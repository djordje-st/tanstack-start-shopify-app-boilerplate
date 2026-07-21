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

/**
 * User agents that should be allowed through even if detected as bots
 * (e.g., Shopify POS/Mobile apps, Shopify webhooks)
 */
const ALLOWED_BOT_PATTERNS = [
  /^Shopify POS\//,
  /^Shopify Mobile\//,
  /^Shopify-Captain-Hook$/,
  /^node$/, // Mantle webhooks use "node" as user agent
]

/**
 * Reject requests from bots to prevent unnecessary processing
 * Returns true if the request should be rejected
 */
function shouldRejectBot(userAgent: string, request: Request): boolean {
  if (!userAgent) return false

  // Allow Shopify agents through
  if (ALLOWED_BOT_PATTERNS.some(pattern => pattern.test(userAgent))) {
    return false
  }

  // Allow requests with valid auth headers (e.g., HTTPie for testing)
  const hasAuthHeader = request.headers.has('authorization')

  if (hasAuthHeader) {
    return false
  }

  // Check if it's a bot using isbot library
  return isbot(userAgent)
}

/**
 * Extract client IP from request headers
 * Checks common proxy headers in order of preference
 */
function getClientIp(headers: Headers): string {
  // Cloudflare's connecting IP (most reliable when using CF)
  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp

  // X-Forwarded-For can contain multiple IPs, take the first (original client)
  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()

  // X-Real-IP from nginx or other proxies
  const xRealIp = headers.get('x-real-ip')
  if (xRealIp) return xRealIp

  return 'unknown'
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

/**
 * Detect if a path looks like a vulnerability scan attempt
 */
function isSuspiciousPath(pathname: string): boolean {
  const suspiciousPatterns = [
    '.env',
    '.git',
    '.sql',
    '.bak',
    '.config',
    '.htaccess',
    'wp-',
    'wordpress',
    'phpmyadmin',
    'admin.php',
    'xmlrpc',
    'backup',
    'shell',
    'cgi-bin',
    'actuator',
    'telescope',
    '.aspx',
    '.jsp',
    '.php',
    'eval-stdin',
    'vendor/',
    'debug/',
    'console/',
  ]

  const lowerPath = pathname.toLowerCase()

  return suspiciousPatterns.some(pattern => lowerPath.includes(pattern))
}

function getRequestOutcome(status: number): string {
  if (status >= 500) return 'error'
  if (status >= 400) return 'rejected'
  if (status >= 300) return 'redirect'
  return 'success'
}

/**
 * Global request logging middleware
 * Logs comprehensive request/response details for performance monitoring and troubleshooting
 */
const requestLoggingMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const url = new URL(request.url)
    const startTime = Date.now()
    const headers = request.headers
    const userAgent = request.headers.get('user-agent') ?? ''
    const contentType = headers.get('content-type')
    const contentLength = headers.get('content-length')
    const queryParamCount = Array.from(url.searchParams.keys()).length
    const clientIp = getClientIp(headers)
    const referer = getRefererForLogging(headers)
    const origin = headers.get('origin')
    const cfCountry = headers.get('cf-ipcountry')
    const cfRay = headers.get('cf-ray')
    const suspicious = isSuspiciousPath(url.pathname)
    const event: Record<string, unknown> = {
      event: 'http_request',
      request_id:
        headers.get('x-request-id') ??
        headers.get('x-shopify-webhook-id') ??
        cfRay ??
        crypto.randomUUID(),
      method: request.method,
      path: url.pathname,
      query_param_count: queryParamCount,
      content_type: contentType?.split(';')[0],
      content_length: parseInt(contentLength ?? '0', 10),
      client_ip: clientIp,
      country: cfCountry,
      user_agent: userAgent.slice(0, 120),
      referer: referer?.slice(0, 200),
      origin,
      cloudflare_ray: cfRay,
      suspicious,
      shop_domain: headers.get('x-shopify-shop-domain'),
      shopify_webhook_id: headers.get('x-shopify-webhook-id'),
      shopify_topic: headers.get('x-shopify-topic'),
      status_code: 500,
      outcome: 'error',
    }

    return withLogContext(event, async () => {
      try {
        if (shouldRejectBot(userAgent, request)) {
          event.status_code = 410
          event.outcome = 'rejected_bot'
          throw new Response(null, { status: 410, statusText: 'Gone' })
        }

        const result = await next()
        const status = result.response?.status ?? 200
        event.status_code = status
        event.outcome = getRequestOutcome(status)
        return result
      } catch (error) {
        if (error instanceof Response) {
          event.status_code = error.status
          if (event.outcome !== 'rejected_bot') {
            event.outcome = getRequestOutcome(error.status)
          }
        } else {
          event.error = serializeError(error)
        }

        throw error
      } finally {
        event.duration_ms = Date.now() - startTime
        event.slow = Number(event.duration_ms) > 1000

        if (Number(event.status_code) >= 500)
          logger.error('http_request', event)
        else logger.info('http_request', event)
      }
    })
  }
)

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLoggingMiddleware, csrfMiddleware],
}))
