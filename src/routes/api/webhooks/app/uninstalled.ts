import { createServerFileRoute } from '@tanstack/react-start/server'

export const ServerRoute = createServerFileRoute(
  '/api/webhooks/app/uninstalled'
).methods({
  POST: async ({ request }) => {
    try {
      const body = await request.json()

      console.log('app uninstalled webhook body:', body)

      return new Response('OK', { status: 200 })
    } catch (e) {
      console.error(e)
      return new Response('Not found', { status: 500 })
    }
  },
})
