import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Detect Safari mobile specifically
const isSafariMobile = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
};

// Enhanced cross-device and mobile compatible storage implementation
// with special handling for Safari mobile
const mobileStorage = {
  getItem: (key: string) => {
    try {
      if (typeof window !== 'undefined') {
        // For Safari mobile, prioritize cookies first due to storage restrictions
        if (isSafariMobile()) {
          console.log('Safari mobile detected, checking cookies first');
          const cookies = document.cookie.split('; ');
          const cookie = cookies.find(c => c.startsWith(`${key}=`));
          if (cookie) {
            const value = decodeURIComponent(cookie.split('=')[1]);
            console.log('Found session in Safari cookie');
            return value;
          }
        }
        
        // First check localStorage (may fail in Safari private browsing)
        try {
          const localValue = localStorage.getItem(key);
          if (localValue) return localValue;
        } catch (e) {
          console.warn('localStorage access denied (private browsing?):', e);
        }
        
        // Then check sessionStorage
        try {
          const sessionValue = sessionStorage.getItem(key);
          if (sessionValue) return sessionValue;
        } catch (e) {
          console.warn('sessionStorage access denied:', e);
        }
        
        // Then check cookies for non-Safari or as fallback
        if (!isSafariMobile()) {
          const cookies = document.cookie.split('; ');
          const cookie = cookies.find(c => c.startsWith(`${key}=`));
          if (cookie) {
            return decodeURIComponent(cookie.split('=')[1]);
          }
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
      if (typeof window !== 'undefined') {
        console.log('Storing session, Safari mobile:', isSafariMobile());
        
        // For Safari mobile, set cookies with special configuration
        if (isSafariMobile()) {
          try {
            const yearFromNow = new Date();
            yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);
            
            // Try Secure + SameSite=None first (required for some iOS versions)
            if (location.protocol === 'https:') {
              document.cookie = `${key}=${encodeURIComponent(value)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=None; Secure`;
              console.log('Set secure Safari cookie');
            } else {
              // Fallback for non-HTTPS
              document.cookie = `${key}=${encodeURIComponent(value)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
              console.log('Set Safari cookie (non-secure)');
            }
          } catch (e) {
            console.warn('Safari cookie setting failed:', e);
          }
        }
        
        // Primary storage in localStorage (may fail in Safari private browsing)
        try { 
          localStorage.setItem(key, value); 
          console.log('Stored in localStorage');
        } catch (e) { 
          console.warn('localStorage error (private browsing?):', e); 
        }
        
        // Backup in sessionStorage
        try { 
          sessionStorage.setItem(key, value); 
          console.log('Stored in sessionStorage');
        } catch (e) { 
          console.warn('sessionStorage error:', e); 
        }
        
        // Regular cookies for non-Safari mobile browsers
        if (!isSafariMobile()) {
          try {
            const yearFromNow = new Date();
            yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);
            document.cookie = `${key}=${encodeURIComponent(value)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
            document.cookie = `${key}-exists=true; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
            console.log('Stored in regular cookies');
          } catch (e) { 
            console.warn('Cookie error:', e); 
          }
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
        
        // Clear all possible cookie variations
        try {
          document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
          document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax;`;
          document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=None; Secure;`;
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
    flowType: 'implicit', // Change to implicit for better mobile support
    debug: true, // Enable debug to help diagnose mobile issues
    storage: mobileStorage
  },
  // Add global error handler and timeout
  global: {
    headers: {
      'X-Client-Info': 'supabase-js/2.53.0'
    },
    fetch: (input, init) => {
      // Add timeout to all requests for mobile
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      return fetch(input, {
        ...init,
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));
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