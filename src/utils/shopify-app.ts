import '@shopify/shopify-api/adapters/web-api'
import { shopifyApi, ApiVersion } from '@shopify/shopify-api'

export const apiVersion = ApiVersion.July25

export const shopifyApp = shopifyApi({
  apiVersion,
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_APP_SCOPES!.split(','),
  hostName: process.env.SHOPIFY_APP_URL!.split('//')[1],
  isEmbeddedApp: true,
  future: {
    lineItemBilling: true,
    customerAddressDefaultFix: true,
    unstable_managedPricingSupport: true,
  },
})
