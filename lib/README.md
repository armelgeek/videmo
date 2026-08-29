# Lib Directory

Core library modules for the application. Each subdirectory or module group has its own README explaining its purpose.

## Structure

- **[auth/](./AUTH.md)** - Authentication & authorization (better-auth integration, session management)
- **[client.ts](./CLIENT.md)** - Unified API client wrapper for fetch() calls
- **[database/](./DATABASE.md)** - Database setup (Prisma, pg connection)
- **[email/](./EMAIL.md)** - Email service & templating
- **[config/](./CONFIG.md)** - Application configuration & environment variables
- **[mastra/](./mastra/)** - AI agents, tools, and workflows (Mastra framework)
- **[permissions/](./PERMISSIONS.md)** - Role-based access control (RBAC)
- **[schemas/](./SCHEMAS.md)** - Zod validation schemas
- **[security/](./SECURITY.md)** - Security utilities (rate limiting, audit logging)
- **[payments/](./PAYMENTS.md)** - Payment processing (Stripe integration)
- **[utils/](./UTILS.md)** - Utility functions & helpers
- **[webhooks/](./WEBHOOKS.md)** - Webhook handlers
- **[seo.ts](./SEO.md)** - SEO utilities & metadata
- **[unified-engine/](./unified-engine/README.md)** - Unified editor engine (state management, animation, timeline playback)
- **[editor/](./editor/)** - Editor UI components and logic
- **[whiteboard-animation/](./whiteboard-animation/DEPRECATION_NOTICE.md)** - Whiteboard animation UI (legacy - uses unified-engine)
