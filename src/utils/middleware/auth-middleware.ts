import { RequestedTokenType, Session } from '@shopify/shopify-api'
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import logger from '~/utils/logger'
import {
  createAdminApiGraphqlClient,
  getSessionToken,
  getShopFromRequest,
  getValidSessionWithShop,
  rejectBotRequest,
  respondToInvalidSessionToken,
  upsertSessionAndShop,
} from '~/utils/shopify/auth'
import { shopifyApp } from '~/utils/shopify/app'

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()

    // Reject bots to prevent unnecessary auth flows
    rejectBotRequest(request)

    const shop = getShopFromRequest(request)

    try {
      const encodedSessionToken = getSessionToken(request)

      if (!encodedSessionToken) {
        logger.debug('[auth] No session token found', {
          type: 'auth',
          shop,
        })
        respondToInvalidSessionToken(request)
      }

      let decodedSessionToken

      try {
        decodedSessionToken =
          await shopifyApp.session.decodeSessionToken(encodedSessionToken)
      } catch (error) {
        logger.debug('[auth] Failed to decode session token', {
          type: 'auth',
          shop,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        respondToInvalidSessionToken(request)
      }

      const dest = new URL(decodedSessionToken.dest)
      const shopDomain = dest.hostname
      const sessionId = shopifyApp.session.getOfflineId(shopDomain)

      // Try to get existing valid session
      if (sessionId) {
        const existing = await getValidSessionWithShop(sessionId)

        if (existing) {
          logger.debug('[auth] Using existing session', {
            type: 'auth',
            shop: shopDomain,
            sessionId,
          })

          return next({
            context: {
              session: existing.session,
              shop: existing.shop,
              admin: createAdminApiGraphqlClient(existing.session),
            },
          })
        }
      }

      // No valid session, perform token exchange
      logger.debug('[auth] Performing token exchange', {
        type: 'auth',
        shop: shopDomain,
      })

      const accessToken = await shopifyApp.auth.tokenExchange({
        shop: shopDomain,
        sessionToken: encodedSessionToken,
        requestedTokenType: RequestedTokenType.OfflineAccessToken,
      })

      const newSession = new Session(accessToken.session)
      const { session, shop: shopData } = await upsertSessionAndShop(newSession)

      logger.info('[auth] New session created via token exchange', {
        type: 'auth',
        shop: shopDomain,
        sessionId: session.id,
      })

      return next({
        context: {
          session,
          shop: shopData,
          admin: createAdminApiGraphqlClient(session),
        },
      })
    } catch (error) {
      // Re-throw Response objects (from respondToInvalidSessionToken, etc.)
      if (error instanceof Response) {
        throw error
      }

      // Re-throw redirect objects
      if (error && typeof error === 'object' && 'to' in error) {
        throw error
      }

      logger.error('[auth] Middleware error', {
        type: 'auth',
        shop,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }
)
