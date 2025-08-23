-- Migration script to add user isolation to existing customers table
-- Run this in your Supabase SQL editor after the main schema

-- Add user_id column to existing customers table
ALTER TABLE customers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add missing columns that might not exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_referral BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_source VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lead_size VARCHAR(10) DEFAULT '2GIG';

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;
DROP POLICY IF EXISTS "Allow all operations on email_notifications" ON email_notifications;

-- Create new policies for user data isolation
CREATE POLICY "Users can view own customers" ON customers 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers" ON customers 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers" ON customers 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers" ON customers 
  FOR DELETE USING (auth.uid() = user_id);

-- Email notifications policies (users can only see notifications for their customers)
CREATE POLICY "Users can view own email notifications" ON email_notifications 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = email_notifications.customer_id 
      AND customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own email notifications" ON email_notifications 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = email_notifications.customer_id 
      AND customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own email notifications" ON email_notifications 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = email_notifications.customer_id 
      AND customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own email notifications" ON email_notifications 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = email_notifications.customer_id 
      AND customers.user_id = auth.uid()
    )
  );

-- IMPORTANT: You need to manually assign existing customers to users
-- Run this query to see existing customers that need user_id assignment:
-- SELECT id, name, email, created_at FROM customers WHERE user_id IS NULL;

-- To assign existing customers to a specific user (replace 'USER_EMAIL' with the actual email):
-- UPDATE customers 
-- SET user_id = (SELECT id FROM auth.users WHERE email = 'USER_EMAIL') 
-- WHERE user_id IS NULL;

-- Make user_id NOT NULL after assigning all existing customers
-- ALTER TABLE customers ALTER COLUMN user_id SET NOT NULL;
