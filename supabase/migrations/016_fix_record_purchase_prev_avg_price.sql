-- Root cause: there are two overloaded record_purchase functions.
-- The 6-param version (with p_created_at, always called by the client)
-- was missing prev_avg_price and avg_price_updated_at updates.
-- The 5-param version had them, but was never called by the client.
--
-- Fix 1: data backfill — set prev_avg_price for items that have
-- multiple purchases but prev_avg_price = 0 (weighted avg of all
-- purchases before the most recent one).
UPDATE public.items i
SET prev_avg_price = sub.prior_avg
FROM (
  SELECT
    p.item_id,
    SUM(p.total_price) / NULLIF(SUM(p.quantity), 0) AS prior_avg
  FROM public.purchases p
  WHERE p.created_at < (
    SELECT MAX(p2.created_at)
    FROM public.purchases p2
    WHERE p2.item_id = p.item_id
  )
  GROUP BY p.item_id
) sub
WHERE i.id = sub.item_id
  AND i.prev_avg_price = 0
  AND sub.prior_avg IS NOT NULL;

-- Fix 2: replace the 6-param record_purchase with the correct version
-- that includes prev_avg_price, avg_price_updated_at, and security guard.
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
     SET prev_avg_price       = v_current_avg_price,
         avg_price            = v_new_avg_price,
         stock                = v_new_stock,
         avg_price_updated_at = now()
   WHERE id = p_item_id AND user_id = p_user_id;

  -- price_per_unit is GENERATED ALWAYS (total_price / quantity) — omit from INSERT
  INSERT INTO public.purchases (user_id, item_id, quantity, total_price, created_at)
  VALUES (p_user_id, p_item_id, p_quantity, p_total_price, COALESCE(p_created_at, now()));
END;
$$;
