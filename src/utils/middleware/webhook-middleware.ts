import { createMiddleware } from '@tanstack/react-start'
import type {WebhookJobData} from '~/utils/webhooks/queue';
import logger from '~/utils/logger'
import { shopifyApp } from '~/utils/shopify/app'
import {
  getWebhookDelayHours,
  isWebhookProcessed,
  markWebhookProcessed,
} from '~/utils/webhooks/idempotency'
import {  webhookQueue } from '~/utils/webhooks/queue'

/**
 * Webhook middleware that validates, deduplicates, and queues webhooks for processing.
 *
 * Following Shopify best practices:
 * - Responds with 200 immediately after validation
 * - Uses X-Shopify-Event-Id for duplicate detection
 * - Queues processing for background execution
 * - Logs delayed webhooks (>24h)
 */
export const webhookMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request }) => {
    const eventId = request.headers.get('x-shopify-event-id')
    const triggeredAt = request.headers.get('x-shopify-triggered-at')

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

        return new Response('Invalid webhook', { status: 401 })
      }

      const { webhookId, topic, domain, apiVersion, subTopic } = validation

      // Check for duplicate using eventId (recommended by Shopify)
      // Fall back to webhookId if eventId not available
      const idempotencyKey = eventId ?? webhookId

      if (await isWebhookProcessed(idempotencyKey)) {
        logger.info('[webhook] Duplicate webhook ignored', {
          type: 'webhook',
          eventId,
          webhookId,
          topic,
          domain,
        })

        return new Response('OK', { status: 200 })
      }

      // Log if webhook is significantly delayed
      getWebhookDelayHours(triggeredAt, topic, domain)

      // Mark as processed immediately to prevent duplicates during queue processing
      await markWebhookProcessed(idempotencyKey)

      // Queue for background processing
      const jobData: WebhookJobData = {
        eventId: idempotencyKey,
        webhookId,
        topic,
        domain,
        apiVersion,
        subTopic,
        body: rawBody ? JSON.parse(rawBody) : undefined,
        triggeredAt,
        receivedAt: new Date().toISOString(),
      }

      await webhookQueue.add(topic, jobData, {
        jobId: idempotencyKey,
      })

      logger.info('[webhook] Queued for processing', {
        type: 'webhook',
        eventId,
        webhookId,
        topic,
        domain,
      })

      // Respond immediately per best practices
      return new Response('OK', { status: 200 })
    } catch (error) {
      logger.error('[webhook] Middleware error', {
        type: 'webhook',
        eventId,
        domain: request.headers.get('x-shopify-shop-domain'),
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Return 500 to trigger Shopify retry
      return new Response('Error processing webhook', { status: 500 })
    }
  }
)
