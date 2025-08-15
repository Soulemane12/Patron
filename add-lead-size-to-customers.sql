-- Add lead_size column to customers table
ALTER TABLE public.customers 
ADD COLUMN lead_size text NULL DEFAULT '2GIG';

-- Add constraint to ensure only valid lead sizes
ALTER TABLE public.customers 
ADD CONSTRAINT check_lead_size 
CHECK (lead_size IN ('500MB', '1GIG', '2GIG'));

-- Update existing customers to have 2GIG as default (as requested)
UPDATE public.customers 
SET lead_size = '2GIG' 
WHERE lead_size IS NULL;

-- Insert test customer with 2GIG lead size
INSERT INTO public.customers (
  name, 
  email, 
  phone, 
  service_address, 
  installation_date, 
  installation_time, 
  lead_size,
  status,
  is_referral
) VALUES (
  'John Smith',
  'john.smith@example.com',
  '555-123-4567',
  '123 Main Street, Anytown, CA 90210',
  '2024-01-15',
  '2:00 PM',
  '2GIG',
  'active',
  false
) ON CONFLICT DO NOTHING;

-- Insert another test customer with 1GIG lead size
INSERT INTO public.customers (
  name, 
  email, 
  phone, 
  service_address, 
  installation_date, 
  installation_time, 
  lead_size,
  status,
  is_referral
) VALUES (
  'Sarah Johnson',
  'sarah.johnson@example.com',
  '555-987-6543',
  '456 Oak Avenue, Somewhere, NY 10001',
  '2024-01-20',
  '10:00 AM',
  '1GIG',
  'active',
  true
) ON CONFLICT DO NOTHING;

-- Insert test customer with 500MB lead size
INSERT INTO public.customers (
  name, 
  email, 
  phone, 
  service_address, 
  installation_date, 
  installation_time, 
  lead_size,
  status,
  is_referral
) VALUES (
  'Mike Davis',
  'mike.davis@example.com',
  '555-456-7890',
  '789 Pine Road, Elsewhere, TX 75001',
  '2024-01-25',
  '3:30 PM',
  '500MB',
  'completed',
  false
) ON CONFLICT DO NOTHING;

-- Create index for better performance on lead_size queries
CREATE INDEX IF NOT EXISTS idx_customers_lead_size ON public.customers(lead_size);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
