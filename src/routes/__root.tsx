/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { DefaultCatchBoundary } from '~/components/default-catch-boundary'
import { NotFound } from '~/components/not-found'

export const Route = createRootRouteWithContext()({
  head: () => ({
    links: [
      {
        rel: 'preconnect',
        href: 'https://cdn.shopify.com',
      },
      {
        rel: 'preload',
        href: 'https://cdn.shopify.com/shopifycloud/polaris.js',
        as: 'script',
      },
    ],
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
        content: process.env.SHOPIFY_API_KEY!,
      },
    ],
    scripts: [
      {
        src: 'https://cdn.shopify.com/shopifycloud/app-bridge.js',
        rel: 'preconnect',
        fetchPriority: 'high',
      },
      {
        src: 'https://cdn.shopify.com/shopifycloud/polaris.js',
        rel: 'preconnect',
        fetchPriority: 'high',
      },
    ],
  }),
  errorComponent: props => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    )
  },
  pendingComponent: () => (
    <s-page>
      <s-spinner />
    </s-page>
  ),
  notFoundComponent: () => <NotFound />,
  shellComponent: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <s-app-nav>
        <Link to="/" rel="home">
          Home
        </Link>
      </s-app-nav>

      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
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
