# Shopify App Boilerplate

A modern Shopify app boilerplate built with TanStack Start and TypeScript.

## One Click Deploy to Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/tanstack-shopify-app-template?referralCode=0at3R0&utm_medium=integration&utm_source=template&utm_campaign=generic)

## Architecture Overview

### Frontend Stack

- **[TanStack Router](https://tanstack.com/router)** - Type-safe routing with data loaders
- **[TanStack Start](https://tanstack.com/start)** - Full-stack React framework
- **[React 19](https://react.dev)** - Latest React with concurrent features
- **[Shopify App Bridge](https://shopify.dev/docs/api/app-bridge-library)** - Native Shopify admin integration
- **[App Bridge UI](https://shopify.dev/docs/api/app-home/using-polaris-components)** - Pre-built UI components (`s-*` elements) using Polaris web components

### Backend Stack

- **[Drizzle ORM](https://orm.drizzle.team)** - Type-safe database operations with migrations
- **PostgreSQL 18.4** - Primary database
- **[LogTape](https://logtape.org/)** - One readable, redacted log line per request

### Shopify Integration

- **Admin API 2026-07** - Latest GraphQL API with generated types
- **App Proxy Authentication** - Secure frontend-backend communication
- **Webhook Authentication** - HMAC-validated webhook endpoint processing

## Features

- OAuth Authentication - Secure Shopify app installation
- Session Management - Persistent sessions with database storage
- GraphQL Integration - Type-safe Shopify Admin API queries
- App Proxy Support - Authenticated frontend API calls
- Webhook Handlers - Direct HMAC-validated endpoint processing
- Request Logging - One summary line per request, with errors and stack traces
- Theme Extensions - Extensible theme app extensions

### Logging

The server writes one log line per request. The message summarizes the request, so you can scan the log list without opening entries:

```text
GET / 200 42ms example.myshopify.com
POST /api/webhooks/app/uninstalled 401 2ms missing_hmac
GET loadApp() 200 2016ms Error: Connection terminated due to connection timeout
```

The summary contains the method, the path or server function name, the status, the duration, the shop, any rejection reason, and any error. A failed server function still responds with status 200, so its line is logged at the error level. Errors thrown in server routes, page loaders, and server functions include their stack trace.

In production, LogTape's JSON Lines formatter writes each line as JSON with `level` and `message` fields, which platforms such as Railway display in their log list. The other fields can be filtered: `request_id`, `method`, `path`, `status`, `duration_ms`, `shop`, `shop_id`, `server_fns`, `webhook_topic`, `rejection_reason`, `error`, `client_ip`, `country`, and `user_agent`. Empty fields are left out. During development, each request prints one short line, such as `INF GET / 200 29ms example.myshopify.com`, without a timestamp because the Shopify CLI adds one. Error lines also list the request's fields and stack trace.

To add a field to the current request's line, call `addLogContext()` from `#/utils/logger`. Fields with sensitive names, such as secrets, tokens, and passwords, are removed before output. Database errors are logged without their query parameters. Shopify SDK warnings and errors are logged as separate lines that include the `request_id`.

## Installation

### 1. Clone and Install Dependencies

Use Node.js 24 (see `.nvmrc`) and the pnpm version pinned in `package.json`.

```bash
git clone https://github.com/djordje-st/tanstack-start-shopify-app-boilerplate.git
cd tanstack-start-shopify-app-boilerplate
pnpm install
```

### 2. Start Local Services

```bash
pnpm docker:up
```

This starts a PostgreSQL container on host port `5433` to avoid conflicts with other local projects that use port `5432`.

### 3. Environment Configuration

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/shopify_tanstack_dev

# Shopify App Credentials (from Partner Dashboard)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
```

The server reads both values at runtime, so one build works for any app. `shopify app dev`
sets them for you during local development.

### 4. Database Setup

```bash
# Push schema to database
pnpm db:push

# Or use migrations
pnpm db:generate && pnpm db:migrate
```

### 5. Link Your Shopify App

```bash
shopify app config link
```

This creates/links a Shopify app and generates the `shopify.app.toml` configuration.

### 6. Start Development Server

```bash
# Start with Shopify CLI (recommended)
pnpm dev
```

## Available Scripts

| Script                  | Description                       |
| ----------------------- | --------------------------------- |
| `pnpm dev`              | Start dev server with Shopify CLI |
| `pnpm app:dev`          | Start Vite dev server only        |
| `pnpm app:build`        | Build for production              |
| `pnpm app:start`        | Start production server           |
| `pnpm db:push`          | Push schema changes to database   |
| `pnpm db:generate`      | Generate migration files          |
| `pnpm db:migrate`       | Run migrations                    |
| `pnpm db:studio`        | Open Drizzle Studio               |
| `pnpm docker:up`        | Start Docker services             |
| `pnpm docker:down`      | Stop Docker services              |
| `pnpm docker:destroy`   | Remove Docker volumes             |
| `pnpm graphql:generate` | Generate GraphQL types            |
| `pnpm typecheck`        | Run TypeScript checks             |
| `pnpm lint`             | Run ESLint                        |
| `pnpm format`           | Format with Prettier              |

## Project Structure

```
src/
├── components/          # React components
├── db/
│   ├── migrations/      # Drizzle migrations
│   └── schema/          # Database schema (modular)
├── graphql/             # GraphQL queries
├── routes/              # TanStack Router routes
│   └── api/             # API routes (webhooks, proxy)
├── types/               # TypeScript definitions
│   └── generated/       # Auto-generated types
└── utils/
    ├── middleware/      # Request middleware
    └── shopify/         # Shopify utilities
```

## Troubleshooting

### App won't load in Shopify admin

- Run `shopify app config link` to ensure app is properly linked
- Check that your tunnel URL matches the app configuration
- Ensure App Bridge scripts are loading correctly

### Database connection failed

- Run `pnpm docker:up` to start PostgreSQL
- Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Run `pnpm db:push` to ensure schema is up to date

### GraphQL queries failing

- Verify app has correct scopes in `shopify.app.toml`
- Check that access token is valid
- Run `pnpm graphql:generate` to regenerate types

## Resources

- [Shopify App Development](https://shopify.dev/docs/apps)
- [TanStack Router Documentation](https://tanstack.com/router)
- [TanStack Start Documentation](https://tanstack.com/start)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Shopify CLI Documentation](https://shopify.dev/docs/apps/tools/cli)
- [App Bridge UI Components](https://shopify.dev/docs/api/app-home/web-components)

## Contributing

Contributions are welcome:

- Report issues and bugs
- Suggest improvements
- Submit pull requests
