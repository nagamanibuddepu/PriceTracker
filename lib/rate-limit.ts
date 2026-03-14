import { redisConnection } from './redis'

export async function isDemoModeEnabled(): Promise<boolean> {
  // First check if there is an override in Redis from the admin endpoint
  try {
    const redisDemoMode = await redisConnection.get('system:demo_mode')
    if (redisDemoMode !== null) {
      return redisDemoMode === 'true'
    }
  } catch (error) {
    console.error('Failed to get demo mode from Redis:', error)
  }

  // Fallback to environment variable
  return process.env.DEMO_MODE === 'true'
}

export async function checkRateLimit(
  ip: string,
  action: 'search' | 'chat',
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; currentCount: number }> {
  try {
    const key = `ratelimit:${action}:${ip}`
    const currentCount = await redisConnection.incr(key)

    if (currentCount === 1) {
      // Set expiration only on the first increment
      await redisConnection.expire(key, windowSeconds)
    }

    // Return the status correctly based on if it's over the limit
    if (currentCount > limit) {
      return { success: false, currentCount }
    }

    return { success: true, currentCount }
  } catch (error) {
    console.error(`Rate limit check failed for ${action}:`, error)
    // Fail open in case Redis is down
    return { success: true, currentCount: 0 }
  }
}
