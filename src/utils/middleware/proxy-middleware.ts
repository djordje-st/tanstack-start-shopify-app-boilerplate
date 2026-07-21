import { createMiddleware } from '@tanstack/react-start'
import { addLogContext, serializeError } from '#/utils/logger'
import { createAdminApiGraphqlClient } from '#/utils/shopify/auth'
import {
  fetchShopAndSession,
  verifyShopifyProxyRequest,
} from '#/utils/shopify/proxy'

export const proxyMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const url = new URL(request.url)
    const shopDomain = url.searchParams.get('shop')
    addLogContext({ shop_domain: shopDomain, request_type: 'app_proxy' })

    if (!(await verifyShopifyProxyRequest(request))) {
      addLogContext({
        proxy_validation: 'invalid',
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

      addLogContext({
        proxy_validation: 'valid',
        shop_id: shop.id,
        shop_domain: shop.domain,
        shop_plan: shop.plan,
        shop_currency: shop.currency,
      })

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

      addLogContext({
        proxy_error: serializeError(error),
      })

      throw Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
)
