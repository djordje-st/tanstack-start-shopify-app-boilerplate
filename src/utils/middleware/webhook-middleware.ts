import { createMiddleware } from '@tanstack/react-start'
import logger from '#/utils/logger'
import { shopifyApp } from '#/utils/shopify/app'

/**
 * Validate the raw webhook body before exposing it to the route handler.
 */
export const webhookMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const webhookId = request.headers.get('x-shopify-webhook-id')

    try {
      const rawBody = await request.text()

      const validation = await shopifyApp.webhooks.validate({
        rawBody,
        rawRequest: {
          method: request.method,
          url: request.url,
          headers: request.headers,
        },
      })

      if (!validation.valid) {
        logger.warn('[webhook] Invalid webhook signature', {
          type: 'webhook',
          reason: validation.reason,
          domain: request.headers.get('x-shopify-shop-domain'),
        })

        throw new Response('Invalid webhook', { status: 401 })
      }

      const { topic, domain } = validation
      const body = rawBody ? JSON.parse(rawBody) : undefined

      return next({
        context: {
          topic,
          domain,
          body,
        },
      })
    } catch (error) {
      if (error instanceof Response) {
        throw error
      }

      logger.error('[webhook] Middleware error', {
        type: 'webhook',
        webhookId,
        domain: request.headers.get('x-shopify-shop-domain'),
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new Response('Error processing webhook', { status: 500 })
    }
  }
)
