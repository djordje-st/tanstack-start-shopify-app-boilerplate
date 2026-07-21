# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0]

### Added

- **Server function CSRF protection** (`src/start.ts`) - Added TanStack Start's CSRF middleware for server function requests.

### Changed

- **Migrate the server runtime to Nitro 3** (`src/server.ts`, `vite.config.ts`, `package.json`) - Replaced the legacy Nitro v2 plugin with Nitro 3, adopted `srvx` responses, and updated the Vite React Compiler integration and runtime dependencies.

- **Update to Shopify Admin API 2026-07** (`.graphqlrc.ts`, `shopify.app.example.toml`, `src/utils/shopify/app.ts`, `src/types/generated/`) - Updated the app and webhook API versions and switched Admin GraphQL code generation to Shopify's local schema and generated type output.

- **Overhaul embedded app authentication** (`src/utils/middleware/auth-middleware.ts`, `src/utils/shopify/auth.ts`) - Added embedded-app redirects, stricter bearer token handling, Shopify retry responses, and single-flight refresh or exchange of expiring offline sessions with a five-minute expiry buffer.

- **Harden the session token bounce flow** (`src/routes/session-token-bounce.tsx`, `src/utils/shopify/session-token-bounce.server.ts`) - Moved bounce-page generation into a server-only helper and added no-store caching and shop-specific frame ancestor restrictions.

- **Process Shopify webhooks directly** (`src/routes/api/webhooks/app/`, `src/utils/middleware/webhook-middleware.ts`) - Webhook routes now validate the raw HMAC-signed request and perform uninstall and shop-redact cleanup synchronously.

- **Rename the public Shopify API key variable** (`.env.example`, `src/routes/__root.tsx`, `src/utils/shopify/app.ts`) - Replaced `SHOPIFY_API_KEY` with `VITE_SHOPIFY_API_KEY`; existing environments must be updated.

- **Update local PostgreSQL to 18.4** (`docker-compose.yml`) - Upgraded the development image and changed its data mount to PostgreSQL 18's expected `/var/lib/postgresql` path; existing development volumes require migration or recreation.

### Removed

- **Redis-backed queues, idempotency, reconciliation, and database caching** (`docker-compose.yml`, `src/utils/`) - Removed Redis, BullMQ workers, webhook deduplication and retries, reconciliation jobs, and the Drizzle Redis cache along with their dependencies and environment variables.

- **Storefront GraphQL code generation** (`.graphqlrc.ts`, `src/graphql/storefront/queries.ts`, `package.json`) - Removed the unused Storefront project, placeholder query, client dependency, and project-specific generation scripts.

- **Redundant GraphQL codegen dependencies** (`package.json`, `pnpm-lock.yaml`) - Removed direct dependencies already supplied by the GraphQL Code Generator CLI and Shopify API codegen preset.

## [2.5.0]

### Changed

- **Support expiring offline session handling** (`src/utils/middleware/auth-middleware.ts`, `src/utils/shopify/auth.ts`, `src/utils/shopify/proxy.ts`) - Centralized offline session loading so auth and proxy flows now reuse the same logic to return existing sessions, migrate legacy non-expiring offline tokens, refresh expiring offline tokens, and create new expiring offline sessions via token exchange when needed.

### Fixed

- **Webhook validation type compatibility** (`src/utils/middleware/webhook-middleware.ts`) - Updated webhook context creation to handle both Shopify webhook validation result variants by deriving the identifier from `webhookId` or `eventId` and only reading `subTopic` when present.

## [2.4.0]

### Changed

- **Update runtime and dependency stack** (`.nvmrc`, `package.json`, `pnpm-lock.yaml`) - Bumped Node.js to `24.13.0`, updated pnpm to `10.30.1`, and refreshed package versions across app/runtime/tooling dependencies.

- **Ignore build output for formatting** (`.prettierignore`) - Added `dist` to ignored paths.

- **Refactor session token bounce route response handling** (`src/routes/session-token-bounce.tsx`) - Replaced `loader`-thrown HTML responses with explicit `server.handlers.GET` response handling.

- **Simplify HTTP path logging** (`src/start.ts`) - Removed server function pathname decoding and now log raw request pathnames directly.

