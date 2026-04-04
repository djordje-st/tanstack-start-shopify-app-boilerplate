import { AuthScopes, RequestedTokenType, Session } from '@shopify/shopify-api'
import { redirect } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import type { SelectSession, SelectShop } from '~/db/schema'
import { db } from '~/db'
import { sessionsTable, shopsTable } from '~/db/schema'
import logger from '~/utils/logger'
import { apiVersion, shopifyApp } from '~/utils/shopify/app'
import { SHOP_QUERY } from '~/graphql/admin/queries'

/**
 * In-memory lock map to prevent concurrent session updates for the same shop.
 * When multiple parallel requests arrive for the same shop, only the first one
 * performs the token exchange / migration / refresh while others wait.
 */
const sessionLocks = new Map<string, Promise<unknown>>()

const OFFLINE_TOKEN_EXPIRY_BUFFER_MS = 60 * 1000

type SessionWithShop = {
  session: SelectSession
  shop: SelectShop
}

type GetOfflineSessionOptions = {
  sessionToken?: string
}

/**
 * Execute a function with a per-shop lock to prevent race conditions while
 * updating sessions. If a lock exists for the shop, wait for it to complete.
 */
async function withSessionLock<T>(
  shopDomain: string,
  fn: () => Promise<T>
): Promise<T> {
  const existingLock = sessionLocks.get(shopDomain) as Promise<T> | undefined

  if (existingLock) {
    logger.debug('[auth] Waiting for existing session update to complete', {
      type: 'auth',
      shop: shopDomain,
    })

    try {
      return await existingLock
    } catch {
      const newLock = sessionLocks.get(shopDomain) as Promise<T> | undefined

      if (newLock && newLock !== existingLock) {
        return await newLock
      }
    }
  }

  // Create a new lock promise
  const lockPromise = fn()
  sessionLocks.set(shopDomain, lockPromise)

  try {
    const result = await lockPromise

    return result
  } finally {
    // Only delete if it's still our lock (another request might have set a new one)
    if (sessionLocks.get(shopDomain) === lockPromise) {
      sessionLocks.delete(shopDomain)
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

async function loadSessionWithShop(
  shopDomain: string
): Promise<SessionWithShop | null> {
  const [result] = await db
    .select({
      session: sessionsTable,
      shop: shopsTable,
    })
    .from(sessionsTable)
    .innerJoin(shopsTable, eq(sessionsTable.shop, shopsTable.domain))
    .where(eq(sessionsTable.shop, shopDomain))

  if (!result) {
    return null
  }

  return result
}

function isDateExpired(
  value: Date | null | undefined,
  bufferMs: number = 0
): boolean {
  if (!value) {
    return false
  }

  return value.getTime() - bufferMs <= Date.now()
}

export async function getOfflineSessionWithShop(
  shopDomain: string,
  options: GetOfflineSessionOptions = {}
): Promise<SessionWithShop | null> {
  const { sessionToken } = options
  const result = await loadSessionWithShop(shopDomain)

  if (result && isSessionStructurallyValid(result.session)) {
    const needsMigration =
      !result.session.isOnline &&
      Boolean(result.session.accessToken) &&
      !result.session.refreshToken &&
      !result.session.expires

    const needsRefresh =
      !result.session.isOnline &&
      Boolean(result.session.expires) &&
      isDateExpired(result.session.expires, OFFLINE_TOKEN_EXPIRY_BUFFER_MS)

    if (!needsMigration && !needsRefresh) {
      return result
    }
  } else if (!sessionToken) {
    return null
  }

  return withSessionLock(shopDomain, async () => {
    const latest = await loadSessionWithShop(shopDomain)

    if (latest && isSessionStructurallyValid(latest.session)) {
      const needsMigration =
        !latest.session.isOnline &&
        Boolean(latest.session.accessToken) &&
        !latest.session.refreshToken &&
        !latest.session.expires

      const needsRefresh =
        !latest.session.isOnline &&
        Boolean(latest.session.expires) &&
        isDateExpired(latest.session.expires, OFFLINE_TOKEN_EXPIRY_BUFFER_MS)

      if (!needsMigration && !needsRefresh) {
        return latest
      }

      if (needsMigration && latest.session.accessToken) {
        try {
          const { session } = await shopifyApp.auth.migrateToExpiringToken({
            shop: shopDomain,
            nonExpiringOfflineAccessToken: latest.session.accessToken,
          })

          const migrated = await upsertSessionAndShop(session)

          logger.info('[auth] Migrated offline session to expiring token', {
            type: 'auth',
            shopDomain,
            sessionId: migrated.session.id,
          })

          return migrated
        } catch (error) {
          logger.error('[auth] Failed to migrate offline session', {
            type: 'auth',
            shopDomain,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      if (needsRefresh) {
        if (!latest.session.refreshToken) {
          logger.warn('[auth] Offline session expired without refresh token', {
            type: 'auth',
            shopDomain,
          })
        } else if (
          isDateExpired(
            latest.session.refreshTokenExpires,
            OFFLINE_TOKEN_EXPIRY_BUFFER_MS
          )
        ) {
          logger.warn('[auth] Offline session refresh token expired', {
            type: 'auth',
            shopDomain,
          })
        } else {
          try {
            const { session } = await shopifyApp.auth.refreshToken({
              shop: shopDomain,
              refreshToken: latest.session.refreshToken,
            })

            const refreshed = await upsertSessionAndShop(session)

            logger.info('[auth] Refreshed expiring offline token', {
              type: 'auth',
              shopDomain,
              sessionId: refreshed.session.id,
            })

            return refreshed
          } catch (error) {
            logger.error('[auth] Failed to refresh expiring offline token', {
              type: 'auth',
              shopDomain,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }
      }
    }

    if (!sessionToken) {
      return null
    }

    const tokenExchange = await shopifyApp.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
      expiring: true,
    })

    const created = await upsertSessionAndShop(
      new Session(tokenExchange.session)
    )

    logger.info('[auth] New session created via token exchange', {
      type: 'auth',
      shop: shopDomain,
      sessionId: created.session.id,
    })

    return created
  })
}

function isSessionStructurallyValid(session: SelectSession): boolean {
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

async function upsertSessionAndShop(session: Session): Promise<{
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
      refreshToken: session.refreshToken,
      refreshTokenExpires: session.refreshTokenExpires,
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
        refreshToken: session.refreshToken,
        refreshTokenExpires: session.refreshTokenExpires,
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
