-- DJ Scratch: database hygiene follow-up (Supabase linter findings).
-- Run once in Supabase Dashboard -> SQL Editor. Every step is guarded:
-- failures become NOTICEs instead of aborting the script.
--
-- 1) Adds missing PRIMARY KEYs (live tables predate the definitions in code).
-- 2) Drops the now-redundant user_settings unique constraint (duplicate index).
-- 3) Indexes friends FK columns.
-- Left alone on purpose: "unused" indexes on tracks/referral_clicks (harmless,
-- workload-dependent — dropping them can hurt), and the listens duplicate
-- index (identify it first with the inspection query at the bottom).

-- ---------- 1) Missing primary keys ----------
DO $$
BEGIN
  -- user_settings(user_id): needs NOT NULL first; orphans stay as-is on failure.
  BEGIN
    ALTER TABLE public.user_settings ALTER COLUMN user_id SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'user_settings.user_id has NULLs, PK skipped: %', SQLERRM;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_settings'::regclass
      AND contype = 'p'
  ) THEN
    BEGIN
      ALTER TABLE public.user_settings ADD PRIMARY KEY (user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'user_settings PK skipped: %', SQLERRM;
    END;
  END IF;

  -- global_settings(key)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.global_settings'::regclass
      AND contype = 'p'
  ) THEN
    BEGIN
      ALTER TABLE public.global_settings ADD PRIMARY KEY (key);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'global_settings PK skipped: %', SQLERRM;
    END;
  END IF;

  -- suggestions(id), website_logs(id), bot_actions(id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.suggestions'::regclass
      AND contype = 'p'
  ) THEN
    BEGIN
      ALTER TABLE public.suggestions ADD PRIMARY KEY (id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'suggestions PK skipped: %', SQLERRM;
    END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.website_logs'::regclass
      AND contype = 'p'
  ) THEN
    BEGIN
      ALTER TABLE public.website_logs ADD PRIMARY KEY (id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'website_logs PK skipped: %', SQLERRM;
    END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.bot_actions'::regclass
      AND contype = 'p'
  ) THEN
    BEGIN
      ALTER TABLE public.bot_actions ADD PRIMARY KEY (id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'bot_actions PK skipped: %', SQLERRM;
    END;
  END IF;

  -- command_usage(command_name)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.command_usage'::regclass
      AND contype = 'p'
  ) THEN
    BEGIN
      ALTER TABLE public.command_usage ADD PRIMARY KEY (command_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'command_usage PK skipped: %', SQLERRM;
    END;
  END IF;
END
$$;

-- ---------- 2) Drop the redundant unique constraint (duplicate index) ----------
-- user_settings already has PRIMARY KEY(user_id) after step 1, which enforces
-- the same uniqueness as the standalone unique index(es). Keep the pkey,
-- drop the copies (names vary by era: *_user_id_key and *_user_id_unique).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_settings'::regclass
      AND contype = 'p'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_key') THEN
      ALTER TABLE public.user_settings DROP CONSTRAINT user_settings_user_id_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_unique') THEN
      ALTER TABLE public.user_settings DROP CONSTRAINT user_settings_user_id_unique;
    ELSIF EXISTS (
      SELECT 1 FROM pg_class WHERE relname = 'user_settings_user_id_unique'
    ) THEN
      DROP INDEX public.user_settings_user_id_unique;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'unique-index drop skipped: %', SQLERRM;
END
$$;

-- ---------- 3) Index friends FK columns ----------
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends (user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends (friend_id);

-- ---------- 5) Drop exact-duplicate unique constraints/indexes (verified 2026-09-29) ----------
-- Each pair enforces/indexes identical columns; the pkey wins. Some dupes are
-- constraint-backed (must DROP CONSTRAINT) and some are plain indexes
-- (DROP INDEX) — the helper tries in that order. Brief locks each;
-- statement timeout so a busy table errors out instead of hanging.
SET statement_timeout = '30s';

DO $$
BEGIN
  -- command_usage: pkey covers (command_name); the unique constraint is the copy.
  BEGIN
    ALTER TABLE public.command_usage DROP CONSTRAINT command_usage_command_name_unique;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'command_usage dupe: %', SQLERRM;
  END;
  -- global_settings: pkey covers (key); the unique constraint is the copy.
  BEGIN
    ALTER TABLE public.global_settings DROP CONSTRAINT global_settings_key_unique;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'global_settings dupe: %', SQLERRM;
  END;
END
$$;

-- listens: idx_listens_track and idx_listens_track_id are byte-identical
-- (track_id). Keep idx_listens_track. (idx_listens_user_id vs the composite
-- idx_listens_user_played intentionally left: prefix overlap, not a dupe.)
DROP INDEX IF EXISTS public.idx_listens_track_id;

-- user_settings: handled in step 2 (constraint-backed, not a plain index).

RESET statement_timeout;
