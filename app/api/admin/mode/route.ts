import { NextResponse } from 'next/server'
import { redisConnection } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const adminKey = req.headers.get('x-admin-key')
  
  if (!process.env.ADMIN_API_KEY || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { mode } = await req.json()
    
    if (mode === 'demo') {
      await redisConnection.set('system:demo_mode', 'true')
      return NextResponse.json({ message: 'Demo mode enabled' })
    } else if (mode === 'production') {
      await redisConnection.set('system:demo_mode', 'false')
      return NextResponse.json({ message: 'Production mode enabled' })
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }
  } catch (error) {
    console.error('Failed to update system mode:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
