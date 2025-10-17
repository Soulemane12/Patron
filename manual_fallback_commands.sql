-- ============================================================================
-- MANUAL FALLBACK COMMANDS
-- ============================================================================
-- If the automated scripts continue to fail, run these commands ONE AT A TIME
-- Copy and paste each command individually into your Supabase SQL editor

-- ============================================================================
-- COMMAND 1: Create trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- COMMAND 2: Add column to customers table (may error if exists - that's OK)
-- ============================================================================
ALTER TABLE customers ADD COLUMN visible_on_leaderboard BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- COMMAND 3: Update customers data
-- ============================================================================
UPDATE customers SET visible_on_leaderboard = TRUE WHERE visible_on_leaderboard IS NULL;

-- ============================================================================
-- COMMAND 4: Create user_status table
-- ============================================================================
CREATE TABLE user_status (
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
-- COMMAND 5: Enable RLS
-- ============================================================================
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMAND 6: Create policy
-- ============================================================================
CREATE POLICY "Admin can manage user status" ON user_status FOR ALL USING (true);

-- ============================================================================
-- COMMAND 7: Create indexes
-- ============================================================================
CREATE INDEX idx_customers_visible ON customers(visible_on_leaderboard);
CREATE INDEX idx_user_status_user_id ON user_status(user_id);
CREATE INDEX idx_user_status_visible ON user_status(visible_on_leaderboard);

-- ============================================================================
-- COMMAND 8: Create triggers
-- ============================================================================
CREATE TRIGGER update_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMAND 9: Create user status records
-- ============================================================================
INSERT INTO user_status (user_id, is_approved, approved_at, approved_by, visible_on_leaderboard)
SELECT
    id,
    FALSE,
    NULL,
    NULL,
    FALSE
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_status WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- COMMAND 10: Assign first 3 users to Q's branch
-- ============================================================================
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
-- COMMAND 11: Verify setup
-- ============================================================================
SELECT
    (SELECT COUNT(*) FROM auth.users) as total_users,
    (SELECT COUNT(*) FROM user_status WHERE visible_on_leaderboard = TRUE) as users_in_q_branch,
    (SELECT COUNT(*) FROM customers) as total_customers,
    (SELECT COUNT(*) FROM customers WHERE visible_on_leaderboard = TRUE) as visible_customers;

-- ============================================================================
-- COMMAND 12: Show users in Q's branch
-- ============================================================================
SELECT
    u.email,
    us.is_approved,
    us.visible_on_leaderboard as in_q_branch
FROM auth.users u
JOIN user_status us ON u.id = us.user_id
WHERE us.visible_on_leaderboard = TRUE;

-- ============================================================================
-- If you need to assign specific users by email, use this template:
-- ============================================================================
/*
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