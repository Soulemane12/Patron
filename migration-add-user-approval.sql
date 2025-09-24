-- Add approval functionality to existing user_status table
ALTER TABLE user_status ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE user_status ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE user_status ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT NULL;

-- Create or replace function to manage user status with approval
CREATE OR REPLACE FUNCTION create_user_status_with_approval_if_not_exists()
RETURNS VOID AS $$
BEGIN
  -- Create user_status table if it doesn't exist
  CREATE TABLE IF NOT EXISTS user_status (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    is_paused BOOLEAN DEFAULT FALSE,
    paused_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    paused_by TEXT DEFAULT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    approved_by TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Add columns if they don't exist (for existing tables)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_status' AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE user_status ADD COLUMN is_approved BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_status' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE user_status ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_status' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE user_status ADD COLUMN approved_by TEXT DEFAULT NULL;
  END IF;

  -- Create index on user_id for performance
  CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_status_is_approved ON user_status(is_approved);
  CREATE INDEX IF NOT EXISTS idx_user_status_is_paused ON user_status(is_paused);

END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT create_user_status_with_approval_if_not_exists();

-- Set all existing users as approved by default (so they don't get locked out)
INSERT INTO user_status (user_id, is_approved, approved_at, approved_by)
SELECT id, TRUE, NOW(), 'migration'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_status)
ON CONFLICT (user_id) DO UPDATE SET
  is_approved = TRUE,
  approved_at = COALESCE(user_status.approved_at, NOW()),
  approved_by = COALESCE(user_status.approved_by, 'migration');

-- Update existing user_status records to approved if not set
UPDATE user_status SET
  is_approved = TRUE,
  approved_at = COALESCE(approved_at, NOW()),
  approved_by = COALESCE(approved_by, 'migration')
WHERE is_approved IS NULL OR is_approved = FALSE;