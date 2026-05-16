# FE/BE Decoupling & Migration Blueprint — Light Story

> **Status:** Approved | **Architect:** Senior PM / Lead Solution Architect | **Date:** 2026-05-16
> **Repo Strategy:** Single monorepo with npm workspaces. Decoupling enforced at the **network/gateway boundary**, not the repo boundary.

---

## Task Manifest (Machine-Readable)

```yaml
manifest:
  version: "1.2"
  last_updated: "2026-05-16"
  total_phases: 6
  total_tasks: 30
  completed: 26
  in_progress: 0
  pending: 4
  tasks:
    # ── Phase 0: Audit & Setup ── (COMPLETED)
    - id: P0.1
      phase: 0
      title: "Endpoint Inventory"
      status: done
      deps: []
      files: [packages/api-types/endpoint-registry.json]
      commands: []
      verify: ["json file exists with all endpoints"]

    - id: P0.2
      phase: 0
      title: "Workspace Restructure"
      status: done
      deps: [P0.1]
      files: [package.json]
      commands: []
      verify: ["npm workspaces configured"]

    # ── Phase 1: API Contract Definition ── (90% complete)
    - id: P1.1
      phase: 1
      title: "Write OpenAPI Spec"
      status: done
      deps: [P0.2]
      files: [packages/api-types/openapi.yaml]
      commands: []
      verify: ["openapi.yaml exists"]

    - id: P1.2
      phase: 1
      title: "Generate TypeScript Types"
      status: done
      deps: [P1.1]
      files: [packages/api-types/src/generated/]
      commands: ["npm --prefix packages/api-types run generate"]
      verify: ["generated/index.ts compiles"]

    - id: P1.3
      phase: 1
      title: "Lint Spec with Spectral"
      status: done
      deps: [P1.1]
      files: [packages/api-types/openapi.yaml, packages/api-types/.spectral.yaml]
      commands: ["npx @stoplight/spectral lint packages/api-types/openapi.yaml"]
      verify: ["linter exits 0"]

    - id: P1.4
      phase: 1
      title: "Deploy Mock Server (Prism)"
      status: pending
      deps: [P1.1]
      files: [.github/workflows/ci.yml]
      commands: []
      verify: ["mock server starts on PR"]

    # ── Phase 2: Backend Isolation ── (COMPLETED)
    - id: P2.1
      phase: 2
      title: "Extract Comics Worker"
      status: done
      deps: [P1.2]
      files: [workers/comics-worker/src/index.ts, workers/comics-worker/wrangler.jsonc]
      commands: []
      verify: ["worker deploys independently"]

    - id: P2.2
      phase: 2
      title: "Extract Stories Worker"
      status: done
      deps: [P1.2]
      files: [workers/stories-worker/src/index.ts, workers/stories-worker/wrangler.jsonc]
      commands: []
      verify: ["worker deploys independently"]

    - id: P2.3
      phase: 2
      title: "Extract Analytics Worker"
      status: done
      deps: [P1.2]
      files: [workers/analytics-worker/src/index.ts, workers/analytics-worker/wrangler.jsonc]
      commands: []
      verify: ["worker deploys independently"]

    - id: P2.4
      phase: 2
      title: "Extract Admin Worker"
      status: done
      deps: [P1.2]
      files: [workers/admin-worker/src/index.ts, workers/admin-worker/wrangler.jsonc]
      commands: []
      verify: ["worker deploys independently"]

    - id: P2.5
      phase: 2
      title: "Build API Gateway Worker"
      status: done
      deps: [P2.1, P2.2, P2.3, P2.4]
      files: [workers/api-gateway/src/index.ts, workers/api-gateway/wrangler.jsonc]
      commands: []
      verify: ["gateway routes to all workers"]

    # ── Phase 2.5: Auth Unification ── (75% complete)
    - id: P2_5.1
      phase: 2.5
      title: "Gateway JWT Validation"
      status: done
      deps: [P2.5]
      files: [workers/api-gateway/src/auth.ts]
      commands: []
      verify: ["invalid JWT returns 401"]

    - id: P2_5.2
      phase: 2.5
      title: "Header Injection to Downstream Workers"
      status: done
      deps: [P2_5.1]
      files: [workers/api-gateway/src/index.ts]
      commands: []
      verify: ["x-user-id header injected"]

    - id: P2_5.3
      phase: 2.5
      title: "Remove Duplicate JWT Parsing from Domain Workers"
      status: done
      deps: [P2_5.2]
      files: [workers/comics-worker/src/index.ts, workers/stories-worker/src/index.ts, workers/analytics-worker/src/index.ts, workers/admin-worker/src/index.ts]
      commands: []
      verify: ["domain workers read x-user-id header, not raw JWT"]

    - id: P2_5.4
      phase: 2.5
      title: "Route Supabase Behind Gateway"
      status: done
      deps: [P2_5.3]
      files: [workers/api-gateway/src/index.ts]
      commands: []
      verify: ["no Supabase direct calls from browser"]

    # ── Phase 3: Frontend Refactoring ── (not started)
    - id: P3.1
      phase: 3
      title: "Create apiClient.ts"
      status: done
      deps: [P1.2]
      files: [frontend/src/lib/apiClient.ts]
      commands: []
      verify: ["apiClient.ts exists, targets gateway"]

    - id: P3.2
      phase: 3
      title: "Remove Supabase Browser Client"
      status: done
      deps: [P3.1]
      files: [frontend/src/lib/client.ts, frontend/src/lib/supabase/client.ts]
      commands: []
      verify: ["no @supabase/supabase-js in browser bundle"]

    - id: P3.3
      phase: 3
      title: "Delete BFF API Routes"
      status: done
      deps: [P3.1]
      files: [frontend/src/app/api/]
      commands: []
      verify: ["frontend/src/app/api/ does not exist"]

    - id: P3.4
      phase: 3
      title: "Rewrite Services as HTTP Clients"
      status: done
      deps: [P3.1]
      files: [frontend/src/services/story.service.ts, frontend/src/services/comic.service.ts, frontend/src/services/analytics.service.ts]
      commands: []
      verify: ["all services use apiClient, not supabase"]

    - id: P3.5
      phase: 3
      title: "Clean Up Duplicate Repositories"
      status: done
      deps: [P3.4]
      files: [frontend/src/services/repositories/]
      commands: []
      verify: ["single repository adapter set"]

    - id: P3.6
      phase: 3
      title: "Wire Use Case Layer"
      status: done
      deps: [P3.4]
      files: [frontend/src/application/use-cases/]
      commands: []
      verify: ["hooks call use cases, not services directly"]

    - id: P3.7
      phase: 3
      title: "Strip localStorage Business Logic"
      status: done
      deps: [P3.4]
      files: [frontend/src/services/comic.service.ts]
      commands: []
      verify: ["no localStorage in comic.service.ts"]

    # ── Phase 4: Concurrent Development Setup ── (not started)
    - id: P4.1
      phase: 4
      title: "CI Mock Server Integration"
      status: done
      deps: [P1.4]
      files: [.github/workflows/ci.yml]
      commands: []
      verify: ["CI starts prism service"]

    - id: P4.2
      phase: 4
      title: "Feature Flag (API_MOCK)"
      status: done
      deps: [P3.1]
      files: [frontend/.env.example, frontend/src/lib/apiClient.ts]
      commands: []
      verify: ["NEXT_PUBLIC_API_MOCK toggles mock vs real"]

    - id: P4.3
      phase: 4
      title: "Backend Preview Environments"
      status: done
      deps: [P2.5]
      files: [.github/workflows/ci.yml]
      commands: []
      verify: ["each PR gets preview worker URL"]

    - id: P4.4
      phase: 4
      title: "Contract Tests in CI"
      status: done
      deps: [P1.2]
      files: [.github/workflows/ci.yml]
      commands: []
      verify: ["CI fails if response violates spec"]

    # ── Phase 5: Integration & CORS Security ── (not started)
    - id: P5.1
      phase: 5
      title: "CORS Configuration on Gateway"
      status: done
      deps: [P2.5]
      files: [workers/api-gateway/src/index.ts]
      commands: []
      verify: ["non-whitelisted origins return 403"]

    - id: P5.2
      phase: 5
      title: "Staged Rollout to Staging"
      status: pending
      deps: [P5.1, P3.7, P2_5.4]
      files: []
      commands: []
      verify: ["staging CI passes"]

    - id: P5.3
      phase: 5
      title: "DNS Cutover to Production"
      status: pending
      deps: [P5.2]
      files: []
      commands: []
      verify: ["zero 4xx/5xx increase"]

    - id: P5.4
      phase: 5
      title: "Deprecation Cleanup"
      status: pending
      deps: [P5.3]
      files: [frontend/src/app/api/]
      commands: []
      verify: ["old BFF routes deleted"]
```

