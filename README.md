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

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/djordje-st/start-shopify-app-boilerplate.git
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
or
pnpm db:generate && pnpm db:migrate

# Optional: Open Drizzle Studio for database management
pnpm db:studio
```

### 4. Link your Shopify app to the project

Run `shopify app config link` and create a new Shopify app or link an existing one to the project

### 5. Development Server

```bash
# Start the development server with Shopify CLI
pnpm dev

# Alternative: Start only the app (without Shopify CLI)
pnpm app:dev
```

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
- [Polaris Web Components](https://shopify.dev/docs/api/app-home/using-polaris-components)

## 🤝 Contributing

This is a learning project. Feel free to:

- Report issues and bugs
- Suggest improvements
- Submit pull requests
- Share your experiences

---

**Remember**: This is a development boilerplate, not a production-ready application. Always follow Shopify's best practices and security guidelines when building real applications.
