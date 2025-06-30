import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

// Environment configuration
const isDevelopment = process.env.NODE_ENV === 'development'
const enableFileLogging =
  process.env.ENABLE_FILE_LOGGING === 'true' || !isDevelopment

// Create Winston logger instance
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console transport (always enabled)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : ''
          return `${timestamp} [${level}]: ${message}${metaStr}`
        })
      ),
    }),
  ],
})

// Add file transports if enabled
if (enableFileLogging) {
  // Combined logs
  logger.add(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: winston.format.json(),
    })
  )

  // Error logs
  logger.add(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: winston.format.json(),
    })
  )

  // HTTP logs
  logger.add(
    new DailyRotateFile({
      filename: 'logs/http-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxSize: '20m',
      maxFiles: '3d',
      format: winston.format.json(),
    })
  )
}

// Handle uncaught exceptions and rejections
logger.exceptions.handle(
  new winston.transports.File({ filename: 'logs/exceptions.log' })
)

logger.rejections.handle(
  new winston.transports.File({ filename: 'logs/rejections.log' })
)

// Auto-extract error information
function extractErrorInfo(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return {
    message: String(error),
    type: typeof error,
  }
}

// Auto-categorize error types
function categorizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('Invalid Shopify proxy')) return 'INVALID_PROXY'
  if (message.includes('Missing shop parameter')) return 'MISSING_SHOP'
  if (
    message.includes('Shop not found') ||
    message.includes('No valid session')
  )
    return 'SHOP_NOT_FOUND'
  if (message.includes('GraphQL')) return 'GRAPHQL_ERROR'
  if (message.includes('Network') || message.includes('fetch'))
    return 'NETWORK_ERROR'
  if (message.includes('timeout')) return 'TIMEOUT_ERROR'
  if (message.toLowerCase().includes('rate limit')) return 'RATE_LIMIT'

  return 'INTERNAL_ERROR'
}

// Extract shop from various sources
function extractShop(request?: Request, context?: any): string {
  if (request) {
    const url = new URL(request.url)
    const shop = url.searchParams.get('shop')
    if (shop) return shop
  }

  if (context?.shop) return context.shop

  return 'unknown'
}

// Simplified logging functions
export function logError(error: unknown, context?: any) {
  const errorInfo = extractErrorInfo(error)
  const errorType = categorizeError(error)
  const shop = extractShop(context?.request, context)

  logger.error(errorInfo.message, {
    error: errorInfo,
    errorType,
    shop,
    timestamp: new Date().toISOString(),
    ...context,
  })
}

export function logInfo(message: string, context?: any) {
  const shop = extractShop(context?.request, context)

  logger.info(message, {
    shop,
    timestamp: new Date().toISOString(),
    ...context,
  })
}

export function logWarning(message: string, context?: any) {
  const shop = extractShop(context?.request, context)

  logger.warn(message, {
    shop,
    timestamp: new Date().toISOString(),
    ...context,
  })
}

export function logDebug(message: string, context?: any) {
  const shop = extractShop(context?.request, context)

  logger.debug(message, {
    shop,
    timestamp: new Date().toISOString(),
    ...context,
  })
}

// Auto-extract request info for HTTP logging
export function logRequest(request: Request, context?: any) {
  const url = new URL(request.url)
  const shop = extractShop(request, context)

  logger.http('Incoming request', {
    method: request.method,
    url: request.url,
    pathname: url.pathname,
    search: url.search,
    shop,
    userAgent: request.headers.get('user-agent'),
    timestamp: new Date().toISOString(),
    ...context,
  })
}

export function logResponse(
  request: Request,
  response: Response,
  duration?: number,
  context?: any
) {
  const shop = extractShop(request, context)
  const level = response.status >= 400 ? 'error' : 'http'

  logger.log(level, 'Response sent', {
    method: request.method,
    url: request.url,
    status: response.status,
    duration,
    shop,
    timestamp: new Date().toISOString(),
    ...context,
  })
}

export default logger
