-- Create user_status table for Q's branch management
CREATE TABLE IF NOT EXISTS user_status (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_paused BOOLEAN DEFAULT FALSE,
    paused_at TIMESTAMP WITH TIME ZONE,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    visible_on_leaderboard BOOLEAN DEFAULT FALSE, -- This controls Q's branch assignment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_visible ON user_status(visible_on_leaderboard);
CREATE INDEX IF NOT EXISTS idx_user_status_approved ON user_status(is_approved);
CREATE INDEX IF NOT EXISTS idx_user_status_paused ON user_status(is_paused);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_status_updated_at 
    BEFORE UPDATE ON user_status 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admin access (you may need to adjust this based on your auth setup)
CREATE POLICY "Admin can manage user status" ON user_status
    FOR ALL USING (true);

-- If you also need to update customers table to support branch visibility
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS visible_on_leaderboard BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_customers_visible ON customers(visible_on_leaderboard);
