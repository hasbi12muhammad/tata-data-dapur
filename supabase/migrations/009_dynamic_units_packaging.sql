-- Migration 009: Dynamic units & packaging input

-- ============================================================
-- 1. Drop hardcoded unit check constraints
-- ============================================================
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_unit_check;
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_unit_check;

-- ============================================================
-- 2. custom_units table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_units (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.custom_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_custom_units" ON public.custom_units;
CREATE POLICY "users_own_custom_units"
  ON public.custom_units FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. packaging_types table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.packaging_types (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.packaging_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_packaging_types" ON public.packaging_types;
CREATE POLICY "users_own_packaging_types"
  ON public.packaging_types FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. Add nullable packaging columns to purchases
-- ============================================================
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS pkg_type_id  uuid REFERENCES public.packaging_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pkg_qty      numeric(15,4),
  ADD COLUMN IF NOT EXISTS size_per_pkg numeric(15,4);

-- ============================================================
-- 5. Replace record_purchase RPC
--    NOTE: price_per_unit is GENERATED ALWAYS (total_price / quantity)
--          — it must NOT be inserted explicitly.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_purchase(
  p_user_id        uuid,
  p_item_id        uuid,
  p_quantity       numeric,
  p_total_price    numeric,
  p_price_per_unit numeric,
  p_created_at     timestamptz DEFAULT NULL,
  p_pkg_type_id    uuid        DEFAULT NULL,
  p_pkg_qty        numeric     DEFAULT NULL,
  p_size_per_pkg   numeric     DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock     numeric;
  v_current_avg_price numeric;
  v_new_avg_price     numeric;
  v_new_stock         numeric;
BEGIN
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
  INSERT INTO public.purchases (user_id, item_id, quantity, total_price, created_at, pkg_type_id, pkg_qty, size_per_pkg)
  VALUES (p_user_id, p_item_id, p_quantity, p_total_price,
          COALESCE(p_created_at, now()),
          p_pkg_type_id, p_pkg_qty, p_size_per_pkg);
END;
$$;

-- ============================================================
-- 6. Replace update_purchase RPC
--    NOTE: price_per_unit is GENERATED ALWAYS — skip explicit update.
--          We add p_price_per_unit param for API symmetry but it is unused
--          (the generated column recomputes automatically from total_price/quantity).
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_purchase(
  p_purchase_id  uuid,
  p_user_id      uuid,
  p_quantity     numeric,
  p_total_price  numeric,
  p_price_per_unit numeric DEFAULT NULL,
  p_pkg_type_id  uuid     DEFAULT NULL,
  p_pkg_qty      numeric  DEFAULT NULL,
  p_size_per_pkg numeric  DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_id       uuid;
  v_old_quantity  numeric;
  v_old_avg       numeric;
  v_new_avg       numeric;
BEGIN
  SELECT item_id, quantity INTO v_item_id, v_old_quantity
    FROM public.purchases
   WHERE id = p_purchase_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  -- Update purchase record (price_per_unit is generated, omit it)
  UPDATE public.purchases
     SET quantity     = p_quantity,
         total_price  = p_total_price,
         pkg_type_id  = p_pkg_type_id,
         pkg_qty      = p_pkg_qty,
         size_per_pkg = p_size_per_pkg
   WHERE id = p_purchase_id AND user_id = p_user_id;

  -- Adjust item stock by the quantity delta
  UPDATE public.items
     SET stock = stock + (p_quantity - v_old_quantity)
   WHERE id = v_item_id AND user_id = p_user_id;

  -- Recalculate avg_price as weighted average across ALL purchases for this item
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
