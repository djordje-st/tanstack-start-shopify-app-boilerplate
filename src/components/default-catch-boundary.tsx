import { ErrorComponent, Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  return (
    <s-page inlineSize="small">
      <s-section>
        <s-stack direction="block">
          <s-banner tone="critical">
            <s-heading>Something went wrong</s-heading>

            <s-paragraph>
              An error occurred while loading this page. Please try again or go
              back to the homepage.
            </s-paragraph>
          </s-banner>

          {import.meta.env.DEV ? (
            <s-box>
              <ErrorComponent error={error} />
            </s-box>
          ) : null}

          <Link to="/">
            <s-button variant="primary">Home</s-button>
          </Link>
        </s-stack>
      </s-section>
    </s-page>
  )
}
