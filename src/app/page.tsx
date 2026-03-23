'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from './components/Navbar';

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      } else {
        setEmail(session.user.email ?? null);
      }
    });
  }, [router]);

  if (!email) return null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <Navbar />
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h1 className="text-2xl font-semibold text-blue-800 mb-2">You're signed in</h1>
          <p className="text-gray-600">{email}</p>
        </div>
      </div>
    </main>
  );
}
