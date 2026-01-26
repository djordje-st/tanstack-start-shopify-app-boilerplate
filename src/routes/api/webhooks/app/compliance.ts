import { createFileRoute } from '@tanstack/react-router'
import { webhookMiddleware } from '~/utils/middleware/webhook-middleware'

/**
 * GDPR compliance webhook endpoint
 * Handles: CUSTOMERS_DATA_REQUEST, CUSTOMERS_REDACT, SHOP_REDACT
 */
export const Route = createFileRoute('/api/webhooks/app/compliance')({
  server: {
    middleware: [webhookMiddleware],
    handlers: {
      POST: async ({ context }) => {
        if (context.isDuplicate) {
          return new Response('OK', { status: 200 })
        }

        await context.queueForProcessing()

        return new Response('OK', { status: 200 })
      },
    },
  },
})
