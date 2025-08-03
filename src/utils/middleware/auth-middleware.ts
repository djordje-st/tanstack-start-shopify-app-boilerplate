import { type AdminApiClient } from '@shopify/admin-api-client'
import { RequestedTokenType, type Session } from '@shopify/shopify-api'
import { createMiddleware } from '@tanstack/react-start'
import {
  getHeaders,
  getWebRequest,
  type HTTPHeaderName,
} from '@tanstack/react-start/server'
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
  headers: Partial<Record<HTTPHeaderName, string | undefined>>,
  searchParams: URLSearchParams
): string | null {
  // 1. Authorization header (API calls) - normalized to be capitalized
  const authHeader = headers.Authorization || headers.authorization

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
      .values({
        domain: sessionData.shop,
      })
      .onConflictDoUpdate({
        target: shops.domain,
        set: {
          updatedAt: new Date().toISOString(),
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

    return { session, shop }
  })
}

/**
 * Main authentication middleware
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      const headers = getHeaders()
      const request = getWebRequest()
      const url = new URL(request.url)
      const token = extractSessionToken(headers, url.searchParams)

      if (!token) {
        throw new Error('No session token found')
      }

      const decodedSessionToken = await shopifyApp.session.decodeSessionToken(
        token
      )

      if (!decodedSessionToken?.dest) {
        throw new Error('Invalid session token: missing destination')
      }

      const shopDomain = new URL(decodedSessionToken.dest).hostname
      const currentId = shopifyApp.session.getOfflineId(shopDomain)

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

      const accessToken = await shopifyApp.auth.tokenExchange({
        shop: shopDomain,
        sessionToken: token,
        requestedTokenType: RequestedTokenType.OfflineAccessToken,
      })

      if (!accessToken.session?.shop) {
        throw new Error('Token exchange failed: no shop found')
      }

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
