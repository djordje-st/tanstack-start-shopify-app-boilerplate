import { AdminApiClient } from '@shopify/admin-api-client'
import { RequestedTokenType, Session } from '@shopify/shopify-api'
import { createMiddleware } from '@tanstack/react-start'
import { getHeaders, getWebRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '~/db'
import {
  sessions,
  shops,
  type SelectSession,
  type SelectShop,
} from '~/db/schema'
import { logError } from '~/utils/logger'
import { shopifyApp } from '~/utils/shopify-app'
import { createGraphqlClient } from '~/utils/shopify-graphql-client'

// Enhanced context type with better type safety
type AuthContext = {
  session: SelectSession
  shop: SelectShop
  graphql: AdminApiClient
}

/**
 * Extracts session token from multiple sources in order of priority
 */
function extractSessionToken(
  headers: Headers,
  searchParams: URLSearchParams
): string | null {
  // 1. Authorization header (API calls) - normalized to be capitalized
  const authHeader = headers.get('Authorization')

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
function createAuthContext(
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
 */
async function upsertSessionAndShop(sessionData: Session): Promise<{
  session: SelectSession
  shop: SelectShop
}> {
  return db.transaction(async tx => {
    // Upsert session with normalized shop domain
    await tx
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

    // Upsert shop - create only if domain doesn't exist
    await tx
      .insert(shops)
      .values({ domain: sessionData.shop })
      .onConflictDoUpdate({
        target: shops.domain,
        set: {
          updatedAt: new Date(),
        },
      })

    // Get both records
    const [session, shop] = await Promise.all([
      tx.query.sessions.findFirst({
        where: eq(sessions.id, sessionData.id),
      }),
      tx.query.shops.findFirst({
        where: eq(shops.domain, sessionData.shop),
      }),
    ])

    if (!session || !shop) {
      throw new Error('Failed to create/retrieve session or shop')
    }

    // Register webhooks (don't fail the entire flow if this fails)
    // try {
    //   await shopifyApp.webhooks.register({ session: sessionData })
    // } catch (webhookError) {
    //   logError('Webhook registration failed', webhookError)
    // }

    return { session, shop }
  })
}

/**
 * Main authentication middleware
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const headersObj = getHeaders()
    const normalizedHeaders = Object.entries(headersObj)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        // Normalize authorization header to be capitalized
        if (key.toLowerCase() === 'authorization') {
          return ['Authorization', value]
        }
        return [key, value]
      }) as [string, string][]

    const headers = new Headers(normalizedHeaders)
    const request = getWebRequest()
    const url = new URL(request.url)

    try {
      const currentId = await shopifyApp.session.getCurrentId({
        isOnline: false,
        rawRequest: request,
      })

      if (currentId) {
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, currentId),
        })

        if (session?.accessToken) {
          const shop = await db.query.shops.findFirst({
            where: eq(shops.domain, session.shop),
          })

          if (shop) {
            const context = createAuthContext(session, shop)

            return next({ context })
          }
        }
      }

      // Fallback to token-based authentication
      const token = extractSessionToken(headers, url.searchParams)

      if (!token) {
        throw new Error('No session token found')
      }

      // Decode and validate token
      const decodedSessionToken = await shopifyApp.session.decodeSessionToken(
        token
      )

      if (!decodedSessionToken?.dest) {
        throw new Error('Invalid session token: missing destination')
      }

      // Extract and normalize shop domain
      const shopDomain = new URL(decodedSessionToken.dest).hostname

      // Token exchange with normalized domain
      const accessToken = await shopifyApp.auth.tokenExchange({
        shop: shopDomain,
        sessionToken: token,
        requestedTokenType: RequestedTokenType.OfflineAccessToken,
      })

      if (!accessToken.session?.shop) {
        throw new Error('Token exchange failed: no shop found')
      }

      // Database operations
      const { session, shop } = await upsertSessionAndShop(accessToken.session)
      const context = createAuthContext(session, shop)

      return next({ context })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logError(errorMessage, error)

      throw error
    }
  }
)
