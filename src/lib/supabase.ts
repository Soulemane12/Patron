import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  service_address: string;
  installation_date: string;
  installation_time: string;
  created_at: string;
  updated_at: string;
  status?: 'active' | 'cancelled' | 'completed';
}

export interface EmailNotification {
  id: string;
  customer_id: string;
  notification_type: 'day_before' | 'day_of' | 'follow_up';
  sent_at: string;
  email_content: string;
  status: string;
} 