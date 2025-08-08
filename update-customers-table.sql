-- SQL to add referral columns to the customers table
ALTER TABLE customers
ADD COLUMN is_referral BOOLEAN DEFAULT FALSE,
ADD COLUMN referral_source TEXT;

-- Optionally set default values for existing records
UPDATE customers
SET is_referral = FALSE
WHERE is_referral IS NULL;