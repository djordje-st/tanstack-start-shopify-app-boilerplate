# Shopify App Boilerplate

⚠️ **NOT PRODUCTION READY** - This is a development boilerplate for learning and experimentation purposes.

A modern Shopify app boilerplate built with TanStack Start, and TypeScript.

## 🏗️ Architecture Overview

### Frontend Stack

- **[TanStack Router](https://tanstack.com/router)** - Type-safe routing with data loaders
- **[TanStack Start](https://tanstack.com/start)** - Full-stack React framework
- **[React 19](https://react.dev)** - Latest React with concurrent features
- **[Shopify App Bridge](https://shopify.dev/docs/api/app-bridge-library)** - Native Shopify admin integration
- **[Shopify App Bridge UI](https://shopify.dev/docs/api/app-home/using-polaris-components)** - Pre-built UI components (`s-*` elements) using the experimental Polaris web components

### Backend Stack

- **[Drizzle ORM](https://orm.drizzle.team)** - Type-safe database operations
- **PostgreSQL** - Primary database
- **[Redis](https://redis.io)** - Session storage and job queue
- **[BullMQ](https://docs.bullmq.io)** - Background job processing
- **[Winston](https://github.com/winstonjs/winston)** - Structured logging

### Shopify Integration

- **Admin API Client** - GraphQL API interactions
- **App Proxy Authentication** - Secure frontend-backend communication
- **Webhook Handling** - App lifecycle events
- **Theme Extensions** - Custom storefront blocks

## 🚀 Features

### Core Functionality

- ✅ **OAuth Authentication** - Secure Shopify app installation
- ✅ **Session Management** - Persistent user sessions with database storage
- ✅ **GraphQL Integration** - Type-safe Shopify Admin API queries
- ✅ **App Proxy Support** - Authenticated frontend API calls
- ✅ **Background Jobs** - Scheduled tasks with BullMQ
- ✅ **Database Schema** - Sessions and shops management
- ✅ **Webhook Handlers** - App uninstall event handling
- ✅ **Theme Extensions** - Example star rating block
- ✅ **Comprehensive Logging** - File-based and console logging

### Example Implementations

- 📦 **Products Display** - Fetches and displays shop products
- 🔄 **Shop Sync Job** - Scheduled shop data synchronization
- ⭐ **Star Rating Block** - Theme extension with Liquid templating
- 🛡️ **HMAC Verification** - Secure app proxy request validation

## 📋 Prerequisites

- **Node.js** >= 18.0.0 (see `.nvmrc`)
- **pnpm** >= 8.0.0
- **PostgreSQL** >= 14
- **Redis** >= 6.0
- **Shopify CLI** >= 3.0
- **Shopify Partner Account** with app credentials

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd shopify-app-boilerplate
pnpm install
```

### 2. Environment Configuration

Copy the example environment file and configure your values:

```bash
cp .env.example .env
```

Required environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shopify_app
REDIS_URL=redis://localhost:6379

# Shopify App Credentials (from Partner Dashboard)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok.app
SHOPIFY_APP_SCOPES=read_products,write_products
SHOPIFY_APP_PROXY_SECRET=your_proxy_secret

# Optional
LOG_TO_FILE=true
```

### 3. Database Setup

```bash
# Push schema to database
pnpm db:push

# Optional: Open Drizzle Studio for database management
pnpm db:studio
```

### 4. Development Server

```bash
# Start the development server with Shopify CLI
pnpm dev

# Alternative: Start only the app (without Shopify CLI)
pnpm app:dev
```

## 📁 Project Structure

```
src/
├── components/          # Reusable React components
├── db/                 # Database schema and configuration
│   ├── schema.ts       # Drizzle table definitions
│   └── index.ts        # Database connection
├── graphql/            # GraphQL queries and types
│   └── queries.ts      # Shopify Admin API queries
├── jobs/               # Background job definitions
│   └── sync-shop.ts    # Shop data synchronization job
├── routes/             # TanStack Router routes
│   ├── api/           # Backend API endpoints
│   │   ├── products.ts # Products API with proxy auth
│   │   └── webhooks/   # Webhook handlers
│   ├── __root.tsx     # Root layout and App Bridge setup
│   ├── index.tsx      # Home page with products table
│   └── about.tsx      # About page
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
    ├── middleware/     # Custom middleware
    │   └── auth-middleware.ts  # Authentication middleware
    ├── logger.ts       # Winston logging configuration
    ├── redis.ts        # Redis connection
    ├── shopify-*.ts    # Shopify-specific utilities
    └── ...

extensions/
└── test-block/         # Theme extension example
    ├── blocks/         # Liquid block templates
    ├── assets/         # CSS/JS assets
    ├── locales/        # Translations
    └── shopify.extension.toml
```

## 🔧 Available Scripts

```bash
# Development
pnpm dev                # Start Shopify CLI development server
pnpm app:dev           # Start app only (port 3000)
pnpm app:build         # Build production app
pnpm app:start         # Start production server

# Database
pnpm db:push           # Push schema changes
pnpm db:studio         # Open Drizzle Studio
pnpm db:generate       # Generate migrations
pnpm db:migrate        # Run migrations

# GraphQL
pnpm graphql:generate  # Generate GraphQL types
```

## 🔐 Authentication Flow

### 1. App Installation

- User installs app via Shopify admin
- OAuth flow exchanges authorization code for access token
- Session stored in PostgreSQL with shop information

### 2. App Bridge Authentication

- Frontend receives session token via URL parameters
- Token validated and exchanged for offline access token
- Authenticated GraphQL client created for API calls

### 3. App Proxy Requests

- Frontend API calls include HMAC signature
- Backend verifies request authenticity
- Shop context retrieved from database

## 📊 Database Schema

### Sessions Table

```sql
session (
  id: text PRIMARY KEY,           -- Session identifier
  shop: text NOT NULL UNIQUE,     -- Shop domain
  state: text NOT NULL,           -- OAuth state
  isOnline: boolean DEFAULT false, -- Online/offline session
  scope: text,                    -- Granted permissions
  expires: timestamp,             -- Session expiration
  accessToken: text               -- Shopify access token
)
```

### Shops Table

```sql
shop (
  id: uuid PRIMARY KEY,           -- Internal shop ID
  domain: text NOT NULL UNIQUE,   -- Shop domain (.myshopify.com)
  name: text,                     -- Shop name
  email: text,                    -- Shop contact email
  contactEmail: text,             -- Alternative contact
  currencyCode: text,             -- Shop currency
  weightUnit: text,               -- Weight measurement unit
  timezone: text,                 -- IANA timezone
  url: text,                      -- Shop URL
  createdAt: timestamp DEFAULT now(),
  updatedAt: timestamp DEFAULT now()
)
```

## 🎯 Key Features Deep Dive

### Background Jobs

- **Sync Shop Job**: Periodically updates shop information from Shopify API
- **BullMQ Integration**: Reliable job processing with Redis
- **Configurable Scheduling**: Cron-based job scheduling
- **Error Handling**: Comprehensive job failure management

### Theme Extensions

- **Star Rating Block**: Example Liquid block for product ratings
- **Configurable Settings**: Color picker and product selector
- **Asset Management**: JavaScript and image assets
- **Internationalization**: Translation-ready structure

### API Endpoints

- **`/api/products`**: Secured endpoint returning shop products
- **`/api/webhooks/app/uninstalled`**: Handles app uninstallation
- **Proxy Authentication**: HMAC-verified requests for security

## 🐛 Troubleshooting

### Common Issues

**App won't load in Shopify admin:**

- Verify `SHOPIFY_APP_URL` matches your ngrok URL
- Check that your app URL is using HTTPS
- Ensure App Bridge scripts are loading correctly

**Database connection failed:**

- Verify PostgreSQL is running and accessible
- Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Run `pnpm db:push` to ensure schema is up to date

**Redis connection failed:**

- Ensure Redis server is running
- Verify `REDIS_URL` format: `redis://localhost:6379`
- Check Redis authentication if required

**GraphQL queries failing:**

- Verify app has correct scopes in `shopify.app.toml`
- Check that access token is valid and not expired
- Ensure shop is properly authenticated

## 📚 Resources

- [Shopify App Development](https://shopify.dev/docs/apps)
- [TanStack Router Documentation](https://tanstack.com/router)
- [TanStack Start Documentation](https://tanstack.com/start)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Shopify CLI Documentation](https://shopify.dev/docs/apps/tools/cli)

## 🤝 Contributing

This is a learning project. Feel free to:

- Report issues and bugs
- Suggest improvements
- Submit pull requests
- Share your experiences

## 📄 License

[MIT License](LICENSE) - Feel free to use this boilerplate for learning and development purposes.

---

**Remember**: This is a development boilerplate, not a production-ready application. Always follow Shopify's best practices and security guidelines when building real applications.
