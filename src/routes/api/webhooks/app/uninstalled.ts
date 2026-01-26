import { createFileRoute } from '@tanstack/react-router'
import { webhookMiddleware } from '~/utils/middleware/webhook-middleware'

/**
 * APP_UNINSTALLED webhook endpoint
 * Cleans up sessions when app is uninstalled
 */
export const Route = createFileRoute('/api/webhooks/app/uninstalled')({
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
