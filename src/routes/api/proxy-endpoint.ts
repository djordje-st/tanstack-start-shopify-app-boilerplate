import { json } from '@tanstack/react-start'
import { createServerFileRoute } from '@tanstack/react-start/server'
import { SHOP_QUERY } from '~/graphql/queries'
import { logError } from '~/utils/logger'
import { authenticateProxy } from '~/utils/shopify-proxy'

export const ServerRoute = createServerFileRoute('/api/proxy-endpoint').methods({
  GET: async ({ request }) => {
    try {
      // Verify proxy request and get shop + GraphQL client
      const { graphql } = await authenticateProxy(request)

      const shopResponse = await graphql.request(SHOP_QUERY)

      return json(shopResponse.data)
    } catch (e) {
      logError('❌ Error in products API:', e)

      const errorMessage = e instanceof Error ? e.message : 'Unknown error'

      // Return appropriate status codes based on error type
      if (errorMessage.includes('Invalid Shopify proxy request')) {
        return new Response('Unauthorized', { status: 401 })
      }

      if (errorMessage.includes('Missing shop parameter')) {
        return new Response('Bad Request: Missing shop parameter', {
          status: 400,
        })
      }

      if (
        errorMessage.includes('Shop not found') ||
        errorMessage.includes('No valid session')
      ) {
        return new Response(`Not Found: ${errorMessage}`, { status: 404 })
      }

      return new Response(`Internal Server Error: ${errorMessage}`, {
        status: 500,
      })
    }
  },
})
