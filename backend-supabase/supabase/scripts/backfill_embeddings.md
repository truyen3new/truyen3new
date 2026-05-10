# Backfill embeddings for `stories.search_vector`

This document describes a safe, batched backfill process to populate `stories.search_vector` for pgvector semantic search.

## Export story ids and text to embed

```sql
COPY (
  SELECT id, concat_ws('\n', title, coalesce(summary, '')) as text
  FROM public.stories
  WHERE search_vector IS NULL
) TO '/tmp/stories_to_embed.csv' WITH CSV HEADER;
```

## Generate embeddings (example using OpenAI / local worker)

- Use a small worker script to read CSV in batches (e.g., 100 rows) and call your embedding provider.
- Ensure you respect rate limits and parallelism (recommend 4 parallel requests max).

## Apply embeddings in batches

Example Node script idea (pseudocode):

- Read batch
- Build POST body with embeddings
- Call Supabase REST or `supabase-js` with service role to `UPDATE public.stories SET search_vector = $1 WHERE id = $2` in a transaction per batch

## Reindex ivfflat (if used) after a large backfill

```sql
REINDEX INDEX idx_stories_search_vector;
```

## Notes

- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.
- Test with a small sample first and validate similarity results before full run.
