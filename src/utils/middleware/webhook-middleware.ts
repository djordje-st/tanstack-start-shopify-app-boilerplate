import { createMiddleware } from '@tanstack/react-start'
import { addLogContext, serializeError } from '#/utils/logger'
import { shopifyApp } from '#/utils/shopify/app'

/**
 * Validate the raw webhook body before exposing it to the route handler.
 */
export const webhookMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const webhookId = request.headers.get('x-shopify-webhook-id')

    addLogContext({
      shopify_webhook_id: webhookId,
      shop_domain: request.headers.get('x-shopify-shop-domain'),
      shopify_topic: request.headers.get('x-shopify-topic'),
    })

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
        addLogContext({
          webhook_validation: 'invalid',
          webhook_validation_reason: validation.reason,
        })

        throw new Response('Invalid webhook', { status: 401 })
      }

      const { topic, domain } = validation
      const body = rawBody ? JSON.parse(rawBody) : undefined

      addLogContext({
        webhook_validation: 'valid',
        shopify_topic: topic,
        shop_domain: domain,
      })

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

      addLogContext({
        webhook_validation: 'error',
        webhook_error: serializeError(error),
      })

      throw new Response('Error processing webhook', { status: 500 })
    }
  }
)
