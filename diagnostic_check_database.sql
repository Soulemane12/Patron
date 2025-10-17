-- ============================================================================
-- DATABASE DIAGNOSTIC SCRIPT
-- ============================================================================
-- Run this first to see exactly what exists in your database
-- This will help us understand why the setup is failing

-- Check if customers table exists and show all columns
SELECT '=== CUSTOMERS TABLE ===' as section;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as table_status;

-- Show all columns in customers table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- Check specifically for visible_on_leaderboard column in customers
SELECT '=== CUSTOMERS.VISIBLE_ON_LEADERBOARD ===' as section;
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard'
        )
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as column_status;

-- Check if user_status table exists
SELECT '=== USER_STATUS TABLE ===' as section;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as table_status;

-- Show all columns in user_status table (if it exists)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_status'
ORDER BY ordinal_position;

-- Check for auth.users table (should exist in Supabase)
SELECT '=== AUTH.USERS TABLE ===' as section;
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as table_status;

-- Count records in each table
SELECT '=== RECORD COUNTS ===' as section;
SELECT
    (SELECT COUNT(*) FROM customers) as customers_count,
    (SELECT COUNT(*) FROM auth.users) as auth_users_count;

-- Try to count user_status records (this might fail if table doesn't exist)
SELECT '=== USER_STATUS COUNT ===' as section;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
        RAISE NOTICE 'user_status table exists, counting records...';
        PERFORM (SELECT COUNT(*) FROM user_status);
        RAISE NOTICE 'user_status record count successful';
    ELSE
        RAISE NOTICE 'user_status table does NOT exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error accessing user_status table: %', SQLERRM;
END
$$;

-- Check for any constraints or triggers that might be causing issues
SELECT '=== CONSTRAINTS ===' as section;
SELECT conname, contype, confupdtype, confdeltype
FROM pg_constraint
WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'customers');

-- Check current schema
SELECT '=== CURRENT SCHEMA ===' as section;
SELECT current_schema();

-- Check all schemas
SELECT '=== ALL SCHEMAS ===' as section;
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast');

-- Final summary
SELECT '=== DIAGNOSTIC COMPLETE ===' as section;
SELECT 'Check the results above to see what exists and what is missing' as message;