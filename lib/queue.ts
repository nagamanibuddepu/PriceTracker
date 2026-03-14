import { Queue } from 'bullmq'
import { redisConnection } from './redis'

// Initialize the queue using the shared redis connection
export const scrapeQueue = new Queue('scrape-queue', {
    connection: redisConnection,
})

/**
 * Enqueues a scraping job for a specific search query.
 * @param query The search query to scrape for
 * @returns The created job
 */
export async function enqueueScrapeJob(query: string) {
    // Add job to the queue, using query as the job name or passing in data
    const job = await scrapeQueue.add('scrape', { query }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: {
            age: 3600, // keep up to 1 hour
            count: 100 // keep up to 100 jobs
        },
        removeOnFail: {
            age: 24 * 3600 // keep up to 24 hours
        },
    })
    return job
}
