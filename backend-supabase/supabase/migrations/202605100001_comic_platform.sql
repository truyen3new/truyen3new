-- Migration: Comic Platform core tables, RLS, and pgvector search
-- Date: 2026-05-10

-- 1) pgvector extension (for semantic search)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text,
  cover_url text,
  status text NOT NULL DEFAULT 'draft', -- 'draft' | 'published' | 'archived'
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  search_vector vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Chapters table
CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  chapter_number integer NOT NULL,
  title text NOT NULL,
  content text,
  vip_content boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, chapter_number)
);

-- 4) RLS: enable on both tables
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- 5) RLS policies
-- published stories readable
CREATE POLICY IF NOT EXISTS read_published_stories
  ON public.stories FOR SELECT
  USING (status = 'published');

-- free chapters: readable when not VIP and story is published
CREATE POLICY IF NOT EXISTS read_free_chapters
  ON public.chapters FOR SELECT
  USING (
    vip_content = FALSE
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = public.chapters.story_id AND s.status = 'published'
    )
  );

-- vip chapters: only readable to premium or admin profiles
CREATE POLICY IF NOT EXISTS read_vip_chapters_premium_admin
  ON public.chapters FOR SELECT
  USING (
    vip_content = TRUE
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('premium', 'admin', 'superadmin')
    )
  );

-- 6) pgvector index (recommended for similarity search)
-- Use ivfflat index; tune 'lists' based on dataset size and performance testing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_stories_search_vector' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_stories_search_vector ON public.stories USING ivfflat (search_vector vector_cosine_ops) WITH (lists = 100)';
  END IF;
END$$;

-- 7) Semantic search RPC using pgvector
CREATE OR REPLACE FUNCTION public.search_stories(
  query_embedding vector(1536),
  match_count integer DEFAULT 10
) RETURNS TABLE (
  id uuid,
  title text,
  summary text,
  cover_url text,
  similarity float
) LANGUAGE sql STABLE AS $$
  SELECT
    s.id,
    s.title,
    s.summary,
    s.cover_url,
    1 - (s.search_vector <=> query_embedding) AS similarity
  FROM public.stories s
  WHERE s.search_vector IS NOT NULL
  ORDER BY s.search_vector <=> query_embedding
  LIMIT match_count;
$$;

-- 8) Notes / operational guidance (do not run as SQL)
-- Backfill: Populate `stories.search_vector` asynchronously using an embedding generator
-- Example: UPDATE public.stories SET search_vector = '<embedding>' WHERE id = ...;
-- Rebuild ivfflat index after significant inserts: REINDEX INDEX idx_stories_search_vector;
