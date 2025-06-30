import { redis as connection } from '~/utils/redis'
import { Queue, Worker } from 'bullmq'
import { SHOP_QUERY } from '~/graphql/queries'
import { createGraphqlClient } from '~/utils/shopify-graphql-client'
import { db } from '~/db'
import { shops } from '~/db/schema'
import { eq } from 'drizzle-orm'

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
        contactEmail: shopData.data?.shop?.contactEmail,
        currencyCode: shopData.data?.shop?.currencyCode,
        weightUnit: shopData.data?.shop?.weightUnit,
        timezone: shopData.data?.shop?.ianaTimezone,
        url: shopData.data?.shop?.url,
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
