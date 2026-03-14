import { NextResponse } from 'next/server'
import { scrapeQueue } from '@/lib/queue'

export async function GET(
    request: Request,
    { params }: { params: { jobId: string } }
) {
    try {
        const job = await scrapeQueue.getJob(params.jobId)

        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            )
        }

        const state = await job.getState()
        const progress = job.progress

        if (state === 'completed') {
            return NextResponse.json({
                status: 'completed',
                data: job.returnvalue
            })
        }

        if (state === 'failed') {
            return NextResponse.json({
                status: 'failed',
                error: job.failedReason
            })
        }

        return NextResponse.json({
            status: state, // 'waiting', 'active', 'delayed', etc.
            progress
        })
    } catch (error) {
        console.error('API Error checking job status:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
