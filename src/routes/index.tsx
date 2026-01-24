import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '~/utils/middleware/auth-middleware'

const homepageLoader = createServerFn({})
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return {
      session: context.session,
      shop: context.shop,
    }
  })

export const Route = createFileRoute('/')({
  component: HomeComponent,
  loader: () => homepageLoader(),
})

function HomeComponent() {
  return (
    <s-page heading="Home">
      <s-section>
        <s-heading>Home</s-heading>
        <s-paragraph>Welcome to the home page</s-paragraph>
      </s-section>
    </s-page>
  )
}
