import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { sessionsTable } from '#/db/schema'
import { addLogContext } from '#/utils/logger'
import { webhookMiddleware } from '#/utils/middleware/webhook-middleware'

/**
 * APP_UNINSTALLED webhook endpoint
 * Cleans up sessions when app is uninstalled
 */
export const Route = createFileRoute('/api/webhooks/app/uninstalled')({
  server: {
    middleware: [webhookMiddleware],
    handlers: {
      POST: async ({ context }) => {
        if (context.topic !== 'APP_UNINSTALLED') {
          addLogContext({ webhook_action: 'unhandled' })

          return new Response('OK', { status: 200 })
        }

        await db
          .delete(sessionsTable)
          .where(eq(sessionsTable.shop, context.domain))

        addLogContext({ webhook_action: 'app_uninstalled' })

        return new Response('OK', { status: 200 })
      },
    },
  },
})
