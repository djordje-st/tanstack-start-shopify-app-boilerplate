import { createFileRoute } from '@tanstack/react-router'
import { webhookMiddleware } from '~/utils/middleware/webhook-middleware'

/**
 * APP_UNINSTALLED webhook endpoint
 * The middleware handles validation, idempotency, and queuing.
 * Actual processing happens in the webhook worker.
 */
export const Route = createFileRoute('/api/webhooks/app/uninstalled')({
  server: {
    middleware: [webhookMiddleware],
  },
})