- **Refresh setup docs** (`README.md`) - Removed optional `LOG_TO_FILE` environment variable from setup example and cleaned script table formatting.

### Removed

- **Embedded header helper utilities** (`src/utils/shopify/auth.ts`) - Removed `addCorsHeaders` and `addDocumentHeaders`.

## [2.3.0]

### Changed

- **Move bot detection to global request middleware** (`src/start.ts`) - Bot rejection now happens at the earliest entry point before any auth or processing logic runs:
  - Configurable allowed bot patterns for Shopify POS, Mobile, Captain-Hook, and Mantle webhook user agents
  - Requests with `Authorization` headers bypass bot detection (e.g., testing tools)
  - Uses `isbot` library for detection with a `410 Gone` response for rejected bots

- **Simplify auth middleware** (`src/utils/middleware/auth-middleware.ts`) - Removed `rejectBotRequest` call since bot filtering is now handled globally

- **Use Vite env check** (`src/start.ts`) - Replaced `process.env.NODE_ENV === 'development'` with `import.meta.env.DEV`

- **Update webhook queue comments** (`src/utils/webhooks/queue.ts`) - `CUSTOMERS_DATA_REQUEST` and `CUSTOMERS_REDACT` handlers now have placeholder comments for custom logic

### Removed

- **`rejectBotRequest` function** (`src/utils/shopify/auth.ts`) - Bot detection consolidated into global middleware
- **Verbose session debug logging** (`src/utils/middleware/auth-middleware.ts`) - Removed "Using existing session" debug log

## [2.2.0]

### Added

- **Token exchange lock mechanism** (`src/utils/shopify/auth.ts`) - Prevents race conditions when multiple parallel requests arrive for the same shop:
  - In-memory lock map tracks ongoing token exchanges per shop
  - `withTokenExchangeLock` function ensures only one request performs token exchange while others wait
  - Double-checks for existing sessions after acquiring lock to avoid redundant exchanges

- **Server entry point** (`src/server.ts`) - Centralized server initialization with background worker support:
  - Initializes webhook and reconciliation workers in production
  - Skips worker initialization in development to avoid hot reload issues

### Changed

- **Improved bot detection** (`src/utils/shopify/auth.ts`) - Added explicit DuckDuckBot detection alongside isbot library

- **Session upsert conflict handling** (`src/utils/shopify/auth.ts`) - Changed conflict target from session ID to shop domain for more reliable session updates

- **Webhook topic format** (`src/utils/webhooks/queue.ts`) - Updated webhook topics to use Shopify's enum format:
  - `app/uninstalled` → `APP_UNINSTALLED`
  - `shop/redact` → `SHOP_REDACT`
  - `customers/data_request` → `CUSTOMERS_DATA_REQUEST`
  - `customers/redact` → `CUSTOMERS_REDACT`

## [2.1.0]

### Added

- **Lightweight GraphQL code generation** (`.graphqlrc.ts`) - Optimized codegen using `importTypes` to generate only operation-specific types:
  - Admin API types imported from `@shopify/admin-api-client`
  - Storefront API types imported from `@shopify/storefront-api-client`
  - Generated files are ~25 lines instead of 50,000+ lines
  - Support for Shopify Functions extensions with dynamic schema detection

- **New npm scripts for GraphQL codegen**:
  - `graphql:generate` - Generate all projects
  - `graphql:generate:admin` - Generate Admin API types only
  - `graphql:generate:storefront` - Generate Storefront API types only
  - `graphql:watch` - Watch mode for development

- **Organized GraphQL directory structure**:
  - `src/graphql/admin/` - Admin API queries and mutations
  - `src/graphql/storefront/` - Storefront API queries and mutations

### Changed

- **Moved queries** - `src/graphql/queries.ts` → `src/graphql/admin/queries.ts`
- **Updated imports** - All files now import from `~/graphql/admin/queries`

### Removed

- `src/graphql/queries.ts` - Moved to admin subdirectory
- `src/types/generated/admin.types.d.ts` - Replaced by lightweight `admin.generated.d.ts`
- `src/types/generated/admin-2026-01.schema.json` - No longer needed with `importTypes`

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
