import '@tanstack/react-start/server-only'
import { shopifyApp } from '#/utils/shopify/app'

export function createSessionTokenBounceResponse(): Response {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8',
  })

  return new Response(
    `<!doctype html><html><head><meta name="shopify-api-key" content="${shopifyApp.config.apiKey}"><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script></head></html>`,
    { headers }
  )
}
