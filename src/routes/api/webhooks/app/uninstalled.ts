import { createServerFileRoute } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '~/db'
import { sessions } from '~/db/schema'
import { logInfo, logError } from '~/utils/logger'
import { shopifyApp } from '~/utils/shopify-app'

export const ServerRoute = createServerFileRoute(
  '/api/webhooks/app/uninstalled'
).methods({
  POST: async ({ request }) => {
    try {
      const webhook = await shopifyApp.webhooks.validate({
        rawBody: await request.text(),
        rawRequest: request,
      })

      if (!webhook.valid) {
        return new Response('Invalid webhook', { status: 401 })
      }

      logInfo(`Received app_uninstalled webhook for ${webhook.domain}`)

      // Delete all sessions for the uninstalled shop
      await db.delete(sessions).where(eq(sessions.shop, webhook.domain))

      return new Response('OK', { status: 200 })
    } catch (e) {
      logError('❌ Webhook processing failed:', e)

      // Return 401 for authentication failures, 500 for other errors
      const status =
        e instanceof Error && e.message.includes('Invalid Shopify webhook')
          ? 401
          : 500

      return new Response('Error processing webhook', { status })
    }
  },
})
