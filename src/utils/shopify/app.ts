import { webApiAdapterInitialized } from '@shopify/shopify-api/adapters/web-api'
import { ApiVersion, shopifyApi } from '@shopify/shopify-api'

if (!webApiAdapterInitialized) {
  throw new Error('Web API adapter not initialized')
}

export const apiVersion = ApiVersion.January26

export const shopifyApp = shopifyApi({
  apiVersion,
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_APP_SCOPES?.split(',') ?? [],
  hostName: process.env.SHOPIFY_APP_URL!.split('//')[1],
  isEmbeddedApp: true,
  future: {
    expiringOfflineAccessTokens: true,
    customerAddressDefaultFix: true,
    unstable_managedPricingSupport: true,
  },
})
