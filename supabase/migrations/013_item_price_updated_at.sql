-- Track when item avg_price last changed so recipe HPP diff badge
-- only shows for recipes that existed BEFORE the price change.
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS avg_price_updated_at timestamptz;

-- Backfill: existing rows get created_at as a safe default
UPDATE items SET avg_price_updated_at = created_at WHERE avg_price_updated_at IS NULL;

-- record_purchase: set avg_price_updated_at on every new purchase
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
     SET avg_price             = v_new_avg_price,
         stock                 = v_new_stock,
         avg_price_updated_at  = now()
   WHERE id = p_item_id AND user_id = p_user_id;

  INSERT INTO public.purchases (user_id, item_id, quantity, total_price, created_at)
  VALUES (p_user_id, p_item_id, p_quantity, p_total_price, COALESCE(p_created_at, now()));
END;
$$;

-- update_purchase: set avg_price_updated_at when price recalculated
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
     SET prev_avg_price       = v_old_avg,
         avg_price            = COALESCE(v_new_avg, 0),
         avg_price_updated_at = now()
   WHERE id = v_item_id AND user_id = p_user_id;
END;
$$;

-- delete_purchase: set avg_price_updated_at when price recalculated
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
     SET prev_avg_price       = v_old_avg,
         avg_price            = COALESCE(v_new_avg, 0),
         avg_price_updated_at = now()
   WHERE id = v_item_id AND user_id = p_user_id;
END;
$$;
