import { Queue, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { Job } from 'bullmq';
import { db } from '~/db'
import { sessionsTable, shopsTable } from '~/db/schema'
import { redis } from '~/utils/redis'
import logger from '~/utils/logger'
import { createAdminApiGraphqlClient } from '~/utils/shopify/auth'
import { SHOP_QUERY } from '~/graphql/queries'
import { createWebhookWorker } from '~/utils/webhooks/queue'

export interface ReconciliationJobData {
  shopDomain: string
  type: 'shop_data'
}

export const reconciliationQueue = new Queue<ReconciliationJobData>(
  'reconciliation',
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 500,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
      },
    },
  }
)

/**
 * Queue a reconciliation job for a specific shop
 */
export async function queueShopReconciliation(shopDomain: string) {
  await reconciliationQueue.add(
    'shop_data',
    { shopDomain, type: 'shop_data' },
    {
      jobId: `reconcile:${shopDomain}:${Date.now()}`,
    }
  )
}

/**
 * Queue reconciliation jobs for all active shops
 * Call this periodically (e.g., daily via cron)
 */
export async function queueAllShopsReconciliation() {
  const shops = await db.select({ domain: shopsTable.domain }).from(shopsTable)

  logger.info('[reconciliation] Queueing reconciliation for all shops', {
    type: 'reconciliation',
    shopCount: shops.length,
  })

  for (const shop of shops) {
    await queueShopReconciliation(shop.domain)
  }
}

async function reconcileShopData(job: Job<ReconciliationJobData>) {
  const { shopDomain } = job.data

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.shop, shopDomain))
    .limit(1)

  if (!session?.accessToken) {
    logger.warn('[reconciliation] No valid session for shop', {
      type: 'reconciliation',
      shopDomain,
    })
    return
  }

  const client = createAdminApiGraphqlClient(session)
  const shopData = await client.request(SHOP_QUERY)

  if (shopData.errors || !shopData.data?.shop) {
    throw new Error(
      `Failed to fetch shop data: ${shopData.errors?.message ?? 'Unknown error'}`
    )
  }

  await db
    .update(shopsTable)
    .set({
      name: shopData.data.shop.name,
      email: shopData.data.shop.email,
      timezone: shopData.data.shop.ianaTimezone,
      currency: shopData.data.shop.currencyCode,
      plan: shopData.data.shop.plan?.publicDisplayName,
    })
    .where(eq(shopsTable.domain, shopDomain))

  logger.info('[reconciliation] Shop data reconciled', {
    type: 'reconciliation',
    shopDomain,
  })
}

function createReconciliationWorker() {
  const worker = new Worker<ReconciliationJobData>(
    'reconciliation',
    async job => {
      const { shopDomain, type } = job.data

      logger.info('[reconciliation] Processing job', {
        type: 'reconciliation',
        shopDomain,
        jobType: type,
        jobId: job.id,
      })

      switch (type) {
        case 'shop_data':
          await reconcileShopData(job)
          break
        default:
          logger.warn('[reconciliation] Unknown job type', {
            type: 'reconciliation',
            jobType: type,
          })
      }
    },
    {
      connection: redis,
      concurrency: 2,
    }
  )

  worker.on('failed', (job, error) => {
    logger.error('[reconciliation] Job failed', {
      type: 'reconciliation',
      jobId: job?.id,
      shopDomain: job?.data.shopDomain,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    })
  })

  worker.on('error', error => {
    logger.error('[reconciliation] Worker error', {
      type: 'reconciliation',
      error: error.message,
    })
  })

  return worker
}

let workersStarted = false

/**
 * Start all background workers (webhook + reconciliation)
 * Call this manually to begin processing queued jobs
 *
 * Safe to call multiple times - will only start once
 */
export function startWorkers() {
  if (workersStarted) {
    logger.info('[workers] Already started', { type: 'workers' })
    return
  }

  createWebhookWorker()
  createReconciliationWorker()

  workersStarted = true

  logger.info('[workers] Started webhook and reconciliation workers', {
    type: 'workers',
  })
}
