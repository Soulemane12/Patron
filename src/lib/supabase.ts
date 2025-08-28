import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Enhanced cross-device and mobile compatible storage implementation
const mobileStorage = {
  getItem: (key: string) => {
    try {
      // For mobile devices, try multiple approaches
      if (typeof window !== 'undefined') {
        // First check localStorage
        const localValue = localStorage.getItem(key);
        if (localValue) return localValue;
        
        // Then check sessionStorage
        const sessionValue = sessionStorage.getItem(key);
        if (sessionValue) return sessionValue;
        
        // Then check cookies as last resort (needed for some mobile browsers)
        const cookies = document.cookie.split('; ');
        const cookie = cookies.find(c => c.startsWith(`${key}=`));
        if (cookie) {
          return cookie.split('=')[1];
        }
      }
      return null;
    } catch (e) {
      console.warn('Storage access error:', e);
      return null;
    }
  },
  
  setItem: (key: string, value: string) => {
    try {
      // Store in all possible places for maximum compatibility
      if (typeof window !== 'undefined') {
        // Primary storage in localStorage
        try { localStorage.setItem(key, value); } catch (e) { console.warn('localStorage error:', e); }
        
        // Backup in sessionStorage
        try { sessionStorage.setItem(key, value); } catch (e) { console.warn('sessionStorage error:', e); }
        
        // Last resort: cookies (critical for iOS WebKit)
        try {
          // Set a long expiration for better persistence
          const yearFromNow = new Date();
          yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);
          
          // Use a more permissive SameSite setting for better mobile support
          document.cookie = `${key}=${encodeURIComponent(value)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
          
          // Also set a simpler flag cookie that's easier to detect
          document.cookie = `${key}-exists=true; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
        } catch (e) { 
          console.warn('Cookie error:', e); 
        }
      }
    } catch (error) {
      console.error('Storage error:', error);
    }
  },
  
  removeItem: (key: string) => {
    try {
      if (typeof window !== 'undefined') {
        // Clear from all storage types
        try { localStorage.removeItem(key); } catch (e) {}
        try { sessionStorage.removeItem(key); } catch (e) {}
        
        // Clear cookies
        try {
          document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
          document.cookie = `${key}-exists=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        } catch (e) {}
      }
    } catch (error) {
      console.error('Storage removal error:', error);
    }
  }
};

// Create Supabase client with enhanced mobile support
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'patron-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: true, // Enable debug to help diagnose mobile issues
    storage: mobileStorage
    // Allow multiple sessions per user is enabled by default in the latest version
  },
  // Add global error handler
  global: {
    headers: {
      'X-Client-Info': 'supabase-js/2.53.0'
    }
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