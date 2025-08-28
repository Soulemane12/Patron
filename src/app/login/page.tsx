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
        // Only clear this specific device's session data if fresh=true 
        // This allows other devices to stay logged in with shared accounts
        if (urlParams.get('fresh') === 'true') {
          // Clear only the auth token, not everything
          localStorage.removeItem('patron-auth');
          sessionStorage.removeItem('patron-auth');
          
          // Clear only auth-related cookies
          document.cookie.split(';').forEach(c => {
            const trimmed = c.trim();
            if (trimmed.startsWith('patron-auth=') || 
                trimmed.startsWith('patron-auth-exists=') ||
                trimmed.startsWith('supabase-auth-token=')) {
              document.cookie = trimmed.split('=')[0] + '=;expires=' + new Date().toUTCString() + ';path=/';
            }
          });
          console.log('Session cleaned up for this device');
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
    
    try {
      // Enhanced mobile-friendly login
      const mobileOptions = {
        // Use shorter timeout for mobile devices (prevent waiting too long)
        timeoutInMs: 15000,
        // Cookies for mobile browsers that block localStorage
        useCookies: true
      };
      
      // First check if already logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Already logged in, redirecting...');
        window.location.href = '/';
        return;
      }
      
      // Proceed with login - using options that support mobile devices better
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password
      });
      
      if (error) {
        console.error('Login error:', error);
        // Special handling for mobile-specific issues
        if (error.message?.includes('network') || error.message?.includes('timeout')) {
          setError('Network issue. Please check your connection and try again.');
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }
      
      if (data?.session) {
        console.log('Login successful, storing session...');
        
        // Store session in cookie for better mobile support
        try {
          const yearFromNow = new Date();
          yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);
          document.cookie = `patron-mobile-token=${encodeURIComponent(data.session.access_token)}; expires=${yearFromNow.toUTCString()}; path=/; SameSite=Lax`;
        } catch (e) {
          console.warn('Could not set cookie:', e);
        }
        
        // Use direct page navigation for more reliable redirect
        window.location.href = '/';
      } else {
        // Session not found despite no error
        setError('Login failed. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('An unexpected error occurred. Please try again.');
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
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          No account? <a className="text-blue-600 hover:underline" href="/signup">Sign up</a>
        </p>
      </div>
    </main>
  );
}