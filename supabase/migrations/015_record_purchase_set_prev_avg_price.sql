-- Fix: record_purchase sebelumnya tidak set prev_avg_price.
-- Sekarang simpan avg_price lama sebagai prev_avg_price sebelum update,
-- supaya badge HPP diff muncul saat pembelian baru dengan harga berbeda.
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

  INSERT INTO public.purchases (user_id, item_id, quantity, total_price, created_at)
  VALUES (p_user_id, p_item_id, p_quantity, p_total_price, COALESCE(p_created_at, now()));
END;
$$;
