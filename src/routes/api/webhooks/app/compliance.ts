import { createServerFileRoute } from '@tanstack/react-start/server'
import { logInfo, logError } from '~/utils/logger'
import { shopifyApp } from '~/utils/shopify-app'

export const ServerRoute = createServerFileRoute(
  '/api/webhooks/app/compliance'
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

      logInfo(`Received ${webhook.topic} webhook for ${webhook.domain}`)

      switch (webhook.topic) {
        case 'CUSTOMERS_DATA_REQUEST':
          // Handle data request
          return new Response('No customer data stored', { status: 200 })

        case 'CUSTOMERS_REDACT':
          // Handle customer redact
          return new Response('No customer data stored', { status: 200 })

        case 'SHOP_REDACT':
          // Handle shop redact
          return new Response('No shop data stored', { status: 200 })

        default:
          logInfo(`Unhandled compliance webhook topic: ${webhook.topic}`)

          return new Response('Unhandled compliance webhook topic', {
            status: 400,
          })
      }
    } catch (error) {
      logError('❌ Webhook processing failed:', error)

      // Return 401 for authentication failures, 500 for other errors
      const status =
        error instanceof Error &&
        error.message.includes('Invalid Shopify webhook')
          ? 401
          : 500

      return new Response('Error processing webhook', { status })
    }
  },
})
