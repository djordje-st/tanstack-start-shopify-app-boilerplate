import { createFileRoute } from '@tanstack/react-router'
import { createSessionTokenBounceResponse } from '#/utils/shopify/session-token-bounce.server'

/**
 * Session Token Bounce Page
 *
 * This page serves as a fallback mechanism to obtain session tokens when they're
 * unavailable in request headers or URL parameters. It loads the App Bridge script
 * which automatically:
 * 1. Detects the `shopify-reload` query parameter
 * 2. Obtains a fresh session token
 * 3. Redirects back to the original URL with the new token
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/set-embedded-app-authorization
 */

export const Route = createFileRoute('/session-token-bounce')({
  server: {
    handlers: {
      GET: ({ request }) => createSessionTokenBounceResponse(request),
    },
  },
})
