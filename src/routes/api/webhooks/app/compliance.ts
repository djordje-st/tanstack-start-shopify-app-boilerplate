import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { sessionsTable, shopsTable } from '#/db/schema'
import logger from '#/utils/logger'
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

            logger.info('[webhook] Shop redacted, all data deleted', {
              type: 'webhook',
              domain: context.domain,
            })
            break

          case 'CUSTOMERS_DATA_REQUEST':
            // Add your logic for customer data requests.
            logger.info('[webhook] Customer data request', {
              type: 'webhook',
              domain: context.domain,
            })
            break

          case 'CUSTOMERS_REDACT':
            // Add your logic for customer redaction.
            logger.info('[webhook] Customer redact', {
              type: 'webhook',
              domain: context.domain,
            })
            break

          default:
            logger.warn('[webhook] Unhandled topic', {
              type: 'webhook',
              topic: context.topic,
              domain: context.domain,
            })
        }

        return new Response('OK', { status: 200 })
      },
    },
  },
})
