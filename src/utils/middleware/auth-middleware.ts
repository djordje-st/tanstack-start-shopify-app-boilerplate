import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import logger from '~/utils/logger'
import {
  createAdminApiGraphqlClient,
  getOfflineSessionWithShop,
  getSessionToken,
  getShopFromRequest,
  respondToInvalidSessionToken,
} from '~/utils/shopify/auth'
import { shopifyApp } from '~/utils/shopify/app'

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()
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
      const result = await getOfflineSessionWithShop(shopDomain, {
        sessionToken: encodedSessionToken,
      })

      if (!result) {
        respondToInvalidSessionToken(request)
      }

      const { session, shop: shopData } = result

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
