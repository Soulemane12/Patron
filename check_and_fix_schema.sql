-- Check current structure of customers table
\d customers;

-- Add the missing column step by step
-- First, let's just add the column without any constraints
ALTER TABLE customers ADD COLUMN IF NOT EXISTS visible_on_leaderboard BOOLEAN;

-- Then set default values for existing records
UPDATE customers SET visible_on_leaderboard = TRUE WHERE visible_on_leaderboard IS NULL;

-- Now set the default for future records
ALTER TABLE customers ALTER COLUMN visible_on_leaderboard SET DEFAULT TRUE;

-- Add the index
CREATE INDEX IF NOT EXISTS idx_customers_visible ON customers(visible_on_leaderboard);
