-- Add batch production fields to recipes
-- batch_yield: how many units produced per batch (default 1 = existing behavior)
-- waste_pct: estimated waste percentage per batch (default 0)
-- hpp_per_unit = total_ingredient_cost / (batch_yield * (1 - waste_pct/100))

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS batch_yield integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS waste_pct  numeric  NOT NULL DEFAULT 0;
