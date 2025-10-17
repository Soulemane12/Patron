-- ============================================================================
-- STEP 4: VERIFY EVERYTHING IS WORKING
-- ============================================================================
-- Run this script AFTER steps 1, 2, and 3
-- This shows you the current state and confirms everything works

-- Show table structures
SELECT 'CUSTOMERS TABLE STRUCTURE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

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

-- Show users in Q's branch
SELECT 'USERS IN Q''S BRANCH:' as info;
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

-- Show customer counts for Q's branch users
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

SELECT '🎉 SETUP VERIFICATION COMPLETE!' as final_status;
SELECT 'Your Q''s Branch Management system should now be working!' as message;
SELECT 'Check /q and /soulemane pages to verify functionality.' as next_step;