import { createMiddleware } from '@tanstack/react-start'
import { isbot } from 'isbot'
import { addLogContext } from '#/utils/logger'

const ALLOWED_BOT_PATTERNS = [
  /^Shopify POS\//,
  /^Shopify Mobile\//,
  /^Shopify-Captain-Hook$/,
]

function shouldRejectBot(request: Request): boolean {
  const userAgent = request.headers.get('user-agent') ?? ''
  const { pathname } = new URL(request.url)

  // Bot detection only applies to app pages, not API calls or token recovery.
  if (
    process.env.NODE_ENV === 'development' ||
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

export const botMiddleware = createMiddleware().server(
  ({ next, request, handlerType }) => {
    if (handlerType === 'router' && shouldRejectBot(request)) {
      addLogContext({ rejection_reason: 'bot' })
      throw new Response(null, { status: 410, statusText: 'Gone' })
    }

    return next()
  }
)
