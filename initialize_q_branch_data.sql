-- ============================================================================
-- INITIALIZE Q'S BRANCH DATA
-- ============================================================================
-- This script sets up the initial data for Q's branch management
-- Run this only after both customers and user_status tables are fixed

-- Method 1: Create user_status records for all auth users
DO $$
DECLARE
    inserted_count INTEGER := 0;
    total_users INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
        -- Count total auth users
        SELECT COUNT(*) INTO total_users FROM auth.users;

        -- Insert records for users that don't have status records
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

        GET DIAGNOSTICS inserted_count = ROW_COUNT;

        RAISE NOTICE 'SUCCESS: Created % new user_status records out of % total users', inserted_count, total_users;
    ELSE
        RAISE NOTICE 'ERROR: user_status table does not exist - run fix_user_status_table.sql first';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to create user_status records: %', SQLERRM;
END
$$;

-- Method 2: Assign first 3 users to Q's branch for testing
DO $$
DECLARE
    updated_count INTEGER := 0;
    user_emails TEXT := '';
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
        -- Update the first 3 users
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

        GET DIAGNOSTICS updated_count = ROW_COUNT;

        -- Get the emails of assigned users for display
        SELECT string_agg(u.email, ', ')
        INTO user_emails
        FROM auth.users u
        JOIN user_status us ON u.id = us.user_id
        WHERE us.visible_on_leaderboard = TRUE;

        RAISE NOTICE 'SUCCESS: Assigned % users to Q''s branch: %', updated_count, user_emails;
    ELSE
        RAISE NOTICE 'ERROR: user_status table does not exist - run fix_user_status_table.sql first';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to assign users to Q''s branch: %', SQLERRM;
END
$$;

-- Method 3: Update customers to be visible for Q's branch users
DO $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard'
    ) THEN
        -- Set all customers to be visible by default
        UPDATE customers
        SET visible_on_leaderboard = TRUE
        WHERE visible_on_leaderboard IS NULL OR visible_on_leaderboard = FALSE;

        GET DIAGNOSTICS updated_count = ROW_COUNT;

        RAISE NOTICE 'SUCCESS: Set % customers to be visible', updated_count;
    ELSE
        RAISE NOTICE 'ERROR: customers.visible_on_leaderboard column does not exist - run fix_customers_table.sql first';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to update customer visibility: %', SQLERRM;
END
$$;

-- Verification: Show current state
DO $$
DECLARE
    total_users INTEGER := 0;
    users_in_branch INTEGER := 0;
    total_customers INTEGER := 0;
    visible_customers INTEGER := 0;
    customers_for_branch_users INTEGER := 0;
BEGIN
    -- Count users
    SELECT COUNT(*) INTO total_users FROM auth.users;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
        SELECT COUNT(*) INTO users_in_branch FROM user_status WHERE visible_on_leaderboard = TRUE;
    END IF;

    -- Count customers
    SELECT COUNT(*) INTO total_customers FROM customers;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'visible_on_leaderboard'
    ) THEN
        SELECT COUNT(*) INTO visible_customers FROM customers WHERE visible_on_leaderboard = TRUE;

        -- Count customers for Q's branch users
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
            SELECT COUNT(*) INTO customers_for_branch_users
            FROM customers c
            WHERE c.user_id IN (
                SELECT us.user_id FROM user_status us WHERE us.visible_on_leaderboard = TRUE
            );
        END IF;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '=== FINAL SUMMARY ===';
    RAISE NOTICE 'Total Auth Users: %', total_users;
    RAISE NOTICE 'Users in Q''s Branch: %', users_in_branch;
    RAISE NOTICE 'Total Customers: %', total_customers;
    RAISE NOTICE 'Visible Customers: %', visible_customers;
    RAISE NOTICE 'Customers for Q''s Branch Users: %', customers_for_branch_users;
    RAISE NOTICE '';

    IF users_in_branch > 0 AND customers_for_branch_users > 0 THEN
        RAISE NOTICE '🎉 SUCCESS: Q''s Branch system is ready!';
        RAISE NOTICE 'Your /q page should now show % users with % customers', users_in_branch, customers_for_branch_users;
    ELSE
        RAISE NOTICE '⚠️  WARNING: Setup incomplete - check previous error messages';
    END IF;
END
$$;