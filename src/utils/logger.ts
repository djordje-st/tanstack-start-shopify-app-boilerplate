import '@tanstack/react-start/server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import {
  compareLogLevel,
  configureSync,
  getAnsiColorFormatter,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogger,
  withFilter,
} from '@logtape/logtape'
import { getPrettyFormatter } from '@logtape/pretty'
import { redactByField } from '@logtape/redaction'
import type { Sink, TextFormatter } from '@logtape/logtape'

export type LogContext = Record<string, unknown>

export type SerializedError = {
  type: string
  message: string
  stack?: Array<string>
  query?: string
}

const requestContext = new AsyncLocalStorage<LogContext>()

const consoleSink = (formatter: TextFormatter) =>
  redactByField(getConsoleSink({ formatter }))

const sinks: Record<string, Sink> = import.meta.env.DEV
  ? {
      console: withFilter(
        consoleSink(
          getAnsiColorFormatter({
            timestamp: 'none',
            format: ({ level, message }) => `${level} ${message}`,
          })
        ),
        record => compareLogLevel(record.level, 'error') < 0
      ),
      errors: withFilter(
        consoleSink(
          getPrettyFormatter({
            level: 'ABBR',
            icons: false,
            align: false,
            properties: true,
            wordWrap: false,
          })
        ),
        'error'
      ),
    }
  : {
      console: consoleSink(
        getJsonLinesFormatter({ message: 'template', properties: 'flatten' })
      ),
    }

configureSync({
  sinks,
  loggers: [
    {
      category: ['logtape', 'meta'],
      lowestLevel: 'warning',
      sinks: Object.keys(sinks),
    },
    {
      category: 'shopify-app',
      lowestLevel: 'info',
      sinks: Object.keys(sinks),
    },
  ],
})

const logger = getLogger('shopify-app')

export function withLogContext<T>(context: LogContext, callback: () => T): T {
  return requestContext.run(context, callback)
}

export function getLogContext(): LogContext | undefined {
  return requestContext.getStore()
}

export function addLogContext(context: LogContext): void {
  Object.assign(requestContext.getStore() ?? {}, context)
}

function getStackFrames(stack: string | undefined): Array<string> | undefined {
  return stack
    ?.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('at '))
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error && 'query' in error && 'params' in error) {
    const cause = serializeError(error.cause)

    return {
      ...cause,
      query: String(error.query),
      stack: getStackFrames(error.stack),
    }
  }

  if (!(error instanceof Error)) {
    return { type: 'UnknownError', message: String(error) }
  }

  return {
    type: error.name === 'Error' ? error.constructor.name : error.name,
    message: error.message,
    stack: getStackFrames(error.stack),
  }
}

export default logger
