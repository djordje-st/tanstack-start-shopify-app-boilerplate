import '@tanstack/react-start/server-only'
import { webApiAdapterInitialized } from '@shopify/shopify-api/adapters/web-api'
import { ApiVersion, LogSeverity, shopifyApi } from '@shopify/shopify-api'
import logger, { addLogContext } from '#/utils/logger'

if (!webApiAdapterInitialized) {
  throw new Error('Web API adapter not initialized')
}

export const apiVersion = ApiVersion.July26

export const shopifyApp = shopifyApi({
  apiVersion,
  apiKey: process.env.VITE_SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_APP_SCOPES?.split(',') ?? [],
  hostName: process.env.SHOPIFY_APP_URL!.split('//')[1],
  isEmbeddedApp: true,
  logger: {
    level: import.meta.env.DEV ? LogSeverity.Debug : LogSeverity.Info,
    timestamps: false,
    log: (severity, message) => {
      const context = {
        shopify_sdk_level: LogSeverity[severity].toLowerCase(),
        shopify_sdk_message: message,
      }

      if (addLogContext(context)) return

      const event = { event: 'shopify_sdk', ...context }
      if (severity === LogSeverity.Error) logger.error('shopify_sdk', event)
      else logger.info('shopify_sdk', event)
    },
  },
  future: {
    customerAddressDefaultFix: true,
    unstable_managedPricingSupport: true,
  },
})
