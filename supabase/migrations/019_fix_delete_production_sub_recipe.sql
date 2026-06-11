-- Migration 019: Fix delete_production + update_production sub-recipe stock restoration
--               + Add negative-stock guards to all deduction RPCs
--
-- Root cause: delete_production and update_production only iterated recipe_items
-- WHERE item_id IS NOT NULL, ignoring sub_recipe_id rows. When producing finished
-- goods via produce_recipe, sub-recipe stocks ARE deducted — but delete/update
-- never restored them, causing permanent negative stock on sub-recipes.
--
-- RPCs fixed: delete_production, update_production
-- Guards added: produce_recipe, produce_sub_recipe, deduct_sub_recipe_stock

-- ─── 1. delete_production ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_production(
  p_user_id       uuid,
  p_production_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe_id     uuid;
  v_batches       numeric;
  v_total_cost    numeric;
  v_current_stock numeric;
  v_current_avg   numeric;
  v_new_stock     numeric;
  v_new_avg       numeric;
  v_is_ingredient boolean;
  v_ri            record;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT recipe_id, batches, total_cost
    INTO v_recipe_id, v_batches, v_total_cost
    FROM public.productions
   WHERE id = p_production_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production not found';
  END IF;

  SELECT stock, avg_price, is_ingredient
    INTO v_current_stock, v_current_avg, v_is_ingredient
    FROM public.recipes
   WHERE id = v_recipe_id AND user_id = p_user_id;

  v_new_stock := v_current_stock - v_batches;

  IF v_new_stock > 0 THEN
    v_new_avg := GREATEST(0, (v_current_stock * v_current_avg - v_total_cost) / v_new_stock);
  ELSE
    v_new_avg := 0;
  END IF;

  UPDATE public.recipes
     SET stock     = v_new_stock,
         avg_price = v_new_avg
   WHERE id = v_recipe_id AND user_id = p_user_id;

  -- Kembalikan stok bahan baku (items)
  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = v_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock + (v_ri.quantity_used * v_batches)
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

  -- Kembalikan stok sub-resep (hanya produk jadi — produce_sub_recipe tidak deduct sub-resep)
  IF NOT v_is_ingredient THEN
    FOR v_ri IN
      SELECT ri.sub_recipe_id, ri.quantity_used
        FROM public.recipe_items ri
       WHERE ri.recipe_id = v_recipe_id AND ri.sub_recipe_id IS NOT NULL
    LOOP
      UPDATE public.recipes
         SET stock = stock + (v_ri.quantity_used * v_batches)
       WHERE id = v_ri.sub_recipe_id AND user_id = p_user_id;
    END LOOP;
  END IF;

  DELETE FROM public.productions
   WHERE id = p_production_id AND user_id = p_user_id;
END;
$$;

-- ─── 2. update_production ─────────────────────────────────────────────────────
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

  v_new_stock := v_current_stock - v_old_batches + p_batches;

  IF v_new_stock > 0 THEN
    v_new_avg := GREATEST(0, (v_current_stock * v_current_avg - v_old_cost + p_total_cost) / v_new_stock);
  ELSE
    v_new_avg := 0;
  END IF;

  UPDATE public.recipes
     SET stock     = v_new_stock,
         avg_price = v_new_avg
   WHERE id = v_recipe_id AND user_id = p_user_id;

  -- Adjust stok bahan baku berdasarkan selisih batch
  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = v_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock + (v_ri.quantity_used * (v_old_batches - p_batches))
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

  -- Adjust stok sub-resep berdasarkan selisih batch (hanya produk jadi)
  IF NOT v_is_ingredient THEN
    FOR v_ri IN
      SELECT ri.sub_recipe_id, ri.quantity_used
        FROM public.recipe_items ri
       WHERE ri.recipe_id = v_recipe_id AND ri.sub_recipe_id IS NOT NULL
    LOOP
      UPDATE public.recipes
         SET stock = stock + (v_ri.quantity_used * (v_old_batches - p_batches))
       WHERE id = v_ri.sub_recipe_id AND user_id = p_user_id;
    END LOOP;
  END IF;

  UPDATE public.productions
     SET batches    = p_batches,
         total_cost = p_total_cost
   WHERE id = p_production_id AND user_id = p_user_id;
END;
$$;

-- ─── 3. produce_recipe (add stock guards) ─────────────────────────────────────
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

  -- Guard: cek stok sub-resep sebelum deduct
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
     SET stock     = v_new_stock,
         avg_price = v_new_avg
   WHERE id = p_recipe_id AND user_id = p_user_id;

  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = p_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock - (v_ri.quantity_used * p_batches)
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

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

-- ─── 4. produce_sub_recipe (add stock guards) ──────────────────────────────────
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

  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = p_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock - (v_ri.quantity_used * p_batches)
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

  INSERT INTO public.productions (user_id, recipe_id, batches, total_cost, created_at)
  VALUES (p_user_id, p_recipe_id, p_batches, p_total_cost, COALESCE(p_created_at, now()));
END;
$$;

-- ─── 5. deduct_sub_recipe_stock (add stock guard) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_sub_recipe_stock(
  p_user_id   uuid,
  p_recipe_id uuid,
  p_quantity  numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock numeric;
  v_recipe_name   text;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT stock, name
    INTO v_current_stock, v_recipe_name
    FROM public.recipes
   WHERE id = p_recipe_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe not found';
  END IF;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stok "%" tidak cukup: tersedia %, dibutuhkan %',
      v_recipe_name, v_current_stock, p_quantity;
  END IF;

  UPDATE public.recipes
     SET stock = stock - p_quantity
   WHERE id = p_recipe_id AND user_id = p_user_id;
END;
$$;
