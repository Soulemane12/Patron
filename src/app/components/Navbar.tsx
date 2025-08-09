'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface NavbarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export default function Navbar({ activeSection, onSectionChange }: NavbarProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed', error);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <nav className="bg-white shadow-md rounded-lg mb-6 overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-2 p-2">
        <div className="flex flex-wrap flex-1">
          <NavItem 
          id="calendar"
          label="Calendar" 
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          }
          isActive={activeSection === 'calendar'}
          onClick={() => onSectionChange('calendar')}
        />
        <NavItem 
          id="pipeline"
          label="Customers" 
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
          }
          isActive={activeSection === 'pipeline'}
          onClick={() => onSectionChange('pipeline')}
        />
        <NavItem 
          id="add"
          label="Add Lead" 
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
          }
          isActive={activeSection === 'add'}
          onClick={() => onSectionChange('add')}
        />
        <NavItem 
          id="stats"
          label="Analytics" 
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          }
          isActive={activeSection === 'stats'}
          onClick={() => onSectionChange('stats')}
        />
        </div>
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium text-gray-700 hover:text-red-600 bg-gray-50 hover:bg-gray-100 rounded-md border border-gray-200 disabled:opacity-50"
          aria-label="Sign out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4.75A1.75 1.75 0 014.75 3h5.5A1.75 1.75 0 0112 4.75v1a.75.75 0 01-1.5 0v-1a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h5.5a.25.25 0 00.25-.25v-1a.75.75 0 011.5 0v1A1.75 1.75 0 0110.25 17h-5.5A1.75 1.75 0 013 15.25V4.75zm12.53 5.47a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 10-1.06 1.06l1.22 1.22H8.75a.75.75 0 000 1.5h4.44l-1.22 1.22a.75.75 0 101.06 1.06l2.5-2.5z" clipRule="evenodd" />
          </svg>
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </nav>
  );
}

interface NavItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ id, label, icon, isActive, onClick }: NavItemProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex flex-col md:flex-row items-center justify-center px-3 py-3 md:px-6 md:py-4 text-xs md:text-sm font-medium transition-colors duration-150 border-b-2 flex-1 ${
        isActive
          ? 'text-blue-600 border-blue-500 bg-blue-50'
          : 'text-gray-700 border-transparent hover:text-blue-500 hover:bg-blue-50'
      }`}
    >
      <span className="mb-1 md:mb-0 md:mr-2">{icon}</span>
      <span>{label}</span>
    </button>
  );
}