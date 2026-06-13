-- Migration 022: Add negative-stock guard to update_production
--
-- When a production's batch count is INCREASED, update_production deducts the
-- additional raw-material / sub-recipe stock. Previously this had no guard and
-- could silently push stock below zero. This adds a pre-check (parallel to the
-- guards already in produce_recipe) that raises if the extra deduction would go
-- negative. Restore-direction changes (decreasing batches) are never guarded.
--
-- Uses the production_items snapshot when present, else falls back to the live
-- recipe definition (same precedence as migration 021).

CREATE OR REPLACE FUNCTION public.update_production(
  p_user_id       uuid,
  p_production_id uuid,
  p_batches       numeric,
  p_total_cost    numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe_id     uuid;
  v_old_batches   numeric;
  v_old_cost      numeric;
  v_current_stock numeric;
  v_current_avg   numeric;
  v_new_stock     numeric;
  v_new_avg       numeric;
  v_is_ingredient boolean;
  v_has_snapshot  boolean;
  v_diff          numeric;  -- old_batches - new_batches (>0 = restore, <0 = deduct)
  v_extra         numeric;  -- additional batches consumed when increasing
  v_ri            record;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT recipe_id, batches, total_cost
    INTO v_recipe_id, v_old_batches, v_old_cost
    FROM public.productions
   WHERE id = p_production_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production not found';
  END IF;

  SELECT stock, avg_price, is_ingredient
    INTO v_current_stock, v_current_avg, v_is_ingredient
    FROM public.recipes
   WHERE id = v_recipe_id AND user_id = p_user_id;

  v_diff  := v_old_batches - p_batches;
  v_extra := p_batches - v_old_batches;  -- >0 only when increasing batches

  SELECT EXISTS (
    SELECT 1 FROM public.production_items WHERE production_id = p_production_id
  ) INTO v_has_snapshot;

  -- ── Guard: only when increasing batches (extra deduction) ──────────────────
  IF v_extra > 0 THEN
    IF v_has_snapshot THEN
      FOR v_ri IN
        SELECT pi.item_id, pi.sub_recipe_id, pi.quantity_used
          FROM public.production_items pi
         WHERE pi.production_id = p_production_id AND pi.user_id = p_user_id
      LOOP
        IF v_ri.item_id IS NOT NULL THEN
          IF (SELECT stock FROM public.items WHERE id = v_ri.item_id AND user_id = p_user_id)
             < (v_ri.quantity_used * v_extra) THEN
            RAISE EXCEPTION 'Stok bahan "%" tidak cukup untuk tambah batch: dibutuhkan %',
              (SELECT name FROM public.items WHERE id = v_ri.item_id),
              v_ri.quantity_used * v_extra;
          END IF;
        ELSIF v_ri.sub_recipe_id IS NOT NULL THEN
          IF (SELECT stock FROM public.recipes WHERE id = v_ri.sub_recipe_id AND user_id = p_user_id)
             < (v_ri.quantity_used * v_extra) THEN
            RAISE EXCEPTION 'Stok bahan setengah jadi "%" tidak cukup untuk tambah batch: dibutuhkan %',
              (SELECT name FROM public.recipes WHERE id = v_ri.sub_recipe_id),
              v_ri.quantity_used * v_extra;
          END IF;
        END IF;
      END LOOP;
    ELSE
      -- legacy fallback: guard against the live recipe
      FOR v_ri IN
        SELECT ri.item_id, ri.quantity_used, i.stock AS avail, i.name AS nm
          FROM public.recipe_items ri
          JOIN public.items i ON i.id = ri.item_id AND i.user_id = p_user_id
         WHERE ri.recipe_id = v_recipe_id AND ri.item_id IS NOT NULL
      LOOP
        IF v_ri.avail < (v_ri.quantity_used * v_extra) THEN
          RAISE EXCEPTION 'Stok bahan "%" tidak cukup untuk tambah batch: dibutuhkan %',
            v_ri.nm, v_ri.quantity_used * v_extra;
        END IF;
      END LOOP;

      IF NOT v_is_ingredient THEN
        FOR v_ri IN
          SELECT ri.sub_recipe_id, ri.quantity_used, r.stock AS avail, r.name AS nm
            FROM public.recipe_items ri
            JOIN public.recipes r ON r.id = ri.sub_recipe_id AND r.user_id = p_user_id
           WHERE ri.recipe_id = v_recipe_id AND ri.sub_recipe_id IS NOT NULL
        LOOP
          IF v_ri.avail < (v_ri.quantity_used * v_extra) THEN
            RAISE EXCEPTION 'Stok bahan setengah jadi "%" tidak cukup untuk tambah batch: dibutuhkan %',
              v_ri.nm, v_ri.quantity_used * v_extra;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- ── Apply produced-recipe stock + avg recalc ───────────────────────────────
  v_new_stock := v_current_stock - v_old_batches + p_batches;
  IF v_new_stock > 0 THEN
    v_new_avg := GREATEST(0, (v_current_stock * v_current_avg - v_old_cost + p_total_cost) / v_new_stock);
  ELSE
    v_new_avg := 0;
  END IF;

  UPDATE public.recipes
     SET stock = v_new_stock, avg_price = v_new_avg
   WHERE id = v_recipe_id AND user_id = p_user_id;

  -- ── Adjust component stocks by batch delta ─────────────────────────────────
  IF v_has_snapshot THEN
    FOR v_ri IN
      SELECT item_id, sub_recipe_id, quantity_used
        FROM public.production_items
       WHERE production_id = p_production_id AND user_id = p_user_id
    LOOP
      IF v_ri.item_id IS NOT NULL THEN
        UPDATE public.items
           SET stock = stock + (v_ri.quantity_used * v_diff)
         WHERE id = v_ri.item_id AND user_id = p_user_id;
      ELSIF v_ri.sub_recipe_id IS NOT NULL THEN
        UPDATE public.recipes
           SET stock = stock + (v_ri.quantity_used * v_diff)
         WHERE id = v_ri.sub_recipe_id AND user_id = p_user_id;
      END IF;
    END LOOP;
  ELSE
    FOR v_ri IN
      SELECT ri.item_id, ri.quantity_used
        FROM public.recipe_items ri
       WHERE ri.recipe_id = v_recipe_id AND ri.item_id IS NOT NULL
    LOOP
      UPDATE public.items
         SET stock = stock + (v_ri.quantity_used * v_diff)
       WHERE id = v_ri.item_id AND user_id = p_user_id;
    END LOOP;

    IF NOT v_is_ingredient THEN
      FOR v_ri IN
        SELECT ri.sub_recipe_id, ri.quantity_used
          FROM public.recipe_items ri
         WHERE ri.recipe_id = v_recipe_id AND ri.sub_recipe_id IS NOT NULL
      LOOP
        UPDATE public.recipes
           SET stock = stock + (v_ri.quantity_used * v_diff)
         WHERE id = v_ri.sub_recipe_id AND user_id = p_user_id;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.productions
     SET batches = p_batches, total_cost = p_total_cost
   WHERE id = p_production_id AND user_id = p_user_id;
END;
$$;