---

## Gantt & Task Dependency Graph

```
P0.1 ──► P0.2
            │
            ▼
          P1.1 ──► P1.2 ──► P2.1 ──► P2.5 ──► P2_5.1 ──► P2_5.2 ──► P2_5.3 ──► P2_5.4
            │         │       P2.2 ──► │                              │
            │         │       P2.3 ──► │                              │
            │         │       P2.4 ──► │                              │
            │         ▼                                                │
            │       P3.1 ──► P3.2  P3.3  P3.4 ──► P3.5  P3.6  P3.7  │
            │         │                                                │
            │         └──────► P4.2                                    │
            │                                                          │
            ├──► P1.3  P1.4 ──► P4.1                                  │
            │         │                                                │
            │         └──────► P4.4                                    │
            │                                                          ▼
            │                                                  ┌──────────────┐
            │                                                  │   P5.1       │
            │                                                  │   P5.2       │
            │                                                  │   P5.3       │
            │                                                  │   P5.4       │
            │                                                  └──────────────┘
```

### Timeline

| Week | Phase | Tasks |
|---|---|---|
| 1 | **P0** | P0.1 → P0.2 |
| 2-3 | **P1** | P1.1 → P1.2 → P1.3, P1.4 |
| 4-6 | **P2** (full) + **P3** (starts week 4) | P2.1-P2.5 → P2_5.1-P2_5.4; P3.1-P3.4 |
| 7 | **P3** (finish) + **P4** (parallel) | P3.5-P3.7; P4.1-P4.4 |
| 8 | **P5** | P5.1 → P5.2 → P5.3 → P5.4 |

