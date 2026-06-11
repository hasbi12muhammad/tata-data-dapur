-- Migration 020: Add negative-stock guard to adjust_item_stock
-- adjust_item_stock is used for addon item deductions during sales.
-- Previously had no guard — p_delta < 0 could silently create negative item stock.
-- Now raises exception when deduction would go below 0.

CREATE OR REPLACE FUNCTION public.adjust_item_stock(
  p_user_id uuid,
  p_item_id uuid,
  p_delta   numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock numeric;
  v_item_name     text;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT stock, name
    INTO v_current_stock, v_item_name
    FROM public.items
   WHERE id = p_item_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  -- Only guard on deductions (negative delta)
  IF p_delta < 0 AND v_current_stock + p_delta < 0 THEN
    RAISE EXCEPTION 'Stok addon "%" tidak cukup: tersedia %, dibutuhkan %',
      v_item_name, v_current_stock, -p_delta;
  END IF;

  UPDATE public.items
     SET stock = stock + p_delta
   WHERE id = p_item_id AND user_id = p_user_id;
END;
$$;
