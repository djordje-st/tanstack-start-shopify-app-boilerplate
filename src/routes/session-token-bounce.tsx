import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

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

const getBouncePageHtml = createServerFn({ method: 'GET' }).handler(() => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="shopify-api-key" content="${process.env.SHOPIFY_API_KEY}" />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background-color: #f1f1f1;
            color: #1a1a1a;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }

          .spinner {
            width: 28px;
            height: 28px;
            border: 3px solid #e3e3e3;
            border-top-color: #616161;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          .loading-text {
            font-size: 14px;
            color: #616161;
          }
        </style>
      </head>

      <body>
        <div class="loading-container">
          <div class="spinner"></div>
          <p class="loading-text">Loading...</p>
        </div>
      </body>
    </html>
  `
})

export const Route = createFileRoute('/session-token-bounce')({
  loader: async () => {
    const html = await getBouncePageHtml()

    throw new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  },

  component: () => null,
})
