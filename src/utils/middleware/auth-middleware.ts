import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import {
  createAdminApiGraphqlClient,
  getOfflineSessionWithShop,
} from '#/utils/shopify/auth'
import { shopifyApp } from '#/utils/shopify/app'

const RETRY_HEADER = 'X-Shopify-Retry-Invalid-Session-Request'

export function getSessionToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')

  return authorization === null
    ? new URL(request.url).searchParams.get('id_token')
    : (authorization.match(/^Bearer ([^\s]+)$/i)?.[1] ?? null)
}

export function getSessionTokenBounceUrl(request: Request): URL {
  const original = new URL(request.url)
  original.searchParams.delete('id_token')

  const bounce = new URL('/session-token-bounce', original)
  bounce.search = original.search
  bounce.searchParams.set(
    'shopify-reload',
    `${original.pathname}${original.search}`
  )

  return bounce
}

export function rejectInvalidSessionToken(
  request: Request,
  retry = false
): never {
  if (!request.headers.has('authorization')) {
    throw Response.redirect(getSessionTokenBounceUrl(request), 302)
  }

  throw new Response(null, {
    status: 401,
    headers: retry ? { [RETRY_HEADER]: '1' } : undefined,
  })
}

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()
    const documentRequest = !request.headers.has('authorization')

    if (documentRequest) {
      const url = new URL(request.url)

      if (url.searchParams.get('embedded') !== '1') {
        throw Response.redirect(
          await shopifyApp.auth.getEmbeddedAppUrl({ rawRequest: request }),
          302
        )
      }
    }

    const encodedSessionToken = getSessionToken(request)

    if (!encodedSessionToken) {
      rejectInvalidSessionToken(request)
    }

    let decodedSessionToken

    try {
      decodedSessionToken =
        await shopifyApp.session.decodeSessionToken(encodedSessionToken)
    } catch {
      rejectInvalidSessionToken(request, true)
    }

    const shopDomain = new URL(decodedSessionToken.dest).hostname
    const result = await getOfflineSessionWithShop(
      shopDomain,
      encodedSessionToken
    )

    if (!result) {
      rejectInvalidSessionToken(request)
    }

    return next({
      context: {
        ...result,
        admin: createAdminApiGraphqlClient(result.session),
      },
    })
  }
)