---

## Current State Assessment

| Dimension | Status |
|---|---|
| **Backends** | Two: D1 SaaS (monolithic Worker, ~1541-line `src/index.ts`) + Supabase (PostgreSQL, Auth, Edge Functions, RLS) |
| **Frontend** | Next.js 16 with BFF API routes + direct Supabase browser client |
| **Coupling Severity** | High — frontend API routes proxy to backends directly; browser imports `@supabase/supabase-js`; business logic split across D1 monolith and Supabase |
| **Clean Architecture** | Shells exist (`application/use-cases/`, `domain/interfaces/`, `infrastructure/repositories/`) but are largely unwired — most calls bypass them |
| **Auth** | Supabase Auth; D1 backend parses Supabase JWTs independently at edge |

---

## Architecture Target

```
Browser / Next.js (Pure Presentation)
        │
        │  HTTPS / JWT Bearer
        ▼
┌──────────────────────────────────────────────┐
│         API GATEWAY (Cloudflare Worker)       │
│  • JWT validation (single choke point)        │
│  • Rate limiting (100 req/min/user)           │
│  • Request routing to domain Workers          │
│  • Strict CORS enforcement                    │
│  • Request logging / audit                    │
└──────┬──────┬──────┬──────┬──────┬───────────┘
       │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼
   comics  stories  admin  analytics  assets(R2)
   Worker  Worker   Worker  Worker    Worker
       │      │      │      │
       ▼      ▼      ▼      ▼
      D1     D1     D1     D1
```

**Key principle:** Frontend has **zero knowledge** of D1, R2, or Supabase internals. It only knows HTTP methods, endpoints, and JSON shapes.

---

## Phase 0: Audit & Setup

### P0.1 — Endpoint Inventory

**Action:** Catalog every current frontend API route and backend Worker route. Group by domain.

**Files to read:**
- `frontend/src/app/api/` (all route.ts files)
- `backend-d1-saas/src/index.ts` (all route handlers)
- `workers/r2-signed-url/worker.js` (asset routes)

**Output:** `packages/api-types/endpoint-registry.json`
```json
{
  "domains": ["stories", "chapters", "comics", "auth", "admin", "analytics", "taxonomy", "system", "assets"],
  "endpoints": [
    { "method": "GET", "path": "/api/v1/stories", "domain": "stories", "source": "d1-worker" },
    { "method": "POST", "path": "/api/v1/comics/{comicId}/chapters", "domain": "comics", "source": "d1-worker" }
  ]
}
```

**Verification:** Every route in the registry has a corresponding route handler in exactly one Worker (no overlap, no gap).

---

### P0.2 — Workspace Restructure

**Action:** Set up npm workspaces in root `package.json`. Create `packages/api-types/` with `tsconfig.json` and `package.json`.

**Commands:**
```bash
mkdir -p packages/api-types/src/generated
```

**Root `package.json` changes:**
```json
{
  "workspaces": ["packages/*", "frontend", "workers/*", "backend-supabase"],
  "scripts": {
    "dev": "npm --prefix frontend run dev",
    "build": "npm --prefix frontend run build",
    "lint": "npm --prefix frontend run lint",
    "generate:types": "npm --prefix packages/api-types run generate"
  }
}
```

**Verification:** `npm install` from root installs all workspaces. `npm ls` shows all packages.

---

## Phase 1: API Contract Definition

### P1.1 — Write OpenAPI 3.1 Spec

**Action:** Create `packages/api-types/openapi.yaml` with all endpoints from P0.1 registry.

**Tooling:** `@stoplight/spectral` for linting, `redoc-cli` for preview.

**Structure:**
```yaml
openapi: "3.1.0"
info:
  title: Light Story API
  version: "1.0.0"
servers:
  - url: https://api.lightstory.app/api/v1
    description: Production
  - url: https://staging-api.lightstory.app/api/v1
    description: Staging
  - url: http://localhost:4010/api/v1
    description: Mock (Prism)
paths:
  /comics/{comicId}/chapters:
    post:
      operationId: createChapter
      tags: [comics]
      summary: Upload a new chapter
      security:
        - bearerAuth: []
      parameters:
        - name: comicId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                title: { type: string, maxLength: 255 }
                pages:
                  type: array
                  items:
                    type: object
                    properties:
                      pageNumber: { type: integer }
                      caption: { type: string }
                cover:
                  type: string
                  format: binary
      responses:
        "201":
          description: Chapter created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SuccessResponse"
        "401":
          $ref: "#/components/responses/Unauthorized"
        "403":
          $ref: "#/components/responses/Forbidden"
        "422":
          $ref: "#/components/responses/ValidationError"
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    SuccessResponse:
      type: object
      properties:
        status: { type: string, enum: [success] }
        data: { type: object }
    ErrorResponse:
      type: object
      properties:
        status: { type: string, enum: [error] }
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            requestId: { type: string }
```

**Verification:** `npx @stoplight/spectral lint packages/api-types/openapi.yaml` exits with code 0.

---

### P1.2 — Generate TypeScript Types

