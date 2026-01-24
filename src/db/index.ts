import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'
import { unstorageCache } from 'drizzle-uncache'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

const storage = createStorage({
  // optionally use memory driver for development
  driver: redisDriver({ url: process.env.REDIS_URL }),
})

const cache = unstorageCache({
  storage,
  config: {
    ex: 60 * 1000, // 1 hour
  },
})

export const db = drizzle(pool, {
  schema,
  cache,
})
