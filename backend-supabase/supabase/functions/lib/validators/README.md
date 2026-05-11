# Zod Validation Integration Guide

## Overview

This directory contains Zod validators for type-safe request validation across Edge Functions, API routes, and RPC calls.

## Available Validators

- **search.validator.ts** - pgvector semantic search (embedding: 1536 dims, matchCount: 1-100)
- **stories.validator.ts** - Story and Chapter creation/updates (title, content, UUIDs, enums)

## Quick Start

```typescript
import { SearchSchema } from '../lib/validators/search.validator';

const parsed = SearchSchema.safeParse(body);
if (!parsed.success) {
  return jsonResponse({ error: 'Invalid input', details: parsed.error.errors }, 400);
}

const { embedding, matchCount } = parsed.data;
// Now safe to use: embedding is exactly 1536 floats, matchCount is 1-100
```

## Using Validators in API Routes

**Example: Semantic Search Endpoint** (`/api/rpc/search-stories`)

```typescript
import { SearchSchema } from '@/backend-supabase/supabase/functions/lib/validators/search.validator';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = SearchSchema.safeParse(body);
  
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid search input', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const { embedding, matchCount } = parsed.data;
  // Call RPC with validated inputs
  const { data } = await supabase.rpc('search_stories', {
    query_embedding: embedding,
    match_count: matchCount,
  });
  
  return NextResponse.json({ results: data, count: data.length });
}
```

## Using Validators in Edge Functions

**Example: Replace manual validation**

Before (manual):
```typescript
if (typeof title !== "string" || !title.trim()) {
  return jsonResponse({ error: "title is required" }, 400);
}
```

After (Zod):
```typescript
import { z } from "npm:zod@3.22.4";
import { StorySchema } from "../lib/validators/stories.validator.ts";

const parsed = StorySchema.safeParse(payload);
if (!parsed.success) {
  return jsonResponse({ error: "Invalid input", details: parsed.error.errors }, 400);
}

const { title, author_id } = parsed.data;
// Now title and author_id are guaranteed to be valid strings
```

## Built-in Validators

### SearchSchema
- `embedding`: number[] (exactly 1536 elements)
- `matchCount`: number (1-100, default 10)

### StorySchema
- `title`: string (1-500 chars)
- `summary`: string (max 2000 chars, optional)
- `author_id`: UUID string (required)
- `status`: 'draft' | 'published' | 'archived' (default 'draft')

### ChapterSchema
- `story_id`: UUID string
- `chapter_number`: positive integer
- `title`: string (1-500 chars)
- `content`: non-empty string
- `vip_content`: boolean (optional, default false)

## Adding New Validators

1. Create file: `backend-supabase/supabase/functions/lib/validators/your-feature.validator.ts`
2. Define schemas with Zod
3. Export types: `export type YourInput = z.infer<typeof YourSchema>`
4. Import in functions: `import { YourSchema } from '../lib/validators/your-feature.validator'`
5. Use `safeParse()` to validate

## Testing

Run validation tests:
```bash
npm run test -- search-stories.test.ts
```

Manual test with curl:
```bash
curl -X POST http://localhost:3000/api/rpc/search-stories \
  -H "Content-Type: application/json" \
  -d '{"embedding": [0.5]*1536, "matchCount": 10}'
```

## Best Practices

✅ Always validate at API/Edge Function entry points
✅ Use `safeParse()` to avoid throwing errors
✅ Return detailed error messages with Zod error array
✅ Leverage `z.infer<typeof Schema>` for TypeScript types
✅ Fail fast before database operations

## References

- Zod docs: https://zod.dev
- API endpoint: `/api/rpc/search-stories` (semantic search)
- Test file: `search-stories.test.ts` (validation examples)

