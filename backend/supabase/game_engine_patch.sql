-- ================================================================
-- game_engine_patch.sql
-- Run THIS FIRST in Supabase SQL Editor, BEFORE game_engine_final.sql
--
-- Fixes: "null value in column round_id violates not-null constraint"
-- Cause: Your existing game_rounds table has round_id NOT NULL.
--        Our INSERT doesn't supply it (it's a legacy column).
-- ================================================================

-- Step 1: Make round_id nullable (it's a legacy column we don't use)
ALTER TABLE public.game_rounds
  ALTER COLUMN round_id DROP NOT NULL;

-- Step 2: Give it a default of NULL so old code still works
ALTER TABLE public.game_rounds
  ALTER COLUMN round_id SET DEFAULT NULL;

-- Step 3: Verify the fix — this should return 0 rows (no NOT NULL on round_id)
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'game_rounds'
  AND column_name  = 'round_id';

-- Step 4: Now seed the rounds immediately
SELECT public.fn_tick_game_rounds();

-- Step 5: Confirm 4 active rounds exist (one per mode)
SELECT game_type, mode, period, status, ends_at
FROM public.game_rounds
WHERE status = 'active'
ORDER BY mode;
