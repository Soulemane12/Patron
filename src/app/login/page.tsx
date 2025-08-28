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
    
    console.log('Login attempt started on mobile device');
    
    try {
      // Add a timeout to prevent hanging indefinitely
      const loginPromise = supabase.auth.signInWithPassword({ 
        email, 
        password
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout')), 30000) // 30 second timeout
      );
      
      console.log('Attempting login with timeout protection...');
      const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;
      
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
        
        // Add a small delay to ensure session is fully processed
        setTimeout(() => {
          console.log('Redirecting to dashboard...');
          window.location.replace('/'); // Use replace instead of href for better mobile support
        }, 500);
        
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