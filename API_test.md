# Light Story API — Postman Test Suite

> **Total Endpoints:** 48  
> **Total Test Cases:** ~202  
> **Base URLs:** Local `http://localhost:3001` | Staging `https://staging.lightstory.app` | Mock `http://localhost:4010`

---

## Environment Variables

Create a Postman environment with these variables:

| Variable | Description | Local Value |
|---|---|---|
| `baseUrl` | Frontend/Next.js BFF | `http://localhost:3001` |
| `d1WorkerUrl` | D1 SaaS Worker | `http://localhost:9000` |
| `r2ProxyUrl` | R2 Proxy Worker | `http://localhost:9080` |
| `supabaseEdgeUrl` | Supabase Edge Functions | `http://localhost:54321/functions/v1` |
| `analyticsWorkerUrl` | Analytics Aggregator | `http://localhost:8787` |
| `adminKey` | D1 Admin API key | `test-admin-key-12345` |
| `tenantKey` | Provisioned tenant key | *(from setup)* |
| `tenantId` | Provisioned tenant ID | *(from setup)* |
| `storyId` | Created story ID | *(from setup)* |
| `chapterId` | Created chapter ID | *(from setup)* |
| `jwtSuperadmin` | Superadmin JWT | *(from auth)* |
| `jwtAdmin` | Admin JWT | *(from auth)* |
| `jwtEmployee` | Employee JWT | *(from auth)* |
| `jwtUser` | Regular user JWT | *(from auth)* |
| `jwtPremium` | Premium user JWT | *(from auth)* |
| `internalSecret` | Internal admin secret | *(from .env)* |
| `supabaseUrl` | Supabase project URL | `http://localhost:54321` |
| `supabaseAnonKey` | Supabase anon key | *(from config)* |
| `r2Bucket` | R2 bucket name | `lightstory-assets` |
| `r2TestKey` | Test asset key for R2 | `test/sample.txt` |

---

## Postman Test Script Snippets

Reusable JavaScript snippets for the **Tests** tab:

### Status & Response Validation
```js
// Status code check
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Status 401", () => pm.response.to.have.status(401));
pm.test("Status 403", () => pm.response.to.have.status(403));
pm.test("Status 404", () => pm.response.to.have.status(404));
pm.test("Status 422", () => pm.response.to.have.status(422));
pm.test("Status 409", () => pm.response.to.have.status(409));

// Response time
pm.test("Response time < 3000ms", () => pm.expect(pm.response.responseTime).to.be.below(3000));

// Content-Type check
pm.test("Content-Type is JSON", () => pm.response.to.have.header("Content-Type", "application/json"));

// Success envelope
pm.test("status is success", () => pm.expect(pm.response.json().status).to.eql("success"));

// Error envelope
pm.test("status is error", () => pm.expect(pm.response.json().status).to.eql("error"));
pm.test("Error has code and message", () => {
  const err = pm.response.json().error;
  pm.expect(err).to.have.property("code");
  pm.expect(err).to.have.property("message");
  pm.expect(err).to.have.property("requestId");
});

// Extract variable from response
pm.test("Save variable", () => {
  const json = pm.response.json();
  if (json.data?.id) pm.collectionVariables.set("storyId", json.data.id);
  if (json.tenantKey) pm.collectionVariables.set("tenantKey", json.tenantKey);
  if (json.data?.tenant?.id) pm.collectionVariables.set("tenantId", json.data.tenant.id);
});
```

---

# GROUP 01: D1 SaaS Multi-tenant Worker (15 endpoints)

Base URL: `{{d1WorkerUrl}}`

---

## 01-A `GET /health`

### Request
```
GET {{d1WorkerUrl}}/health
```

### Test Cases

| # | Scenario | Auth | Expected Status | Expected Body |
|---|---|---|---|---|
| 1 | Public health check | None | `200` | `{ "ok": true }` |

### Postman Test Script
```js
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("ok is true", () => pm.expect(pm.response.json().ok).to.be.true);
```

---

## 01-B `POST /tenants`

Creates a new tenant with a provisioned D1 database.

### Request
```
POST {{d1WorkerUrl}}/tenants
x-admin-key: {{adminKey}}
Content-Type: application/json

{
  "name": "Test Tenant {{$randomCompanyName}}"
}
```

### Test Cases

| # | Scenario | Auth | Body | Expected |
|---|---|---|---|---|
| 1 | Create tenant — valid | `x-admin-key: valid` | Full body | `201` |
| 2 | Create tenant — missing admin key | None | Full body | `401` / `403` |
| 3 | Create tenant — invalid admin key | `x-admin-key: bogus` | Full body | `401` / `403` |
| 4 | Create tenant — missing name | `x-admin-key: valid` | `{}` | `422` |

### Response (201)
```json
{
  "tenant": {
    "id": "01jqxyz...",
    "slug": "test-tenant-acme",
    "name": "Test Tenant Acme",
    "databaseId": "aaaa-bbbb-cccc",
    "databaseName": "tenant-01jqxyz",
    "status": "provisioning",
    "createdAt": "2026-05-16T10:00:00Z",
    "updatedAt": "2026-05-16T10:00:00Z"
  },
  "tenantKey": "tnt_abc123secret..."
}
```

### Error Response (401)
```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid admin key",
    "requestId": "req_..."
  }
}
```

### Error Response (422)
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "name is required",
    "requestId": "req_..."
  }
}
```

### Postman Test Script
```js
// Case 1: Success
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Has tenant and tenantKey", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("tenant");
  pm.expect(json).to.have.property("tenantKey");
  pm.expect(json.tenant).to.have.property("id");
  pm.expect(json.tenant).to.have.property("name");
});
// Save for chained requests
pm.test("Save tenantId and tenantKey", () => {
  const json = pm.response.json();
  pm.collectionVariables.set("tenantId", json.tenant.id);
  pm.collectionVariables.set("tenantKey", json.tenantKey);
});

// Case 2-3: Auth failure
pm.test("Status 401", () => pm.response.to.have.status(401));
pm.test("Error code is UNAUTHORIZED", () => {
  pm.expect(pm.response.json().error.code).to.eql("UNAUTHORIZED");
});

// Case 4: Validation failure
pm.test("Status 422", () => pm.response.to.have.status(422));
pm.test("Error code is VALIDATION_ERROR", () => {
  pm.expect(pm.response.json().error.code).to.eql("VALIDATION_ERROR");
});
```

---

## 01-C `GET /tenants`

### Request
```
GET {{d1WorkerUrl}}/tenants
x-admin-key: {{adminKey}}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | List tenants — valid | `x-admin-key: valid` | `200` + array |
| 2 | List tenants — no auth | None | `401` |

### Response (200)
```json
{
  "tenants": [
    {
      "id": "01jqxyz...",
      "slug": "test-tenant-acme",
      "name": "Test Tenant Acme",
      "databaseId": "aaaa-bbbb-cccc",
      "databaseName": "tenant-01jqxyz",
      "status": "ready",
      "createdAt": "2026-05-16T10:00:00Z",
      "updatedAt": "2026-05-16T10:00:00Z"
    }
  ]
}
```

