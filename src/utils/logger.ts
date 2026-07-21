import '@tanstack/react-start/server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import {
  configureSync,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogger,
} from '@logtape/logtape'
import { redactByField } from '@logtape/redaction'

const requestContext = new AsyncLocalStorage<Record<string, unknown>>()
const formatter = getJsonLinesFormatter({ properties: 'flatten' })

configureSync({
  sinks: {
    app: redactByField(getConsoleSink({ formatter })),
    meta: getConsoleSink({ formatter }),
  },
  loggers: [
    {
      category: ['logtape', 'meta'],
      lowestLevel: 'warning',
      sinks: ['meta'],
    },
    {
      category: 'shopify-app',
      lowestLevel: 'info',
      sinks: ['app'],
    },
  ],
})

const logger = getLogger('shopify-app').with({
  service: 'tanstack-start-shopify-app',
  environment: process.env.NODE_ENV ?? 'development',
  commit_hash:
    process.env.COMMIT_SHA ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    'unknown',
  service_version: process.env.SERVICE_VERSION ?? 'unknown',
  region:
    process.env.REGION ??
    process.env.RAILWAY_REPLICA_REGION ??
    process.env.VERCEL_REGION ??
    'unknown',
  instance_id:
    process.env.INSTANCE_ID ??
    process.env.RAILWAY_REPLICA_ID ??
    process.env.HOSTNAME ??
    'unknown',
})

export function withLogContext<T>(
  context: Record<string, unknown>,
  callback: () => T
): T {
  return requestContext.run(context, callback)
}

export function addLogContext(context: Record<string, unknown>): boolean {
  const current = requestContext.getStore()

  if (!current) return false

  Object.assign(current, context)
  return true
}

export function serializeError(error: unknown) {
  return error instanceof Error
    ? { type: error.name, message: error.message, stack: error.stack }
    : { type: 'UnknownError', message: String(error) }
}

export default logger
