import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { SHOP_QUERY } from '~/graphql/queries'
import { authMiddleware } from '~/utils/middleware/auth-middleware'

const aboutLoader = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const shopResponse = await context.graphql.request(SHOP_QUERY)

      return {
        shop: shopResponse.data?.shop,
        authSuccess: true,
      }
    } catch (error) {
      console.error('Failed to fetch shop data:', error)
      return {
        shop: null,
        authSuccess: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

export const Route = createFileRoute('/about')({
  component: AboutComponent,
  loader: () => aboutLoader(),
})

function AboutComponent() {
  const loaderData = Route.useLoaderData()

  return (
    <s-page>
      {/* Authentication Status */}
      <s-section heading="Authentication Status">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text>Status: </s-text>
            <s-text>
              {loaderData.authSuccess ? '✓ Authenticated' : '✗ Failed'}
            </s-text>
          </s-paragraph>
          {loaderData.error && (
            <s-banner tone="critical">
              <s-paragraph>Error: {loaderData.error}</s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      {/* Shop Information */}
      {loaderData.authSuccess && loaderData.shop ? (
        <s-section>
          <s-heading>Shop Information</s-heading>

          <s-stack direction="block" gap="base">
            <s-box>
              <s-paragraph>
                <s-text>Shop Name:</s-text>
              </s-paragraph>
              <s-paragraph>{loaderData.shop.name}</s-paragraph>
            </s-box>

            <s-box>
              <s-paragraph>
                <s-text>Email:</s-text>
              </s-paragraph>
              <s-paragraph>{loaderData.shop.email}</s-paragraph>
            </s-box>

            <s-box>
              <s-paragraph>
                <s-text>Domain:</s-text>
              </s-paragraph>
              <s-paragraph>{loaderData.shop.myshopifyDomain}</s-paragraph>
            </s-box>

            <s-box>
              <s-paragraph>
                <s-text>Plan Type:</s-text>
              </s-paragraph>
              <s-paragraph>
                {loaderData.shop.plan?.partnerDevelopment
                  ? 'Development'
                  : 'Production'}
              </s-paragraph>
            </s-box>
          </s-stack>
        </s-section>
      ) : loaderData.authSuccess ? (
        <s-section>
          <s-banner tone="warning">
            <s-paragraph>
              Authentication successful but no shop data available.
            </s-paragraph>
          </s-banner>
        </s-section>
      ) : null}
    </s-page>
  )
}
