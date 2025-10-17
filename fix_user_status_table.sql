-- ============================================================================
-- FIX USER_STATUS TABLE - CREATE TABLE AND SETUP
-- ============================================================================
-- This script specifically creates the user_status table
-- Run this only if the diagnostic shows the table is missing

-- Create the trigger function first
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Method 1: Create user_status table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status'
    ) THEN
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
        RAISE NOTICE 'SUCCESS: Created user_status table';
    ELSE
        RAISE NOTICE 'INFO: user_status table already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to create user_status table: %', SQLERRM;
END
$$;

-- Method 2: Set up RLS and policies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
        -- Enable RLS
        ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Admin can manage user status" ON user_status;

        -- Create new policy
        CREATE POLICY "Admin can manage user status" ON user_status FOR ALL USING (true);

        RAISE NOTICE 'SUCCESS: Set up RLS and policies for user_status table';
    ELSE
        RAISE NOTICE 'WARNING: Cannot set up policies - user_status table does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to set up policies: %', SQLERRM;
END
$$;

-- Method 3: Create indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
        CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_status_visible ON user_status(visible_on_leaderboard);
        CREATE INDEX IF NOT EXISTS idx_user_status_approved ON user_status(is_approved);
        CREATE INDEX IF NOT EXISTS idx_user_status_paused ON user_status(is_paused);
        RAISE NOTICE 'SUCCESS: Created indexes for user_status table';
    ELSE
        RAISE NOTICE 'WARNING: Cannot create indexes - user_status table does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to create indexes: %', SQLERRM;
END
$$;

-- Method 4: Set up triggers
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
        DROP TRIGGER IF EXISTS update_user_status_updated_at ON user_status;
        CREATE TRIGGER update_user_status_updated_at
            BEFORE UPDATE ON user_status
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'SUCCESS: Created trigger for user_status table';
    ELSE
        RAISE NOTICE 'WARNING: Cannot create trigger - user_status table does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to create trigger: %', SQLERRM;
END
$$;

-- Verify the result
SELECT 'VERIFICATION: USER_STATUS TABLE AFTER FIX' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_status'
ORDER BY ordinal_position;

-- Check if we can insert a test record
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_status') THEN
        -- Get a user ID to test with
        SELECT id INTO test_user_id FROM auth.users LIMIT 1;

        IF test_user_id IS NOT NULL THEN
            -- Try to insert a test record
            INSERT INTO user_status (user_id, is_approved, visible_on_leaderboard)
            VALUES (test_user_id, TRUE, TRUE)
            ON CONFLICT (user_id) DO UPDATE SET
                is_approved = EXCLUDED.is_approved,
                visible_on_leaderboard = EXCLUDED.visible_on_leaderboard;

            RAISE NOTICE 'SUCCESS: Test record inserted/updated in user_status table';
        ELSE
            RAISE NOTICE 'WARNING: No users found in auth.users to test with';
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to insert test record: %', SQLERRM;
END
$$;