### Postman Test Script
```js
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("tenants is array", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("tenants");
  pm.expect(json.tenants).to.be.an("array");
});
```

---

## 01-D `POST /admin/add-tenant`

### Request
```
POST {{d1WorkerUrl}}/admin/add-tenant
x-admin-key: {{adminKey}}
Content-Type: application/json

{
  "id": "custom-tenant-id",
  "slug": "custom-tenant",
  "name": "Custom Tenant",
  "database_id": "custom-db-id",
  "database_name": "custom-db-name",
  "api_key_hash": "abc123hash..."
}
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Insert tenant manually | `201` `{ "success": true }` |
| 2 | Missing required fields | `422` |

---

## 01-E `GET /admin/failed-tenants`

### Request
```
GET {{d1WorkerUrl}}/admin/failed-tenants
x-admin-key: {{adminKey}}
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | List failed tenants | `200` + array |
| 2 | No admin key | `401` |

---

## 01-F `POST /admin/recover/:tenantId`

### Request
```
POST {{d1WorkerUrl}}/admin/recover/{{tenantId}}
x-admin-key: {{adminKey}}
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Recover existing tenant | `200` |
| 2 | Recover nonexistent tenant | `404` |

### Response (200)
```json
{
  "success": true,
  "message": "Tenant recovered and marked ready"
}
```

---

## 01-G `GET /tenants/:tenantId`

### Request
```
GET {{d1WorkerUrl}}/tenants/{{tenantId}}
x-tenant-key: {{tenantKey}}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | Get tenant — valid tenant key | `x-tenant-key: valid` | `200` + tenant |
| 2 | Get tenant — valid admin key | `x-admin-key: valid` | `200` + tenant |
| 3 | Get tenant — invalid tenant key | `x-tenant-key: bogus` | `403` |
| 4 | Get tenant — expired JWT | `Authorization: Bearer expired` | `401` |

### Response (200)
```json
{
  "tenant": {
    "id": "01jqxyz...",
    "slug": "test-tenant-acme",
    "name": "Test Tenant Acme",
    "databaseId": "aaaa-bbbb-cccc",
    "databaseName": "tenant-01jqxyz",
    "status": "ready",
    "createdAt": "2026-05-16T10:00:00Z",
    "updatedAt": "2026-05-16T10:00:00Z"
  }
}
```

---

## 01-H `GET /tenants/:tenantId/stories`

### Request
```
GET {{d1WorkerUrl}}/tenants/{{tenantId}}/stories
x-tenant-key: {{tenantKey}}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | List stories — valid | tenant key | `200` + array |
| 2 | List stories — no auth | None | `403` |

### Response (200)
```json
{
  "tenant": { "id": "01jqxyz...", "slug": "test-tenant", "name": "Test Tenant" },
  "stories": [
    {
      "id": "story_01jq...",
      "title": "The Adventure Begins",
      "slug": "the-adventure-begins",
      "description": "A thrilling tale",
      "cover_url": "https://assets.example.com/cover.jpg",
      "status": "published",
      "scheduled_at": null,
      "view_count": 42,
      "author": "Jane Doe",
      "category": "Fantasy",
      "genres": ["adventure", "magic"],
      "tags": ["hero", "quest"],
      "artist": "John Art",
      "translator": null,
      "source": "original",
      "rank_score": 95.5,
      "created_at": "2026-05-16T10:00:00Z",
      "updated_at": "2026-05-16T10:00:00Z"
    }
  ]
}
```

---

## 01-I `POST /tenants/:tenantId/stories`

### Request
```
POST {{d1WorkerUrl}}/tenants/{{tenantId}}/stories
x-tenant-key: {{tenantKey}}
Content-Type: application/json

{
  "title": "The Adventure Begins",
  "slug": "the-adventure-begins",
  "description": "A thrilling tale of discovery",
  "author": "Jane Doe",
  "category": "Fantasy",
  "genres": ["adventure", "magic"],
  "tags": ["hero", "quest"],
  "status": "draft",
  "artist": "John Art",
  "source": "original"
}
```

### Test Cases

| # | Scenario | Auth | Body | Expected |
|---|---|---|---|---|
| 1 | Create story — tenant key | tenant key | Full body | `201` |
| 2 | Create story — admin key | admin key | Full body | `201` |
| 3 | Create story — employee JWT | JWT employee | Full body | `201` |
| 4 | Create story — user JWT (forbidden) | JWT user | Full body | `403` |
| 5 | Create story — missing title | tenant key | `{}` | `422` |
| 6 | Create story — missing author | tenant key | `{ "title": "x" }` | `422` |

### Response (201)
```json
{
  "tenant": { "id": "01jqxyz...", "slug": "test-tenant" },
  "story": {
    "id": "story_01jq...",
    "title": "The Adventure Begins",
    "slug": "the-adventure-begins",
    "description": "A thrilling tale of discovery",
    "cover_url": null,
    "status": "draft",
    "scheduled_at": null,
    "view_count": 0,
    "author": "Jane Doe",
    "category": "Fantasy",
    "genres": ["adventure", "magic"],
    "tags": ["hero", "quest"],
    "artist": "John Art",
    "translator": null,
    "source": "original",
    "rank_score": 0,
    "created_at": "2026-05-16T10:00:00Z",
    "updated_at": "2026-05-16T10:00:00Z"
  }
}
```

### Postman Test Script
```js
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Has story with id", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("story");
  pm.expect(json.story).to.have.property("id");
  pm.expect(json.story.title).to.eql("The Adventure Begins");
});
pm.test("Save storyId", () => {
  pm.collectionVariables.set("storyId", pm.response.json().story.id);
});

// Case 4: Forbidden
pm.test("Status 403", () => pm.response.to.have.status(403));
pm.test("Error code is INSUFFICIENT_PERMISSIONS", () => {
  pm.expect(pm.response.json().error.code).to.eql("INSUFFICIENT_PERMISSIONS");
});
```

---

## 01-J `GET /tenants/:tenantId/stories/:storyId`

### Request
```
GET {{d1WorkerUrl}}/tenants/{{tenantId}}/stories/{{storyId}}
x-tenant-key: {{tenantKey}}
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Get story by ID | `200` + story |
| 2 | Nonexistent storyId | `404` |

### Response (200)
```json
{
  "tenant": { "id": "01jqxyz..." },
  "story": {
    "id": "story_01jq...",
    "title": "The Adventure Begins",
    "slug": "the-adventure-begins",
    "description": "A thrilling tale of discovery",
    "cover_url": null,
    "status": "draft",
    "scheduled_at": null,
    "view_count": 0,
    "author": "Jane Doe",
    "category": "Fantasy",
    "genres": ["adventure", "magic"],
    "tags": ["hero", "quest"],
    "artist": "John Art",
    "translator": null,
    "source": "original",
    "rank_score": 0,
    "created_at": "2026-05-16T10:00:00Z",
    "updated_at": "2026-05-16T10:00:00Z"
  }
}
```

---

## 01-K `PUT /tenants/:tenantId/stories/:storyId`

