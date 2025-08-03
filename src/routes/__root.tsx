/// <reference types="vite/client" />
import { NavMenu } from '@shopify/app-bridge-react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { createServerFn } from '@tanstack/react-start'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import { authMiddleware } from '~/utils/middleware/auth-middleware'

const handleShopifyAuth = createServerFn({ method: 'GET' })
  .validator((data: string | null) => data)
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { session } = context

    if (!session) {
      throw redirect({ to: '/' })
    }

    return session
  })

export const Route = createRootRouteWithContext()({
  head: () => ({
    links: [
      {
        rel: 'preconnect',
        href: 'https://cdn.shopify.com',
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
      },
      {
        src: 'https://cdn.shopify.com/shopifycloud/app-bridge-ui-experimental.js',
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
  component: RootComponent,
  beforeLoad: ({ location }) => {
    const idToken = new URLSearchParams(location.search).get('id_token')

    if (!idToken) {
      return null
    }

    return handleShopifyAuth({ data: idToken })
  },
})

function RootComponent() {
  return (
    <RootDocument>
      <NavMenu>
        <Link to="/" rel="home">
          Home
        </Link>

        <Link to="/about">About</Link>
      </NavMenu>

      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>

      <body>
        {children}

        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
