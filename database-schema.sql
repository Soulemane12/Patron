-- Customer Management System Database Schema
-- Run this in your Supabase SQL editor

-- Create customers table with user_id for data isolation
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  service_address TEXT NOT NULL,
  installation_date DATE NOT NULL,
  installation_time VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed', 'paid', 'not_paid')),
  is_referral BOOLEAN DEFAULT false,
  referral_source VARCHAR(255),
  lead_size VARCHAR(10) DEFAULT '2GIG',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create email notifications table to track sent emails
CREATE TABLE email_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'day_before', 'day_of', 'follow_up'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email_content TEXT,
  status VARCHAR(50) DEFAULT 'sent'
);

-- Create index for better performance
CREATE INDEX idx_customers_installation_date ON customers(installation_date);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_email_notifications_customer_id ON email_notifications(customer_id);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for user data isolation
-- Users can only see, insert, update, and delete their own customers
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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 