-- Migration 018: Selling Price (Harga Jual Tetap)
--
-- Adds selling_price column to recipes and items tables.
-- Both columns are nullable: NULL = never sold, no auto-fill logic.
-- selling_price stores the last used selling price for each recipe/item.

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT NULL;
ALTER TABLE items    ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT NULL;
