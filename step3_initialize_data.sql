-- ============================================================================
-- STEP 3: INITIALIZE Q'S BRANCH DATA
-- ============================================================================
-- Run this script AFTER steps 1 and 2
-- This sets up the Q's branch assignments

-- Create user_status records for all auth users that don't have them
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

SELECT 'Step 3 Complete: Q''s branch data initialized' as status;