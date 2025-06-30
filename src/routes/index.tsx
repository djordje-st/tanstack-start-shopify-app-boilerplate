import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { PRODUCT_QUERY } from '~/graphql/queries'
import { syncShopScheduler, SYNC_SHOP_JOB_NAME } from '~/jobs/sync-shop'
import { logError } from '~/utils/logger'
import { authMiddleware } from '~/utils/middleware/auth-middleware'

const homeLoader = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const productsResponse = await context.graphql.request(PRODUCT_QUERY)

      return {
        products: productsResponse.data?.products?.edges || [],
        authSuccess: true,
      }
    } catch (error) {
      logError('Failed to fetch data:', error)

      return {
        shop: null,
        products: [],
        authSuccess: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

const homeAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await syncShopScheduler.upsertJobScheduler(
      SYNC_SHOP_JOB_NAME,
      {
        pattern: '0 0 * * *', // Job will repeat every day at 00:00:00
      },
      {
        data: context,
      }
    )
  })

const removeJob = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async () => {
    await syncShopScheduler.removeJobScheduler(SYNC_SHOP_JOB_NAME)
  })

export const Route = createFileRoute('/')({
  loader: () => homeLoader(),
  component: HomeComponent,
})

function HomeComponent() {
  const loaderData = Route.useLoaderData()

  return (
    <s-page>
      <s-section heading="Welcome to Your Shopify App">
        <s-paragraph>
          {loaderData?.authSuccess ? '✓ Authenticated' : '✗ Failed'}
        </s-paragraph>

        {loaderData?.error && (
          <s-paragraph>Error: {loaderData?.error}</s-paragraph>
        )}

        <s-stack direction="inline" gap="small">
          <s-button onClick={() => homeAction()}>Add Job</s-button>
          <s-button onClick={() => removeJob()}>Remove Job</s-button>
        </s-stack>
      </s-section>

      {loaderData?.authSuccess ? (
        <s-section padding="none">
          {loaderData?.products.length > 0 ? (
            <s-table
              onNextPage={() => console.log('next page')}
              onPreviousPage={() => console.log('prev page')}
              hasNextPage
              hasPreviousPage
              paginate
            >
              <s-table-header-row>
                <s-table-header listSlot="primary">Name</s-table-header>
                <s-table-header>Handle</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>

              <s-table-body>
                {loaderData?.products.map((edge, index) => (
                  <s-table-row key={edge.node.id || index}>
                    <s-table-cell>{edge.node.title}</s-table-cell>
                    <s-table-cell>{edge.node.handle}</s-table-cell>

                    <s-table-cell>
                      <s-button
                        href={`shopify://admin/products/${edge.node.id
                          .split('/')
                          .at(-1)}`}
                      >
                        View
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          ) : (
            <s-section>
              <s-heading>No products found</s-heading>

              <s-text>
                Create some products in your Shopify admin to see them here.
              </s-text>
            </s-section>
          )}
        </s-section>
      ) : null}
    </s-page>
  )
}
