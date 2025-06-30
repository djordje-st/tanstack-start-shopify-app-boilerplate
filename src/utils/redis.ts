import Redis from 'ioredis'
import { logError, logInfo } from '~/utils/logger'

export const redis = new Redis(`${process.env.REDIS_URL!}?family=0`, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
})

redis.on('connect', () => {
  logInfo('Redis connected')
})

redis.on('error', error => {
  logError('Redis connection error:', error)
})
