-- ============================================================================
-- STEP 2: UPDATE DATA AND CREATE INDEXES
-- ============================================================================
-- Run this script AFTER step 1
-- Now we can safely reference the columns that were created in step 1

-- Update all existing customers to be visible
UPDATE customers
SET visible_on_leaderboard = TRUE
WHERE visible_on_leaderboard IS NULL;

-- Set default for future customers
ALTER TABLE customers ALTER COLUMN visible_on_leaderboard SET DEFAULT TRUE;

-- Create all indexes
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_visible ON customers(visible_on_leaderboard);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_visible ON user_status(visible_on_leaderboard);
CREATE INDEX IF NOT EXISTS idx_user_status_approved ON user_status(is_approved);
CREATE INDEX IF NOT EXISTS idx_user_status_paused ON user_status(is_paused);

-- Set up triggers
DROP TRIGGER IF EXISTS update_user_status_updated_at ON user_status;
CREATE TRIGGER update_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

SELECT 'Step 2 Complete: Data updated and indexes created' as status;