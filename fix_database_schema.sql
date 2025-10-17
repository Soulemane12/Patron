-- First, add the missing column to customers table
ALTER TABLE customers 
ADD COLUMN visible_on_leaderboard BOOLEAN DEFAULT TRUE;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_customers_visible ON customers(visible_on_leaderboard);

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

-- Create indexes for user_status table
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_visible ON user_status(visible_on_leaderboard);
CREATE INDEX IF NOT EXISTS idx_user_status_approved ON user_status(is_approved);
CREATE INDEX IF NOT EXISTS idx_user_status_paused ON user_status(is_paused);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_status table
DROP TRIGGER IF EXISTS update_user_status_updated_at ON user_status;
CREATE TRIGGER update_user_status_updated_at 
    BEFORE UPDATE ON user_status 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and create new one
DROP POLICY IF EXISTS "Admin can manage user status" ON user_status;
CREATE POLICY "Admin can manage user status" ON user_status
    FOR ALL USING (true);
