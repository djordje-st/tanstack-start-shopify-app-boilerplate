import Redis from 'ioredis'
import logger from '~/utils/logger'

export const redis = new Redis(`${process.env.REDIS_URL!}?family=0`, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
})

redis.on('connect', () => {
  logger.info('[redis] Connected', {
    type: 'redis',
  })
})

redis.on('error', error => {
  logger.error('[redis] Connection error', {
    type: 'redis',
    error: error instanceof Error ? error.message : 'Unknown error',
  })
})
