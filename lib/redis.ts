import Redis from 'ioredis'

function resolveRedisUrl(rawUrl: string): { url: string; useTls: boolean } {
  const url = rawUrl || 'redis://localhost:6379'

  try {
    const parsed = new URL(url)
    const isUpstash = parsed.hostname.endsWith('.upstash.io')

    // Upstash requires TLS; redis:// causes read ECONNRESET
    if (isUpstash && parsed.protocol === 'redis:') {
      parsed.protocol = 'rediss:'
      console.warn('[REDIS] Upstash host detected — use rediss:// in REDIS_URL (auto-upgraded for this session)')
      return { url: parsed.toString(), useTls: true }
    }

    return { url, useTls: parsed.protocol === 'rediss:' }
  } catch {
    return { url, useTls: url.startsWith('rediss://') }
  }
}

const { url: redisUrl, useTls } = resolveRedisUrl(process.env.REDIS_URL || '')

const globalForRedis = global as typeof globalThis & {
  _redisConnection?: Redis
}

function createRedisConnection(): Redis {
  const connection = new Redis(redisUrl, {
    lazyConnect: true,
    // BullMQ requires null; low values cause MaxRetriesPerRequestError during reconnects
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    commandTimeout: 5000,
    ...(useTls ? { tls: {} } : {}),
    retryStrategy(times) {
      if (times > 3) return null
      return Math.min(times * 200, 2000)
    },
    enableReadyCheck: false,
  })

  connection.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[REDIS] connection warning:', err.message)
    }
  })

  connection.on('connect', () => {
    console.log('[REDIS] connected')
  })

  connection.on('reconnecting', () => {
    console.warn('[REDIS] reconnecting...')
  })

  return connection
}

export const redisConnection =
  globalForRedis._redisConnection ?? createRedisConnection()

if (process.env.NODE_ENV !== 'production') {
  globalForRedis._redisConnection = redisConnection
}

let redisAvailableCache: boolean | null = null
let lastRedisCheck = 0
const REDIS_CHECK_INTERVAL = 30000 // 30 seconds

export async function isRedisAvailable(): Promise<boolean> {
  const now = Date.now()
  if (redisAvailableCache !== null && now - lastRedisCheck < REDIS_CHECK_INTERVAL) {
    return redisAvailableCache
  }

  try {
    if (redisConnection.status === 'end') {
      redisAvailableCache = false
      lastRedisCheck = now
      return false
    }

    if (redisConnection.status === 'wait') {
      await Promise.race([
        redisConnection.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis connect timeout')), 2000)
        ),
      ])
    }

    await Promise.race([
      redisConnection.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
      ),
    ])

    redisAvailableCache = true
    lastRedisCheck = now
    return true
  } catch {
    redisAvailableCache = false
    lastRedisCheck = now
    return false
  }
}

export async function safeRedisGet(key: string): Promise<string | null> {
  if (!(await isRedisAvailable())) {
    return null
  }

  try {
    return await redisConnection.get(key)
  } catch {
    redisAvailableCache = false
    return null
  }
}
