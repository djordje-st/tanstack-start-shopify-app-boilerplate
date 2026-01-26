import { createMiddleware } from '@tanstack/react-start'
import type { WebhookJobData } from '~/utils/webhooks/queue'
import logger from '~/utils/logger'
import { shopifyApp } from '~/utils/shopify/app'
import {
  getWebhookDelayHours,
  isWebhookProcessed,
  markWebhookProcessed,
} from '~/utils/webhooks/idempotency'
import { webhookQueue } from '~/utils/webhooks/queue'

export interface WebhookContext {
  eventId: string
  webhookId: string
  topic: string
  domain: string
  apiVersion: string
  subTopic?: string
  body: unknown
  triggeredAt: string | null
  receivedAt: string
  isDuplicate: boolean
  delayHours: number | null
  /**
   * Queue the webhook for background processing
   * Call this in the endpoint after any synchronous work
   */
  queueForProcessing: () => Promise<void>
}

/**
 * Webhook middleware that validates and provides context for webhook handlers.
 *
 * Following Shopify best practices:
 * - Uses X-Shopify-Event-Id for duplicate detection
 * - Provides delay information for late webhooks
 * - Offers queueForProcessing() for background execution
 *
 * The endpoint is responsible for:
 * - Calling queueForProcessing() if needed
 * - Returning the response (should be 200 for valid webhooks)
 */
export const webhookMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const eventId = request.headers.get('x-shopify-event-id')
    const triggeredAt = request.headers.get('x-shopify-triggered-at')
    const receivedAt = new Date().toISOString()

    try {
      const rawBody = await request.text()

      const validation = await shopifyApp.webhooks.validate({
        rawBody,
        rawRequest: request,
      })

      if (!validation.valid) {
        logger.warn('[webhook] Invalid webhook signature', {
          type: 'webhook',
          reason: validation.reason,
          domain: request.headers.get('x-shopify-shop-domain'),
        })

        throw new Response('Invalid webhook', { status: 401 })
      }

      const { webhookId, topic, domain, apiVersion, subTopic } = validation

      // Use eventId for duplicate detection, fall back to webhookId
      const idempotencyKey = eventId ?? webhookId
      const isDuplicate = await isWebhookProcessed(idempotencyKey)
      const delayHours = getWebhookDelayHours(triggeredAt, topic, domain)
      const body = rawBody ? JSON.parse(rawBody) : undefined

      const context: WebhookContext = {
        eventId: idempotencyKey,
        webhookId,
        topic,
        domain,
        apiVersion,
        subTopic,
        body,
        triggeredAt,
        receivedAt,
        isDuplicate,
        delayHours,
        queueForProcessing: async () => {
          if (isDuplicate) {
            logger.info('[webhook] Skipping queue - duplicate', {
              type: 'webhook',
              eventId: idempotencyKey,
              topic,
              domain,
            })
            return
          }

          await markWebhookProcessed(idempotencyKey)

          const jobData: WebhookJobData = {
            eventId: idempotencyKey,
            webhookId,
            topic,
            domain,
            apiVersion,
            subTopic,
            body,
            triggeredAt,
            receivedAt,
          }

          await webhookQueue.add(topic, jobData, {
            jobId: idempotencyKey,
          })

          logger.info('[webhook] Queued for processing', {
            type: 'webhook',
            eventId: idempotencyKey,
            topic,
            domain,
          })
        },
      }

      return next({ context })
    } catch (error) {
      if (error instanceof Response) {
        throw error
      }

      logger.error('[webhook] Middleware error', {
        type: 'webhook',
        eventId,
        domain: request.headers.get('x-shopify-shop-domain'),
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new Response('Error processing webhook', { status: 500 })
    }
  }
)