### Request
```
PUT {{d1WorkerUrl}}/tenants/{{tenantId}}/stories/{{storyId}}
x-tenant-key: {{tenantKey}}
Content-Type: application/json

{
  "title": "The Adventure Continues",
  "status": "published",
  "description": "Updated description"
}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | Update story — admin | admin key | `200` + updated |
| 2 | Update story — employee (forbidden) | JWT employee | `403` |
| 3 | Update nonexistent story | admin key + bogus id | `404` |

### Response (200)
```json
{
  "tenant": { "id": "01jqxyz..." },
  "story": {
    "id": "story_01jq...",
    "title": "The Adventure Continues",
    "slug": "the-adventure-begins",
    "description": "Updated description",
    "cover_url": null,
    "status": "published",
    "view_count": 0,
    "author": "Jane Doe",
    "created_at": "2026-05-16T10:00:00Z",
    "updated_at": "2026-05-16T11:00:00Z"
  }
}
```

---

## 01-L `DELETE /tenants/:tenantId/stories/:storyId`

### Request
```
DELETE {{d1WorkerUrl}}/tenants/{{tenantId}}/stories/{{storyId}}
x-tenant-key: {{tenantKey}}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | Delete story — admin | admin key | `200` `{ deleted: true }` |
| 2 | Delete story — employee (forbidden) | JWT employee | `403` |
| 3 | Delete nonexistent story | admin key | `404` |

### Response (200)
```json
{
  "tenant": { "id": "01jqxyz..." },
  "deleted": true
}
```

---

## 01-M `GET /tenants/:tenantId/stories/:storyId/chapters`

### Request
```
GET {{d1WorkerUrl}}/tenants/{{tenantId}}/stories/{{storyId}}/chapters
x-tenant-key: {{tenantKey}}
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | List chapters | `200` + array |
| 2 | Nonexistent storyId | `404` |

### Response (200)
```json
{
  "tenant": { "id": "01jqxyz..." },
  "chapters": [
    {
      "id": "ch_01jq...",
      "story_id": "story_01jq...",
      "chapter_number": 1,
      "title": "Chapter 1: The Beginning",
      "status": "published",
      "scheduled_at": null,
      "content": { "pages": [...] },
      "view_count": 10,
      "created_at": "2026-05-16T10:00:00Z",
      "updated_at": "2026-05-16T10:00:00Z"
    }
  ]
}
```

---

## 01-N `POST /tenants/:tenantId/stories/:storyId/chapters`

### Request
```
POST {{d1WorkerUrl}}/tenants/{{tenantId}}/stories/{{storyId}}/chapters
x-tenant-key: {{tenantKey}}
Content-Type: application/json

{
  "chapter_number": 1,
  "title": "Chapter 1: The Beginning",
  "content": { "pages": [{"pageNumber": 1, "caption": "Once upon a time..."}] },
  "status": "draft"
}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | Create chapter — employee | JWT employee | `201` |
| 2 | Create chapter — user (forbidden) | JWT user | `403` |
| 3 | Create chapter — missing chapter_number | tenant key | `422` |
| 4 | Create chapter — negative chapter_number | tenant key | `422` |
| 5 | Create chapter — missing content | tenant key | `422` |

### Response (201)
```json
{
  "tenant": { "id": "01jqxyz..." },
  "chapter": {
    "id": "ch_01jq...",
    "story_id": "story_01jq...",
    "chapter_number": 1,
    "title": "Chapter 1: The Beginning",
    "status": "draft",
    "scheduled_at": null,
    "content": { "pages": [{"pageNumber": 1, "caption": "Once upon a time..."}] },
    "view_count": 0,
    "created_at": "2026-05-16T10:00:00Z",
    "updated_at": "2026-05-16T10:00:00Z"
  }
}
```

### Postman Test Script
```js
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Has chapter with id", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("chapter");
  pm.expect(json.chapter).to.have.property("id");
  pm.expect(json.chapter.chapter_number).to.eql(1);
});
pm.test("Save chapterId", () => {
  pm.collectionVariables.set("chapterId", pm.response.json().chapter.id);
});
```

---

## 01-O `GET /tenants/:tenantId/analytics/dashboard`

### Request
```
GET {{d1WorkerUrl}}/tenants/{{tenantId}}/analytics/dashboard?range=7d
x-tenant-key: {{tenantKey}}
```

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | Dashboard — 7d range | `?range=7d` | `200` + analytics |
| 2 | Dashboard — 24h range | `?range=24h` | `200` |
| 3 | Dashboard — 30d range | `?range=30d` | `200` |
| 4 | Dashboard — invalid range | `?range=invalid` | `200` (defaults) or `422` |

### Response (200)
```json
{
  "analytics": {
    "meta": {
      "timestamp": "2026-05-16T10:00:00Z",
      "range": "7d",
      "role": "admin",
      "cached": false,
      "restricted": false,
      "source_health": { "d1_api": "ready", "r2_api": "ready" },
      "time_window": { "start": "2026-05-09T10:00:00Z", "end": "2026-05-16T10:00:00Z" }
    },
    "user_engagement": {
      "total_users": 100,
      "new_users": 5,
      "active_users": 45,
      "total_views": 1200,
      "total_favorites": 89,
      "growth_rate_pct": 3.2,
      "churn_rate_pct": 1.1,
      "avg_session_duration_minutes": 12.5
    },
    "content_performance": {
      "total_views": 1200,
      "total_favorites": 89,
      "avg_views_per_chapter": 42.5,
      "engagement_score": 0.074,
      "top_chapters": [
        { "chapter_id": "ch_...", "story_id": "story_...", "title": "Chapter 1", "chapter_number": 1, "views": 300, "favorites": 25, "engagement_score": 0.083, "growth_rate_pct": 5.1 }
      ]
    }
  }
}
```

---

# GROUP 02: Next.js BFF Public Routes (11 endpoints)

Base URL: `{{baseUrl}}`

---

## 02-A `GET /api/stories`

### Request
```
GET {{baseUrl}}/api/stories
```

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | No | Fetch single story by ID |
| `field` | string | No | Select specific column |
| `page` | number | No (default 1) | Pagination page |
| `pageSize` | number | No (default 10, max 50) | Items per page |
| `keyword` | string | No | Full-text search |
| `status` | string | No | Filter by status |
| `sort` | string | No | `newest`, `oldest`, `most_viewed` |

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | List stories — default pagination | None | `200` + `{ items, total }` |
| 2 | Filter by keyword | `?keyword=adventure` | `200` + filtered |
| 3 | Filter by status | `?status=published` | `200` |
| 4 | Paginate page 2 | `?page=2&pageSize=5` | `200` + 5 items |
| 5 | Sort newest | `?sort=newest` | `200` + newest first |
| 6 | Get single story | `?id=xxx` | `200` + `{ data }` |
| 7 | pageSize exceeds max | `?pageSize=100` | `422` or clamped to 50 |
| 8 | Nonexistent story ID | `?id=nonexistent` | `404` |

### Response — Paginated
```json
{
  "items": [
    {
      "id": "story_uuid",
      "title": "The Adventure Begins",
      "slug": "the-adventure-begins",
      "description": "A thrilling tale",
      "cover_url": "https://assets.example.com/cover.jpg",
      "status": "published",
      "author": "Jane Doe",
      "category": "Fantasy",
      "genres": ["adventure", "magic"],
      "view_count": 42,
      "created_at": "2026-05-16T10:00:00Z"
    }
  ],
  "total": 25
}
```

