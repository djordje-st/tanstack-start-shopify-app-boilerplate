import { AuthScopes, Session } from '@shopify/shopify-api'
import { redirect } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import type { SelectSession, SelectShop } from '~/db/schema'
import { db } from '~/db'
import { sessionsTable, shopsTable } from '~/db/schema'
import logger from '~/utils/logger'
import { apiVersion, shopifyApp } from '~/utils/shopify/app'
import { SHOP_QUERY } from '~/graphql/admin/queries'

/**
 * In-memory lock map to prevent concurrent token exchanges for the same shop.
 * When multiple parallel requests arrive for the same shop, only the first one
 * performs the token exchange while others wait for it to complete.
 */
const tokenExchangeLocks = new Map<
  string,
  Promise<{
    session: SelectSession
    shop: SelectShop
  }>
>()

/**
 * Execute a function with a per-shop lock to prevent race conditions
 * during token exchange. If a lock exists for the shop, wait for it
 * to complete and return the result.
 */
export async function withTokenExchangeLock(
  shopDomain: string,
  fn: () => Promise<{ session: SelectSession; shop: SelectShop }>
): Promise<{ session: SelectSession; shop: SelectShop }> {
  const existingLock = tokenExchangeLocks.get(shopDomain)

  if (existingLock) {
    logger.debug('[auth] Waiting for existing token exchange to complete', {
      type: 'auth',
      shop: shopDomain,
    })

    try {
      // Wait for the existing token exchange to complete
      return await existingLock
    } catch {
      // If the existing exchange failed, we'll try again below
      // by checking if a new lock was set or proceeding with our own
      const newLock = tokenExchangeLocks.get(shopDomain)

      if (newLock && newLock !== existingLock) {
        return await newLock
      }
    }
  }

  // Create a new lock promise
  const lockPromise = fn()
  tokenExchangeLocks.set(shopDomain, lockPromise)

  try {
    const result = await lockPromise

    return result
  } finally {
    // Only delete if it's still our lock (another request might have set a new one)
    if (tokenExchangeLocks.get(shopDomain) === lockPromise) {
      tokenExchangeLocks.delete(shopDomain)
    }
  }
}

export const AUTH_HEADERS = {
  REAUTH_URL: 'X-Shopify-API-Request-Failure-Reauthorize-Url',
  RETRY_INVALID_SESSION: 'X-Shopify-Retry-Invalid-Session-Request',
} as const

/**
 * Handle CORS preflight OPTIONS requests
 */
export function handleOptionsRequest(
  request: Request,
  additionalHeaders: Array<string> = []
): void {
  if (request.method !== 'OPTIONS') {
    return
  }

  const corsHeaders = new Set([
    'Authorization',
    'Content-Type',
    ...additionalHeaders,
  ])

  throw new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': [...corsHeaders].join(', '),
      'Access-Control-Expose-Headers': AUTH_HEADERS.REAUTH_URL,
      'Access-Control-Max-Age': '7200',
    },
  })
}

/**
 * Add CORS headers to a response for cross-origin requests
 */
export function addCorsHeaders(
  response: Response,
  request: Request,
  additionalHeaders: Array<string> = []
): Response {
  const origin = request.headers.get('Origin')
  const appUrl = shopifyApp.config.hostName

  if (!origin || origin.includes(appUrl)) {
    return response
  }

  const corsHeaders = new Set([
    'Authorization',
    'Content-Type',
    ...additionalHeaders,
  ])

  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set(
    'Access-Control-Allow-Headers',
    [...corsHeaders].join(', ')
  )
  response.headers.set('Access-Control-Expose-Headers', AUTH_HEADERS.REAUTH_URL)

  return response
}

/**
 * Add security headers for document responses in embedded apps
 */
export function addDocumentHeaders(
  headers: Headers,
  shopDomain?: string
): void {
  const cdnUrl = 'https://cdn.shopify.com'
  const appBridgeUrl = 'https://cdn.shopify.com/shopifycloud/app-bridge.js'

  if (shopDomain) {
    headers.set(
      'Link',
      `<${cdnUrl}>; rel="preconnect", <${appBridgeUrl}>; rel="preload"; as="script"`
    )
    headers.set(
      'Content-Security-Policy',
      `frame-ancestors https://${shopDomain} https://admin.shopify.com https://*.spin.dev;`
    )
  } else {
    headers.set('Content-Security-Policy', `frame-ancestors 'none';`)
  }
}

/**
 * Extract session token from Authorization header
 */
export function getSessionTokenFromHeader(request: Request): string | null {
  return request.headers.get('authorization')?.replace('Bearer ', '') ?? null
}

/**
 * Extract session token from URL parameter
 */
export function getSessionTokenFromUrl(request: Request): string | null {
  const url = new URL(request.url)

  return url.searchParams.get('id_token')
}

/**
 * Get session token from request (header first, then URL param)
 */
export function getSessionToken(request: Request): string | null {
  return getSessionTokenFromHeader(request) ?? getSessionTokenFromUrl(request)
}

/**
 * Get shop domain from request URL
 */
