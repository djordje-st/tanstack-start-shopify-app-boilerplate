import { RequestedTokenType } from '@shopify/shopify-api'
import { eq } from 'drizzle-orm'
import type { AdminApiClient } from '@shopify/admin-api-client'
import type { Session } from '@shopify/shopify-api'
import type { SelectSession, SelectShop } from '~/db/schema'
import type { GetShopQuery } from '~/types/generated/admin.generated'
import { db } from '~/db'
import { sessions, shops } from '~/db/schema'
import { SHOP_QUERY } from '~/graphql/queries'
import { apiVersion, shopifyApp } from '~/utils/shopify/app'
import { createGraphqlClient } from '~/utils/shopify/graphql-client'

// Enhanced context type with better type safety
export type AuthContext = {
  session: SelectSession
  shop: SelectShop
  graphql: AdminApiClient
}

// Minimal shop data required for upsert operations
export type ShopUpsertData = {
  name: string | null
  email: string | null
  ianaTimezone: string | null
  currencyCode: string | null
  plan: { publicDisplayName: string | null }
}

/**
 * Checks if a session's scopes include all required app scopes
 * Returns false if scopes are missing or outdated
 */
export function isSessionScopeValid(sessionScope: string | null): boolean {
  if (!sessionScope) return false

  const requiredScopes = process.env.SHOPIFY_APP_SCOPES!.split(',')
  const sessionScopes = sessionScope.split(',').map(s => s.trim())

  return requiredScopes.every(scope => sessionScopes.includes(scope.trim()))
}

/**
 * Extracts session token from multiple sources in order of priority
 */
export function extractSessionToken(
  headers: Headers,
  searchParams: URLSearchParams
): string | null {
  // 1. Authorization header (API calls) - normalized to be capitalized
  const authHeader =
    headers.get('Authorization') || headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '')
  }

  // 2. URL search params (initial page load)
  const idToken = searchParams.get('id_token')

  if (idToken) {
    return idToken
  }

  return null
}

/**
 * Creates auth context from session and shop data
 */
export function createAuthContext(
  session: SelectSession,
  shop: SelectShop
): AuthContext {
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

/**
 * Gets or creates session and shop in database with proper error handling
 * Invalidates cache after updates to ensure fresh data
 */
export async function upsertSessionAndShop(
  shopData: ShopUpsertData,
  sessionData: Session
): Promise<{
  session: SelectSession
  shop: SelectShop
}> {
  const now = new Date().toISOString()

  const result = await db.transaction(async tx => {
    // Upsert session with normalized shop domain - returns the upserted record
    const [session] = await tx
      .insert(sessions)
      .values({
        id: sessionData.id,
        shop: sessionData.shop,
        state: sessionData.state,
        isOnline: sessionData.isOnline,
        scope: sessionData.scope,
        expires: sessionData.expires,
        accessToken: sessionData.accessToken,
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: {
          accessToken: sessionData.accessToken,
          expires: sessionData.expires,
          scope: sessionData.scope,
          state: sessionData.state,
          shop: sessionData.shop,
        },
      })
      .returning()

    // Upsert shop - returns the upserted record
    const [shop] = await tx
      .insert(shops)
      .values({
        domain: sessionData.shop,
        name: shopData.name,
        email: shopData.email,
        timezone: shopData.ianaTimezone,
        currency: shopData.currencyCode,
        plan: shopData.plan.publicDisplayName,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: shops.domain,
        set: {
          name: shopData.name,
          email: shopData.email,
          timezone: shopData.ianaTimezone,
          currency: shopData.currencyCode,
          plan: shopData.plan.publicDisplayName,
          updatedAt: now,
        },
      })
      .returning()

    if (!session || !shop) {
      throw new Error('Failed to create/retrieve session or shop')
    }

    return { session, shop }
  })

  return result
}

/**
 * Fetches shop data from Shopify GraphQL API
 */
export async function fetchShopDataFromGraphQL(
  shopDomain: string,
  accessToken: string
): Promise<GetShopQuery['shop']> {
  const response = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: SHOP_QUERY }),
    }
  )

  const data = await response.json()

  return data.data.shop
}

/**
 * Fetches cached session and shop data in parallel
 */
export async function fetchSessionAndShop(
  sessionId: string,
  shopDomain: string
) {
  const [session, shop] = await Promise.all([
    db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) }),
    db.query.shops.findFirst({ where: eq(shops.domain, shopDomain) }),
  ])

  return { session, shop }
}

/**
 * Converts existing shop record to ShopUpsertData format
 */
export function shopRecordToUpsertData(
  existingShop: NonNullable<
    Awaited<ReturnType<typeof fetchSessionAndShop>>['shop']
  >
): ShopUpsertData {
  return {
    name: existingShop.name,
    email: existingShop.email,
    ianaTimezone: existingShop.timezone,
    currencyCode: existingShop.currency,
    plan: { publicDisplayName: existingShop.plan },
  }
}

/**
 * Converts GraphQL shop response to ShopUpsertData format
 */
export function graphqlShopToUpsertData(
  shopData: NonNullable<GetShopQuery['shop']>
): ShopUpsertData {
  return {
    name: shopData.name,
    email: shopData.email,
    ianaTimezone: shopData.ianaTimezone,
    currencyCode: shopData.currencyCode,
    plan: { publicDisplayName: shopData.plan.publicDisplayName },
  }
}

/**
 * Decodes and validates a Shopify session token
 * @returns shopDomain and sessionId if valid
 * @throws Error if token is invalid
 */
export async function decodeSessionToken(token: string) {
  const decodedToken = await shopifyApp.session.decodeSessionToken(token)

  if (!decodedToken?.dest) {
    throw new Error('Invalid session token: missing destination')
  }

  const shopDomain = new URL(decodedToken.dest).hostname
  const sessionId = shopifyApp.session.getOfflineId(shopDomain)

  return { decodedToken, shopDomain, sessionId }
}

/**
 * Performs token exchange with Shopify and persists session/shop
 * This is the "slow path" when no valid cached session exists
 */
export async function performTokenExchange(token: string, shopDomain: string) {
  const { session: tokenExchangeSession } = await shopifyApp.auth.tokenExchange(
    {
      shop: shopDomain,
      sessionToken: token,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    }
  )

  if (!tokenExchangeSession?.shop || !tokenExchangeSession.accessToken) {
    throw new Error('Token exchange failed: invalid session')
  }

  // Check if shop exists to determine if this is a new installation
  const { shop: existingShop } = await fetchSessionAndShop(
    tokenExchangeSession.id,
    shopDomain
  )

  // Get shop data: fetch from GraphQL for new installs, reuse existing for updates
  const graphqlShopData = existingShop
    ? null
    : await fetchShopDataFromGraphQL(
        tokenExchangeSession.shop,
        tokenExchangeSession.accessToken
      )

  const shopData = existingShop
    ? shopRecordToUpsertData(existingShop)
    : graphqlShopToUpsertData(graphqlShopData!)

  // Persist session and shop
  return upsertSessionAndShop(shopData, tokenExchangeSession)
}
