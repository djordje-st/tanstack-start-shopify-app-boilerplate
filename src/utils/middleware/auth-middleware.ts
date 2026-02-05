import { RequestedTokenType, Session } from '@shopify/shopify-api'
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import logger from '~/utils/logger'
import {
  createAdminApiGraphqlClient,
  getSessionToken,
  getShopFromRequest,
  getValidSessionWithShop,
  respondToInvalidSessionToken,
  upsertSessionAndShop,
  withTokenExchangeLock,
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
      const sessionId = shopifyApp.session.getOfflineId(shopDomain)

      // Try to get existing valid session
      if (sessionId) {
        const existing = await getValidSessionWithShop(sessionId)

        if (existing) {
          return next({
            context: {
              session: existing.session,
              shop: existing.shop,
              admin: createAdminApiGraphqlClient(existing.session),
            },
          })
        }
      }

      // No valid session, perform token exchange with lock to prevent race conditions
      const { session, shop: shopData } = await withTokenExchangeLock(
        shopDomain,
        async () => {
          // Double-check if session was created by another request while we waited
          const sessionIdToCheck = shopifyApp.session.getOfflineId(shopDomain)

          if (sessionIdToCheck) {
            const existingAfterLock =
              await getValidSessionWithShop(sessionIdToCheck)

            if (existingAfterLock) {
              logger.debug(
                '[auth] Session found after acquiring lock, skipping token exchange',
                {
                  type: 'auth',
                  shop: shopDomain,
                  sessionId: existingAfterLock.session.id,
                }
              )

              return existingAfterLock
            }
          }

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
          const result = await upsertSessionAndShop(newSession)

          logger.info('[auth] New session created via token exchange', {
            type: 'auth',
            shop: shopDomain,
            sessionId: result.session.id,
          })

          return result
        }
      )

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
