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

-- Function to add a new customer with optimized performance
CREATE OR REPLACE FUNCTION add_customer(
  p_user_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_service_address TEXT,
  p_installation_date DATE,
  p_installation_time TEXT,
  p_status TEXT DEFAULT 'active',
  p_is_referral BOOLEAN DEFAULT false,
  p_referral_source TEXT DEFAULT NULL,
  p_lead_size TEXT DEFAULT '2GIG'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  service_address TEXT,
  installation_date DATE,
  installation_time TEXT,
  status TEXT,
  is_referral BOOLEAN,
  referral_source TEXT,
  lead_size TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO customers (
    user_id,
    name,
    email,
    phone,
    service_address,
    installation_date,
    installation_time,
    status,
    is_referral,
    referral_source,
    lead_size
  ) VALUES (
    p_user_id,
    p_name,
    p_email,
    p_phone,
    p_service_address,
    p_installation_date,
    p_installation_time,
    p_status,
    p_is_referral,
    CASE WHEN p_is_referral THEN p_referral_source ELSE NULL END,
    p_lead_size
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update an existing customer with optimized performance
CREATE OR REPLACE FUNCTION update_customer(
  p_customer_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_service_address TEXT,
  p_installation_date DATE,
  p_installation_time TEXT,
  p_status TEXT DEFAULT 'active',
  p_is_referral BOOLEAN DEFAULT false,
  p_referral_source TEXT DEFAULT NULL,
  p_lead_size TEXT DEFAULT '2GIG'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  service_address TEXT,
  installation_date DATE,
  installation_time TEXT,
  status TEXT,
  is_referral BOOLEAN,
  referral_source TEXT,
  lead_size TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE customers
  SET
    name = p_name,
    email = p_email,
    phone = p_phone,
    service_address = p_service_address,
    installation_date = p_installation_date,
    installation_time = p_installation_time,
    status = p_status,
    is_referral = p_is_referral,
    referral_source = CASE WHEN p_is_referral THEN p_referral_source ELSE NULL END,
    lead_size = p_lead_size,
    updated_at = NOW()
  WHERE id = p_customer_id
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a customer with optimized performance
CREATE OR REPLACE FUNCTION delete_customer(
  p_customer_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM customers
  WHERE id = p_customer_id
  RETURNING 1 INTO deleted_count;
  
  RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all customers for a specific user
CREATE OR REPLACE FUNCTION get_user_customers(
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  service_address TEXT,
  installation_date DATE,
  installation_time TEXT,
  status TEXT,
  is_referral BOOLEAN,
  referral_source TEXT,
  lead_size TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM customers
  WHERE user_id = p_user_id
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to the service role
GRANT EXECUTE ON FUNCTION add_customer(UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_customer(UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION delete_customer(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_customers(UUID) TO service_role;
