import { eq } from 'drizzle-orm'
import { db } from '~/db'
import { sessionsTable, shopsTable } from '~/db/schema'
import logger from '~/utils/logger'
import { createAdminApiGraphqlClient } from '~/utils/shopify/auth'
import { shopifyApp } from '~/utils/shopify/app'

function searchParamsToQuery(
  searchParams: URLSearchParams
): Record<string, string> {
  const grouped: Record<string, Array<string>> = {}

  searchParams.forEach((value, key) => {
    if (grouped[key]) {
      grouped[key].push(value)
    } else {
      grouped[key] = [value]
    }
  })

  const result: Record<string, string> = {}

  for (const [key, values] of Object.entries(grouped)) {
    result[key] = values.join(',')
  }

  return result
}

export async function verifyShopifyProxyRequest(
  request: Request
): Promise<boolean> {
  try {
    const url = new URL(request.url)
    const query = searchParamsToQuery(url.searchParams)

    return await shopifyApp.utils.validateHmac(query, { signator: 'appProxy' })
  } catch (error) {
    logger.warn('[proxy] HMAC validation failed', {
      type: 'proxy',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return false
  }
}

export async function fetchShopAndSession(shopDomain: string) {
  const result = await db
    .select({
      shop: shopsTable,
      session: sessionsTable,
    })
    .from(shopsTable)
    .leftJoin(sessionsTable, eq(shopsTable.domain, sessionsTable.shop))
    .where(eq(shopsTable.domain, shopDomain))
    .limit(1)

  return {
    shop: result[0]?.shop ?? null,
    session: result[0]?.session ?? null,
  }
}

export function createProxyContext(
  session: NonNullable<Awaited<ReturnType<typeof fetchShopAndSession>>['session']>,
  shop: NonNullable<Awaited<ReturnType<typeof fetchShopAndSession>>['shop']>
) {
  if (!session.accessToken) {
    throw new Error('Session missing access token')
  }

  return {
    session,
    shop,
    admin: createAdminApiGraphqlClient(session),
  }
}

export type ProxyContext = ReturnType<typeof createProxyContext>

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

  const message = error instanceof Error ? error.message : 'Unknown error'

  logger.error('[proxy] Handler error', {
    type: 'proxy',
    shopId: context.shop?.id,
    shopDomain: context.shop?.domain,
    error: message,
  })

  return Response.json({ error: message }, { status: 500 })
}
