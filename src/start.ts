import { createCsrfMiddleware, createStart } from '@tanstack/react-start'
import { shopifyRequestContextMiddleware } from '#/utils/middleware/auth-middleware'
import { botMiddleware } from '#/utils/middleware/bot-middleware'
import {
  requestLoggingMiddleware,
  serverFnLoggingMiddleware,
} from '#/utils/middleware/request-logging-middleware'

const csrfMiddleware = createCsrfMiddleware({
  filter: ctx => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [
    requestLoggingMiddleware,
    botMiddleware,
    csrfMiddleware,
    shopifyRequestContextMiddleware,
  ],
  functionMiddleware: [serverFnLoggingMiddleware],
}))
