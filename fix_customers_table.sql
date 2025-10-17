-- ============================================================================
-- FIX CUSTOMERS TABLE - ADD MISSING COLUMN
-- ============================================================================
-- This script specifically fixes the customers table
-- Run this only if the diagnostic shows the column is missing

-- Method 1: Try the safe approach first
DO $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard'
    ) THEN
        -- Add the column
        EXECUTE 'ALTER TABLE customers ADD COLUMN visible_on_leaderboard BOOLEAN DEFAULT TRUE';
        RAISE NOTICE 'SUCCESS: Added visible_on_leaderboard column to customers table';
    ELSE
        RAISE NOTICE 'INFO: visible_on_leaderboard column already exists in customers table';
    END IF;
EXCEPTION
    WHEN duplicate_column THEN
        RAISE NOTICE 'INFO: Column already exists (caught duplicate_column error)';
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to add column: %', SQLERRM;
END
$$;

-- Method 2: Update existing NULL values to TRUE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard'
    ) THEN
        UPDATE customers SET visible_on_leaderboard = TRUE WHERE visible_on_leaderboard IS NULL;
        RAISE NOTICE 'SUCCESS: Updated NULL values in visible_on_leaderboard column';
    ELSE
        RAISE NOTICE 'WARNING: Cannot update - visible_on_leaderboard column does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to update column: %', SQLERRM;
END
$$;

-- Verify the result
SELECT 'VERIFICATION: CUSTOMERS TABLE AFTER FIX' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard';

-- Show count of customers with the new column
DO $$
DECLARE
    total_count INTEGER;
    visible_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard'
    ) THEN
        SELECT COUNT(*) INTO total_count FROM customers;
        SELECT COUNT(*) INTO visible_count FROM customers WHERE visible_on_leaderboard = TRUE;
        RAISE NOTICE 'RESULT: % total customers, % visible customers', total_count, visible_count;
    END IF;
END
$$;