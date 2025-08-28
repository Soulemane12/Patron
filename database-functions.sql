-- Database functions for Patron app
-- Run this in your Supabase SQL editor to create the required functions

-- Function to create the user_status table if it doesn't exist and ensure all columns are present
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
      CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
      
      -- Enable RLS on user_status
      ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for user_status (admin only)
      DROP POLICY IF EXISTS "Admin can manage user_status" ON user_status;
      CREATE POLICY "Admin can manage user_status" ON user_status 
        FOR ALL USING (true);
    ';
  ELSE
    -- Table exists, check if all required columns exist and add if missing
    
    -- Check and add paused_by column if missing
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'user_status' AND column_name = 'paused_by'
    ) THEN
      EXECUTE 'ALTER TABLE user_status ADD COLUMN paused_by TEXT';
    END IF;
    
    -- Check and add paused_at column if missing
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'user_status' AND column_name = 'paused_at'
    ) THEN
      EXECUTE 'ALTER TABLE user_status ADD COLUMN paused_at TIMESTAMP WITH TIME ZONE';
    END IF;
    
    -- Check and add created_at column if missing
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'user_status' AND column_name = 'created_at'
    ) THEN
      EXECUTE 'ALTER TABLE user_status ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;
    
    -- Check and add updated_at column if missing
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'user_status' AND column_name = 'updated_at'
    ) THEN
      EXECUTE 'ALTER TABLE user_status ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;
    
    -- Ensure index exists
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id)';
    
    -- Ensure RLS is enabled
    EXECUTE 'ALTER TABLE user_status ENABLE ROW LEVEL SECURITY';
    
    -- Recreate policy to ensure it exists
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage user_status" ON user_status';
    EXECUTE 'CREATE POLICY "Admin can manage user_status" ON user_status FOR ALL USING (true)';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION create_user_status_if_not_exists() TO service_role;
