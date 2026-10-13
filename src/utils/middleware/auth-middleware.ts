import { createMiddleware } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { HttpResponseError, InvalidJwtError } from '@shopify/shopify-api'
import { addLogContext } from '#/utils/logger'
import {
  createAdminApiGraphqlClient,
  getOfflineSessionWithShop,
} from '#/utils/shopify/auth'
import { shopifyApp } from '#/utils/shopify/app'

const RETRY_HEADER = 'X-Shopify-Retry-Invalid-Session-Request'

export function getSessionToken(
  request: Request,
  isDocument: boolean
): string | null {
  const authorization = request.headers.get('authorization')

  return authorization === null && isDocument
    ? new URL(request.url).searchParams.get('id_token')
    : (authorization?.match(/^Bearer ([^\s]+)$/i)?.[1] ?? null)
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
  isDocument: boolean,
  retry = false
): never {
  if (isDocument) {
    throw redirect({
      href: getSessionTokenBounceUrl(request).href,
      statusCode: 302,
    })
  }

  throw new Response(null, {
    status: 401,
    headers: retry ? { [RETRY_HEADER]: '1' } : undefined,
  })
}

function getFrameAncestors(url: URL): string {
  const shop = shopifyApp.utils.sanitizeShop(url.searchParams.get('shop') ?? '')

  return shop
    ? `frame-ancestors https://${shop} https://admin.shopify.com;`
    : "frame-ancestors 'none';"
}

function redirectToEmbeddedApp(url: URL): never {
  const shop = shopifyApp.utils.sanitizeShop(url.searchParams.get('shop') ?? '')
  const host =
    shopifyApp.utils.sanitizeHost(url.searchParams.get('host') ?? '') ??
    (shop && btoa(`${shop}/admin`))

  if (!host) {
    throw new Response('Missing shop', { status: 400 })
  }

  throw redirect({
    href: shopifyApp.auth.buildEmbeddedAppUrl(host),
    statusCode: 302,
  })
}

// Register globally so server functions called during SSR retain the page context.
export const shopifyRequestContextMiddleware = createMiddleware().server(
  ({ request, handlerType, next }) => {
    const url = new URL(request.url)
    const isDocument =
      handlerType === 'router' &&
      (request.method === 'GET' || request.method === 'HEAD') &&
      !url.pathname.startsWith('/api/')

    if (isDocument) {
      setResponseHeader('Content-Security-Policy', getFrameAncestors(url))

      if (
        url.pathname !== '/session-token-bounce' &&
        url.searchParams.get('embedded') !== '1' &&
        !request.headers.has('authorization')
      ) {
        redirectToEmbeddedApp(url)
      }
    }

    return next({ context: { isDocument } })
  }
)

export const authMiddleware = createMiddleware({ type: 'function' })
  .middleware([shopifyRequestContextMiddleware])
  .server(async ({ next, context: { isDocument } }) => {
    const request = getRequest()
    const encodedSessionToken = getSessionToken(request, isDocument)

    if (!encodedSessionToken) {
      rejectInvalidSessionToken(request, isDocument, true)
    }

    let shopDomain: string

    try {
      const decodedSessionToken =
        await shopifyApp.session.decodeSessionToken(encodedSessionToken)
      shopDomain = new URL(decodedSessionToken.dest).hostname

      if (
        !shopifyApp.utils.sanitizeShop(shopDomain) ||
        new URL(decodedSessionToken.iss).hostname !== shopDomain
      ) {
        throw new InvalidJwtError('Session token shop is invalid')
      }
    } catch {
      rejectInvalidSessionToken(request, isDocument, true)
    }

    const requestedShop = new URL(request.url).searchParams.get('shop')

    if (requestedShop !== null) {
      const sanitizedShop = shopifyApp.utils.sanitizeShop(requestedShop)

      if (
        !sanitizedShop ||
        new URL(`https://${sanitizedShop}`).hostname !== shopDomain
      ) {
        rejectInvalidSessionToken(request, isDocument)
      }
    }

    let result

    try {
      result = await getOfflineSessionWithShop(shopDomain, encodedSessionToken)
    } catch (error) {
      if (
        error instanceof InvalidJwtError ||
        (error instanceof HttpResponseError &&
          error.response.code === 400 &&
          error.response.body?.error === 'invalid_subject_token')
      ) {
        rejectInvalidSessionToken(request, isDocument, true)
      }

      throw error
    }

    if (!result) {
      rejectInvalidSessionToken(request, isDocument)
    }

    addLogContext({ shop: result.shop.domain, shop_id: result.shop.id })

    return next({
      context: {
        ...result,
        admin: createAdminApiGraphqlClient(result.session),
      },
    })
  })
