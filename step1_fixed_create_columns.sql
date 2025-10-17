-- ============================================================================
-- STEP 1 FIXED: CREATE MISSING COLUMNS AND TABLES
-- ============================================================================
-- This version forces column creation and shows you what's happening

-- Create the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Check if column exists and show result
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'visible_on_leaderboard'
    ) THEN
        RAISE NOTICE 'Column visible_on_leaderboard already exists in customers table';
    ELSE
        RAISE NOTICE 'Column visible_on_leaderboard does NOT exist, creating it now...';
        ALTER TABLE customers ADD COLUMN visible_on_leaderboard BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Column visible_on_leaderboard created successfully!';
    END IF;
END
$$;

-- Force create the column (will error if it exists, which is fine)
ALTER TABLE customers ADD COLUMN visible_on_leaderboard BOOLEAN DEFAULT TRUE;

-- Create user_status table
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

-- Enable RLS
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Create basic policy (drop first if exists)
DROP POLICY IF EXISTS "Admin can manage user status" ON user_status;
CREATE POLICY "Admin can manage user status" ON user_status FOR ALL USING (true);

-- Show final table structure
SELECT 'FINAL CUSTOMERS TABLE STRUCTURE:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

SELECT 'Step 1 Complete: All structures created' as status;