**Action:** Use `openapi-typescript` to generate types from the OpenAPI spec.

**`packages/api-types/package.json`**:
```json
{
  "name": "@light-story/api-types",
  "version": "1.0.0",
  "main": "src/generated/index.ts",
  "scripts": {
    "generate": "npx openapi-typescript openapi.yaml -o src/generated/index.ts",
    "typecheck": "npx tsc --noEmit"
  }
}
```

**Commands:**
```bash
npm --prefix packages/api-types run generate
```

**Verification:** `packages/api-types/src/generated/index.ts` exists. No TypeScript errors:
```bash
npm --prefix packages/api-types run typecheck
```

---

### P1.3 — Lint Spec with Spectral

**Action:** Add Spectral ruleset and CI check.

**`packages/api-types/.spectral.yaml`**:
```yaml
extends: [[spectral:oas, all]]
rules:
  operation-tag-defined: error
  operation-operationId: error
  path-params: error
  content-type-json: warn
```

**Verification:** `npx @stoplight/spectral lint packages/api-types/openapi.yaml --fail-severity=warn` exits 0.

---

### P1.4 — Deploy Mock Server (Prism)

**Action:** Add Prism mock server to GitHub Actions CI.

**`.github/workflows/ci.yml` addition:**
```yaml
jobs:
  api-mock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx @stoplight/prism-cli mock packages/api-types/openapi.yaml --port 4010
      - run: curl -f http://localhost:4010/api/v1/health || exit 1
```

**Verification:** CI job `api-mock` passes. Frontend CI tests can target `http://localhost:4010`.

---

## Phase 2: Backend Isolation

### P2.1 — Extract Comics Worker

**Action:** Extract comic/chapter endpoint logic from `backend-d1-saas/src/index.ts` into `workers/comics-worker/src/index.ts`.

**Source file:** `backend-d1-saas/src/index.ts` (lines handling `/tenants/:id/stories`, `/tenants/:id/stories/:storyId/chapters`)

**New files:**
- `workers/comics-worker/package.json`
- `workers/comics-worker/wrangler.jsonc` — D1 binding `COMICS_DB`
- `workers/comics-worker/src/index.ts` — routes: `GET/POST /stories`, `GET/PUT/DELETE /stories/:storyId`, `GET/POST /stories/:storyId/chapters`

**Verification:**
```bash
npm --prefix workers/comics-worker run test
curl -f http://localhost:9001/health
```

---

### P2.2 — Extract Stories Worker

**Action:** Extract story logic (non-comic) into `workers/stories-worker/`.

**Source:** Lines from `backend-d1-saas/src/index.ts` handling story CRUD outside comics domain.

**New files:** Same structure as P2.1.

---

### P2.3 — Extract Analytics Worker

**Action:** Extract analytics dashboard aggregation logic.

**Source:** `backend-supabase/workers/analytics-aggregator.ts` + analytics endpoints from `backend-d1-saas/src/index.ts`.

**New files:**
- `workers/analytics-worker/src/index.ts` — routes: `GET /analytics/dashboard`, `GET /analytics/overview`

**D1 binding:** `ANALYTICS_DB` (read-only replica or cross-tenant query).

---

### P2.4 — Extract Admin Worker

**Action:** Extract admin operations (audit logs, profile management, taxonomy, system settings).

**Source:** Admin routes from `backend-d1-saas/src/index.ts` and `frontend/src/app/api/internal/admin/`.

**New files:**
- `workers/admin-worker/src/index.ts` — routes: `GET /audit`, `POST /profiles`, `POST /taxonomy`, `GET/POST /system-settings`

---

### P2.5 — Build API Gateway Worker

**Action:** Create `workers/api-gateway/` that routes `/api/v1/*` to domain Workers via `fetch()` (service binding).

**Architecture:**
```
Request ──► API Gateway
               │
               ├── /api/v1/comics/*     ──► comics-worker (service binding)
               ├── /api/v1/stories/*    ──► stories-worker (service binding)
               ├── /api/v1/admin/*      ──► admin-worker (service binding)
               ├── /api/v1/analytics/*  ──► analytics-worker (service binding)
               ├── /api/v1/assets/*     ──► r2-proxy (service binding)
               └── /api/v1/health       ──► inline response
```

**`workers/api-gateway/wrangler.jsonc`**:
```json
{
  "name": "api-gateway",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-16",
  "services": [
    { "binding": "COMICS_WORKER", "service": "comics-worker" },
    { "binding": "STORIES_WORKER", "service": "stories-worker" },
    { "binding": "ADMIN_WORKER", "service": "admin-worker" },
    { "binding": "ANALYTICS_WORKER", "service": "analytics-worker" },
    { "binding": "R2_PROXY", "service": "r2-proxy" }
  ]
}
```

**Key behaviors:**
1. Parse path prefix → select target binding
2. Forward request method, headers, body
3. Return response from downstream Worker
4. Collect metrics per route

**Verification:**
```bash
curl -f http://localhost:9000/api/v1/health
# returns: { "status": "ok", "service": "api-gateway" }
```

---

## Phase 2.5: Auth Unification

### P2_5.1 — Gateway JWT Validation

