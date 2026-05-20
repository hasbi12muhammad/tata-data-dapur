-- Migration 010: Sale Add-Ons
-- Adds is_addon flag to items and recipes (sub-recipes)
-- Creates sale_addons table to track add-ons per sale
-- Adds hpp_addons_at_sale to sales (total addon HPP for the transaction)
-- RPCs: adjust_item_stock, restore_sub_recipe_stock

ALTER TABLE items ADD COLUMN is_addon boolean NOT NULL DEFAULT false;
ALTER TABLE recipes ADD COLUMN is_addon boolean NOT NULL DEFAULT false;
ALTER TABLE sales ADD COLUMN hpp_addons_at_sale numeric(15,4) NOT NULL DEFAULT 0;

CREATE TABLE sale_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE RESTRICT,
  sub_recipe_id uuid REFERENCES recipes(id) ON DELETE RESTRICT,
  quantity numeric(15,4) NOT NULL CHECK (quantity > 0),
  price_per_unit_at_sale numeric(15,4) NOT NULL DEFAULT 0,
  name_at_sale text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT exactly_one_source CHECK (
    (item_id IS NOT NULL AND sub_recipe_id IS NULL) OR
    (item_id IS NULL AND sub_recipe_id IS NOT NULL)
  )
);

ALTER TABLE sale_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sale_addons" ON sale_addons
  FOR ALL
  USING (
    sale_id IN (SELECT id FROM sales WHERE user_id = auth.uid())
  )
  WITH CHECK (
    sale_id IN (SELECT id FROM sales WHERE user_id = auth.uid())
  );

-- RPC: adjust_item_stock
-- p_delta negative = deduct stock, positive = restore stock
CREATE OR REPLACE FUNCTION adjust_item_stock(
  p_user_id uuid,
  p_item_id uuid,
  p_delta numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE items
  SET stock = stock + p_delta
  WHERE id = p_item_id AND user_id = p_user_id;
END;
$$;

-- RPC: restore_sub_recipe_stock (reverse of deduct_sub_recipe_stock)
CREATE OR REPLACE FUNCTION restore_sub_recipe_stock(
  p_user_id uuid,
  p_recipe_id uuid,
  p_quantity numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE recipes
  SET stock = stock + p_quantity
  WHERE id = p_recipe_id AND user_id = p_user_id;
END;
$$;
