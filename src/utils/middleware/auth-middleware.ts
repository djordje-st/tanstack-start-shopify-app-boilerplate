import { createMiddleware } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import {
  getRequest,
  setResponseHeader,
  setResponseStatus,
} from '@tanstack/react-start/server'
import logger from '~/utils/logger'
import {
  createAuthContext,
  decodeSessionToken,
  extractSessionToken,
  fetchSessionAndShop,
  isSessionScopeValid,
  performTokenExchange,
} from '~/utils/shopify/auth'

/**
 * Custom error for auth failures that should trigger retry
 */
class AuthRetryError extends Error {
  constructor(message: string) {
    super(message)

    this.name = 'AuthRetryError'
  }
}

/**
 * Custom error for XHR auth failures that need a 401 response with retry header.
 * This is serializable unlike Response objects.
 */
class AuthRetryResponseError extends Error {
  constructor(message: string) {
    super(message)

    this.name = 'AuthRetryResponseError'
  }
}

/**
 * Sets response headers for XHR auth retry and throws serializable error
 */
function throwRetryResponse(message: string): never {
  setResponseStatus(401)
  setResponseHeader('Content-Type', 'application/json')
  setResponseHeader('X-Shopify-Retry-Invalid-Session-Request', '1')

  throw new AuthRetryResponseError(message)
}

/**
 * Builds the bounce page URL with the current request path
 */
function buildBounceUrl(url: URL): string {
  const searchParams = new URLSearchParams(url.searchParams)

  // Remove id_token to prevent sending expired token to bounce page
  searchParams.delete('id_token')

  // Add shopify-reload param so App Bridge redirects back with fresh token
  searchParams.set(
    'shopify-reload',
    `${url.pathname}?${searchParams.toString()}`
  )

  return `/auth/session-token-bounce?${searchParams.toString()}`
}

/**
 * Main authentication middleware
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()
    const url = new URL(request.url)
    const headers = request.headers

    try {
      const token = extractSessionToken(headers, url.searchParams)

      if (!token) {
        throw new AuthRetryError('No session token found')
      }

      // Decode and validate the session token
      let shopDomain: string
      let sessionId: string | undefined

      try {
        const result = await decodeSessionToken(token)

        shopDomain = result.shopDomain
        sessionId = result.sessionId
      } catch {
        throw new AuthRetryError('Invalid or expired session token')
      }

      // Fast path: Try to use cached session and shop
      if (sessionId) {
        const { session, shop } = await fetchSessionAndShop(
          sessionId,
          shopDomain
        )

        if (
          session?.accessToken &&
          shop &&
          isSessionScopeValid(session.scope)
        ) {
          const context = createAuthContext(session, shop)

          return next({ context })
        }
      }

      // Slow path: Token exchange required
      let session, shop

      try {
        const result = await performTokenExchange(token, shopDomain)

        session = result.session
        shop = result.shop
      } catch (error) {
        logger.error('Token exchange failed', {
          shopDomain,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        throw new AuthRetryError('Token exchange failed')
      }

      const context = createAuthContext(session, shop)

      return next({ context })
    } catch (error) {
      // Handle auth retry errors
      if (error instanceof AuthRetryError) {
        logger.warn('Auth retry required', { error: error.message })

        if (!headers.get('Authorization')) {
          throw redirect({ to: buildBounceUrl(url) })
        }

        throwRetryResponse(error.message)
      }

      logger.error('Auth middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }
)
