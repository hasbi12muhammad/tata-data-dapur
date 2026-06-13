-- Migration 021: Production BOM snapshot (production_items)
--
-- Problem: delete_production / update_production reconstruct the consumed
-- quantities from the LIVE recipe definition (recipe_items). If a recipe is
-- edited AFTER a production is recorded, deleting/updating that production
-- restores the WRONG amount of raw-material / sub-recipe stock — or none at all
-- if an ingredient was removed from the recipe in the meantime.
--
-- Fix: snapshot exactly what each production consumed into `production_items`
-- (per-batch quantity, captured at production time). delete/update restore from
-- the snapshot. Legacy productions that have no snapshot fall back to the live
-- recipe definition (best-effort, unchanged old behaviour).
--
-- Supersedes the delete/update sub-recipe restore from migration 019.

-- ─── 1. Snapshot table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.production_items (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_id uuid NOT NULL REFERENCES public.productions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  item_id       uuid REFERENCES public.items(id)   ON DELETE CASCADE,
  sub_recipe_id uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  -- per-batch quantity at production time (deduction = quantity_used * batches)
  quantity_used numeric(15,4) NOT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT production_items_one_source
    CHECK ((item_id IS NOT NULL) != (sub_recipe_id IS NOT NULL))
);

ALTER TABLE public.production_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_production_items" ON public.production_items;
CREATE POLICY "users_own_production_items" ON public.production_items
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS production_items_production_idx
  ON public.production_items (production_id);

-- ─── 2. produce_recipe (snapshot both items + sub-recipes consumed) ───────────
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
  v_production_id uuid;
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

  -- Deduct sub-recipes
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

  -- Snapshot consumed BOM (per-batch quantities) for accurate future restore
  INSERT INTO public.production_items (production_id, user_id, item_id, sub_recipe_id, quantity_used)
  SELECT v_production_id, p_user_id, ri.item_id, ri.sub_recipe_id, ri.quantity_used
    FROM public.recipe_items ri
   WHERE ri.recipe_id = p_recipe_id
     AND (ri.item_id IS NOT NULL OR ri.sub_recipe_id IS NOT NULL);
END;
$$;

-- ─── 3. produce_sub_recipe (snapshot consumed raw materials) ──────────────────
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

  v_new_stock := v_current_stock + p_batches;
  IF v_new_stock > 0 THEN
    v_new_avg := (v_current_stock * v_current_avg + p_total_cost) / v_new_stock;
  ELSE
    v_new_avg := CASE WHEN p_batches > 0 THEN p_total_cost / p_batches ELSE 0 END;
  END IF;

  UPDATE public.recipes
     SET stock = v_new_stock, avg_price = v_new_avg
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
  VALUES (p_user_id, p_recipe_id, p_batches, p_total_cost, COALESCE(p_created_at, now()))
  RETURNING id INTO v_production_id;

  -- Snapshot consumed raw materials only (sub-recipe production deducts items only)
  INSERT INTO public.production_items (production_id, user_id, item_id, sub_recipe_id, quantity_used)
  SELECT v_production_id, p_user_id, ri.item_id, NULL, ri.quantity_used
    FROM public.recipe_items ri
   WHERE ri.recipe_id = p_recipe_id AND ri.item_id IS NOT NULL;
END;
$$;

-- ─── 4. delete_production (restore from snapshot; fallback to live recipe) ─────
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
  v_has_snapshot  boolean;
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

  -- Reduce produced recipe stock + recalc avg
  v_new_stock := v_current_stock - v_batches;
  IF v_new_stock > 0 THEN
    v_new_avg := GREATEST(0, (v_current_stock * v_current_avg - v_total_cost) / v_new_stock);
  ELSE
    v_new_avg := 0;
  END IF;

  UPDATE public.recipes
     SET stock = v_new_stock, avg_price = v_new_avg
   WHERE id = v_recipe_id AND user_id = p_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.production_items WHERE production_id = p_production_id
  ) INTO v_has_snapshot;

  IF v_has_snapshot THEN
    -- Accurate restore from what was actually consumed
    FOR v_ri IN
      SELECT item_id, sub_recipe_id, quantity_used
        FROM public.production_items
       WHERE production_id = p_production_id AND user_id = p_user_id
    LOOP
      IF v_ri.item_id IS NOT NULL THEN
        UPDATE public.items
           SET stock = stock + (v_ri.quantity_used * v_batches)
         WHERE id = v_ri.item_id AND user_id = p_user_id;
      ELSIF v_ri.sub_recipe_id IS NOT NULL THEN
        UPDATE public.recipes
           SET stock = stock + (v_ri.quantity_used * v_batches)
         WHERE id = v_ri.sub_recipe_id AND user_id = p_user_id;
      END IF;
    END LOOP;
  ELSE
    -- Legacy fallback: reconstruct from live recipe (pre-snapshot productions)
    FOR v_ri IN
      SELECT ri.item_id, ri.quantity_used
        FROM public.recipe_items ri
       WHERE ri.recipe_id = v_recipe_id AND ri.item_id IS NOT NULL
    LOOP
      UPDATE public.items
         SET stock = stock + (v_ri.quantity_used * v_batches)
       WHERE id = v_ri.item_id AND user_id = p_user_id;
    END LOOP;

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
  END IF;

  -- production_items cascade-deletes with the production row
  DELETE FROM public.productions
   WHERE id = p_production_id AND user_id = p_user_id;
END;
$$;

-- ─── 5. update_production (adjust by batch delta using snapshot) ──────────────
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
     SET stock = v_new_stock, avg_price = v_new_avg
   WHERE id = v_recipe_id AND user_id = p_user_id;

  v_diff := v_old_batches - p_batches;

  SELECT EXISTS (
    SELECT 1 FROM public.production_items WHERE production_id = p_production_id
  ) INTO v_has_snapshot;

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
    -- Legacy fallback: reconstruct from live recipe
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
