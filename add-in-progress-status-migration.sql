-- Migration to add 'in_progress' status to customers table
-- Run this in your Supabase SQL editor

-- Step 1: Drop the existing check constraint (if it exists)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;

-- Step 2: Add the new check constraint that includes 'in_progress'
ALTER TABLE customers
ADD CONSTRAINT customers_status_check
CHECK (status IN ('active', 'cancelled', 'completed', 'paid', 'not_paid', 'in_progress'));

-- Step 3: Add a comment explaining the status types
COMMENT ON COLUMN customers.status IS 'Customer status: active (new), in_progress (missed installation), cancelled, completed, paid, not_paid';

-- Step 4: Verify the constraint was added successfully
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'customers'::regclass
AND conname = 'customers_status_check';

-- Step 5: Show current status distribution (optional verification)
SELECT
    status,
    COUNT(*) as count
FROM customers
GROUP BY status
ORDER BY count DESC;

-- Migration completed successfully!
-- You can now use 'in_progress' status in your application.