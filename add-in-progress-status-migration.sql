-- Migration to add 'in_progress' status to customers table
-- Run this in your Supabase SQL editor

-- First, drop the existing check constraint
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;

-- Add the new check constraint that includes 'in_progress'
ALTER TABLE customers
ADD CONSTRAINT customers_status_check
CHECK (status IN ('active', 'cancelled', 'completed', 'paid', 'not_paid', 'in_progress'));

-- Add a comment explaining the status types
COMMENT ON COLUMN customers.status IS 'Customer status: active (new customer), in_progress (missed installation), cancelled, completed, paid, not_paid';

-- Verify the constraint was added successfully
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'customers'::regclass
AND conname = 'customers_status_check';

-- Test query to verify we can now insert 'in_progress' status
-- (This is just for verification - don't actually run this insert)
-- INSERT INTO customers (user_id, name, email, phone, service_address, installation_date, installation_time, status)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'Test', 'test@example.com', '123-456-7890', 'Test Address', '2024-01-01', '10:00 AM', 'in_progress');