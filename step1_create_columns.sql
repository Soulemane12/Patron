-- ============================================================================
-- STEP 1: CREATE MISSING COLUMNS AND TABLES
-- ============================================================================
-- Run this script FIRST, then run the other steps
-- This creates all the missing structures without referencing them

-- Create the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add the missing column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS visible_on_leaderboard BOOLEAN DEFAULT TRUE;

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

SELECT 'Step 1 Complete: All structures created' as status;