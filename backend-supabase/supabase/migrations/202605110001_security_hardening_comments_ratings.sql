-- Migration: Security hardening for comments and ratings (RLS + sanitization)
-- Date: 2026-05-11

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ratings ENABLE ROW LEVEL SECURITY;

-- Helper: check role and premium
CREATE OR REPLACE FUNCTION public.user_has_role(uid uuid, role_name text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role = role_name);
$$;

CREATE OR REPLACE FUNCTION public.user_has_premium(uid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role IN ('premium', 'admin', 'superadmin'));
$$;

-- Comments RLS: only allow SELECT on published content and allow INSERT by authenticated users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='comments' AND policyname='comments_select_published') THEN
    CREATE POLICY comments_select_published ON public.comments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = public.comments.story_id AND s.status = 'published'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='comments' AND policyname='comments_insert_auth') THEN
    CREATE POLICY comments_insert_auth ON public.comments FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='comments' AND policyname='comments_update_owner_or_admin') THEN
    CREATE POLICY comments_update_owner_or_admin ON public.comments FOR UPDATE
    USING (author_id = auth.uid() OR public.user_has_role(auth.uid(), 'admin') OR public.user_has_role(auth.uid(), 'superadmin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='comments' AND policyname='comments_delete_owner_or_admin') THEN
    CREATE POLICY comments_delete_owner_or_admin ON public.comments FOR DELETE
    USING (author_id = auth.uid() OR public.user_has_role(auth.uid(), 'admin') OR public.user_has_role(auth.uid(), 'superadmin'));
  END IF;
END $$;

-- Ratings RLS: allow read on published stories; inserts require auth; updates/deletes owner or admin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ratings' AND policyname='ratings_select_published') THEN
    CREATE POLICY ratings_select_published ON public.ratings FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = public.ratings.story_id AND s.status = 'published'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ratings' AND policyname='ratings_insert_auth') THEN
    CREATE POLICY ratings_insert_auth ON public.ratings FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ratings' AND policyname='ratings_update_owner_or_admin') THEN
    CREATE POLICY ratings_update_owner_or_admin ON public.ratings FOR UPDATE
    USING (user_id = auth.uid() OR public.user_has_role(auth.uid(), 'admin') OR public.user_has_role(auth.uid(), 'superadmin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ratings' AND policyname='ratings_delete_owner_or_admin') THEN
    CREATE POLICY ratings_delete_owner_or_admin ON public.ratings FOR DELETE
    USING (user_id = auth.uid() OR public.user_has_role(auth.uid(), 'admin') OR public.user_has_role(auth.uid(), 'superadmin'));
  END IF;
END $$;

-- IDOR protection: explicit function to validate chapter access by id
CREATE OR REPLACE FUNCTION public.can_read_chapter(_chapter_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN (SELECT vip_content FROM public.chapters WHERE id = _chapter_id) = false THEN
      EXISTS (SELECT 1 FROM public.chapters c JOIN public.stories s ON s.id = c.story_id WHERE c.id = _chapter_id AND s.status = 'published')
    ELSE public.user_has_premium(_uid)
  END;
$$;

-- Note: After applying migration, update API Layer to call can_read_chapter() when fetching chapter by id to ensure explicit check.
