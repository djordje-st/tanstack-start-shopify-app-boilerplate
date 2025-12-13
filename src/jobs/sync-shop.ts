import { Queue, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { redis as connection } from '~/utils/redis'
import { SHOP_QUERY } from '~/graphql/queries'
import { createGraphqlClient } from '~/utils/shopify/graphql-client'
import { db } from '~/db'
import { shops } from '~/db/schema'

export const SYNC_SHOP_JOB_NAME = 'sync-shop'

/**
 * @description Queue for syncing shop data from the Shopify API
 */
export const syncShopScheduler = new Queue(SYNC_SHOP_JOB_NAME, { connection })

const worker = new Worker(
  SYNC_SHOP_JOB_NAME,
  async job => {
    const graphql = createGraphqlClient(job.data.shop, job.data.session)

    const shopData = await graphql.request(SHOP_QUERY)

    await db
      .update(shops)
      .set({
        name: shopData.data?.shop?.name,
        email: shopData.data?.shop?.email,
        timezone: shopData.data?.shop?.ianaTimezone,
        currency: shopData.data?.shop?.currencyCode,
        plan: shopData.data?.shop?.plan.publicDisplayName,
        domain: shopData.data?.shop?.myshopifyDomain,
      })
      .where(eq(shops.id, job.data.shop.id))
  },
  { connection }
)

worker.on('completed', job => {
  console.log(`Job ${SYNC_SHOP_JOB_NAME} - ${job.id} completed`)
})

worker.on('failed', (job, error) => {
  console.log(
    `Job ${SYNC_SHOP_JOB_NAME} - ${job?.id} failed with error: ${error}`
  )
})
