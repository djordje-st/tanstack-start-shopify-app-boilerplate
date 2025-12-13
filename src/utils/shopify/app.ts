import { nodeAdapterInitialized } from '@shopify/shopify-api/adapters/node'
import { ApiVersion, shopifyApi } from '@shopify/shopify-api'

if (!nodeAdapterInitialized) {
  throw new Error('Node adapter not initialized')
}

export const apiVersion = ApiVersion.October25

export const shopifyApp = shopifyApi({
  apiVersion,
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_APP_SCOPES?.split(',') ?? [],
  hostName: process.env.SHOPIFY_APP_URL!.split('//')[1],
  isEmbeddedApp: true,
  future: {
    customerAddressDefaultFix: true,
    unstable_managedPricingSupport: true,
  },
})
