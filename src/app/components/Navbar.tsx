'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut({ scope: 'global' });
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
      window.location.replace('/login?fresh=true&signed_out=true');
    } catch {
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/login?fresh=true&signed_out=true');
    }
  }

  return (
    <nav className="bg-white shadow-md rounded-lg mb-6 p-2 flex justify-end">
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-600 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 disabled:opacity-50"
      >
        {isSigningOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </nav>
  );
}
