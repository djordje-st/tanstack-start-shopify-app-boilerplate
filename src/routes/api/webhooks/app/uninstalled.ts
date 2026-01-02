import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '~/db'
import { sessions } from '~/db/schema'
import logger from '~/utils/logger'
import { webhookMiddleware } from '~/utils/middleware/proxy-middleware'
import {
  checkWebhookDelay,
  isWebhookProcessed,
  markWebhookProcessed,
} from '~/utils/webhooks/idempotency'

export const Route = createFileRoute('/api/webhooks/app/uninstalled')({
  server: {
    middleware: [webhookMiddleware],
    handlers: {
      POST: async ({ context }) => {
        try {
          const { valid, shopDomain, webhookId, webhookTopic, triggeredAt } =
            context

          if (!valid || !shopDomain) {
            logger.error('WEBHOOK app_uninstalled invalid', {
              shopDomain,
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

          logger.info('WEBHOOK app_uninstalled received', {
            shopDomain,
          })

          // Delete all sessions for the uninstalled shop
          await db.delete(sessions).where(eq(sessions.shop, shopDomain))

          // Mark webhook as processed for idempotency
          if (webhookId) {
            await markWebhookProcessed(webhookId)
          }

          return new Response('OK', { status: 200 })
        } catch (e) {
          logger.error('WEBHOOK app_uninstalled processing failed', {
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
