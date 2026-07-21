import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { sessionsTable, shopsTable } from '#/db/schema'
import { addLogContext } from '#/utils/logger'
import { webhookMiddleware } from '#/utils/middleware/webhook-middleware'

/**
 * GDPR compliance webhook endpoint
 * Handles: CUSTOMERS_DATA_REQUEST, CUSTOMERS_REDACT, SHOP_REDACT
 */
export const Route = createFileRoute('/api/webhooks/app/compliance')({
  server: {
    middleware: [webhookMiddleware],
    handlers: {
      POST: async ({ context }) => {
        switch (context.topic) {
          case 'SHOP_REDACT':
            await db
              .delete(sessionsTable)
              .where(eq(sessionsTable.shop, context.domain))
            await db
              .delete(shopsTable)
              .where(eq(shopsTable.domain, context.domain))

            addLogContext({ webhook_action: 'shop_redacted' })
            break

          case 'CUSTOMERS_DATA_REQUEST':
            // Add your logic for customer data requests.
            addLogContext({ webhook_action: 'customer_data_requested' })
            break

          case 'CUSTOMERS_REDACT':
            // Add your logic for customer redaction.
            addLogContext({ webhook_action: 'customer_redacted' })
            break

          default:
            addLogContext({ webhook_action: 'unhandled' })
        }

        return new Response('OK', { status: 200 })
      },
    },
  },
})
