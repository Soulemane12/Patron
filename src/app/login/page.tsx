'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountPaused, setAccountPaused] = useState(false);

  // Check for messages in URL and manage session
  useEffect(() => {
    // Handle URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('message') === 'account_paused') {
      setAccountPaused(true);
    }
    
    // Clean session selectively when needed
    const handleSession = async () => {
      try {
        // Handle fresh login (usually from sign out)
        if (urlParams.get('fresh') === 'true' || urlParams.get('signed_out') === 'true') {
          console.log('Fresh login detected, clearing all session data thoroughly...');
          
          // Clear all storage completely for a clean sign out
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch (e) {
            console.warn('Storage clear error:', e);
          }
          
          // Clear all possible auth cookies aggressively
          const cookiesToClear = [
            'patron-auth',
            'patron-auth-exists', 
            'patron-safari-session',
            'supabase-auth-token',
            'sb-auth-token'
          ];

          cookiesToClear.forEach(cookieName => {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=None; Secure;`;
          });
          
          console.log('All session data cleared for fresh sign out');
        }
        
        // Attempt auto-login from cookies for mobile devices
        const attemptCookieLogin = async () => {
          const cookies = document.cookie.split(';');
          const authCookie = cookies.find(c => c.trim().startsWith('patron-auth='));
          
          // If we have an auth cookie but no localStorage session
          if (authCookie && !localStorage.getItem('patron-auth')) {
            console.log('Found auth cookie, attempting to restore session...');
            try {
              await supabase.auth.getSession();
            } catch (e) {
              console.warn('Could not restore session from cookie:', e);
            }
          }
        };
        
        // Try to recover session from cookies (helps mobile devices)
        if (!urlParams.get('fresh')) {
          attemptCookieLogin();
        }
      } catch (err) {
        console.error('Error during session handling:', err);
      }
    };
    
    handleSession();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    console.log('Login attempt started');
    
    // Bulletproof login with retry logic
    const performLogin = async (attemptNumber = 1): Promise<any> => {
      const maxAttempts = 3;
      const baseTimeout = 20000; // 20 seconds base timeout
      const currentTimeout = baseTimeout + (attemptNumber - 1) * 10000; // Progressive timeout
      
      console.log(`Login attempt ${attemptNumber}/${maxAttempts} with ${currentTimeout/1000}s timeout`);
      
      try {
        const loginPromise = supabase.auth.signInWithPassword({ 
          email, 
          password
        });
        
        // Only use timeout for first few attempts
        if (attemptNumber < maxAttempts) {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Login timeout after ${currentTimeout/1000}s`)), currentTimeout)
          );
          return await Promise.race([loginPromise, timeoutPromise]);
        } else {
          // Final attempt - no timeout, wait as long as needed
          console.log('Final login attempt - removing timeout restrictions...');
          return await loginPromise;
        }
        
      } catch (error) {
        console.warn(`Login attempt ${attemptNumber} failed:`, error);
        
        // Don't retry for credential errors
        if (error instanceof Error && (
          error.message?.includes('Invalid login credentials') ||
          error.message?.includes('Email not confirmed') ||
          error.message?.includes('too many requests')
        )) {
          throw error;
        }
        
        if (attemptNumber < maxAttempts) {
          // Retry with delay for timeout/network errors
          const delay = 2000 * attemptNumber; // 2s, 4s delays
          console.log(`Retrying login in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return performLogin(attemptNumber + 1);
        } else {
          throw error;
        }
      }
    };
    
    try {
      console.log('Starting bulletproof login process...');
      const { data, error } = await performLogin();
      
      if (error) {
        console.error('Login error:', error);
        
        // More specific error handling
        if (error.message?.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check and try again.');
        } else if (error.message?.includes('timeout') || error.message?.includes('network')) {
          setError('Connection timeout. Please check your internet and try again.');
        } else if (error.message?.includes('Email not confirmed')) {
          setError('Please check your email and confirm your account first.');
        } else {
          setError(`Login failed: ${error.message}`);
        }
        setLoading(false);
        return;
      }
      
      console.log('Login response received:', data?.session ? 'Session found' : 'No session');
      
      if (data?.session && data?.user) {
        console.log('Login successful! User:', data.user.email);
        
        // Force a complete session refresh to ensure it's properly stored
        try {
          await supabase.auth.getSession();
          console.log('Session refreshed successfully');
        } catch (refreshError) {
          console.warn('Session refresh failed:', refreshError);
        }
        
        // Force session to be immediately available for main page
        try {
          // Trigger auth state change listeners
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('Verified session is available for handoff');
          }
        } catch (e) {
          console.warn('Session verification failed:', e);
        }
        
        // Enhanced cross-browser session persistence and redirect
        const isSafariMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        console.log(`Browser detection: Safari Mobile: ${isSafariMobile}, iOS: ${isIOS}, Mobile: ${isMobile}`);
        
        // Enhanced session storage for all browsers
        try {
          // Store in multiple places for maximum compatibility
          const timestamp = Date.now().toString();
          localStorage.setItem('patron-login-success', timestamp);
          sessionStorage.setItem('patron-session-active', timestamp);
          localStorage.setItem('patron-user-email', data.user.email);
          localStorage.setItem('patron-user-id', data.user.id);
          
          // Enhanced cookie storage for all mobile browsers
          const yearFromNow = new Date();
          yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);
          
          if (location.protocol === 'https:') {
            document.cookie = `patron-login-token=${encodeURIComponent(data.session.access_token)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=None; Secure`;
            document.cookie = `patron-login-timestamp=${timestamp}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=None; Secure`;
            if (isSafariMobile || isIOS) {
              document.cookie = `patron-safari-session=${encodeURIComponent(data.session.access_token)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=None; Secure`;
            }
          } else {
            document.cookie = `patron-login-token=${encodeURIComponent(data.session.access_token)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
            document.cookie = `patron-login-timestamp=${timestamp}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
            if (isSafariMobile || isIOS) {
              document.cookie = `patron-safari-session=${encodeURIComponent(data.session.access_token)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
            }
          }
          console.log('Enhanced session storage completed with timestamp:', timestamp);
        } catch (e) {
          console.warn('Could not set enhanced session storage:', e);
        }
        
        // Wait for session to fully process before redirect
        let redirectDelay = 800; // Default
        if (isSafariMobile) {
          redirectDelay = 1200; // Extra time for Safari mobile
        } else if (isIOS || isMobile) {
          redirectDelay = 1000; // Extra time for mobile devices
        }
        
        console.log(`Using ${redirectDelay}ms redirect delay for this browser`);
        
        setTimeout(() => {
          console.log('Redirecting to dashboard with enhanced session...');
          // Use the most reliable redirect method
          try {
            window.location.replace('/');
          } catch (e) {
            console.warn('Replace failed, trying href:', e);
            window.location.href = '/';
          }
        }, redirectDelay);
        
      } else {
        console.error('Login succeeded but no session/user found');
        setError('Login failed - no session created. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Unexpected login error:', err);
      
      if (err.message === 'Login timeout') {
        setError('Login is taking too long. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold text-blue-800 mb-4 text-center">Log in</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {accountPaused && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-800 text-sm">
                Your account has been paused by an administrator. Please contact support for assistance.
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          No account? <a className="text-blue-600 hover:underline" href="/signup">Sign up</a>
        </p>
      </div>
    </main>
  );
}