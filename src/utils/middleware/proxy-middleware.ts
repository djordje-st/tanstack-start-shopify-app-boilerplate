import crypto from 'node:crypto'
import { createMiddleware } from '@tanstack/react-start'
import logger from '~/utils/logger'
import {
  createProxyContext,
  fetchShopAndSession,
  verifyShopifyProxyRequest,
} from '~/utils/shopify/proxy'

/**
 * Creates an error response with proper status code
 */
function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Validates and retrieves shop/session context from shop domain
 * @throws Response with appropriate status code on error
 */
async function validateAndGetContext(shopDomain: string | null) {
  if (!shopDomain) {
    throw createErrorResponse('Missing shop parameter', 400)
  }

  const { shop, session } = await fetchShopAndSession(shopDomain)

  if (!shop) {
    throw createErrorResponse(`Shop not found: ${shopDomain}`, 404)
  }

  if (!session?.accessToken) {
    throw createErrorResponse(
      `No valid session found for shop: ${shopDomain}`,
      401
    )
  }

  return createProxyContext(session, shop)
}

/**
 * Proxy authentication middleware for Shopify app proxy requests
 * Verifies HMAC signature and provides shop/session context
 */
export const proxyMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const url = new URL(request.url)

    // Verify Shopify proxy signature
    if (!verifyShopifyProxyRequest(request)) {
      logger.warn('Invalid proxy signature', { url: url.pathname })
      throw createErrorResponse('Invalid Shopify proxy request', 401)
    }

    try {
      const context = await validateAndGetContext(url.searchParams.get('shop'))
      return next({ context })
    } catch (error) {
      if (error instanceof Response) {
        throw error
      }

      logger.error('Proxy middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw createErrorResponse('Internal server error', 500)
    }
  }
)

// Webhook context type
type WebhookContext = {
  valid: boolean
  shopDomain: string | null
  webhookTopic: string | null
  body: unknown
}

/**
 * Webhook verification middleware for Shopify webhook requests
 * Verifies HMAC-SHA256 signature and provides webhook context
 * Reads and parses the request body, making it available in context
 */
export const webhookMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    try {
      const shopifyHmac = request.headers.get('x-shopify-hmac-sha256')

      if (!shopifyHmac) {
        throw new Error('Invalid Shopify webhook: Missing HMAC header')
      }

      // Read request body as raw bytes (can only be read once)
      const arrayBuffer = await request.arrayBuffer()
      const bodyBuffer = Buffer.from(arrayBuffer)
      const bodyText = bodyBuffer.toString('utf8')

      // Calculate expected HMAC
      const webhookSecret = process.env.SHOPIFY_API_SECRET

      if (!webhookSecret) {
        throw new Error(
          'SHOPIFY_APP_WEBHOOK_SECRET or SHOPIFY_API_SECRET not configured'
        )
      }

      const calculatedHmacDigest = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyBuffer)
        .digest()

      const receivedHmacDigest = Buffer.from(shopifyHmac, 'base64')

      // Verify signature using timing-safe comparison
      const valid =
        receivedHmacDigest.length === calculatedHmacDigest.length &&
        crypto.timingSafeEqual(receivedHmacDigest, calculatedHmacDigest)

      if (!valid) {
        throw new Error('Invalid Shopify webhook: HMAC verification failed')
      }

      // Extract webhook metadata from headers
      const shopDomain = request.headers.get('x-shopify-shop-domain')
      const webhookTopic = request.headers.get('x-shopify-topic')

      // Parse body JSON if body exists
      let parsedBody: unknown = undefined

      if (bodyText) {
        try {
          parsedBody = JSON.parse(bodyText)
        } catch {
          // If parsing fails, keep body as string
          parsedBody = bodyText
        }
      }

      const context: WebhookContext = {
        valid: true,
        shopDomain,
        webhookTopic,
        body: parsedBody,
      }

      return next({ context })
    } catch (error) {
      logger.error('Webhook middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }
)
