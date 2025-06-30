import { Link } from '@tanstack/react-router'
import { ReactNode } from 'react'

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <s-page inlineSize="small">
      <s-section>
        <s-banner tone="warning">
          <s-heading>Page Not Found</s-heading>

          <s-paragraph>
            {children || 'The page you are looking for does not exist.'}
          </s-paragraph>
        </s-banner>

        <Link to="/">
          <s-button variant="primary">Go to Homepage</s-button>
        </Link>
      </s-section>
    </s-page>
  )
}
