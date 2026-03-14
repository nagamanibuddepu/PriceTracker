import dotenv from 'dotenv'
import path from 'path'
// Load .env.local for standard Node environments
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
// Fallback to .env if .env.local is missing
dotenv.config()

import { Worker } from 'bullmq'
import { redisConnection } from '../lib/redis'
import { compareProducts } from '../app/actions'

// NOTE: Since compareProducts has "use server" at the top of actions.ts,
// importing it in a plain Node.js worker script using tsx might cause issues 
// depending on how tsx handles use server directives. If it fails, we will extract it.
// We'll proceed with this and start the worker.

const worker = new Worker(
    'scrape-queue',
    async (job) => {
        const { query } = job.data
        console.log(`[Worker] Starting job ${job.id} for query: "${query}"`)

        // Call the heavy scraping function with progress streaming
        try {
            const results = await compareProducts(query, 1, async (partialData) => {
                await job.updateProgress(partialData)
            })
            console.log(`[Worker] Completed job ${job.id}. Found ${results.length} grouped products.`)
            return results
        } catch (error) {
            console.error(`[Worker] Error in job ${job.id}:`, error)
            throw error // Let BullMQ handle the failure
        }
    },
    {
        connection: redisConnection,
        concurrency: 2, // Process up to 2 jobs concurrently
    }
)

worker.on('ready', () => {
    console.log('[Worker] Started and listening to scrape-queue.')
})

worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err.message)
})
