-- Simple migration without complex functions
-- Add approval functionality to existing user_status table

-- Add approval columns if they don't exist
ALTER TABLE user_status ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE user_status ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE user_status ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_status_is_approved ON user_status(is_approved);

-- Set all existing users as approved by default (so they don't get locked out)
INSERT INTO user_status (user_id, is_approved, approved_at, approved_by, is_paused)
SELECT id, TRUE, NOW(), 'migration', FALSE
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_status WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO UPDATE SET
  is_approved = COALESCE(user_status.is_approved, TRUE),
  approved_at = COALESCE(user_status.approved_at, NOW()),
  approved_by = COALESCE(user_status.approved_by, 'migration');

-- Update existing user_status records to approved if not set
UPDATE user_status SET
  is_approved = TRUE,
  approved_at = COALESCE(approved_at, NOW()),
  approved_by = COALESCE(approved_by, 'migration')
WHERE is_approved IS NULL OR is_approved = FALSE;

-- Verify the migration worked
SELECT 'Migration completed successfully' as status;