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
- **[Winston](https://github.com/winstonjs/winston)** - Structured logging

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
- Request Logging - Comprehensive HTTP logging with security monitoring
- Theme Extensions - Extensible theme app extensions

## Installation

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/djordje-st/tanstack-start-shopify-app-boilerplate.git
cd tanstack-start-shopify-app-boilerplate
pnpm install
```

### 2. Start Local Services

```bash
pnpm docker:up
```

This starts a PostgreSQL container for local development.

### 3. Environment Configuration

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shopify_tanstack_dev

# Shopify App Credentials (from Partner Dashboard)
VITE_SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
```

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
