-- Lead Size Options Table
-- This table stores the different lead size options that customers can choose from

-- Create lead_size_options table
CREATE TABLE IF NOT EXISTS public.lead_size_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  size_mb INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS trg_lead_size_options_updated_at ON public.lead_size_options;
CREATE TRIGGER trg_lead_size_options_updated_at
  BEFORE UPDATE ON public.lead_size_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.lead_size_options ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for now)
CREATE POLICY "Allow all operations on lead_size_options" ON public.lead_size_options FOR ALL USING (true);

-- Insert the lead size options
INSERT INTO public.lead_size_options (code, name, size_mb) VALUES
  ('LEAD_500MB', '500MB', 500),
  ('LEAD_1GIG', '1GIG', 1024),
  ('LEAD_2GIG', '2GIG', 2048)
ON CONFLICT (code) DO UPDATE SET
  name = excluded.name,
  size_mb = excluded.size_mb,
  updated_at = NOW();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_lead_size_options_code ON public.lead_size_options(code);
CREATE INDEX IF NOT EXISTS idx_lead_size_options_active ON public.lead_size_options(is_active);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
