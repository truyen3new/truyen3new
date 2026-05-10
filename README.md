# Light Story

Light Story is an online reading platform with a Next.js frontend, Supabase backend, and a Cloudflare Workers D1 backend. Includes a comic platform with semantic search, VIP content gating, and real-time updates.

## Quick Links

- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
- [Real Data Setup](docs/REAL_DATA.md)
- [Staging Runbook](docs/STAGING_RUNBOOK.md)
- [Frontend Architecture](frontend/ARCHITECTURE.md)
- [Backend Analytics Setup](backend-supabase/docs/ANALYTICS_WORKER_SETUP.md)

### Comic Platform (New)

- [Comic Platform Deployment](docs/STAGING_DEPLOYMENT_COMIC_PLATFORM.md)
- [Edge Function Setup](docs/DEPLOY_EDGE_FUNCTIONS.md)
- [R2 Worker Setup](docs/DEPLOY_R2_WORKER.md)
- [Cloudflare R2 Integration](docs/CLOUDFLARE_R2_DEPLOYMENT.md)
- [Database Schema](backend-supabase/docs/db-schema.md)
- [Test Suite](backend-supabase/supabase/tests/README.md)

## Repository Layout

```text
frontend/          Next.js application
backend-supabase/  Supabase migrations, functions, tests, and docs
backend-d1-saas/   Cloudflare Workers D1 backend
docs/              Canonical architecture, testing, setup, and archive docs
scripts/           Root helper scripts
src/               Shared root-level code
workers/           Cloudflare Workers (R2 proxy, etc)
```

## Local Development

From the repository root:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
npm --prefix frontend run build
```

For backend validation, use the package-specific commands documented in [docs/TESTING.md](docs/TESTING.md).

## Comic Platform Features

- **Semantic Search**: Vector-based search using pgvector (1536-dimensional embeddings)
- **VIP Content Gating**: Row-level security policies protect premium chapters
- **Real-time Updates**: Supabase Realtime subscriptions for live chapter changes
- **Edge Functions**: Serverless webhooks for payments and rewards
- **Asset Proxy**: Cloudflare R2 with JWT-based access control
- **Role-based Access**: Admin panel for content management

## Runtime Notes

- Use `NEXT_PUBLIC_*` variables in the browser.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `INTERNAL_ADMIN_SECRET` server-side only.
- Internal admin routes live under `/api/internal/admin/*`.
- Comic platform uses `search_stories()` RPC and `chapters` realtime subscriptions.

## Canonical Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/TESTING.md](docs/TESTING.md)
- [docs/REAL_DATA.md](docs/REAL_DATA.md)
- [docs/ARCHIVE/README.md](docs/ARCHIVE/README.md)


