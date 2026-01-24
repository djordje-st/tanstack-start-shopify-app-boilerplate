# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0]

### Added

- **Global request logging middleware** (`src/start.ts`) - Comprehensive HTTP request/response logging with:
  - Server function name decoding for readable logs
  - Client IP extraction (supports Cloudflare, X-Forwarded-For, X-Real-IP)
  - Suspicious path detection for security monitoring
  - Performance tracking with slow request alerts (>1s)
  - Cloudflare integration (country codes, ray IDs)

- **Session token bounce page** (`src/routes/session-token-bounce.tsx`) - Fallback mechanism for obtaining session tokens when unavailable in headers or URL parameters

- **Webhook middleware** (`src/utils/middleware/webhook-middleware.ts`) - Centralized webhook handling with:
  - HMAC signature validation
  - Duplicate detection using X-Shopify-Event-Id
  - Background queue processing via BullMQ
  - Delayed webhook monitoring

- **Webhook job queue** (`src/utils/webhooks/queue.ts`) - BullMQ-based background processing for webhooks

- **Docker Compose configuration** - Local development setup for PostgreSQL 16 and Redis 7

- **Database migrations** - Drizzle migration files for version-controlled schema changes

- **Modular database schema** - Split schema into separate files:
  - `src/db/schema/common.ts` - Shared column definitions
  - `src/db/schema/sessions.ts` - Session table
  - `src/db/schema/shops.ts` - Shop table

- **Shopify JSX types** (`src/types/shopify-jsx.d.ts`) - Type definitions for App Bridge UI web components

### Changed

- **Updated to Shopify Admin API 2026-01** - Latest API version with updated type definitions

- **Simplified auth middleware** (`src/utils/middleware/auth-middleware.ts`) - Streamlined authentication flow with better session token handling

- **Improved proxy middleware** (`src/utils/middleware/proxy-middleware.ts`) - Enhanced app proxy authentication and signature verification

- **Refactored auth utilities** (`src/utils/shopify/auth.ts`) - Cleaner OAuth flow implementation

- **Updated proxy utilities** (`src/utils/shopify/proxy.ts`) - Improved signature validation logic

- **Simplified webhook idempotency** (`src/utils/webhooks/idempotency.ts`) - Streamlined duplicate detection

- **Cleaner index page** (`src/routes/index.tsx`) - Simplified home component using App Bridge UI elements

- **Updated dependencies**:
  - React 19.2.3
  - TanStack Router/Start 1.156.0
  - Drizzle ORM 0.45.1
  - Vite 7.3.1
  - Zod 4.3.6
  - TypeScript 5.9.3
  - And more...

### Removed

- `src/components/DefaultCatchBoundary.tsx` - Renamed to kebab-case
- `src/components/NotFound.tsx` - Renamed to kebab-case
- `src/jobs/sync-shop.ts` - Moved to `src/utils/jobs/`
- `src/routes/about.tsx` - Removed example route
- `src/utils/get-shop-auth.ts` - Consolidated into auth middleware
- `src/utils/shopify/graphql-client.ts` - Use Shopify API client directly
- `src/types/generated/admin-2025-10.schema.json` - Replaced with 2026-01 version
