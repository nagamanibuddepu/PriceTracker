import { isRedisAvailable, redisConnection, safeRedisGet } from './redis'

export async function isDemoModeEnabled(): Promise<boolean> {
  const redisDemoMode = await safeRedisGet('system:demo_mode')
  if (redisDemoMode !== null) {
    return redisDemoMode === 'true'
  }

  return process.env.DEMO_MODE === 'true'
}

export async function checkRateLimit(
  ip: string,
  action: 'search' | 'chat',
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; currentCount: number }> {
  if (!(await isRedisAvailable())) {
    return { success: true, currentCount: 0 }
  }

  try {
    const key = `ratelimit:${action}:${ip}`
    const currentCount = await redisConnection.incr(key)

    if (currentCount === 1) {
      await redisConnection.expire(key, windowSeconds)
    }

    if (currentCount > limit) {
      return { success: false, currentCount }
    }

    return { success: true, currentCount }
  } catch (error) {
    console.error(`Rate limit check failed for ${action}:`, error)
    return { success: true, currentCount: 0 }
  }
}
