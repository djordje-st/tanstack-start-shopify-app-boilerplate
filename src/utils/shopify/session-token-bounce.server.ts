import '@tanstack/react-start/server-only'
import { shopifyApp } from '#/utils/shopify/app'

export function createSessionTokenBounceResponse(request: Request): Response {
  const shop = shopifyApp.utils.sanitizeShop(
    new URL(request.url).searchParams.get('shop') ?? ''
  )

  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': shop
      ? `frame-ancestors https://${shop} https://admin.shopify.com;`
      : "frame-ancestors 'none';",
  })

  return new Response(
    `<!doctype html><html><head><meta name="shopify-api-key" content="${shopifyApp.config.apiKey}"><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script></head></html>`,
    { headers }
  )
}
