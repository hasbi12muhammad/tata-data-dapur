-- Migration 023: produce_sub_recipe deducts nested sub-recipes too
--
-- Problem: produce_sub_recipe only deducted raw materials (item_id), ignoring
-- sub_recipe_id components. A multi-level half-finished good (sub-recipe B made
-- from sub-recipe C) would NOT consume C's stock when B was produced, leaving
-- C's stock inflated. produce_recipe (finished goods) already handled this.
--
-- Fix: mirror produce_recipe — add a stock guard for nested sub-recipes, deduct
-- their stock, and snapshot them into production_items so delete/update restore
-- correctly (the snapshot path in 021/022 already handles sub_recipe rows).

CREATE OR REPLACE FUNCTION public.produce_sub_recipe(
  p_user_id    uuid,
  p_recipe_id  uuid,
  p_batches    numeric,
  p_total_cost numeric,
  p_created_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock numeric;
  v_current_avg   numeric;
  v_new_stock     numeric;
  v_new_avg       numeric;
  v_production_id uuid;
  v_ri            record;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT stock, avg_price
    INTO v_current_stock, v_current_avg
    FROM public.recipes
   WHERE id = p_recipe_id AND user_id = p_user_id AND is_ingredient = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-recipe not found or not marked as ingredient';
  END IF;

  -- Guard: cek stok bahan baku sebelum deduct
  FOR v_ri IN
    SELECT ri.quantity_used, i.stock AS avail, i.name AS item_name
      FROM public.recipe_items ri
      JOIN public.items i ON i.id = ri.item_id AND i.user_id = p_user_id
     WHERE ri.recipe_id = p_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    IF v_ri.avail < (v_ri.quantity_used * p_batches) THEN
      RAISE EXCEPTION 'Stok bahan "%" tidak cukup: tersedia %, dibutuhkan %',
        v_ri.item_name, v_ri.avail, v_ri.quantity_used * p_batches;
    END IF;
  END LOOP;

  -- Guard: cek stok sub-resep bersarang sebelum deduct
  FOR v_ri IN
    SELECT ri.quantity_used, r.stock AS avail, r.name AS recipe_name
      FROM public.recipe_items ri
      JOIN public.recipes r ON r.id = ri.sub_recipe_id AND r.user_id = p_user_id
     WHERE ri.recipe_id = p_recipe_id AND ri.sub_recipe_id IS NOT NULL
  LOOP
    IF v_ri.avail < (v_ri.quantity_used * p_batches) THEN
      RAISE EXCEPTION 'Stok bahan setengah jadi "%" tidak cukup: tersedia %, dibutuhkan %',
        v_ri.recipe_name, v_ri.avail, v_ri.quantity_used * p_batches;
    END IF;
  END LOOP;

  v_new_stock := v_current_stock + p_batches;
  IF v_new_stock > 0 THEN
    v_new_avg := (v_current_stock * v_current_avg + p_total_cost) / v_new_stock;
  ELSE
    v_new_avg := CASE WHEN p_batches > 0 THEN p_total_cost / p_batches ELSE 0 END;
  END IF;

  UPDATE public.recipes
     SET stock = v_new_stock, avg_price = v_new_avg
   WHERE id = p_recipe_id AND user_id = p_user_id;

  -- Deduct raw materials
  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = p_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock - (v_ri.quantity_used * p_batches)
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

  -- Deduct nested sub-recipes
  FOR v_ri IN
    SELECT ri.sub_recipe_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = p_recipe_id AND ri.sub_recipe_id IS NOT NULL
  LOOP
    UPDATE public.recipes
       SET stock = stock - (v_ri.quantity_used * p_batches)
     WHERE id = v_ri.sub_recipe_id AND user_id = p_user_id;
  END LOOP;

  INSERT INTO public.productions (user_id, recipe_id, batches, total_cost, created_at)
  VALUES (p_user_id, p_recipe_id, p_batches, p_total_cost, COALESCE(p_created_at, now()))
  RETURNING id INTO v_production_id;

  -- Snapshot consumed BOM (raw materials + nested sub-recipes)
  INSERT INTO public.production_items (production_id, user_id, item_id, sub_recipe_id, quantity_used)
  SELECT v_production_id, p_user_id, ri.item_id, ri.sub_recipe_id, ri.quantity_used
    FROM public.recipe_items ri
   WHERE ri.recipe_id = p_recipe_id
     AND (ri.item_id IS NOT NULL OR ri.sub_recipe_id IS NOT NULL);
END;
$$;
