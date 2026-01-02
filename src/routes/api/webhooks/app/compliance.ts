import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '~/db'
import { sessions, shops } from '~/db/schema'
import logger from '~/utils/logger'
import { webhookMiddleware } from '~/utils/middleware/proxy-middleware'
import {
  checkWebhookDelay,
  isWebhookProcessed,
  markWebhookProcessed,
} from '~/utils/webhooks/idempotency'

export const Route = createFileRoute('/api/webhooks/app/compliance')({
  server: {
    middleware: [webhookMiddleware],
    handlers: {
      POST: async ({ context }) => {
        try {
          const { valid, shopDomain, webhookTopic, webhookId, triggeredAt } =
            context

          if (!valid || !shopDomain || !webhookTopic) {
            logger.error('Invalid compliance webhook', {
              shopDomain,
              webhookTopic,
            })

            return new Response('Invalid webhook', { status: 401 })
          }

          // Check for duplicate webhook processing
          if (webhookId && (await isWebhookProcessed(webhookId))) {
            logger.info('Duplicate webhook ignored', {
              webhookId,
              webhookTopic,
              shopDomain,
            })

            return new Response('OK', { status: 200 })
          }

          // Check for delayed webhooks (logs warning if >24 hours old)
          checkWebhookDelay(triggeredAt, webhookTopic, shopDomain)

          switch (webhookTopic) {
            case 'customers/data_request':
              return new Response('No customer data stored', { status: 200 })
            case 'customers/redact':
              return new Response('No customer data stored', { status: 200 })
            case 'shop/redact':
              await db.delete(sessions).where(eq(sessions.shop, shopDomain))
              await db.delete(shops).where(eq(shops.domain, shopDomain))

              logger.info('WEBHOOK shop/redact completed', {
                shopDomain,
                webhookTopic,
              })

              // Mark webhook as processed for idempotency
              if (webhookId) {
                await markWebhookProcessed(webhookId)
              }

              return new Response('No shop data stored', { status: 200 })
            default:
              logger.warn('WEBHOOK unhandled topic', {
                shopDomain,
                webhookTopic,
              })
              return new Response('OK', { status: 200 })
          }
        } catch (e) {
          logger.error('Webhook processing failed', {
            error: e instanceof Error ? e.message : 'Unknown error',
          })

          // Return 401 for authentication failures, 500 for other errors
          const status =
            e instanceof Error && e.message.includes('Invalid Shopify webhook')
              ? 401
              : 500

          return new Response('Error processing webhook', { status })
        }
      },
    },
  },
})
