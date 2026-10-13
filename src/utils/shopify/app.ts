import '@tanstack/react-start/server-only'
import { webApiAdapterInitialized } from '@shopify/shopify-api/adapters/web-api'
import { ApiVersion, LogSeverity, shopifyApi } from '@shopify/shopify-api'
import logger, { getLogContext } from '#/utils/logger'

if (!webApiAdapterInitialized) {
  throw new Error('Web API adapter not initialized')
}

export const apiVersion = ApiVersion.July26

export const shopifyApp = shopifyApi({
  apiVersion,
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_APP_SCOPES?.split(',') ?? [],
  hostName: process.env.SHOPIFY_APP_URL!.split('//')[1],
  isEmbeddedApp: true,
  logger: {
    level: LogSeverity.Warning,
    timestamps: false,
    log: (severity, message) => {
      const event = {
        event: 'shopify_sdk',
        request_id: getLogContext()?.request_id,
      }

      if (severity === LogSeverity.Error) logger.error(message, event)
      else logger.warning(message, event)
    },
  },
  future: {
    customerAddressDefaultFix: true,
    unstable_managedPricingSupport: true,
  },
})