### Response — Single
```json
{
  "data": {
    "id": "story_uuid",
    "title": "The Adventure Begins",
    "slug": "the-adventure-begins",
    "description": "A thrilling tale",
    "cover_url": "https://assets.example.com/cover.jpg",
    "status": "published",
    "author": "Jane Doe",
    "category": "Fantasy",
    "genres": ["adventure", "magic"],
    "tags": ["hero", "quest"],
    "view_count": 42,
    "created_at": "2026-05-16T10:00:00Z",
    "updated_at": "2026-05-16T11:00:00Z"
  }
}
```

### Postman Test Script
```js
// Paginated response
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Has items and total", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("items");
  pm.expect(json).to.have.property("total");
  pm.expect(json.items).to.be.an("array");
});

// Single story
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Has data object", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("data");
  pm.expect(json.data).to.have.property("id");
});
```

---

## 02-B `GET /api/chapters`

### Request
```
GET {{baseUrl}}/api/chapters
```

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | No | Fetch single chapter by ID |
| `storyId` | string | No | List chapters for a story |

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | Get single chapter | `?id=xxx` | `200` + `{ data }` |
| 2 | List by storyId | `?storyId=xxx` | `200` + `{ data: [] }` |
| 3 | Nonexistent chapter | `?id=nonexistent` | `404` |

### Response — Single
```json
{
  "data": {
    "id": "ch_uuid",
    "story_id": "story_uuid",
    "chapter_number": 1,
    "title": "Chapter 1: The Beginning",
    "content": { "pages": [] },
    "vip_content": false,
    "status": "published",
    "view_count": 10,
    "created_at": "2026-05-16T10:00:00Z"
  }
}
```

### Response — List
```json
{
  "data": [
    { "id": "ch_1", "story_id": "story_uuid", "chapter_number": 1, "title": "Chapter 1", "status": "published", "view_count": 10, "created_at": "..." },
    { "id": "ch_2", "story_id": "story_uuid", "chapter_number": 2, "title": "Chapter 2", "status": "draft", "view_count": 0, "created_at": "..." }
  ]
}
```

---

## 02-C `GET /api/auth/verify-recovery`

### Request
```
GET {{baseUrl}}/api/auth/verify-recovery
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Verify recovery (no session) | `200` `{ "hasSession": false }` |

### Response
```json
{
  "hasSession": false
}
```

---

## 02-D `POST /api/rpc/search-stories`

### Request
```
POST {{baseUrl}}/api/rpc/search-stories
Content-Type: application/json

{
  "embedding": [0.001, 0.002, /* ... 1536 floats ... */],
  "matchCount": 10
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Search with valid embedding | 1536-dim array | `200` + results |
| 2 | Empty embedding | `[]` | `422` |
| 3 | Wrong dimension count | `[1, 2, 3]` | `422` |
| 4 | Missing embedding | `{}` | `422` |

### Response (200)
```json
{
  "results": [
    { "id": "story_uuid", "title": "The Adventure Begins", "summary": "A thrilling tale", "cover_url": "...", "similarity": 0.95 },
    { "id": "story_uuid_2", "title": "Another Story", "summary": "...", "cover_url": "...", "similarity": 0.87 }
  ],
  "count": 2
}
```

---

## 02-E `POST /api/rpc/increment-story-views`

### Request
```
POST {{baseUrl}}/api/rpc/increment-story-views
Content-Type: application/json

{
  "storyId": "story_uuid"
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Increment views | `{ storyId: "xxx" }` | `200` `{ ok: true }` |
| 2 | Missing storyId | `{}` | `422` |

### Response
```json
{
  "ok": true
}
```

---

## 02-F `POST /api/rpc/like-story`

### Request
```
POST {{baseUrl}}/api/rpc/like-story
Content-Type: application/json

{
  "storyId": "story_uuid"
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Like story | `{ storyId: "xxx" }` | `200` `{ ok: true }` |
| 2 | Missing storyId | `{}` | `422` |

---

## 02-G `POST /api/rpc/unlike-story`

### Request
```
POST {{baseUrl}}/api/rpc/unlike-story
Content-Type: application/json

{
  "storyId": "story_uuid"
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Unlike story | `{ storyId: "xxx" }` | `200` `{ ok: true }` |
| 2 | Missing storyId | `{}` | `422` |

---

## 02-H `GET /api/system-settings`

### Request
```
GET {{baseUrl}}/api/system-settings
```

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | Get all settings | None | `200` + array |
| 2 | Filter by keys | `?keys=site_name,site_description` | `200` + filtered |

### Response
```json
{
  "data": [
    { "key": "site_name", "value": "Light Story" },
    { "key": "site_description", "value": "An online reading platform" }
  ]
}
```

---

## 02-I `POST /api/system-settings`

### Request
```
POST {{baseUrl}}/api/system-settings
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "payload": [
    { "key": "maintenance_mode", "value": "false" }
  ]
}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | Upsert settings | admin JWT | `200` `{ ok: true }` |
| 2 | No auth | None | `401` |
| 3 | User role (forbidden) | JWT user | `403` |
| 4 | Invalid payload shape | admin JWT + `{}` | `422` |

---

## 02-J `GET /api/site-settings`

### Request
```
GET {{baseUrl}}/api/site-settings?scope=public
```

### Test Cases

| # | Scenario | Query | Auth | Expected |
|---|---|---|---|---|
| 1 | Public scope | `?scope=public` | None | `200` + sanitized |
| 2 | Admin scope | `?scope=admin` | admin JWT | `200` + full rows |
| 3 | Admin scope no auth | `?scope=admin` | None | `401` |

---

## 02-K `GET /api/site-metrics`

### Request
```
GET {{baseUrl}}/api/site-metrics?type=profiles
```

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | Profiles count | `?type=profiles` | `200` `{ count: n }` |
| 2 | Chapters count | `?type=chapters` | `200` `{ count: n }` |
| 3 | Invalid type | `?type=invalid` | `422` |

### Response
```json
{
  "count": 42
}
```

---

## 02-L `GET /api/role-distribution`

### Request
```
GET {{baseUrl}}/api/role-distribution
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Get role distribution | `200` + array |

### Response
```json
{
  "data": [
    { "role": "superadmin", "total": 1 },
    { "role": "admin", "total": 3 },
    { "role": "employee", "total": 5 },
    { "role": "user", "total": 100 }
  ]
}
```

---

## 02-M `GET /api/taxonomy/categories`

### Request
```
GET {{baseUrl}}/api/taxonomy/categories
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | List categories | `200` + array |

### Response
```json
{
  "data": [
    { "id": "cat_uuid", "name": "Fantasy", "slug": "fantasy", "description": "Fantasy stories" },
    { "id": "cat_uuid_2", "name": "Science Fiction", "slug": "science-fiction", "description": "Sci-fi stories" }
  ]
}
```

---

# GROUP 03: Next.js BFF Internal Admin Routes (13 endpoints)

Base URL: `{{baseUrl}}`

**Auth for all admin endpoints:** Use one of:
- `x-internal-secret: {{internalSecret}}` (service-to-service)
- `Authorization: Bearer {{jwtAdmin}}` (admin user)
- `Authorization: Bearer {{jwtSuperadmin}}` (superadmin user)

---

## 03-A `POST /api/internal/admin/comics`

### Request
```
POST {{baseUrl}}/api/internal/admin/comics
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "title": "My New Comic",
  "slug": "my-new-comic",
  "description": "A brand new comic series",
  "author": "Jane Doe",
  "status": "ongoing",
  "category": ["Fantasy", "Adventure"]
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Create comic — all fields | Full body | `201` + comic with tenantKey |
| 2 | Create comic — no auth | Full body + no header | `401` |
| 3 | Create comic — user role | JWT user | `403` |
| 4 | Create comic — missing title | `{ author: "x" }` | `422` |

### Response (201)
```json
{
  "comic": {
    "id": "comic_01jq...",
    "tenantKey": "tnt_xxx...",
    "storyId": "story_01jq...",
    "title": "My New Comic",
    "slug": "my-new-comic",
    "description": "A brand new comic series",
    "author": "Jane Doe",
    "status": "ongoing",
    "category": ["Fantasy", "Adventure"],
    "viewCount": 0,
    "coverUrl": null,
    "createdAt": "2026-05-16T10:00:00Z",
    "updatedAt": "2026-05-16T10:00:00Z"
  }
}
```

### Postman Test Script
```js
pm.test("Status 201", () => pm.response.to.have.status(201));
pm.test("Has comic with id and tenantKey", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("comic");
  pm.expect(json.comic).to.have.property("id");
  pm.expect(json.comic).to.have.property("tenantKey");
  pm.expect(json.comic).to.have.property("storyId");
});
pm.test("Save comic tenantKey and storyId", () => {
  const comic = pm.response.json().comic;
  pm.collectionVariables.set("comicId", comic.id);
  pm.collectionVariables.set("comicTenantKey", comic.tenantKey);
  pm.collectionVariables.set("comicStoryId", comic.storyId);
});
```

---

## 03-B `POST /api/internal/admin/comics/:comicId/chapters`

### Request
```
POST {{baseUrl}}/api/internal/admin/comics/{{comicId}}/chapters
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "storyId": "{{comicStoryId}}",
  "tenantKey": "{{comicTenantKey}}",
  "chapterNumber": 1,
  "title": "Chapter 1: The Beginning",
  "content": { "pages": [{"pageNumber": 1, "caption": "Start"}] }
}
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Create chapter — valid | `201` + chapter |
| 2 | Missing tenantKey | `422` |
| 3 | Invalid tenantKey | `403` |
| 4 | Missing chapterNumber | `422` |

