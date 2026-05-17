# Secret Management & Environment Variables

## Required Secrets (Production)

All secrets are managed via GitHub Secrets and injected at deployment time.

| Variable | Required | Scope | Default | Notes |
|----------|----------|-------|---------|-------|
| `CLOUDFLARE_API_TOKEN` | ✅ Yes | CI/CD | None | Cloudflare API token (create at dash.cloudflare.com) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Backend | None | Service role key (never expose to frontend) |
| `OPENAI_API_KEY` | ✅ Yes | Backend | None | OpenAI API key for embeddings |
| `R2_ACCESS_KEY_ID` | ✅ Yes | Backend | None | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | ✅ Yes | Backend | None | Cloudflare R2 secret key |

## Public Variables (can be in `.env`)

| Variable | Required | Scope | Default | Notes |
|----------|----------|-------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Frontend | None | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ Yes | Frontend | None | Supabase anon key (public) |
| `NEXT_PUBLIC_R2_BUCKET_COVERS` | ✅ Yes | Frontend | `covers` | R2 bucket for comic covers |
| `NEXT_PUBLIC_R2_BUCKET_CHAPTERS` | ✅ Yes | Frontend | `chapters` | R2 bucket for chapter images |
| `CLOUDFLARE_ANALYTICS_WORKER_URL` | ⚠️ Recommended | Frontend | None | Analytics worker internal URL |

## Setup Instructions

### Local Development

```bash
# Copy example to local env
cp .env.example .env.local

# Fill in actual values (never commit .env.local)
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
# etc.
```

### GitHub Secrets

```bash
# Add secrets to repository settings
# Settings > Secrets and variables > Actions > New repository secret

# Required secrets:
# CLOUDFLARE_API_TOKEN
# SUPABASE_SERVICE_ROLE_KEY
# OPENAI_API_KEY
# R2_ACCESS_KEY_ID
# R2_SECRET_ACCESS_KEY
```

---

## Accessing Secrets in Code

### Frontend (Next.js)

```typescript
// ✅ OK - public variable
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ❌ WRONG - secret variable
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // undefined in browser!
```

### Backend (Cloudflare Workers)

```typescript
// wrangler.jsonc
{
  "env": {
    "production": {
      "secrets": [
        "SUPABASE_SERVICE_ROLE_KEY",
        "OPENAI_API_KEY"
      ]
    }
  }
}

// src/index.ts
export default {
  async fetch(req: Request, env: Env) {
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY; // Injected at runtime
  }
}
```

---

## Rotation Policy

- **API Tokens**: Rotate every 90 days
- **Database Keys**: Rotate every 180 days (coordinate with team)
- **R2 Keys**: Rotate every 90 days
- **Compromised Secrets**: Rotate immediately, revoke old token
