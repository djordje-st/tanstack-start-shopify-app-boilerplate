import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { AdminApiClient } from '@shopify/admin-api-client'
import type { SelectSession, SelectShop } from '~/db/schema'
import { db } from '~/db'
import { sessions, shops } from '~/db/schema'
import logger from '~/utils/logger'
import { createGraphqlClient } from '~/utils/shopify/graphql-client'

/**
 * Parses query string into a map handling multiple values per key
 * URLSearchParams.entries() only returns one value per key, so we need custom parsing
 */
function parseQueryParams(
  searchParams: URLSearchParams
): Map<string, Array<string>> {
  const params = new Map<string, Array<string>>()

  searchParams.forEach((value, key) => {
    const existing = params.get(key)

    if (existing) {
      existing.push(value)
    } else {
      params.set(key, [value])
    }
  })

  return params
}

/**
 * Verify that the request came from Shopify using HMAC-SHA256 signature
 * Based on: https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
 */
export function verifyShopifyProxyRequest(request: Request): boolean {
  const url = new URL(request.url)
  const params = parseQueryParams(url.searchParams)

  // Get the signature from the request
  const signatureArr = params.get('signature')
  const signature = signatureArr?.[0]

  if (!signature) {
    return false
  }

  // Use the app's client secret (same as API secret)
  const clientSecret = process.env.SHOPIFY_API_SECRET

  if (!clientSecret) {
    logger.error('SHOPIFY_API_SECRET not configured')
    return false
  }

  // Remove the signature from params for verification
  params.delete('signature')

  // Sort parameters alphabetically and concatenate WITHOUT '&' separator
  // Multiple values for same key are joined with comma
  // Format: key1=value1key2=value2,value3key3=value4
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => `${key}=${values.join(',')}`)
    .join('')

  // Calculate expected signature
  const expectedSignature = createHmac('sha256', clientSecret)
    .update(sortedParams)
    .digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    // If buffers have different lengths, timingSafeEqual throws
    return false
  }
}

/**
 * Fetches shop and session data from database with caching
 */
export async function fetchShopAndSession(shopDomain: string) {
  const result = await db
    .select({
      shop: shops,
      session: sessions,
    })
    .from(shops)
    .leftJoin(sessions, eq(shops.domain, sessions.shop))
    .where(eq(shops.domain, shopDomain))
    .limit(1)

  return {
    shop: result[0]?.shop ?? null,
    session: result[0]?.session ?? null,
  }
}

// Enhanced context type with better type safety
export type ProxyContext = {
  session: SelectSession
  shop: SelectShop
  graphql: AdminApiClient
}

/**
 * Creates proxy context from session and shop data
 */
export function createProxyContext(
  session: SelectSession,
  shop: SelectShop
): ProxyContext {
  if (!session.accessToken) {
    throw new Error('Session missing access token')
  }

  const graphql = createGraphqlClient(shop, session)

  return {
    session,
    shop,
    graphql,
  }
}