### Response (201)
```json
{
  "chapter": {
    "id": "ch_01jq...",
    "story_id": "story_01jq...",
    "chapter_number": 1,
    "title": "Chapter 1: The Beginning",
    "status": "draft",
    "view_count": 0,
    "created_at": "2026-05-16T10:00:00Z"
  }
}
```

---

## 03-C `POST /api/internal/admin/upload-to-r2`

### Request
```
POST {{baseUrl}}/api/internal/admin/upload-to-r2
Authorization: Bearer {{jwtAdmin}}
x-r2-bucket: {{r2Bucket}}
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="test.txt"
Content-Type: text/plain

Hello, world!
--boundary--
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Upload single file | `200` + urls |
| 2 | Missing bucket header | `422` |
| 3 | No file attached | `422` |
| 4 | No auth | `401` |

### Response (200)
```json
{
  "urls": ["https://lightstory-assets.r2.cloudflarestorage.com/test.txt"]
}
```

---

## 03-D `GET /api/internal/admin/taxonomy`

### Request
```
GET {{baseUrl}}/api/internal/admin/taxonomy?type=categories
Authorization: Bearer {{jwtAdmin}}
```

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | List authors | `?type=authors` | `200` + array |
| 2 | List categories | `?type=categories` | `200` + array |
| 3 | Invalid type | `?type=invalid` | `422` |
| 4 | Missing type | None | `422` |

### Response
```json
{
  "data": [
    { "id": "cat_uuid", "name": "Fantasy", "slug": "fantasy" }
  ]
}
```

---

## 03-E `POST /api/internal/admin/taxonomy`

### Request — Create
```
POST {{baseUrl}}/api/internal/admin/taxonomy
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "entity": "category",
  "action": "create",
  "payload": {
    "name": "New Category"
  }
}
```

### Request — Update
```json
{
  "entity": "category",
  "action": "update",
  "id": "cat_uuid",
  "payload": {
    "name": "Updated Category",
    "description": "New description"
  }
}
```

### Request — Delete
```json
{
  "entity": "category",
  "action": "delete",
  "id": "cat_uuid"
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Create category | `{ action: "create", entity: "category", payload: { name } }` | `200` + record |
| 2 | Create author | `{ action: "create", entity: "author", payload: { name } }` | `200` + record |
| 3 | Update existing | `{ action: "update", id: "xxx", payload: { name } }` | `200` |
| 4 | Delete existing | `{ action: "delete", id: "xxx" }` | `200` `{ ok: true }` |
| 5 | Missing entity | `{ action: "create", payload: { name } }` | `422` |
| 6 | Missing action | `{ entity: "category" }` | `422` |

### Response — Create/Update
```json
{
  "data": {
    "id": "cat_uuid",
    "name": "New Category",
    "slug": "new-category"
  }
}
```

### Response — Delete
```json
{
  "ok": true
}
```

---

## 03-F `GET /api/internal/admin/profiles`

### Request
```
GET {{baseUrl}}/api/internal/admin/profiles
Authorization: Bearer {{jwtAdmin}}
```

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | List all profiles | None | `200` + array |
| 2 | Filter by ids | `?ids=id1,id2` | `200` + filtered |

### Response
```json
{
  "data": [
    { "id": "prof_uuid", "email": "admin@example.com", "role": "admin", "full_name": "Admin User" }
  ]
}
```

---

## 03-G `POST /api/internal/admin/profiles`

### Request — Update Name
```
POST {{baseUrl}}/api/internal/admin/profiles
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "action": "updateName",
  "id": "prof_uuid",
  "full_name": "New Name"
}
```

### Request — Update Role (superadmin only)
```json
{
  "action": "updateRole",
  "id": "prof_uuid",
  "role": "admin"
}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | Update name | admin JWT | `200` `{ ok: true }` |
| 2 | Update role | superadmin JWT | `200` |
| 3 | Update role as admin (forbidden) | admin JWT | `403` |
| 4 | Missing action | `{}` | `422` |

---

## 03-H `POST /api/internal/admin/manage-user`

### Request — Create
```
POST {{baseUrl}}/api/internal/admin/manage-user
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "action": "create",
  "email": "newuser@example.com",
  "password": "securepassword123",
  "fullName": "New User",
  "role": "user"
}
```

### Request — Delete (superadmin only)
```json
{
  "action": "delete",
  "userId": "user_uuid"
}
```

### Test Cases

| # | Scenario | Auth | Role in body | Expected |
|---|---|---|---|---|
| 1 | Create user | admin JWT | `"role": "user"` | `200` + userId |
| 2 | Create employee | admin JWT | `"role": "employee"` | `200` |
| 3 | Create admin (forbidden for admin) | admin JWT | `"role": "admin"` | `403` |
| 4 | Create admin (superadmin only) | superadmin JWT | `"role": "admin"` | `200` |
| 5 | Delete user (superadmin only) | superadmin JWT | `{ action: "delete", userId: "..." }` | `200` |
| 6 | Delete as admin (forbidden) | admin JWT | `{ action: "delete", userId: "..." }` | `403` |
| 7 | Short password (< 6 chars) | admin JWT | `{ password: "abc" }` | `422` |
| 8 | Invalid email | admin JWT | `{ email: "notanemail" }` | `422` |

### Response — Create
```json
{
  "userId": "auth_uuid",
  "email": "newuser@example.com",
  "role": "user"
}
```

### Response — Delete
```json
{
  "deleted": true,
  "userId": "auth_uuid"
}
```

### Postman Test Script
```js
// Create success
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Has userId", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("userId");
  pm.expect(json).to.have.property("email");
});

