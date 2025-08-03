import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_unauthorized')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()

  return (
    <s-page>
      <s-section>
        <s-text>
          An issue occured while loading the page. Please try again.
        </s-text>

        <s-button variant="primary" onClick={() => navigate({ to: '/' })}>
          Go to home
        </s-button>
      </s-section>
    </s-page>
  )
}
