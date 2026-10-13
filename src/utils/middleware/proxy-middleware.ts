import { createMiddleware } from '@tanstack/react-start'
import { addLogContext } from '#/utils/logger'
import { shopifyApp } from '#/utils/shopify/app'
import {
  createAdminApiGraphqlClient,
  getOfflineSessionWithShop,
} from '#/utils/shopify/auth'

async function isValidProxyRequest(
  searchParams: URLSearchParams
): Promise<boolean> {
  try {
    return await shopifyApp.utils.validateHmac(searchParams, {
      signator: 'appProxy',
    })
  } catch {
    return false
  }
}

export const proxyMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ request, next }) => {
    const { searchParams } = new URL(request.url)
    const shopDomain = searchParams.get('shop')

    if (!(await isValidProxyRequest(searchParams))) {
      addLogContext({ rejection_reason: 'invalid_proxy_signature' })

      throw Response.json(
        { error: 'Invalid Shopify proxy request' },
        { status: 401 }
      )
    }

    const result = shopDomain
      ? await getOfflineSessionWithShop(shopDomain)
      : null

    if (!result) {
      addLogContext({
        shop: shopDomain ?? undefined,
        rejection_reason: 'no_session',
      })
      throw Response.json(
        { error: `No valid session for shop: ${shopDomain}` },
        { status: 401 }
      )
    }

    const { session, shop } = result

    addLogContext({ shop: shop.domain, shop_id: shop.id })

    return next({
      context: {
        session,
        shop,
        admin: createAdminApiGraphqlClient(session),
      },
    })
  }
)
