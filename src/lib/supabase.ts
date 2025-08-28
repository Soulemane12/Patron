import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Custom cross-device compatible storage implementation
const customStorage = {
  getItem: (key: string) => {
    try {
      // Check localStorage first
      const localValue = localStorage.getItem(key);
      if (localValue) return localValue;
      
      // Then check sessionStorage as fallback
      const sessionValue = sessionStorage.getItem(key);
      return sessionValue;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      // Store in both storages for better cross-device support
      localStorage.setItem(key, value);
      sessionStorage.setItem(key, value);
      
      // Set a cookie for additional persistence
      if (typeof document !== 'undefined') {
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        const expires = new Date(Date.now() + thirtyDays).toUTCString();
        document.cookie = `${key}-exists=true; expires=${expires}; path=/; SameSite=Strict`;
      }
    } catch (error) {
      console.error('Storage error:', error);
    }
  },
  removeItem: (key: string) => {
    try {
      // Clear from all storage types
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
      
      // Clear the cookie
      if (typeof document !== 'undefined') {
        document.cookie = `${key}-exists=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
      }
    } catch (error) {
      console.error('Storage removal error:', error);
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'patron-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: false,
    storage: customStorage
  }
});

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  service_address: string;
  installation_date: string;
  installation_time: string;
  created_at: string;
  updated_at: string;
  status?: 'active' | 'cancelled' | 'completed' | 'paid' | 'not_paid';
  is_referral?: boolean;
  referral_source?: string;
  lead_size?: '500MB' | '1GIG' | '2GIG';
}

export interface EmailNotification {
  id: string;
  customer_id: string;
  notification_type: 'day_before' | 'day_of' | 'follow_up';
  sent_at: string;
  email_content: string;
  status: string;
} 