export function getShopFromRequest(request: Request): string | null {
  const url = new URL(request.url)

  return url.searchParams.get('shop')
}

/**
 * Determine if request is a document request vs fetch request
 */
export function isDocumentRequest(request: Request): boolean {
  return !request.headers.get('authorization')
}

/**
 * Redirect to session token bounce page for document requests
 */
export function redirectToBouncePage(request: Request): never {
  const url = new URL(request.url)
  const searchParams = new URLSearchParams(url.search)

  searchParams.delete('id_token')

  const reloadParams = searchParams.toString()
  const reloadPath = reloadParams
    ? `${url.pathname}?${reloadParams}`
    : url.pathname

  searchParams.set('shopify-reload', reloadPath)

  throw redirect({
    to: '/session-token-bounce',
    search: Object.fromEntries(searchParams.entries()),
  })
}

/**
 * Respond with 401 for invalid session token
 */
export function respondToInvalidSessionToken(
  request: Request,
  options: { retryRequest?: boolean } = {}
): never {
  const { retryRequest = true } = options

  if (isDocumentRequest(request)) {
    redirectToBouncePage(request)
  }

  throw new Response(undefined, {
    status: 401,
    statusText: 'Unauthorized',
    headers: retryRequest
      ? { [AUTH_HEADERS.RETRY_INVALID_SESSION]: '1' }
      : undefined,
  })
}

export function createAdminApiGraphqlClient(session: Session | SelectSession) {
  const shopifySession =
    session instanceof Session
      ? session
      : new Session({
          id: session.id,
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope ?? undefined,
          expires: session.expires ?? undefined,
          accessToken: session.accessToken ?? undefined,
          refreshToken: session.refreshToken ?? undefined,
          refreshTokenExpires: session.refreshTokenExpires ?? undefined,
          onlineAccessInfo: session.onlineAccessInfo ?? undefined,
        })

  return new shopifyApp.clients.Graphql({
    session: shopifySession,
    apiVersion,
  })
}

export async function getValidSessionWithShop(
  sessionId: string
): Promise<{ session: SelectSession; shop: SelectShop } | null> {
  const [result] = await db
    .select({
      session: sessionsTable,
      shop: shopsTable,
    })
    .from(sessionsTable)
    .innerJoin(shopsTable, eq(sessionsTable.shop, shopsTable.domain))
    .where(eq(sessionsTable.id, sessionId))

  if (!result) {
    return null
  }

  if (!isSessionValid(result.session)) {
    return null
  }

  return result
}

function isSessionValid(session: SelectSession): boolean {
  const requiredScopes = shopifyApp.config.scopes
  const sessionScopes = new AuthScopes(session.scope ?? undefined)

  if (!sessionScopes.has(requiredScopes)) {
    logger.warn('[auth] Session missing required scopes, re-authenticating', {
      type: 'auth',
      shopDomain: session.shop,
      sessionScopes: sessionScopes.toArray(),
      requiredScopes: requiredScopes?.toArray() ?? [],
    })

    return false
  }

  if (session.isOnline && session.expires) {
    const isExpired = new Date(session.expires) <= new Date()

    if (isExpired) {
      logger.warn('[auth] Online session expired, re-authenticating', {
        type: 'auth',
        shopDomain: session.shop,
      })

      return false
    }
  }

  if (!session.accessToken) {
    logger.warn('[auth] Session missing access token, re-authenticating', {
      type: 'auth',
      shopDomain: session.shop,
    })

    return false
  }

  return true
}

export async function upsertSessionAndShop(session: Session): Promise<{
  session: SelectSession
  shop: SelectShop
}> {
  const [upsertedSession] = await db
    .insert(sessionsTable)
    .values({
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope,
      expires: session.expires,
      accessToken: session.accessToken,
    })
    .onConflictDoUpdate({
      target: sessionsTable.shop,
      set: {
        id: session.id,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope,
        expires: session.expires,
        accessToken: session.accessToken,
      },
    })
    .returning()

  const shopData =
    await createAdminApiGraphqlClient(session).request(SHOP_QUERY)

  if (shopData.errors || !shopData.data?.shop) {
    logger.error('[auth] Failed to fetch shop data from Shopify', {
      type: 'auth',
      errors: shopData.errors,
    })

    throw new Error('Failed to fetch shop data from Shopify')
  }

  const [upsertedShop] = await db
    .insert(shopsTable)
    .values({
      domain: shopData.data.shop.myshopifyDomain,
      name: shopData.data.shop.name,
      email: shopData.data.shop.email,
      timezone: shopData.data.shop.ianaTimezone,
      currency: shopData.data.shop.currencyCode,
      plan: shopData.data.shop.plan?.publicDisplayName,
    })
    .onConflictDoUpdate({
      target: shopsTable.domain,
      set: {
        name: shopData.data.shop.name,
        email: shopData.data.shop.email,
        timezone: shopData.data.shop.ianaTimezone,
        currency: shopData.data.shop.currencyCode,
        plan: shopData.data.shop.plan?.publicDisplayName,
      },
    })
    .returning()

  return {
    session: upsertedSession,
    shop: upsertedShop,
  }
}
