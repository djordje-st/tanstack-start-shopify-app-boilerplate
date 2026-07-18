import { createMiddleware } from '@tanstack/react-start'
import logger from '#/utils/logger'
import { createAdminApiGraphqlClient } from '#/utils/shopify/auth'
import {
  fetchShopAndSession,
  verifyShopifyProxyRequest,
} from '#/utils/shopify/proxy'

export const proxyMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const url = new URL(request.url)
    const shopDomain = url.searchParams.get('shop')

    if (!(await verifyShopifyProxyRequest(request))) {
      logger.warn('[proxy] Invalid proxy signature', {
        type: 'proxy',
        shopDomain,
        path: url.pathname,
      })

      throw Response.json(
        { error: 'Invalid Shopify proxy request' },
        { status: 401 }
      )
    }

    if (!shopDomain) {
      throw Response.json({ error: 'Missing shop parameter' }, { status: 400 })
    }

    try {
      const { shop, session } = await fetchShopAndSession(shopDomain)

      if (!shop) {
        throw Response.json(
          { error: `Shop not found: ${shopDomain}` },
          { status: 404 }
        )
      }

      if (!session?.accessToken) {
        throw Response.json(
          { error: `No valid session for shop: ${shopDomain}` },
          { status: 401 }
        )
      }

      return next({
        context: {
          session,
          shop,
          admin: createAdminApiGraphqlClient(session),
        },
      })
    } catch (error) {
      if (error instanceof Response) {
        throw error
      }

      logger.error('[proxy] Middleware error', {
        type: 'proxy',
        shopDomain,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
)
