'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountPaused, setAccountPaused] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('message') === 'account_paused') {
      setAccountPaused(true);
    }

    // Handle magic link callback — exchange token for session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await checkApprovalAndRedirect(session.user.id);
      }
    });

    // Listen for auth state changes (magic link sign-in)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await checkApprovalAndRedirect(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkApprovalAndRedirect(userId: string) {
    try {
      const res = await fetch('/api/check-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isPaused) {
          await supabase.auth.signOut();
          window.location.href = '/login?message=account_paused';
          return;
        }
        if (!data.isApproved) {
          await supabase.auth.signOut();
          setError('Your account is pending approval. Please contact the administrator.');
          return;
        }
      }
    } catch {
      // fallback: allow in if check fails
    }
    window.location.href = '/';
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // only allow existing approved users
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold text-blue-800 mb-4 text-center">Log in</h1>

        {sent ? (
          <div className="text-center space-y-3">
            <div className="text-green-600 font-medium">Check your email!</div>
            <p className="text-sm text-gray-600">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-sm text-blue-600 hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {accountPaused && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-red-800 text-sm">
                  Your account has been paused. Please contact support.
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
                  <span>Sending link...</span>
                </div>
              ) : (
                'Send magic link'
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
