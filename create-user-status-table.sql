-- Create user_status table for admin functionality
-- Run this in your Supabase SQL editor

-- Create user_status table
CREATE TABLE IF NOT EXISTS user_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_paused BOOLEAN DEFAULT false,
  paused_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Create policies for user_status table
-- Only admins can view and manage user status
CREATE POLICY "Admins can view all user status" ON user_status 
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert user status" ON user_status 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update user status" ON user_status 
  FOR UPDATE USING (true);

CREATE POLICY "Admins can delete user status" ON user_status 
  FOR DELETE USING (true);
