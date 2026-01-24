import { RequestedTokenType, Session } from '@shopify/shopify-api'
import { redirect } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import logger from '~/utils/logger'
import {
  createAdminApiGraphqlClient,
  getValidSessionWithShop,
  upsertSessionAndShop,
} from '~/utils/shopify/auth'
import { shopifyApp } from '~/utils/shopify/app'

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      const request = getRequest()

      let encodedSessionToken = null
      let decodedSessionToken = null

      try {
        encodedSessionToken =
          getSessionTokenHeader(request) || getSessionTokenFromUrlParam(request)

        if (!encodedSessionToken) {
          throw new Error('No session token found')
        }

        decodedSessionToken =
          await shopifyApp.session.decodeSessionToken(encodedSessionToken)
      } catch (e) {
        const isDocumentRequest = !request.headers.get('authorization')

        if (isDocumentRequest) {
          redirectToSessionTokenBouncePage(request)
        }

        throw new Response(undefined, {
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers({
            'X-Shopify-Retry-Invalid-Session-Request': '1',
          }),
        })
      }

      const dest = new URL(decodedSessionToken.dest)
      const shopDomain = dest.hostname

      const sessionId = shopifyApp.session.getOfflineId(shopDomain)

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

      const accessToken = await shopifyApp.auth.tokenExchange({
        shop: shopDomain,
        sessionToken: encodedSessionToken,
        requestedTokenType: RequestedTokenType.OfflineAccessToken,
      })

      const newSessionData = new Session(accessToken.session)

      const { session: upsertedSession, shop: upsertedShop } =
        await upsertSessionAndShop(newSessionData)

      return next({
        context: {
          session: upsertedSession,
          shop: upsertedShop,
          admin: createAdminApiGraphqlClient(upsertedSession),
        },
      })
    } catch (error) {
      logger.error('[auth] Middleware error', {
        type: 'auth',
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }
)

function getSessionTokenHeader(request: Request) {
  return request.headers.get('authorization')?.replace('Bearer ', '')
}

function getSessionTokenFromUrlParam(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get('id_token')
}

function redirectToSessionTokenBouncePage(request: Request) {
  const url = new URL(request.url)
  const searchParams = new URLSearchParams(url.search)

  // Remove stale id_token to prevent reuse
  searchParams.delete('id_token')

  // Build the reload path (path + remaining query params)
  const reloadParams = searchParams.toString()
  const reloadPath = reloadParams
    ? `${url.pathname}?${reloadParams}`
    : url.pathname

  // Add shopify-reload param for App Bridge to redirect back after getting fresh token
  searchParams.set('shopify-reload', reloadPath)

  throw redirect({
    to: '/session-token-bounce',
    search: Object.fromEntries(searchParams.entries()),
  })
}
