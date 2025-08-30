-- Create table for storing draft customer data
-- This ensures form data persists 100% reliably across all browsers and devices

CREATE TABLE IF NOT EXISTS customer_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_text TEXT,
  formatted_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_customer_drafts_user_id ON customer_drafts(user_id);

-- Create index for updated_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_customer_drafts_updated_at ON customer_drafts(updated_at);

-- Enable Row Level Security
ALTER TABLE customer_drafts ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only access their own drafts
CREATE POLICY "Users can manage their own drafts" ON customer_drafts
  FOR ALL USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_customer_drafts_updated_at
  BEFORE UPDATE ON customer_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_drafts_updated_at();

-- Optional: Create function to cleanup old drafts (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_drafts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM customer_drafts 
  WHERE updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON customer_drafts TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
