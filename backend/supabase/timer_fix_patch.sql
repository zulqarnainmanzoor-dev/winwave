-- ================================================================
-- timer_fix_patch.sql
-- Run this in Supabase SQL Editor to fix skipped rounds immediately
-- ================================================================

-- 1. Delete all active/completed rounds so we start fresh with correct formula
DELETE FROM public.game_rounds WHERE game_type = 'wingo';

-- 2. Replace fn_tick_game_rounds with the fixed version (no +1, correct ends_at)
CREATE OR REPLACE FUNCTION public.fn_tick_game_rounds()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mode      TEXT;
  v_interval  INT;
  v_prefix    TEXT;
  v_now       TIMESTAMPTZ := NOW() AT TIME ZONE 'UTC';
  v_date_str  TEXT        := TO_CHAR(v_now, 'YYYYMMDD');
  v_secs      INT;
  v_round_num INT;
  v_period    TEXT;
  v_ends_at   TIMESTAMPTZ;
  v_round     RECORD;
  v_num       INT;
  v_size      TEXT;
  v_color     TEXT;
  v_forced    TEXT;
  v_hash      BIGINT;
  v_t         BIGINT;
  v_rand      FLOAT8;
  v_i         INT;
  v_char      INT;
BEGIN
  v_secs := EXTRACT(HOUR   FROM v_now)::INT * 3600
          + EXTRACT(MINUTE FROM v_now)::INT * 60
          + EXTRACT(SECOND FROM v_now)::INT;

  FOREACH v_mode IN ARRAY ARRAY['30s','1m','3m','5m'] LOOP
    v_interval := CASE v_mode
      WHEN '30s' THEN 30  WHEN '1m' THEN 60
      WHEN '3m'  THEN 180 ELSE 300
    END;
    v_prefix := CASE v_mode
      WHEN '30s' THEN '1000' WHEN '1m' THEN '2000'
      WHEN '3m'  THEN '3000' ELSE '4000'
    END;

    -- a) Resolve expired active rounds
    FOR v_round IN
      SELECT * FROM public.game_rounds
      WHERE game_type = 'wingo' AND mode = v_mode
        AND status = 'active' AND ends_at <= NOW()
    LOOP
      v_forced := v_round.target_result;

      v_hash := 0;
      FOR v_i IN 1..LENGTH(v_round.period) LOOP
        v_char := ASCII(SUBSTRING(v_round.period, v_i, 1));
        v_hash := ((31 * v_hash + v_char) & x'FFFFFFFF'::BIGINT);
        IF v_hash > 2147483647 THEN v_hash := v_hash - 4294967296; END IF;
      END LOOP;
      v_t := (v_hash + 1834730485) & x'FFFFFFFF'::BIGINT;
      v_t := ((v_t # (v_t >> 15)) * ((v_t | 1) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
      v_t := (v_t # (v_t + ((v_t # (v_t >> 7)) * ((v_t | 61) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT)) & x'FFFFFFFF'::BIGINT;
      v_t    := (v_t # (v_t >> 14)) & x'FFFFFFFF'::BIGINT;
      v_rand := v_t::FLOAT8 / 4294967296.0;
      v_num  := FLOOR(v_rand * 10)::INT;
      v_size := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
      v_color := CASE WHEN v_num IN (0,5) THEN 'violet'
                      WHEN v_num % 2 = 0  THEN 'red' ELSE 'green' END;

      IF v_forced = 'BIG' AND v_size <> 'Big' THEN
        v_num := 5 + (v_num % 5); v_size := 'Big';
        v_color := CASE WHEN v_num=5 THEN 'violet' WHEN v_num%2=0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced = 'SMALL' AND v_size <> 'Small' THEN
        v_num := v_num % 5; v_size := 'Small';
        v_color := CASE WHEN v_num=0 THEN 'violet' WHEN v_num%2=0 THEN 'red' ELSE 'green' END;
      ELSIF v_forced LIKE 'NUM:%' THEN
        v_num := SUBSTRING(v_forced FROM 5)::INT;
        v_size := CASE WHEN v_num >= 5 THEN 'Big' ELSE 'Small' END;
        v_color := CASE WHEN v_num IN (0,5) THEN 'violet' WHEN v_num%2=0 THEN 'red' ELSE 'green' END;
      END IF;

      UPDATE public.game_rounds
      SET status='completed', result_number=v_num, result_size=v_size, result_color=v_color
      WHERE id = v_round.id;
    END LOOP;

    -- b) Create next active round — floor only, NO +1
    --    ends_at = UTC day start + (round_num + 1) * interval
    IF NOT EXISTS (
      SELECT 1 FROM public.game_rounds
      WHERE game_type='wingo' AND mode=v_mode AND status='active'
    ) THEN
      v_round_num := v_secs / v_interval;  -- integer division, no +1
      v_period    := v_date_str || v_prefix || LPAD(v_round_num::TEXT, 5, '0');
      v_ends_at   := DATE_TRUNC('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                   + (((v_round_num + 1) * v_interval) || ' seconds')::INTERVAL;

      INSERT INTO public.game_rounds (game_type, mode, period, started_at, ends_at, status)
      VALUES ('wingo', v_mode, v_period, NOW(), v_ends_at, 'active')
      ON CONFLICT (period) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;

-- 3. Reschedule pg_cron jobs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname) FROM cron.job
    WHERE jobname IN ('wingo-tick-a','wingo-tick-b');

    PERFORM cron.schedule('wingo-tick-a', '* * * * *',
      'SELECT public.fn_tick_game_rounds();');
    PERFORM cron.schedule('wingo-tick-b', '* * * * *',
      'SELECT pg_sleep(30); SELECT public.fn_tick_game_rounds();');
  END IF;
END $$;

-- 4. Seed fresh rounds immediately
SELECT public.fn_tick_game_rounds();

-- 5. Verify — should show 4 consecutive round numbers, each mode independent
SELECT mode, period, status,
       TO_CHAR(ends_at AT TIME ZONE 'UTC', 'HH24:MI:SS') AS ends_utc
FROM public.game_rounds
WHERE status = 'active'
ORDER BY mode;
