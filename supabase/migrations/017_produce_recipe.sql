-- Migration 017: Finished Goods Inventory (Stok Produk Jadi)
--
-- Adds produce_recipe RPC for non-ingredient recipes.
-- Unlike produce_sub_recipe (which requires is_ingredient=true and only deducts items),
-- produce_recipe works for finished goods and deducts BOTH items and sub-recipe stocks.
--
-- Sale flow change (handled in frontend/useSales.ts):
--   Before: sale deducts sub_recipe_deductions directly at sale time
--   After:  production deducts ingredients → sale deducts recipes.stock
--
-- RPCs added: produce_recipe, restore_recipe_stock
-- RPCs reused for sale deduction: deduct_sub_recipe_stock (already works for any recipe)

-- ─── 1. produce_recipe ────────────────────────────────────────────────────────
-- Produces finished goods: deducts items + sub-recipe stocks, adds to recipes.stock,
-- tracks weighted avg_price (HPP per unit), records in productions table.

CREATE OR REPLACE FUNCTION public.produce_recipe(
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
  v_ri            record;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT stock, avg_price
    INTO v_current_stock, v_current_avg
    FROM public.recipes
   WHERE id = p_recipe_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe not found';
  END IF;

  v_new_stock := v_current_stock + p_batches;

  IF v_new_stock > 0 THEN
    v_new_avg := (v_current_stock * v_current_avg + p_total_cost) / v_new_stock;
  ELSE
    v_new_avg := CASE WHEN p_batches > 0 THEN p_total_cost / p_batches ELSE 0 END;
  END IF;

  UPDATE public.recipes
     SET stock     = v_new_stock,
         avg_price = v_new_avg
   WHERE id = p_recipe_id AND user_id = p_user_id;

  -- Deduct raw material (item) stocks
  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = p_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock - (v_ri.quantity_used * p_batches)
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

  -- Deduct sub-recipe (bahan setengah jadi) stocks
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
  VALUES (p_user_id, p_recipe_id, p_batches, p_total_cost, COALESCE(p_created_at, now()));
END;
$$;

-- ─── 2. restore_recipe_stock ──────────────────────────────────────────────────
-- Adds back stock when a sale is deleted or updated.
-- Mirrors deduct_sub_recipe_stock (which is reused for sale deduction).

CREATE OR REPLACE FUNCTION public.restore_recipe_stock(
  p_user_id   uuid,
  p_recipe_id uuid,
  p_quantity  numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.recipes
     SET stock = stock + p_quantity
   WHERE id = p_recipe_id AND user_id = p_user_id;
END;
$$;
