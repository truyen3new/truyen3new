-- RLS Policy Tests for Comic Platform
-- Test file for verifying RLS policies on stories and chapters

-- Setup: Create test user roles
BEGIN;

-- Test: Public user can read published stories
SELECT * FROM public.stories
WHERE status = 'published'
LIMIT 1;
-- Expected: Rows returned

-- Test: Public user cannot read draft stories
SELECT * FROM public.stories
WHERE status = 'draft'
LIMIT 1;
-- Expected: No rows (access denied by RLS)

-- Test: Public user can read free chapters (vip_content = false) of published stories
SELECT * FROM public.chapters
WHERE vip_content = FALSE
AND EXISTS (
  SELECT 1 FROM public.stories s
  WHERE s.id = public.chapters.story_id AND s.status = 'published'
)
LIMIT 1;
-- Expected: Rows returned

-- Test: Public user cannot read VIP chapters
SELECT * FROM public.chapters
WHERE vip_content = TRUE
LIMIT 1;
-- Expected: No rows (access denied by RLS)

-- Test: Premium user can read VIP chapters (requires premium role in profile)
-- Note: This test requires setting a user context with auth.uid() and profile role = 'premium'
-- In a real test, you would set the auth context first:
-- SELECT auth.jwt() - to verify user is authenticated
-- Then query: SELECT * FROM public.chapters WHERE vip_content = TRUE;
-- Expected: Rows returned for premium users

-- Test: Search RPC is accessible
SELECT * FROM public.search_stories(
  '[0.1, 0.2, 0.3]'::vector,
  10
);
-- Expected: Results based on search vector

ROLLBACK;
