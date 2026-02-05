import { Queue, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { Job } from 'bullmq'
import { db } from '~/db'
import { sessionsTable, shopsTable } from '~/db/schema'
import { redis } from '~/utils/redis'
import logger from '~/utils/logger'

export interface WebhookJobData {
  eventId: string
  webhookId: string
  topic: string
  domain: string
  apiVersion: string
  subTopic?: string
  body: unknown
  triggeredAt: string | null
  receivedAt: string
}

export const webhookQueue = new Queue<WebhookJobData>('webhooks', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // 7 days
    },
  },
})

/**
 * Process webhook based on topic
 * Webhook subscriptions are defined in app.toml
 */
async function processWebhook(job: Job<WebhookJobData>) {
  const { topic, domain } = job.data

  switch (topic) {
    case 'APP_UNINSTALLED':
      await db.delete(sessionsTable).where(eq(sessionsTable.shop, domain))

      logger.info('[webhook] App uninstalled, sessions deleted', {
        type: 'webhook',
        domain,
      })

      break

    case 'SHOP_REDACT':
      await db.delete(sessionsTable).where(eq(sessionsTable.shop, domain))
      await db.delete(shopsTable).where(eq(shopsTable.domain, domain))

      logger.info('[webhook] Shop redacted, all data deleted', {
        type: 'webhook',
        domain,
      })

      break

    case 'CUSTOMERS_DATA_REQUEST':
      // add your logic for customer data request

      logger.info('[webhook] Customer data request', {
        type: 'webhook',
        domain,
      })

      break

    case 'CUSTOMERS_REDACT':
      // add your logic for customer redact

      logger.info('[webhook] Customer redact', {
        type: 'webhook',
        domain,
      })

      break

    default:
      logger.warn('[webhook] Unhandled topic', {
        type: 'webhook',
        topic,
        domain,
      })
  }
}

export function createWebhookWorker() {
  const worker = new Worker<WebhookJobData>(
    'webhooks',
    async job => {
      const { topic, domain, eventId } = job.data

      logger.info('[webhook-worker] Processing', {
        type: 'webhook',
        topic,
        domain,
        eventId,
        jobId: job.id,
      })

      await processWebhook(job)

      logger.info('[webhook-worker] Completed', {
        type: 'webhook',
        topic,
        domain,
        eventId,
        jobId: job.id,
      })
    },
    {
      connection: redis,
      concurrency: 5,
    }
  )

  worker.on('failed', (job, error) => {
    logger.error('[webhook-worker] Job failed', {
      type: 'webhook',
      jobId: job?.id,
      topic: job?.data.topic,
      domain: job?.data.domain,
      eventId: job?.data.eventId,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    })
  })

  worker.on('error', error => {
    logger.error('[webhook-worker] Worker error', {
      type: 'webhook',
      error: error.message,
    })
  })

  return worker
}
