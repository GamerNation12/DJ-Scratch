-- DJ Scratch: enable Row Level Security on every public table that lacks it.
-- Safe for this project: the bot and website connect with the privileged
-- DATABASE_URL user (superuser/service_role bypass RLS), so nothing breaks.
-- anon/authenticated roles keep zero access unless a policy grants it.
--
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- Explicit full-access policies for the privileged roles (belt and braces;
-- service_role/postgres bypass RLS by default, this documents intent).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "service full access" ON public.%I FOR ALL TO service_role, postgres USING (true) WITH CHECK (true)',
        t);
    EXCEPTION WHEN duplicate_object THEN
      -- policy already there, ignore
      NULL;
    END;
  END LOOP;
END
$$;
