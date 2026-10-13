import { createMiddleware } from '@tanstack/react-start'
import { isNotFound } from '@tanstack/react-router'
import type { LogContext, SerializedError } from '#/utils/logger'
import logger, {
  getLogContext,
  serializeError,
  withLogContext,
} from '#/utils/logger'

function getClientIp(headers: Headers): string | null {
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    headers.get('x-real-ip')
  )
}

function getSummary(event: LogContext, handlerType: string): string {
  const error = event.error as SerializedError | undefined
  const serverFns = event.server_fns as Array<string> | undefined
  const target =
    handlerType === 'serverFn' && serverFns ? `${serverFns[0]}()` : event.path

  return [
    event.method,
    target,
    event.status,
    `${event.duration_ms}ms`,
    event.shop,
    event.rejection_reason,
    error &&
      `${error.type}: ${error.message.replace(/\s+/g, ' ').slice(0, 160)}`,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Emits one log line per request. Middleware and handlers enrich it with addLogContext.
 */
export const requestLoggingMiddleware = createMiddleware().server(
  async ({ next, request, handlerType }) => {
    const startTime = performance.now()
    const { headers } = request
    const event: LogContext = Object.fromEntries(
      Object.entries({
        event: 'http_request',
        request_id:
          headers.get('x-request-id') ??
          headers.get('x-shopify-webhook-id') ??
          headers.get('cf-ray') ??
          crypto.randomUUID(),
        method: request.method,
        path: new URL(request.url).pathname,
        client_ip: getClientIp(headers),
        country: headers.get('cf-ipcountry'),
        user_agent: headers.get('user-agent')?.slice(0, 120),
      }).filter(([, value]) => value != null)
    )

    return withLogContext(event, async () => {
      let status = 500

      try {
        const result = await next()
        status = result.response.status

        return result
      } catch (error) {
        if (error instanceof Response) {
          status = error.status
          throw error
        }

        // Respond here so Start does not also print the raw error.
        event.error = serializeError(error)
        throw Response.json({ error: 'Internal Server Error' }, { status: 500 })
      } finally {
        event.status = status
        event.duration_ms = Math.round(performance.now() - startTime)

        const message = getSummary(event, handlerType)

        if (event.error || status >= 500) logger.error(message, event)
        else if (status >= 400) logger.warning(message, event)
        else logger.info(message, event)
      }
    })
  }
)

/**
 * Records which server functions ran during a request and why one failed.
 * A failed server function call still responds with HTTP 200.
 */
export const serverFnLoggingMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ next, serverFnMeta }) => {
  const event = getLogContext()

  if (event) {
    event.server_fns = [
      ...((event.server_fns as Array<string> | undefined) ?? []),
      serverFnMeta.name,
    ]
  }

  try {
    return await next()
  } catch (error) {
    if (event && !(error instanceof Response) && !isNotFound(error)) {
      event.error = { ...serializeError(error), server_fn: serverFnMeta.name }
    }

    throw error
  }
})
