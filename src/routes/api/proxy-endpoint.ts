import { createFileRoute } from '@tanstack/react-router'
import { SHOP_DETAILS_QUERY } from '#/graphql/admin/queries'
import { proxyMiddleware } from '#/utils/middleware/proxy-middleware'

// Example test endpoint that shows how to use Shopify's app proxy
export const Route = createFileRoute('/api/proxy-endpoint')({
  server: {
    middleware: [proxyMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const shopResponse = await context.admin.request(SHOP_DETAILS_QUERY)
        const shop = shopResponse.data?.shop

        return Response.json({
          shop: shop ? { name: shop.name, domain: context.shop.domain } : null,
        })
      },
    },
  },
})
