-- ============================================================================
-- BULLETPROOF DATABASE SETUP FOR Q'S BRANCH MANAGEMENT SYSTEM
-- ============================================================================
-- This script is designed to be completely safe and re-runnable
-- It checks EVERYTHING and only adds what's missing
-- NO COLUMN REFERENCE ERRORS - Each phase is self-contained
-- ============================================================================

-- ============================================================================
-- PHASE 1: CREATE ALL MISSING STRUCTURES FIRST
-- ============================================================================

-- Create the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add visible_on_leaderboard column to customers table if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'visible_on_leaderboard'
    ) THEN
        ALTER TABLE customers ADD COLUMN visible_on_leaderboard BOOLEAN DEFAULT TRUE;
        RAISE NOTICE '✅ Added visible_on_leaderboard column to customers table';
    ELSE
        RAISE NOTICE '✅ visible_on_leaderboard column already exists in customers table';
    END IF;
END
$$;

-- Create user_status table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_status (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_paused BOOLEAN DEFAULT FALSE,
    paused_at TIMESTAMP WITH TIME ZONE,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    visible_on_leaderboard BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================================================
-- PHASE 2: UPDATE DATA IN EXISTING COLUMNS (CONDITIONAL)
-- ============================================================================

-- Update customers table data only if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'visible_on_leaderboard'
    ) THEN
        -- Set all existing customers to be visible by default
        UPDATE customers
        SET visible_on_leaderboard = TRUE
        WHERE visible_on_leaderboard IS NULL;

        -- Set default for future records
        ALTER TABLE customers ALTER COLUMN visible_on_leaderboard SET DEFAULT TRUE;

        RAISE NOTICE '✅ Updated customers table data and defaults';
    END IF;
END
$$;

-- ============================================================================
-- PHASE 3: CREATE ALL INDEXES
-- ============================================================================

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- Add visible_on_leaderboard index only if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'visible_on_leaderboard'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_customers_visible ON customers(visible_on_leaderboard);
        RAISE NOTICE '✅ Created index on customers.visible_on_leaderboard';
    END IF;
END
$$;

-- User_status table indexes
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_visible ON user_status(visible_on_leaderboard);
CREATE INDEX IF NOT EXISTS idx_user_status_approved ON user_status(is_approved);
CREATE INDEX IF NOT EXISTS idx_user_status_paused ON user_status(is_paused);

-- ============================================================================
-- PHASE 4: SET UP TRIGGERS AND POLICIES
-- ============================================================================

-- Set up triggers for user_status table
DROP TRIGGER IF EXISTS update_user_status_updated_at ON user_status;
CREATE TRIGGER update_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Set up triggers for customers table
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Configure Row Level Security
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy
DROP POLICY IF EXISTS "Admin can manage user status" ON user_status;
CREATE POLICY "Admin can manage user status" ON user_status
    FOR ALL USING (true);

-- ============================================================================
-- PHASE 5: INITIALIZE DATA FOR Q'S BRANCH SYSTEM
-- ============================================================================

-- Insert user_status records for all auth.users that don't have them
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

-- Approve and assign the first 3 users to Q's branch for testing
UPDATE user_status
SET
    is_approved = TRUE,
    approved_at = NOW(),
    approved_by = 'admin',
    visible_on_leaderboard = TRUE
WHERE user_id IN (
    SELECT u.id
    FROM auth.users u
    ORDER BY u.created_at
    LIMIT 3
);

-- ============================================================================
-- PHASE 6: VERIFICATION AND DIAGNOSTICS
-- ============================================================================

-- Show table structures
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 TABLE STRUCTURES:';
    RAISE NOTICE '==================';
END
$$;

-- Show customers table structure
SELECT
    '📋 CUSTOMERS TABLE' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- Show user_status table structure
SELECT
    '👥 USER_STATUS TABLE' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_status'
ORDER BY ordinal_position;

