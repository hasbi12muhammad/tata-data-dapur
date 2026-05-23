-- Store HPP baseline per recipe so diff badge compares against
-- the HPP at the time the recipe was created/last edited,
-- not against a global item prev_avg_price.
-- NULL = legacy recipe, falls back to prev_avg_price comparison.
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS hpp_baseline numeric DEFAULT NULL;