// Forbidden
pm.test("Status 403", () => pm.response.to.have.status(403));
pm.test("Error code is INSUFFICIENT_PERMISSIONS", () => {
  pm.expect(pm.response.json().error.code).to.eql("INSUFFICIENT_PERMISSIONS");
});
```

---

## 03-I `POST /api/internal/admin/manage-story`

### Request — Create
```
POST {{baseUrl}}/api/internal/admin/manage-story
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "action": "create",
  "story": {
    "title": "Admin Created Story",
    "authorId": "author_uuid",
    "categoryId": "cat_uuid",
    "summary": "A story created via admin",
    "status": "draft"
  }
}
```

### Request — Update
```json
{
  "action": "update",
  "id": "story_uuid",
  "payload": {
    "title": "Updated Title",
    "status": "published"
  }
}
```

### Request — Delete
```json
{
  "action": "delete",
  "id": "story_uuid"
}
```

### Request — Bulk Update Status
```json
{
  "action": "bulkUpdateStatus",
  "ids": ["story_uuid_1", "story_uuid_2"],
  "status": "archived"
}
```

### Request — Bulk Delete
```json
{
  "action": "bulkDelete",
  "ids": ["story_uuid_1", "story_uuid_2"]
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Create story | `{ action: "create", story: {...} }` | `200` + story |
| 2 | Update story | `{ action: "update", id, payload }` | `200` + updated |
| 3 | Delete story | `{ action: "delete", id }` | `200` `{ ok: true }` |
| 4 | Bulk update status | `{ action: "bulkUpdateStatus", ids, status }` | `200` |
| 5 | Bulk delete | `{ action: "bulkDelete", ids }` | `200` |
| 6 | Missing action | `{}` | `422` |
| 7 | Create missing title | `{ action: "create", story: {} }` | `422` |

### Response — Create
```json
{
  "story": {
    "id": "story_uuid",
    "title": "Admin Created Story",
    "slug": "admin-created-story",
    "summary": "A story created via admin",
    "status": "draft",
    "created_at": "2026-05-16T10:00:00Z"
  }
}
```

### Response — Delete/Bulk
```json
{
  "ok": true
}
```

---

## 03-J `POST /api/internal/admin/manage-chapter`

### Request — Create
```
POST {{baseUrl}}/api/internal/admin/manage-chapter
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "action": "create",
  "chapter": {
    "story_id": "story_uuid",
    "chapter_number": 1,
    "title": "Chapter 1: Test",
    "content": "Chapter content here",
    "vip_content": false
  }
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Create chapter | Full body | `200` + chapter |
| 2 | Update chapter | `{ action: "update", id, chapter: {...} }` | `200` |
| 3 | Delete chapter | `{ action: "delete", id }` | `200` |
| 4 | Missing action | `{}` | `422` |

---

## 03-K `GET /api/internal/admin/audit`

### Request
```
GET {{baseUrl}}/api/internal/admin/audit
Authorization: Bearer {{jwtAdmin}}
```

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | List audit logs | None | `200` + array |
| 2 | Limit results | `?limit=10` | `200` + <= 10 items |

### Response
```json
{
  "data": [
    { "id": "audit_uuid", "actor_user_id": "user_uuid", "action": "chapter.create", "target_user_id": null, "target_email": null, "metadata": { "chapter_id": "ch_..." }, "created_at": "2026-05-16T10:00:00Z" }
  ]
}
```

---

## 03-L `POST /api/internal/admin/audit`

### Request
```
POST {{baseUrl}}/api/internal/admin/audit
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "action": "test_action",
  "metadata": { "key": "value" }
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Create audit entry | `{ action: "test" }` | `200` `{ ok: true }` |
| 2 | With metadata | `{ action: "test", metadata: { key: "val" } }` | `200` |
| 3 | Missing action | `{}` | `422` |

---

## 03-M `GET /api/internal/admin/analytics/dashboard`

### Request
```
GET {{baseUrl}}/api/internal/admin/analytics/dashboard?range=7d
Authorization: Bearer {{jwtAdmin}}
```

### Test Cases

| # | Scenario | Query | Auth | Expected |
|---|---|---|---|---|
| 1 | Dashboard — default | None | admin JWT | `200` + analytics |
| 2 | Dashboard — 24h | `?range=24h` | admin JWT | `200` |
| 3 | Dashboard — employee allowed | None | JWT employee | `200` |
| 4 | Dashboard — user forbidden | None | JWT user | `403` |
| 5 | Dashboard — no auth | None | None | `401` |

### Response
```json
{
  "analytics": {
    "meta": { "timestamp": "...", "range": "7d" },
    "user_engagement": { "total_users": 100, "new_users": 5, "active_users": 45, "total_views": 1200, "total_favorites": 89 },
    "content_performance": { "total_views": 1200, "total_favorites": 89, "avg_views_per_chapter": 42.5 }
  }
}
```

---

# GROUP 04: R2 Signed-URL Proxy Worker (1 endpoint)

Base URL: `{{r2ProxyUrl}}`

---

## 04-A `GET /:key`

### Request
```
GET {{r2ProxyUrl}}/public/test.txt
```

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `sig` | string | No | `<hmac>.<expiry_timestamp>` signed URL |

### Test Cases

| # | Scenario | Auth | Path | Expected |
|---|---|---|---|---|
| 1 | Public asset — no auth | None | `/public/test.txt` | `200` + binary |
| 2 | VIP asset — no auth | None | `/vip/premium-chapter.txt` | `403` |
| 3 | VIP asset — premium JWT | `Bearer {{jwtPremium}}` | `/vip/premium-chapter.txt` | `200` |
| 4 | VIP asset — admin JWT | `Bearer {{jwtAdmin}}` | `/vip/premium-chapter.txt` | `200` |
| 5 | VIP asset — regular user JWT | `Bearer {{jwtUser}}` | `/vip/premium-chapter.txt` | `403` |
| 6 | Signed URL — valid | `?sig=valid_hmac.future_ts` | any | `200` |
| 7 | Signed URL — expired | `?sig=valid_hmac.past_ts` | any | `401` |
| 8 | Signed URL — tampered | `?sig=tampered.9999999999` | any | `401` |
| 9 | Nonexistent key | None | `/nonexistent.txt` | `404` |

### Response Headers (200)
```
cache-control: public, max-age=86400
content-type: image/webp
```

### VIP Response Headers
```
cache-control: private, max-age=60
```

### Postman Test Script
```js
// Success
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Has Cache-Control header", () => {
  pm.expect(pm.response.headers.get("cache-control")).to.exist;
});

// Forbidden
pm.test("Status 403", () => pm.response.to.have.status(403));

// Unauthorized
pm.test("Status 401", () => pm.response.to.have.status(401));

// Not found
pm.test("Status 404", () => pm.response.to.have.status(404));
```

---

# GROUP 05: Supabase Edge Functions (7 endpoints)

Base URL: `{{supabaseEdgeUrl}}`

---

## 05-A `POST /increment-story-views`

### Request
```
POST {{supabaseEdgeUrl}}/increment-story-views
Content-Type: application/json

{
  "storyId": "story_uuid"
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Increment valid storyId | `{ storyId: "xxx" }` | `200` `{ ok: true }` |
| 2 | Missing storyId | `{}` | `422` |

---

## 05-B `POST /manage-story`

### Request
```
POST {{supabaseEdgeUrl}}/manage-story
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "title": "New Story via Edge Function",
  "summary": "Created through Supabase Edge Function",
  "authorId": "author_uuid",
  "categoryId": "cat_uuid",
  "status": "draft"
}
```

### Test Cases

| # | Scenario | Auth | Body | Expected |
|---|---|---|---|---|
| 1 | Create story — admin | JWT admin | Full body | `200` + story |
| 2 | Create story — user (forbidden) | JWT user | Full body | `403` |
| 3 | Missing title | JWT admin | `{}` | `422` |
| 4 | Empty title | JWT admin | `{ title: "" }` | `422` |
| 5 | Title >500 chars | JWT admin | Long string | `422` |
| 6 | No auth | None | Full body | `401` |

### Response (200)
```json
{
  "story": {
    "id": "story_uuid",
    "title": "New Story via Edge Function",
    "summary": "Created through Supabase Edge Function",
    "cover_url": null,
    "author_id": "author_uuid",
    "category_id": "cat_uuid",
    "status": "draft",
    "created_at": "2026-05-16T10:00:00Z"
  }
}
```

---

## 05-C `POST /manage-chapter`

### Request
```
POST {{supabaseEdgeUrl}}/manage-chapter
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "story_id": "story_uuid",
  "chapter_number": 1,
  "title": "Chapter via Edge",
  "content": "Full chapter content...",
  "vip_content": false
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Create chapter (employee) | Full body | `200` + chapter |
| 2 | Create chapter (user — forbidden) | JWT user | `403` |
| 3 | Missing story_id | `{ chapter_number: 1, title: "x" }` | `422` |
| 4 | Zero chapter_number | `{ story_id: "x", chapter_number: 0, title: "x" }` | `422` |
| 5 | Missing title | `{ story_id: "x", chapter_number: 1 }` | `422` |