**Action:** Gateway validates Supabase JWT on every request. Rejects invalid/expired tokens with 401 before routing.

**`workers/api-gateway/src/auth.ts`**:
```ts
export interface AuthContext {
  userId: string;
  role: "superadmin" | "admin" | "employee" | "user";
  email: string;
}

export async function validateJWT(token: string): Promise<AuthContext> {
  // Verify Supabase JWT (RS256) using JWKS endpoint
  // Decode payload, extract sub, app_metadata.role, email
  // Return AuthContext or throw UnauthorizedError
}
```

**Verification:**
```bash
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid" http://localhost:9000/api/v1/health
# -> 401
```

---

### P2_5.2 — Header Injection

**Action:** Gateway injects `x-user-id`, `x-user-role`, `x-request-id` headers to downstream Workers. Downstream Workers trust these headers (no re-validation).

**Gateway route handler:**
```ts
async function handleRequest(request: Request): Promise<Response> {
  const auth = await validateJWT(extractBearer(request));
  const downstream = new Request(request.url, {
    method: request.method,
    headers: {
      ...request.headers,
      "x-user-id": auth.userId,
      "x-user-role": auth.role,
      "x-request-id": crypto.randomUUID(),
    },
    body: request.body,
  });
  return await target.fetch(downstream);
}
```

---

### P2_5.3 — Remove Duplicate JWT Parsing

**Action:** Delete JWT verification logic from each domain Worker. They read `x-user-id` and `x-user-role` from headers instead.

**Files to modify per Worker:**
- Remove Supabase JWT library dependency
- Remove JWKS fetching logic
- Replace `const user = await verifyJWT(token)` with `const userId = request.headers.get("x-user-id")`

**Verification:** Domain Workers cannot operate standalone without gateway headers. `curl` directly to domain Worker returns 400.

---

### P2_5.4 — Route Supabase Behind Gateway

**Action:** Move all Supabase Edge Function calls behind the gateway. Gateway proxies Edge Function calls.

**Gateway addition:**
```yaml
/api/v1/rpc/* ──► fetch("https://<project>.supabase.co/rest/v1/rpc/{path}")
```

**Frontend change:** Delete `frontend/src/lib/supabase/client.ts` and `frontend/src/lib/client.ts`. These are replaced in Phase 3.

**Verification:** No `@supabase/supabase-js` import exists in any frontend browser bundle. All data flows through `/api/v1/*`.

---

## Phase 3: Frontend Refactoring

### P3.1 — Create `apiClient.ts`

**Action:** Build a fetch wrapper targeting the gateway. Handles auth token injection, 401 refresh, error normalization.

**`frontend/src/lib/apiClient.ts`**:
```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4010/api/v1";

interface ApiResponse<T> {
  status: "success";
  data: T;
}

interface ApiError {
  status: "error";
  error: { code: string; message: string; requestId: string };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getSupabaseSessionToken(); // from AuthContext
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) await refreshSession(); // auto-refresh
    const err: ApiError = await res.json();
    throw new ApiClientError(err.error.code, err.error.message, err.error.requestId);
  }
  const json: ApiResponse<T> = await res.json();
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
```

**Verification:**
```bash
# With mock server running
npm --prefix frontend run dev
curl http://localhost:3001/api/health-proxy  # should proxy to mock
```

---

### P3.2 — Remove Supabase Browser Client

**Action:** Delete direct Supabase browser client files. Replace all browser-side Supabase imports with `apiClient.ts`.

**Delete:**
- `frontend/src/lib/client.ts` (browser Supabase client)
- `frontend/src/lib/supabase/client.ts` (re-export)
- `frontend/src/lib/supabase/server.ts` (server client — keep only if server components need it; otherwise delete)

**Replace all:**

| File | Replace |
|---|---|
| `frontend/src/modules/auth/AuthContext.tsx` | Remove Supabase `onAuthStateChange`; use `api.get("/auth/session")` |
| `frontend/src/hooks/useChapterSubscription.ts` | Remove Supabase Realtime; use polling or WebSocket via gateway |

**Verification:** `grep -r "@supabase/supabase-js" frontend/src/` returns 0 results.

---

### P3.3 — Delete BFF API Routes

**Action:** Delete `frontend/src/app/api/` entirely.

**Delete recursively:** `frontend/src/app/api/`

**Before deletion**, verify all consumers have been migrated (P3.4).

**Verification:** `npm --prefix frontend run build` succeeds (no dangling route imports). `frontend/src/app/api/` does not exist.

---

### P3.4 — Rewrite Services as HTTP Clients

**Action:** Refactor each service file to use `apiClient` instead of directly calling Supabase or D1.

| Service | Replace calls to | With |
|---|---|---|
| `story.service.ts` | `supabase.from("stories").select(...)` | `api.get("/stories", { params })` |
| `comic.service.ts` | `fetch(tenantWorkerUrl + "/stories")` | `api.get("/comics")` |
| `analytics.service.ts` | `supabase.rpc("get_dashboard")` | `api.get("/analytics/dashboard")` |
| `admin.service.ts` | `fetch("/api/internal/admin/...")` | `api.get("/admin/...")` |
| `siteMetrics.service.ts` | `supabase.from("site_metrics")` | `api.get("/admin/site-metrics")` |
| `systemSettings.service.ts` | `supabase.from("system_settings")` | `api.get("/admin/system-settings")` |
| `category.service.ts` | `supabase.from("categories")` | `api.get("/taxonomy/categories")` |

