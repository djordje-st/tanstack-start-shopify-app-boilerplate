import { createFileRoute } from '@tanstack/react-router'
import { SHOP_QUERY } from '#/graphql/admin/queries'
import { proxyMiddleware } from '#/utils/middleware/proxy-middleware'
import { handleProxyError } from '#/utils/shopify/proxy'

// Example test endpoint that shows how to use Shopify's app proxy
export const Route = createFileRoute('/api/proxy-endpoint')({
  server: {
    middleware: [proxyMiddleware],
    handlers: {
      GET: async ({ context }) => {
        try {
          const { admin } = context

          const shopResponse = await admin.request(SHOP_QUERY)

          return Response.json(shopResponse.data)
        } catch (error) {
          return handleProxyError(error, context)
        }
      },
    },
  },
})
