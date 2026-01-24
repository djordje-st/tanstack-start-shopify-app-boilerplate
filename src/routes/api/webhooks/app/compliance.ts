import { createFileRoute } from '@tanstack/react-router'
import { webhookMiddleware } from '~/utils/middleware/webhook-middleware'

/**
 * GDPR compliance webhook endpoint
 * Handles: CUSTOMERS_DATA_REQUEST, CUSTOMERS_REDACT, SHOP_REDACT
 * The middleware handles validation, idempotency, and queuing.
 * Actual processing happens in the webhook worker.
 */
export const Route = createFileRoute('/api/webhooks/app/compliance')({
  server: {
    middleware: [webhookMiddleware],
  },
})
