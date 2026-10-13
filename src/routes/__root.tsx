import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { QueryClient } from '@tanstack/react-query'
import { authMiddleware } from '#/utils/middleware/auth-middleware'
import { shopifyApp } from '#/utils/shopify/app'

const loadApp = createServerFn()
  .middleware([authMiddleware])
  .handler(() => ({ apiKey: shopifyApp.config.apiKey }))

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    // Authenticate once per document load; server functions authenticate their own calls.
    loader: () => loadApp(),
    staleTime: Infinity,
    head: ({ loaderData }) => ({
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          name: 'shopify-debug',
          content: 'web-vitals',
        },
        {
          name: 'shopify-api-key',
          content: loaderData?.apiKey,
        },
      ],
      scripts: [
        {
          src: 'https://cdn.shopify.com/shopifycloud/app-bridge.js',
          fetchPriority: 'high',
        },
        {
          src: 'https://cdn.shopify.com/shopifycloud/polaris-1.js',
        },
      ],
    }),
    pendingComponent: () => (
      <s-page>
        <s-spinner />
      </s-page>
    ),
    shellComponent: RootDocument,
    component: RootComponent,
  }
)

function RootComponent() {
  return (
    <>
      <s-app-nav>
        <Link to="/" rel="home">
          Home
        </Link>
      </s-app-nav>

      <Outlet />
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>

      <body>
        {children}

        <Scripts />
      </body>
    </html>
  )
}