**Verification:** Every service file has zero `supabase` or direct `fetch` calls to non-gateway URLs. All use `api.get/post/patch/delete`.

---

### P3.5 — Clean Up Duplicate Repositories

**Action:** Remove `frontend/src/services/repositories/`. Keep only `frontend/src/infrastructure/repositories/`.

**Delete:**
```
frontend/src/services/repositories/
├── SupabaseCategoryRepository.ts
├── SupabaseChapterRepository.ts
├── SupabaseSettingsRepository.ts
├── SupabaseStoryRepository.ts
├── SupabaseTaxonomyRepository.ts
```

**Also ensure:** `domain/interfaces/repositories.ts` and `types/repos.ts` are deduplicated. Keep `domain/interfaces/repositories.ts` as the canonical interface.

---

### P3.6 — Wire Use Case Layer

**Action:** Make hooks call use cases instead of services directly. Ensure architecture flows through Clean Architecture layers.

**Before (bypassing layers):**
```ts
// useStories.ts — calls service directly
const stories = await storyService.getAll();
```

**After (proper layering):**
```ts
// useStories.ts
const useStories = () => {
  const useCase = useMemo(() => new GetStoriesUseCase(new ApiStoryRepository(api)), []);
  return useQuery({ queryKey: ["stories"], queryFn: () => useCase.execute() });
};

// application/use-cases/GetStoriesUseCase.ts
export class GetStoriesUseCase {
  constructor(private repo: IStoryRepository) {}
  async execute(): Promise<Story[]> {
    return this.repo.findAll();
  }
}

// infrastructure/repositories/ApiStoryRepository.ts
export class ApiStoryRepository implements IStoryRepository {
  constructor(private client: typeof api) {}
  async findAll(): Promise<Story[]> {
    return this.client.get<Story[]>("/stories");
  }
}
```

**Existing use cases to wire:** `GetDashboardDataUseCase`, `GetOverviewMetricsUseCase`.

**New use cases to create:**
- `GetStoriesUseCase`
- `GetChaptersUseCase`
- `CreateComicUseCase`
- `CreateChapterUseCase`
- `GetAnalyticsUseCase`
- `GetAuditLogsUseCase`

---

### P3.7 — Strip localStorage Business Logic

**Action:** Remove comic-context caching from `comic.service.ts`. Migrate to React Query cache.

**Source file:** `frontend/src/services/comic.service.ts`

**Look for:**
- `localStorage.getItem("light-story:comic-context:*")`
- `localStorage.setItem("light-story:comic-context:*", ...)`

**Replace with:**
```ts
// In hooks that call comic service
useQuery({
  queryKey: ["comic-context", comicId],
  queryFn: () => comicService.getContext(comicId),
  staleTime: 5 * 60 * 1000, // 5 min cache
});
```

**Verification:** `grep -r "localStorage" frontend/src/services/comic.service.ts` returns 0 results. React Query DevTools shows cached comic contexts.

---

## Phase 4: Concurrent Development Setup

### P4.1 — CI Mock Server Integration

**Action:** Add Prism mock server to the main CI workflow. Frontend tests run against mock.

**`.github/workflows/ci.yml` (frontend job):**
```yaml
jobs:
  frontend:
    runs-on: ubuntu-latest
    services:
      prism:
        image: stoplight/prism:5
        ports:
          - 4010:4010
        command: mock /workspace/packages/api-types/openapi.yaml -p 4010
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm --prefix frontend run test
        env:
          NEXT_PUBLIC_API_URL: http://localhost:4010/api/v1
      - run: npm --prefix frontend run build
```

**Verification:** CI `frontend` job passes. Frontend tests never need a real backend.

---

### P4.2 — Feature Flag (API_MOCK)

**Action:** Add `NEXT_PUBLIC_API_MOCK` env var. When true, `apiClient.ts` targets the Prism mock server instead of the real gateway.

**`frontend/.env.example`:**
```env
NEXT_PUBLIC_API_URL=http://localhost:4010/api/v1
NEXT_PUBLIC_API_MOCK=true
```

**`frontend/src/lib/apiClient.ts` update:**
```ts
const API_BASE = process.env.NEXT_PUBLIC_API_MOCK === "true"
  ? "http://localhost:4010/api/v1"
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000/api/v1");
```

**Verification:** Switching `NEXT_PUBLIC_API_MOCK` between `true`/`false` changes the target URL. No code changes needed.

---

### P4.3 — Backend Preview Environments

**Action:** For each backend PR, deploy a preview Worker and inject its URL into the PR.

**`.github/workflows/ci.yml` (backend job):**
```yaml
jobs:
  deploy-preview:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - run: npx wrangler deploy --env preview
        working-directory: workers/api-gateway
      - run: echo "PREVIEW_URL=$(npx wrangler deploy --env preview --dry-run)" >> $GITHUB_OUTPUT
```

**Verification:** Each PR comment includes a preview URL. Gateway routes preview traffic correctly.

