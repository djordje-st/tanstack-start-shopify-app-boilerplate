import { createAdminApiClient } from '@shopify/admin-api-client'
import { SelectSession, SelectShop } from '~/db/schema'
import { apiVersion } from '~/utils/shopify-app'

export const createGraphqlClient = (
  shop: SelectShop,
  session: SelectSession
) => {
  if (!session?.accessToken) {
    throw new Error('Session missing access token')
  }

  return createAdminApiClient({
    storeDomain: shop.domain,
    apiVersion: apiVersion,
    accessToken: session.accessToken,
    retries: 3,
  })
}
