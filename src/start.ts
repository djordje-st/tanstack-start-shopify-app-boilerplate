import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import { isbot } from 'isbot'
import logger, { serializeError, withLogContext } from '#/utils/logger'

const csrfMiddleware = createCsrfMiddleware({
  filter: ctx => ctx.handlerType === 'serverFn',
})

const ALLOWED_BOT_PATTERNS = [
  /^Shopify POS\//,
  /^Shopify Mobile\//,
  /^Shopify-Captain-Hook$/,
]

function shouldRejectBot(
  userAgent: string,
  request: Request,
  handlerType: 'router' | 'serverFn'
): boolean {
  const { pathname } = new URL(request.url)

  // Bot detection only applies to app pages, not API calls or token recovery.
  if (
    process.env.NODE_ENV === 'development' ||
    handlerType !== 'router' ||
    (request.method !== 'GET' && request.method !== 'HEAD') ||
    pathname.startsWith('/api/') ||
    pathname === '/session-token-bounce' ||
    !userAgent ||
    request.headers.has('authorization') ||
    ALLOWED_BOT_PATTERNS.some(pattern => pattern.test(userAgent))
  ) {
    return false
  }

  return isbot(userAgent)
}

function getClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}

function getRefererForLogging(headers: Headers): string | null {
  const referer = headers.get('referer')

  if (!referer) return null

  try {
    const url = new URL(referer)

    return `${url.origin}${url.pathname}`
  } catch {
    return null
  }
}

function getRequestOutcome(status: number): string {
  if (status >= 500) return 'error'
  if (status >= 400) return 'rejected'
  if (status >= 300) return 'redirect'
  return 'success'
}

const requestLoggingMiddleware = createMiddleware().server(
  async ({ next, request, handlerType }) => {
    const url = new URL(request.url)
    const startTime = Date.now()
    const headers = request.headers
    const userAgent = headers.get('user-agent') ?? ''
    const contentLength = Number(headers.get('content-length') ?? 0)
    const cfRay = headers.get('cf-ray')
    const bot = shouldRejectBot(userAgent, request, handlerType)
    const event: Record<string, unknown> = {
      event: 'http_request',
      request_id:
        headers.get('x-request-id') ??
        headers.get('x-shopify-webhook-id') ??
        cfRay ??
        crypto.randomUUID(),
      method: request.method,
      path: url.pathname,
      query_param_count: url.searchParams.size,
      content_type: headers.get('content-type')?.split(';')[0],
      content_length: Number.isFinite(contentLength) ? contentLength : 0,
      client_ip: getClientIp(headers),
      country: headers.get('cf-ipcountry'),
      user_agent: userAgent.slice(0, 120),
      referer: getRefererForLogging(headers)?.slice(0, 200),
      origin: headers.get('origin'),
      cloudflare_ray: cfRay,
      bot,
      shop_domain: headers.get('x-shopify-shop-domain'),
      shopify_webhook_id: headers.get('x-shopify-webhook-id'),
      shopify_topic: headers.get('x-shopify-topic'),
    }

    return withLogContext(event, async () => {
      let status = 500

      try {
        if (bot) {
          event.rejection_reason = 'bot'
          throw new Response(null, { status: 410, statusText: 'Gone' })
        }

        const result = await next()

        status = result.response?.status ?? 200

        return result
      } catch (error) {
        if (error instanceof Response) {
          status = error.status
        } else {
          event.error = serializeError(error)
        }

        throw error
      } finally {
        event.status_code = status
        event.outcome = getRequestOutcome(status)
        event.duration_ms = Date.now() - startTime
        event.slow = Number(event.duration_ms) > 1000

        if (status >= 500) logger.error('http_request', event)
        else if (status >= 400) logger.warning('http_request', event)
        else logger.info('http_request', event)
      }
    })
  }
)

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLoggingMiddleware, csrfMiddleware],
}))