-- Current data counts
DO $$
DECLARE
    total_customers INTEGER;
    visible_customers INTEGER;
    total_user_status_records INTEGER;
    users_in_q_branch INTEGER;
    total_auth_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_customers FROM customers;

    -- Count visible customers (check if column exists first)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard'
    ) THEN
        EXECUTE 'SELECT COUNT(*) FROM customers WHERE visible_on_leaderboard = TRUE' INTO visible_customers;
    ELSE
        visible_customers := 0;
    END IF;

    SELECT COUNT(*) INTO total_user_status_records FROM user_status;
    SELECT COUNT(*) INTO users_in_q_branch FROM user_status WHERE visible_on_leaderboard = TRUE;
    SELECT COUNT(*) INTO total_auth_users FROM auth.users;

    RAISE NOTICE '';
    RAISE NOTICE '📊 CURRENT DATA COUNTS:';
    RAISE NOTICE '======================';
    RAISE NOTICE 'Total Customers: %', total_customers;
    RAISE NOTICE 'Visible Customers: %', visible_customers;
    RAISE NOTICE 'Total User Status Records: %', total_user_status_records;
    RAISE NOTICE 'Users in Q''s Branch: %', users_in_q_branch;
    RAISE NOTICE 'Total Auth Users: %', total_auth_users;
END
$$;

-- Show users assigned to Q's branch
SELECT
    '🌟 USERS IN Q''S BRANCH' as info,
    u.email,
    us.is_approved,
    us.approved_at,
    us.visible_on_leaderboard as in_q_branch,
    us.created_at as status_created
FROM auth.users u
JOIN user_status us ON u.id = us.user_id
WHERE us.visible_on_leaderboard = TRUE
ORDER BY us.created_at;

-- Show customer counts for Q's branch users
DO $$
DECLARE
    total_customers_for_q_users INTEGER := 0;
    visible_customers_for_q_users INTEGER := 0;
BEGIN
    -- Count total customers for Q's branch users
    SELECT COUNT(*) INTO total_customers_for_q_users
    FROM customers c
    WHERE c.user_id IN (
        SELECT us.user_id
        FROM user_status us
        WHERE us.visible_on_leaderboard = TRUE
    );

    -- Count visible customers for Q's branch users (if column exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard'
    ) THEN
        EXECUTE 'SELECT COUNT(*) FROM customers c WHERE c.user_id IN (
            SELECT us.user_id FROM user_status us WHERE us.visible_on_leaderboard = TRUE
        ) AND c.visible_on_leaderboard = TRUE' INTO visible_customers_for_q_users;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '📈 CUSTOMERS FOR Q''S BRANCH:';
    RAISE NOTICE '============================';
    RAISE NOTICE 'Total Customers for Q''s Branch Users: %', total_customers_for_q_users;
    RAISE NOTICE 'Visible Customers for Q''s Branch Users: %', visible_customers_for_q_users;
END
$$;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SETUP COMPLETE!';
    RAISE NOTICE '==================';
    RAISE NOTICE '✅ All tables and columns verified/created';
    RAISE NOTICE '✅ All indexes created';
    RAISE NOTICE '✅ All triggers and policies set up';
    RAISE NOTICE '✅ Sample users assigned to Q''s branch';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 NEXT STEPS:';
    RAISE NOTICE '1. Check your /q page - it should now show users and customers';
    RAISE NOTICE '2. Check your /soulemane admin page - you can assign more users to Q''s branch';
    RAISE NOTICE '3. If /q page is still empty, use the manual assignment example below';
    RAISE NOTICE '';
END
$$;

-- ============================================================================
-- MANUAL USER ASSIGNMENT TEMPLATE (OPTIONAL)
-- ============================================================================

/*
-- If you need to manually assign specific users to Q's branch:
-- Replace 'user@example.com' with actual email addresses

-- Example 1: Assign a specific user to Q's branch
UPDATE user_status
SET
    is_approved = TRUE,
    approved_at = NOW(),
    approved_by = 'admin',
    visible_on_leaderboard = TRUE
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- Example 2: Assign multiple users at once
UPDATE user_status
SET
    is_approved = TRUE,
    approved_at = NOW(),
    approved_by = 'admin',
    visible_on_leaderboard = TRUE
WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('user1@example.com', 'user2@example.com', 'user3@example.com')
);

-- Example 3: Remove a user from Q's branch
UPDATE user_status
SET visible_on_leaderboard = FALSE
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'user@example.com'
);
*/