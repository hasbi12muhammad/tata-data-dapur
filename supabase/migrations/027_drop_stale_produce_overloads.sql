-- Migration 027: Drop stale 5-arg overloads of produce_recipe / produce_sub_recipe
--
-- Migrations 024 and 025 added p_force via CREATE OR REPLACE FUNCTION. Because the
-- parameter list changed, Postgres created a SECOND function instead of replacing the
-- old one. Both overloads then matched a 5-arg call (p_force has a default), so the
-- RPC failed with:
--
--   Could not choose the best candidate function between:
--     public.produce_recipe(p_user_id => uuid, p_recipe_id => uuid, p_batches => numeric,
--                           p_total_cost => numeric, p_created_at => timestamptz),
--     public.produce_recipe(p_user_id => uuid, p_recipe_id => uuid, p_batches => numeric,
--                           p_total_cost => numeric, p_created_at => timestamptz,
--                           p_force => boolean)
--
-- Dropping the pre-p_force overloads leaves one candidate. Existing 5-arg call sites
-- (produksi page, usePurchases) keep working: p_force defaults to false.

DROP FUNCTION IF EXISTS public.produce_recipe(
  uuid, uuid, numeric, numeric, timestamptz
);

DROP FUNCTION IF EXISTS public.produce_sub_recipe(
  uuid, uuid, numeric, numeric, timestamptz
);

-- Sanity check: exactly one of each must remain, and it must accept p_force.
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ')
    INTO v_bad
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('produce_recipe', 'produce_sub_recipe')
     AND NOT ('p_force' = ANY (p.proargnames));

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Stale produce overload still present: %', v_bad;
  END IF;
END;
$$;
