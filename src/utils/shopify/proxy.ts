import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { shopsTable } from '#/db/schema'
import { addLogContext, serializeError } from '#/utils/logger'
import { getOfflineSessionWithShop } from '#/utils/shopify/auth'
import { shopifyApp } from '#/utils/shopify/app'

export async function verifyShopifyProxyRequest(
  request: Request
): Promise<boolean> {
  try {
    const url = new URL(request.url)

    return await shopifyApp.utils.validateHmac(url.searchParams, {
      signator: 'appProxy',
    })
  } catch (error) {
    addLogContext({
      proxy_validation: 'error',
      proxy_validation_error: serializeError(error),
    })

    return false
  }
}

export async function fetchShopAndSession(shopDomain: string) {
  const validSession = await getOfflineSessionWithShop(shopDomain)

  if (validSession) {
    return validSession
  }

  const [shop] = await db
    .select()
    .from(shopsTable)
    .where(eq(shopsTable.domain, shopDomain))
    .limit(1)

  return {
    shop: shop ?? null,
    session: null,
  }
}

/**
 * Handle errors in proxy endpoint handlers
 * Logs the error and returns a JSON error response
 */
export function handleProxyError(
  error: unknown,
  context: { shop?: { id?: number; domain?: string } }
): Response {
  // If it's already a Response (from middleware), rethrow it
  if (error instanceof Response) {
    throw error
  }

  const serializedError = serializeError(error)

  addLogContext({
    shop_id: context.shop?.id,
    shop_domain: context.shop?.domain,
    proxy_handler_error: serializedError,
  })

  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
