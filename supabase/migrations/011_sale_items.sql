-- Migration 011: Multi-item sales
-- Introduces sale_items table so one transaction can hold N products each with their own add-ons.
-- Migrates existing sales data (1 sale → 1 sale_item).
-- Updates sale_addons FK from sale_id → sale_item_id.
-- Strips financial columns from sales (now lives in sale_items).

-- ─── 1. Create sale_items ─────────────────────────────────────────────────────
CREATE TABLE sale_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id            uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id),
  recipe_id          uuid NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  quantity_sold      numeric(15,4) NOT NULL CHECK (quantity_sold > 0),
  selling_price      numeric(15,2) NOT NULL CHECK (selling_price >= 0),
  hpp_at_sale        numeric(15,4) NOT NULL DEFAULT 0,
  hpp_addons_at_sale numeric(15,4) NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sale_items" ON sale_items
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX sale_items_sale_id_idx        ON sale_items(sale_id);
CREATE INDEX sale_items_user_created_idx   ON sale_items(user_id, created_at DESC);

-- ─── 2. Migrate: one sale_item per existing sale ──────────────────────────────
INSERT INTO sale_items (sale_id, user_id, recipe_id, quantity_sold, selling_price, hpp_at_sale, hpp_addons_at_sale, created_at)
SELECT
  id,
  user_id,
  recipe_id,
  quantity_sold,
  selling_price,
  hpp_at_sale,
  COALESCE(hpp_addons_at_sale, 0),
  created_at
FROM sales;

-- ─── 3. Add sale_item_id to sale_addons (nullable first) ─────────────────────
ALTER TABLE sale_addons ADD COLUMN sale_item_id uuid REFERENCES sale_items(id) ON DELETE CASCADE;

-- ─── 4. Populate sale_item_id (each old sale had exactly 1 sale_item) ─────────
UPDATE sale_addons sa
SET sale_item_id = si.id
FROM sale_items si
WHERE si.sale_id = sa.sale_id;

-- ─── 5. Enforce NOT NULL now data is populated ────────────────────────────────
ALTER TABLE sale_addons ALTER COLUMN sale_item_id SET NOT NULL;

-- ─── 6. Drop old RLS policy (references sale_id) BEFORE dropping column ──────
DROP POLICY IF EXISTS "Users manage own sale_addons" ON sale_addons;

-- ─── 7. Drop old FK column ────────────────────────────────────────────────────
ALTER TABLE sale_addons DROP COLUMN sale_id;

-- ─── 8. New RLS on sale_addons ────────────────────────────────────────────────
CREATE POLICY "users_own_sale_addons" ON sale_addons
  FOR ALL
  USING (
    sale_item_id IN (SELECT id FROM sale_items WHERE user_id = auth.uid())
  )
  WITH CHECK (
    sale_item_id IN (SELECT id FROM sale_items WHERE user_id = auth.uid())
  );

-- ─── 9. Strip financial columns from sales (now in sale_items) ───────────────
ALTER TABLE sales
  DROP COLUMN IF EXISTS recipe_id,
  DROP COLUMN IF EXISTS quantity_sold,
  DROP COLUMN IF EXISTS selling_price,
  DROP COLUMN IF EXISTS hpp_at_sale,
  DROP COLUMN IF EXISTS hpp_addons_at_sale,
  DROP COLUMN IF EXISTS profit;