---

### P4.4 — Contract Tests in CI

**Action:** Add contract tests that verify backend responses match the OpenAPI spec.

**`.github/workflows/ci.yml` addition:**
```yaml
jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx @apideck/portman --openApiFile packages/api-types/openapi.yaml --cliOptionsFile .portman.json
```

**Verification:** CI `contract-tests` job fails if a backend response violates the OpenAPI schema.

---

## Phase 5: Integration & CORS Security

### P5.1 — CORS Configuration on Gateway

**Action:** Add strict CORS headers to the API Gateway.

**`workers/api-gateway/src/index.ts` addition:**
```ts
const ALLOWED_ORIGINS = [
  "https://lightstory.app",
  "https://www.lightstory.app",
  "https://staging.lightstory.app",
];

function handleCORS(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  return null; // pass through
}
```

**Verification:**
```bash
# No Origin → 403
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/api/v1/health
# -> 403

# Wrong Origin → 403
curl -s -o /dev/null -w "%{http_code}" -H "Origin: https://evil.com" http://localhost:9000/api/v1/health
# -> 403

# Correct Origin → 200 (with CORS headers)
curl -s -I -H "Origin: https://lightstory.app" http://localhost:9000/api/v1/health
# -> 200, Access-Control-Allow-Origin: https://lightstory.app
```

---

### P5.2 — Staged Rollout

**Action:** Deploy gateway + Workers to staging. Point staging frontend to staging gateway.

**Commands:**
```bash
npx wrangler deploy --env staging   # api-gateway
npx wrangler deploy --env staging   # comics-worker
npx wrangler deploy --env staging   # stories-worker
npx wrangler deploy --env staging   # analytics-worker
npx wrangler deploy --env staging   # admin-worker
npm --prefix frontend run build     # with NEXT_PUBLIC_API_URL=https://staging-api.lightstory.app
npm --prefix frontend run deploy    # to staging Pages
```

**Verification:** Full regression suite passes. All CRUD flows work end-to-end against staging.

---

### P5.3 — DNS Cutover

**Action:** Update frontend env to production gateway URL. Deploy. Monitor.

**Steps:**
1. Set `NEXT_PUBLIC_API_URL=https://api.lightstory.app/api/v1` in production
2. Deploy frontend
3. Monitor Cloudflare dashboard for 4xx/5xx spikes (1 hour)
4. Rollback plan: revert env var, redeploy frontend

**Rollback condition:** Error rate increases by >5% compared to pre-cutover baseline.

---

### P5.4 — Deprecation Cleanup

**Action:** After 1 week of stable production traffic, remove old BFF routes.

**Delete:** `frontend/src/app/api/` (should already be gone from P3.3 — verify).

**Also remove:**
- Sunset headers from gateway (no longer needed)
- Any remaining BFF references in CI or docs

**Verification:** `grep -r "/api/internal" frontend/` returns 0. All traffic exclusively through gateway.

---

## API Contract Boilerplate — Chapter Upload

### `POST /api/v1/comics/{comicId}/chapters`

**Request:**
```
POST /api/v1/comics/cm3n4k5l6m7n8p9q0r1s2t3u/chapters
Authorization: Bearer <supabase-jwt>
Content-Type: multipart/form-data

Boundary: ----FormBoundary7MA4YWxkTrZu0gW

------FormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="title"

Chapter 42: The Revelation
------FormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="pages"
Content-Type: application/json

[{"pageNumber":1,"caption":"He opened the door."}]
------FormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="cover"; filename="cover.webp"
Content-Type: image/webp

<binary>
------FormBoundary7MA4YWxkTrZu0gW--
```

**Behind-the-Scenes (Hidden from Frontend):**
```
1. Gateway validates JWT → extracts user_id, role
2. Gateway injects x-user-id, x-user-role headers
3. Comics-worker receives request
4. RBAC: role >= "employee"? No → 403
5. Validate payload: title ≤ 255 chars, pages non-empty
6. Compress cover image to WebP (sharp) if not already
7. Upload cover to R2: assets/comics/{comicId}/chapters/{chapterId}/cover.webp
8. Insert chapter metadata to D1 chapters table
9. Increment chapter_count on comics table in D1
10. Insert audit log to D1 audit_logs:
    { action: "chapter.create", userId, comicId, chapterId, timestamp }
11. Return 201 with chapter data
```

**Success Response (201):**
```json
{
  "status": "success",
  "data": {
    "id": "ch_01JQXYZ...",
    "comicId": "cm3n4k5l...",
    "title": "Chapter 42: The Revelation",
    "slug": "chapter-42-the-revelation",
    "pageCount": 1,
    "coverUrl": "https://assets.lightstory.app/comics/cm3n4k5l.../chapters/ch_01JQXYZ.../cover.webp",
    "createdAt": "2026-05-16T10:30:00Z"
  }
}
```

**Error Response (4xx/5xx):**
```json
{
  "status": "error",
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Employee role or higher required to create chapters",
    "requestId": "req_abc123..."
  }
}
```

---

## Standardized Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `INSUFFICIENT_PERMISSIONS` | 403 | Role too low |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 422 | Payload invalid |
| `CONFLICT` | 409 | Duplicate slug/title |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Something broke |

