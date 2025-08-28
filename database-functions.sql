-- Database functions for Patron app
-- Run this in your Supabase SQL editor to create the required functions

-- Function to create the user_status table if it doesn't exist
CREATE OR REPLACE FUNCTION create_user_status_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_status'
  ) THEN
    -- Create the table
    EXECUTE '
      CREATE TABLE user_status (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
        is_paused BOOLEAN DEFAULT false,
        paused_at TIMESTAMP WITH TIME ZONE,
        paused_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create index for user_status
      CREATE INDEX idx_user_status_user_id ON user_status(user_id);
      
      -- Enable RLS on user_status
      ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for user_status (admin only)
      CREATE POLICY "Admin can manage user_status" ON user_status 
        FOR ALL USING (true);
        
      -- Create trigger to automatically update updated_at
      CREATE TRIGGER update_user_status_updated_at
        BEFORE UPDATE ON user_status
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION create_user_status_if_not_exists() TO service_role;
