import { createMiddleware } from '@tanstack/react-start'
import { addLogContext } from '#/utils/logger'
import { shopifyApp } from '#/utils/shopify/app'

/**
 * Validate the raw webhook body before exposing it to the route handler.
 */
export const webhookMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
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
      addLogContext({ rejection_reason: validation.reason })

      throw new Response('Invalid webhook', { status: 401 })
    }

    const { topic, domain } = validation

    addLogContext({ shop: domain, webhook_topic: topic })

    return next({
      context: {
        topic,
        domain,
        body: rawBody ? JSON.parse(rawBody) : undefined,
      },
    })
  }
)