---

## CI/CD Pipeline Flow

```
                    ┌─────────────────┐
                    │  git push (PR)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  OpenAPI Check   │
                    │  (spec lint)     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼──────┐ ┌─────▼──────┐
     │   Frontend    │ │  Gateway  │ │  Workers   │
     │   CI          │ │  CI       │ │  CI        │
     ├───────────────┤ ├───────────┤ ├────────────┤
     │ npm ci        │ │ npm ci    │ │ npm ci     │
     │ lint          │ │ lint      │ │ lint       │
     │ test (mock)   │ │ test      │ │ test       │
     │ build         │ │ deploy    │ │ deploy     │
     │ deploy-pages  │ │ (preview) │ │ (preview)  │
     └───────────────┘ └───────────┘ └────────────┘
```

---

## Deployment Matrix

| Component | Platform | Deployment Command | Preview Deploys |
|---|---|---|---|
| **Frontend** | Cloudflare Pages | `wrangler pages deploy` | Per-branch |
| **API Gateway** | Cloudflare Workers | `wrangler deploy --env production` | `--env preview` |
| **Comics Worker** | Cloudflare Workers | `wrangler deploy` | `--env preview` |
| **Stories Worker** | Cloudflare Workers | `wrangler deploy` | `--env preview` |
| **Analytics Worker** | Cloudflare Workers | `wrangler deploy` | `--env preview` |
| **Admin Worker** | Cloudflare Workers | `wrangler deploy` | `--env preview` |
| **R2 Proxy** | Cloudflare Workers | `wrangler deploy` | Per-branch |
| **Supabase** | Supabase Managed | `supabase db push` | Branch preview |

---

## Risk Mitigation Checklist

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **CORS preflight failures in production** | Medium | High | Deploy gateway with CORS headers to staging 1 week before cutover. `Access-Control-Max-Age: 86400`. |
| **JWT expiry causes silent 401s** | High | Medium | `apiClient.ts` interceptor: on 401 → call Supabase `refreshSession()` → retry. Toast on refresh failure. |
| **Breaking API changes break frontend** | Medium | High | Versioning (`/api/v1/`). Old versions preserved 6 months with `Sunset` header. |
| **D1 cold starts on Workers** | Medium | Medium | Monitor with `wrangler deploy --tail`. `workers_dev = false` on prod. Consider hot standby. |
| **Parallel dev → incompatible contracts** | High | High | Contract tests in CI (P4.4). Mock server updated before backend implementation. |
| **Rate limiting blocks legitimate traffic** | Low | Medium | 100 req/min per user (configurable). `Retry-After` header on 429. Monitor dashboard. |
| **Data migration (Supabase ↔ D1 conflicts)** | Medium | High | Single source of truth per entity: stories/chapters → D1, auth/profiles → Supabase. Gateway resolves. |
| **Secret/key leak in Worker env** | Low | Critical | `wrangler secret` for production keys (not `vars`). Audit quarterly. Never log secrets. |

---

## Monorepo Layout (Final)

```
light-story/
├── packages/
│   └── api-types/              ← OpenAPI spec + generated TypeScript types
│       ├── openapi.yaml
│       ├── .spectral.yaml
│       ├── package.json
│       └── src/generated/
│           └── index.ts
├── frontend/                   ← Pure Next.js UI, no backend logic
│   ├── src/
│   │   ├── lib/apiClient.ts    ← Single HTTP client (targets gateway)
│   │   ├── application/use-cases/
│   │   ├── infrastructure/repositories/
│   │   └── ...
│   └── package.json
├── workers/
│   ├── api-gateway/            ← Routing, JWT validation, CORS, rate limiting
│   │   ├── src/index.ts
│   │   └── wrangler.jsonc
│   ├── comics-worker/          ← Comic/chapter CRUD on D1
│   ├── stories-worker/         ← Story CRUD on D1
│   ├── analytics-worker/       ← Dashboard analytics aggregation
│   ├── admin-worker/           ← Admin operations, audit logs
│   └── r2-proxy/               ← JWT-gated R2 asset proxy (existing)
├── backend-supabase/           ← Supabase config, migrations, Edge Functions
├── backend-d1-saas/            ← Retained for reference; no longer deployed
├── package.json                ← Root workspace (npm workspaces)
└── wrangler.jsonc              ← Root wrangler config (monorepo)
```

---

## Agent Execution Protocol

### Status Convention

Each task in the manifest (`tasks[].status`) uses one of:
- `pending` — not started
- `in_progress` — currently being worked on
- `done` — completed, verified
- `blocked` — dependency not met
- `skipped` — no longer needed

### Execution Order

1. Read the manifest from the YAML block at the top of this file
2. Find any task with `status: pending` whose `deps` are all `done`
3. Execute that task using its `commands` and modifying its `files`
4. Run the `verify` steps
5. Update its `status` to `done`
6. Repeat until all tasks are `done`

### Error Handling

- If a task's `verify` step fails: set `status: blocked`, log the failure reason inline, and stop the phase.
- If a task has `commands` that exit non-zero: abort, do not mark done.
- Manual override: set any task's `status` to `skipped` to bypass.
