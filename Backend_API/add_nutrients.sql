-- Run ONCE only if these columns do not already exist.
-- Missing data must remain NULL. Do not replace unknown values with zero.
ALTER TABLE test_nutrition_data
    ADD COLUMN sugar_per_gram DOUBLE NULL,
    ADD COLUMN fat_per_gram DOUBLE NULL,
    ADD COLUMN saturated_fat_per_gram DOUBLE NULL,
    ADD COLUMN sodium_mg_per_gram DOUBLE NULL,
    ADD COLUMN fiber_per_gram DOUBLE NULL;

-- Populate verified values for each food class before expecting all eight numbers.
-- Nutrients listed per 100 g must be divided by 100 before saving here.
-- Sodium: mg per 100 g / 100 = sodium_mg_per_gram. Other nutrients: g / 100.
