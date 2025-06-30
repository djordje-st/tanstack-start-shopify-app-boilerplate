import { createMiddleware } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { logRequest, logResponse } from '../logger'

// Simple request timing storage
const requestTimings = new Map<string, number>()

// Auto-cleanup old timings every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  for (const [id, startTime] of requestTimings.entries()) {
    if (startTime < fiveMinutesAgo) {
      requestTimings.delete(id)
    }
  }
}, 5 * 60 * 1000)

// Simple route filter - skip static assets and health checks
function shouldLogRoute(pathname: string): boolean {
  const skipPatterns = [
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
    /^\/favicon/,
    /^\/health/,
    /^\/ping/,
  ]

  return !skipPatterns.some(pattern => pattern.test(pathname))
}

export const loggingMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getWebRequest()
    const url = new URL(request.url)

    // Skip logging for static assets and health checks
    if (!shouldLogRoute(url.pathname)) {
      return next()
    }

    // Generate simple request ID and start timing
    const requestId = Math.random().toString(36).substring(2, 15)
    const startTime = Date.now()
    requestTimings.set(requestId, startTime)

    // Log incoming request (automatically extracts all needed info)
    logRequest(request)

    try {
      const result = await next()

      // Calculate duration and log response
      const duration = Date.now() - startTime

      // Handle different result types
      if (result instanceof Response) {
        logResponse(request, result, duration)
      }

      // Cleanup timing
      requestTimings.delete(requestId)

      return result
    } catch (error) {
      // Log error and cleanup
      const duration = Date.now() - startTime
      requestTimings.delete(requestId)

      // Error will be logged by the route handler, just re-throw
      throw error
    }
  }
)
