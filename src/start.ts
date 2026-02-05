import { createMiddleware, createStart } from '@tanstack/react-start'
import { isbot } from 'isbot'
import logger from '~/utils/logger'

const SERVER_FN_PREFIX = '/_serverFn/'

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
 * Resolves the display path for logging
 * For server functions, decodes the base64 payload to extract the function name
 */
function resolveLogPath(pathname: string): string {
  if (!pathname.startsWith(SERVER_FN_PREFIX)) {
    return pathname
  }

  try {
    const encoded = pathname.slice(SERVER_FN_PREFIX.length)
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    const payload = JSON.parse(decoded) as { file?: string; export?: string }

    // Extract function name from export like "getShopAuth_createServerFn_handler"
    if (payload.export) {
      const fnName = payload.export.replace(/_createServerFn_handler$/, '')

      return `/_serverFn/${fnName}`
    }

    return pathname
  } catch {
    return pathname
  }
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

/**
 * Global request logging middleware
 * Logs comprehensive request/response details for performance monitoring and troubleshooting
 */
const requestLoggingMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const userAgent = request.headers.get('user-agent') ?? ''

    // Reject bots early, before any processing
    if (shouldRejectBot(userAgent, request)) {
      logger.warn('[http] Rejecting bot request', {
        type: 'http',
        userAgent: userAgent.slice(0, 120),
      })

      throw new Response(null, { status: 410, statusText: 'Gone' })
    }

    if (import.meta.env.DEV) {
      return await next()
    }

    const url = new URL(request.url)
    const startTime = Date.now()
    const headers = request.headers

    // Extract request metadata
    const contentType = headers.get('content-type')
    const contentLength = headers.get('content-length')
    const queryParamCount = Array.from(url.searchParams.keys()).length
    const logPath = resolveLogPath(url.pathname)

    // Security-relevant headers
    const clientIp = getClientIp(headers)
    const referer = headers.get('referer')
    const origin = headers.get('origin')
    const cfCountry = headers.get('cf-ipcountry') // Cloudflare country code
    const cfRay = headers.get('cf-ray') // Cloudflare request ID

    // Check if this looks like a vulnerability scan
    const suspicious = isSuspiciousPath(url.pathname)

    try {
      const result = await next()
      const duration = Date.now() - startTime
      const status = result.response?.status ?? 200
      const isSlow = duration > 1000

      // Determine log level based on status, duration, and suspiciousness
      const logLevel =
        status >= 500 ? 'error' : status >= 400 || suspicious ? 'warn' : 'info'

      logger[logLevel](`[http] request_completed`, {
        type: 'http',
        method: request.method,
        path: logPath,
        status,
        duration_ms: duration,
        slow: isSlow.toString(),
        queryParams: queryParamCount,
        contentType: contentType?.split(';')[0],
        contentLength: parseInt(contentLength ?? '0', 10),
        // Security fields
        ip: clientIp,
        country: cfCountry,
        userAgent: userAgent?.slice(0, 120),
        referer: referer?.slice(0, 200),
        origin,
        cfRay,
        suspicious: suspicious.toString(),
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      logger.error(`[http] ${request.method} ${logPath} failed`, {
        type: 'http',
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        queryParams: queryParamCount,
        contentType: contentType?.split(';')[0],
        contentLength: parseInt(contentLength ?? '0', 10),
        // Security fields
        ip: clientIp,
        country: cfCountry,
        userAgent: userAgent?.slice(0, 120),
        referer: referer?.slice(0, 200),
        origin,
        cfRay,
        suspicious: suspicious.toString(),
      })

      throw error
    }
  }
)

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLoggingMiddleware],
}))
