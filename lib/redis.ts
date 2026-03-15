import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// Create a single redis connection instance to be reused
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redisConnection.on('connect', () => {
  console.log('Successfully connected to Redis')
})