### Response (200)
```json
{
  "chapter": {
    "id": "ch_uuid",
    "story_id": "story_uuid",
    "chapter_number": 1,
    "title": "Chapter via Edge"
  }
}
```

---

## 05-D `POST /manage-user`

### Request — Create
```
POST {{supabaseEdgeUrl}}/manage-user
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "action": "create",
  "email": "newuser@example.com",
  "password": "securepassword123",
  "role": "user",
  "fullName": "New User"
}
```

### Test Cases

| # | Scenario | Auth | Role | Expected |
|---|---|---|---|---|
| 1 | Create user (admin) | JWT admin | `user` | `200` |
| 2 | Create employee (admin) | JWT admin | `employee` | `200` |
| 3 | Create admin as admin (forbidden) | JWT admin | `admin` | `403` |
| 4 | Create admin (superadmin) | JWT superadmin | `admin` | `200` |
| 5 | Delete user (superadmin) | JWT superadmin | — | `200` |
| 6 | Delete as admin (forbidden) | JWT admin | — | `403` |

---

## 05-E `POST /payment_and_rewards`

### Request — Payment Webhook
```
POST {{supabaseEdgeUrl}}/payment_and_rewards
Content-Type: application/json

{
  "type": "payment_webhook",
  "data": {
    "user_id": "user_uuid",
    "amount": 9.99,
    "provider": "stripe",
    "provider_event": { "event_id": "evt_123" }
  }
}
```

### Request — Daily Check-in
```json
{
  "type": "daily_checkin",
  "data": {
    "user_id": "user_uuid"
  }
}
```

### Test Cases

| # | Scenario | Body | Expected |
|---|---|---|---|
| 1 | Payment webhook | `{ type: "payment_webhook", data: { user_id } }` | `200` `{ recorded: true }` |
| 2 | Daily check-in | `{ type: "daily_checkin", data: { user_id } }` | `200` `{ rewarded: true }` |
| 3 | Missing type | `{}` | `422` |

### Responses
```json
{ "recorded": true }
```
```json
{ "rewarded": true }
```

---

## 05-F `POST /upload_to_r2`

### Request
```
POST {{supabaseEdgeUrl}}/upload_to_r2
x-r2-bucket: {{r2Bucket}}
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="test.txt"
Content-Type: text/plain

File content here
--boundary--
```

### Test Cases

| # | Scenario | Expected |
|---|---|---|
| 1 | Upload file | `200` + `{ urls: [...] }` |
| 2 | Missing bucket header | `422` |

### Response
```json
{
  "urls": ["https://..."],
  "errors": []
}
```
Or with partial failures:
```json
{
  "urls": ["https://..."],
  "errors": ["filename2.txt failed to upload"]
}
```
Status: `200` (all succeeded) or `207` (partial failures).

---

## 05-G `POST /create_comic` (legacy)

### Request
```
POST {{supabaseEdgeUrl}}/create_comic
Authorization: Bearer {{jwtAdmin}}
Content-Type: application/json

{
  "title": "Legacy Comic",
  "description": "Created via legacy endpoint",
  "cover_url": "https://example.com/cover.jpg"
}
```

### Test Cases

| # | Scenario | Auth | Expected |
|---|---|---|---|
| 1 | Create comic (any auth) | JWT any user | `201` |
| 2 | No auth | None | `401` |

### Response (201)
```json
{
  "id": "comic_uuid",
  "title": "Legacy Comic",
  "description": "Created via legacy endpoint",
  "cover_url": "https://example.com/cover.jpg",
  "owner_id": "user_uuid"
}
```

---

# GROUP 06: Analytics Aggregator Worker (1 endpoint)

Base URL: `{{analyticsWorkerUrl}}`

---

## 06-A `GET /`

### Request
```
GET {{analyticsWorkerUrl}}/?role=admin&range=7d
```

### Test Cases

