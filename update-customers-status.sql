-- SQL to add status column to the customers table
ALTER TABLE customers
ADD COLUMN status TEXT DEFAULT 'active';

-- Set default status for existing records
UPDATE customers
SET status = 'active'
WHERE status IS NULL;