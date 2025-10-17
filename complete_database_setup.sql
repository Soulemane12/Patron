-- ============================================================================
-- COMPLETE DATABASE SETUP FOR Q'S BRANCH MANAGEMENT SYSTEM
-- ============================================================================
-- This script checks everything and adds what's missing
-- Run this entire script in your Supabase SQL editor

-- ============================================================================
-- 1. CREATE REQUIRED FUNCTIONS FIRST
-- ============================================================================

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 2. ENSURE CUSTOMERS TABLE HAS REQUIRED COLUMN
-- ============================================================================

-- Check if visible_on_leaderboard column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'visible_on_leaderboard'
    ) THEN
        ALTER TABLE customers ADD COLUMN visible_on_leaderboard BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added visible_on_leaderboard column to customers table';
    ELSE
        RAISE NOTICE 'visible_on_leaderboard column already exists in customers table';
    END IF;
END
$$;

-- Ensure all existing customers are visible by default
UPDATE customers
SET visible_on_leaderboard = TRUE
WHERE visible_on_leaderboard IS NULL;

-- Set default for future records
ALTER TABLE customers ALTER COLUMN visible_on_leaderboard SET DEFAULT TRUE;

-- ============================================================================
-- 3. CREATE USER_STATUS TABLE IF IT DOESN'T EXIST
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_status (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_paused BOOLEAN DEFAULT FALSE,
    paused_at TIMESTAMP WITH TIME ZONE,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    visible_on_leaderboard BOOLEAN DEFAULT FALSE, -- This controls Q's branch assignment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================================================
-- 4. CREATE ALL REQUIRED INDEXES
-- ============================================================================

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_visible ON customers(visible_on_leaderboard);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- User_status table indexes
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_visible ON user_status(visible_on_leaderboard);
CREATE INDEX IF NOT EXISTS idx_user_status_approved ON user_status(is_approved);
CREATE INDEX IF NOT EXISTS idx_user_status_paused ON user_status(is_paused);

-- ============================================================================
-- 5. SET UP TRIGGERS
-- ============================================================================

-- Drop existing trigger if it exists and create new one for user_status
DROP TRIGGER IF EXISTS update_user_status_updated_at ON user_status;
CREATE TRIGGER update_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Ensure customers table also has updated_at trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. CONFIGURE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on user_status table
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and create new one
DROP POLICY IF EXISTS "Admin can manage user status" ON user_status;
CREATE POLICY "Admin can manage user status" ON user_status
    FOR ALL USING (true);

-- ============================================================================
-- 7. DIAGNOSTIC QUERIES - Check current state
-- ============================================================================

-- Show structure of customers table
SELECT 'CUSTOMERS TABLE STRUCTURE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- Show structure of user_status table
SELECT 'USER_STATUS TABLE STRUCTURE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_status'
ORDER BY ordinal_position;

-- Show current counts
SELECT 'CURRENT DATA COUNTS:' as info;
SELECT
    (SELECT COUNT(*) FROM customers) as total_customers,
    (SELECT COUNT(*) FROM customers WHERE visible_on_leaderboard = TRUE) as visible_customers,
    (SELECT COUNT(*) FROM user_status) as total_user_status_records,
    (SELECT COUNT(*) FROM user_status WHERE visible_on_leaderboard = TRUE) as users_in_q_branch,
    (SELECT COUNT(*) FROM auth.users) as total_auth_users;

-- ============================================================================
-- 8. FIX THE MAIN ISSUE - ASSIGN SOME USERS TO Q'S BRANCH
-- ============================================================================

-- The main problem is likely that no users are assigned to Q's branch
-- Let's assign the first few approved users to Q's branch for testing

-- First, let's see what users exist
SELECT 'EXISTING USERS (first 5):' as info;
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at
LIMIT 5;

-- Insert user_status records for all auth.users that don't have them yet
-- This is important because the system expects every user to have a status record
INSERT INTO user_status (user_id, is_approved, approved_at, approved_by, visible_on_leaderboard)
SELECT
    id,
    FALSE, -- Start with not approved
    NULL,
    NULL,
    FALSE -- Start with not in Q's branch
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_status WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Now approve and assign the first 3 users to Q's branch for testing
-- You can adjust this query to target specific users by email if needed
UPDATE user_status
SET
    is_approved = TRUE,
    approved_at = NOW(),
    approved_by = 'admin',
    visible_on_leaderboard = TRUE -- Assign to Q's branch
WHERE user_id IN (
    SELECT u.id
    FROM auth.users u
    ORDER BY u.created_at
    LIMIT 3
);

-- ============================================================================
-- 9. FINAL VERIFICATION QUERIES
-- ============================================================================

-- Show the users now assigned to Q's branch
SELECT 'USERS ASSIGNED TO Q''S BRANCH:' as info;
SELECT
    u.email,
    us.is_approved,
    us.approved_at,
    us.visible_on_leaderboard as in_q_branch,
    us.created_at as status_created
FROM auth.users u
JOIN user_status us ON u.id = us.user_id
WHERE us.visible_on_leaderboard = TRUE
ORDER BY us.created_at;

-- Show how many customers belong to users in Q's branch
SELECT 'CUSTOMERS FOR Q''S BRANCH USERS:' as info;
SELECT
    COUNT(*) as total_customers_for_q_branch_users,
    COUNT(CASE WHEN c.visible_on_leaderboard = TRUE THEN 1 END) as visible_customers_for_q_branch_users
FROM customers c
WHERE c.user_id IN (
    SELECT us.user_id
    FROM user_status us
    WHERE us.visible_on_leaderboard = TRUE
);

-- Final summary
SELECT 'FINAL SUMMARY:' as info;
SELECT
    'Total Users' as metric, COUNT(*)::text as count
FROM auth.users
UNION ALL
SELECT
    'Users with Status Records' as metric, COUNT(*)::text as count
FROM user_status
UNION ALL
SELECT
    'Users in Q''s Branch' as metric, COUNT(*)::text as count
FROM user_status
WHERE visible_on_leaderboard = TRUE
UNION ALL
SELECT
    'Total Customers' as metric, COUNT(*)::text as count
FROM customers
UNION ALL
SELECT
    'Visible Customers' as metric, COUNT(*)::text as count
FROM customers
WHERE visible_on_leaderboard = TRUE;

-- ============================================================================
-- 10. MANUAL ASSIGNMENT EXAMPLES (OPTIONAL)
-- ============================================================================

-- If you want to manually assign specific users to Q's branch, use this template:
-- Replace 'user@example.com' with the actual email address

/*
-- Example: Assign a specific user to Q's branch
UPDATE user_status
SET
    is_approved = TRUE,
    approved_at = NOW(),
    approved_by = 'admin',
    visible_on_leaderboard = TRUE
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'user@example.com'
);
*/

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================

SELECT '🎉 DATABASE SETUP COMPLETE!' as status;
SELECT 'Your Q''s Branch Management system should now be working.' as message;
SELECT 'Check the /q and /soulemane pages to verify functionality.' as next_step;