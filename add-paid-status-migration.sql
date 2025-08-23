-- Migration script to add 'paid' status option to existing customers table
-- Run this in your Supabase SQL editor

-- Add check constraint to allow 'paid' status
-- First, drop the existing constraint if it exists (this will work even if it doesn't exist)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;

-- Add the new constraint that includes 'paid'
ALTER TABLE customers ADD CONSTRAINT customers_status_check 
  CHECK (status IN ('active', 'cancelled', 'completed', 'paid'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'customers'::regclass AND conname = 'customers_status_check';
