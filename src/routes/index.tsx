import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
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
