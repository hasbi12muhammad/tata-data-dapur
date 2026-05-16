-- Security fix: validate caller identity in all SECURITY DEFINER RPCs,
-- and ensure user_profiles table has RLS.
--
-- Root cause: all RPCs accepted p_user_id as a caller-supplied parameter
-- without comparing it to auth.uid(). A malicious authenticated user could
-- pass another user's UUID and manipulate their data.
--
-- Fix: add an IS DISTINCT FROM auth.uid() guard at the top of every function.
-- Client-side code (hooks) is unchanged — it already passes the correct user!.id.

-- ── record_purchase ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_purchase(
  p_user_id        uuid,
  p_item_id        uuid,
  p_quantity       numeric,
  p_total_price    numeric,
  p_price_per_unit numeric,
  p_created_at     timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock     numeric;
  v_current_avg_price numeric;
  v_new_avg_price     numeric;
  v_new_stock         numeric;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT stock, avg_price
    INTO v_current_stock, v_current_avg_price
    FROM public.items
   WHERE id = p_item_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_new_stock := v_current_stock + p_quantity;
  IF v_new_stock > 0 THEN
    v_new_avg_price := (v_current_stock * v_current_avg_price + p_quantity * p_price_per_unit) / v_new_stock;
  ELSE
    v_new_avg_price := p_price_per_unit;
  END IF;

  UPDATE public.items
     SET avg_price = v_new_avg_price,
         stock     = v_new_stock
   WHERE id = p_item_id AND user_id = p_user_id;

  -- price_per_unit is GENERATED ALWAYS (total_price / quantity) — omit from INSERT
  INSERT INTO public.purchases (user_id, item_id, quantity, total_price, created_at)
  VALUES (p_user_id, p_item_id, p_quantity, p_total_price, COALESCE(p_created_at, now()));
END;
$$;

-- ── update_purchase ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_purchase(
  p_purchase_id uuid,
  p_user_id     uuid,
  p_quantity    numeric,
  p_total_price numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id      uuid;
  v_old_quantity numeric;
  v_old_avg      numeric;
  v_new_avg      numeric;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT item_id, quantity INTO v_item_id, v_old_quantity
    FROM public.purchases
   WHERE id = p_purchase_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  UPDATE public.purchases
     SET quantity    = p_quantity,
         total_price = p_total_price
   WHERE id = p_purchase_id AND user_id = p_user_id;

  UPDATE public.items
     SET stock = stock + (p_quantity - v_old_quantity)
   WHERE id = v_item_id AND user_id = p_user_id;

  SELECT SUM(total_price) / NULLIF(SUM(quantity), 0) INTO v_new_avg
    FROM public.purchases
   WHERE item_id = v_item_id AND user_id = p_user_id;

  SELECT avg_price INTO v_old_avg
    FROM public.items
   WHERE id = v_item_id AND user_id = p_user_id;

  UPDATE public.items
     SET prev_avg_price = v_old_avg,
         avg_price      = COALESCE(v_new_avg, 0)
   WHERE id = v_item_id AND user_id = p_user_id;
END;
$$;

-- ── delete_purchase ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_purchase(
  p_purchase_id uuid,
  p_user_id     uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id  uuid;
  v_quantity numeric;
  v_old_avg  numeric;
  v_new_avg  numeric;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT item_id, quantity
    INTO v_item_id, v_quantity
    FROM public.purchases
   WHERE id = p_purchase_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  DELETE FROM public.purchases
   WHERE id = p_purchase_id AND user_id = p_user_id;

  UPDATE public.items
     SET stock = stock - v_quantity
   WHERE id = v_item_id AND user_id = p_user_id;

  SELECT avg_price INTO v_old_avg
    FROM public.items
   WHERE id = v_item_id AND user_id = p_user_id;

  SELECT SUM(total_price) / NULLIF(SUM(quantity), 0) INTO v_new_avg
    FROM public.purchases
   WHERE item_id = v_item_id AND user_id = p_user_id;

  UPDATE public.items
     SET prev_avg_price = v_old_avg,
         avg_price      = COALESCE(v_new_avg, 0)
   WHERE id = v_item_id AND user_id = p_user_id;
END;
$$;

-- ── produce_sub_recipe ───────────────────────────────────────────────────────
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

-- ── deduct_sub_recipe_stock ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_sub_recipe_stock(
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
     SET stock = stock - p_quantity
   WHERE id = p_recipe_id AND user_id = p_user_id;
END;
$$;

-- ── delete_production ────────────────────────────────────────────────────────
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

  SELECT stock, avg_price
    INTO v_current_stock, v_current_avg
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

  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = v_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock + (v_ri.quantity_used * v_batches)
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

  DELETE FROM public.productions
   WHERE id = p_production_id AND user_id = p_user_id;
END;
$$;

-- ── update_production ────────────────────────────────────────────────────────
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

  SELECT stock, avg_price
    INTO v_current_stock, v_current_avg
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

  FOR v_ri IN
    SELECT ri.item_id, ri.quantity_used
      FROM public.recipe_items ri
     WHERE ri.recipe_id = v_recipe_id AND ri.item_id IS NOT NULL
  LOOP
    UPDATE public.items
       SET stock = stock + (v_ri.quantity_used * (v_old_batches - p_batches))
     WHERE id = v_ri.item_id AND user_id = p_user_id;
  END LOOP;

  UPDATE public.productions
     SET batches    = p_batches,
         total_cost = p_total_cost
   WHERE id = p_production_id AND user_id = p_user_id;
END;
$$;

-- ── user_profiles: ensure table and RLS exist ─────────────────────────────────
-- This table is referenced by middleware but was not tracked in migrations.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT 'v1'
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_profile" ON public.user_profiles;
CREATE POLICY "users_own_profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Auto-create a v1 profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, version)
  VALUES (NEW.id, 'v1')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