| # | Scenario | Query | Expected |
|---|---|---|---|
| 1 | Admin role — full metrics | `?role=admin&range=7d` | `200` + full infra |
| 2 | User role — masked data | `?role=user` | `200` + all-zero masked |
| 3 | No role | None | `200` + masked (default `user`) |
| 4 | Invalid range | `?role=admin&range=invalid` | `200` (defaults) or `422` |

### Response (200) — Admin
```json
{
  "infrastructure": {
    "r2_usage_gb": 1.5,
    "r2_allocated_gb": 10.0,
    "r2_object_count": 250,
    "r2_egress_gb": 0.3,
    "d1_queries_count": 15000,
    "d1_avg_latency_ms": 12,
    "page_views": 5000,
    "bandwidth_gb": 2.1,
    "cache_hit_ratio_pct": 85.5,
    "storage_efficiency_pct": 92.3,
    "device_mobile": 3200,
    "device_desktop": 1500,
    "device_tablet": 300,
    "top_zones": [{ "zone": "us-east", "requests": 3000 }]
  },
  "source_health": {
    "d1_api": "ready",
    "r2_api": "ready",
    "analytics_engine": "ready",
    "page_analytics": "ready"
  }
}
```

### Response (200) — User (masked)
```json
{
  "infrastructure": {
    "r2_usage_gb": 0,
    "r2_allocated_gb": 0,
    "r2_object_count": 0,
    "r2_egress_gb": 0,
    "d1_queries_count": 0,
    "d1_avg_latency_ms": 0,
    "page_views": 0,
    "bandwidth_gb": 0,
    "cache_hit_ratio_pct": 0,
    "storage_efficiency_pct": 0,
    "device_mobile": 0,
    "device_desktop": 0,
    "device_tablet": 0,
    "top_zones": []
  },
  "source_health": {
    "d1_api": "ready",
    "r2_api": "ready",
    "analytics_engine": "ready",
    "page_analytics": "ready"
  }
}
```

### Postman Test Script
```js
pm.test("Status 200", () => pm.response.to.have.status(200));
pm.test("Has infrastructure and source_health", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("infrastructure");
  pm.expect(json).to.have.property("source_health");
});
```

---

# Setup Scripts (Run First)

Before running the full test collection, execute these requests in order to create test data.

## Setup 1: Create Tenant

```http
POST {{d1WorkerUrl}}/tenants
x-admin-key: {{adminKey}}
Content-Type: application/json

{ "name": "Postman Test Tenant" }
```

**Tests:** Extract `tenantId` and `tenantKey` to collection variables.

## Setup 2: Create Story

```http
POST {{d1WorkerUrl}}/tenants/{{tenantId}}/stories
x-tenant-key: {{tenantKey}}
Content-Type: application/json

{
  "title": "Postman Test Story",
  "slug": "postman-test-story",
  "description": "Created by Postman test suite",
  "author": "Postman Tester",
  "category": "Test",
  "status": "draft"
}
```

**Tests:** Extract `storyId` to collection variable.

## Setup 3: Create Chapter

```http
POST {{d1WorkerUrl}}/tenants/{{tenantId}}/stories/{{storyId}}/chapters
x-tenant-key: {{tenantKey}}
Content-Type: application/json

{
  "chapter_number": 1,
  "title": "Test Chapter 1",
  "content": { "pages": [{"pageNumber": 1, "caption": "Test page"}] },
  "status": "draft"
}
```

**Tests:** Extract `chapterId` to collection variable.

## Setup 4: Upload Test Asset to R2

*(Manual — upload a small text file to the R2 bucket)*

## Setup 5: Obtain JWTs

*(Manual — use Supabase auth endpoints to create users and obtain JWTs for each role)*

---

# Postman Collection Structure Summary

```
Light Story API (Root)
├── 📁 Setup (Run first)
│   ├── POST Create Tenant
│   ├── POST Create Story
│   └── POST Create Chapter
├── 📁 01 D1 SaaS Worker
│   ├── GET /health
│   ├── 📁 Tenant Provisioning
│   │   ├── POST /tenants (4 cases)
│   │   └── GET /tenants (2 cases)
│   ├── 📁 Admin Recovery
│   │   ├── POST /admin/add-tenant (2 cases)
│   │   ├── GET /admin/failed-tenants (2 cases)
│   │   └── POST /admin/recover/:id (2 cases)
│   └── 📁 Tenant-scoped
│       ├── GET /tenants/:id (4 cases)
│       ├── GET /tenants/:id/stories (2 cases)
│       ├── POST /tenants/:id/stories (6 cases)
│       ├── GET /tenants/:id/stories/:sid (2 cases)
│       ├── PUT /tenants/:id/stories/:sid (3 cases)
│       ├── DELETE /tenants/:id/stories/:sid (3 cases)
│       ├── GET /tenants/:id/stories/:sid/chapters (2 cases)
│       ├── POST /tenants/:id/stories/:sid/chapters (5 cases)
│       └── GET /tenants/:id/analytics/dashboard (4 cases)
├── 📁 02 Next.js BFF Public
│   ├── GET /api/stories (8 cases)
│   ├── GET /api/chapters (3 cases)
│   ├── GET /api/auth/verify-recovery (1 case)
│   ├── POST /api/rpc/search-stories (4 cases)
│   ├── POST /api/rpc/increment-story-views (2 cases)
│   ├── POST /api/rpc/like-story (2 cases)
│   ├── POST /api/rpc/unlike-story (2 cases)
│   ├── GET /api/system-settings (2 cases)
│   ├── POST /api/system-settings (4 cases)
│   ├── GET /api/site-settings (3 cases)
│   ├── GET /api/site-metrics (3 cases)
│   ├── GET /api/role-distribution (1 case)
│   └── GET /api/taxonomy/categories (1 case)
├── 📁 03 Next.js BFF Internal Admin
│   ├── POST /api/internal/admin/comics (4 cases)
│   ├── POST /api/internal/admin/comics/:cid/chapters (4 cases)
│   ├── POST /api/internal/admin/upload-to-r2 (4 cases)
│   ├── GET /api/internal/admin/taxonomy (4 cases)
│   ├── POST /api/internal/admin/taxonomy (6 cases)
│   ├── GET /api/internal/admin/profiles (2 cases)
│   ├── POST /api/internal/admin/profiles (4 cases)
│   ├── POST /api/internal/admin/manage-user (8 cases)
│   ├── POST /api/internal/admin/manage-story (7 cases)
│   ├── POST /api/internal/admin/manage-chapter (4 cases)
│   ├── GET /api/internal/admin/audit (2 cases)
│   ├── POST /api/internal/admin/audit (3 cases)
│   └── GET /api/internal/admin/analytics/dashboard (5 cases)
├── 📁 04 R2 Proxy Worker
│   └── GET /:key (9 cases)
├── 📁 05 Supabase Edge Functions
│   ├── POST /increment-story-views (2 cases)
│   ├── POST /manage-story (6 cases)
│   ├── POST /manage-chapter (5 cases)
│   ├── POST /manage-user (6 cases)
│   ├── POST /payment_and_rewards (3 cases)
│   ├── POST /upload_to_r2 (2 cases)
│   └── POST /create_comic (2 cases)
└── 📁 06 Analytics Aggregator
    └── GET / (4 cases)

Total: ~202 test cases across 48 endpoints
```
