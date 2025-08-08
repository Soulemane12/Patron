'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold text-blue-800 mb-4 text-center">Welcome</h1>
        {email ? (
          <div className="space-y-4 text-center">
            <p className="text-black">Signed in as <span className="font-medium">{email}</span></p>
            <button
              onClick={async () => { await supabase.auth.signOut(); location.reload(); }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <a href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Log in</a>
            <a href="/signup" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Sign up</a>
          </div>
        )}
      </div>
    </main>
  );
}

// legacy UI below disabled during DB reset
/*
  // Parse a YYYY-MM-DD string as a local-timezone date (avoids UTC shift)
  const parseDateLocal = (isoDate: string) => new Date(`${isoDate}T00:00:00`);
  const [inputText, setInputText] = useState('');
  const [formattedInfo, setFormattedInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateInstallations, setSelectedDateInstallations] = useState<Customer[]>([]);
  const [activeSection, setActiveSection] = useState<string>('pipeline');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<string>('all');

  // Calculate email notification dates
  const getEmailSchedule = (installationDate: string) => {
    const installDate = parseDateLocal(installationDate);
    const dayBefore = new Date(installDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayOf = new Date(installDate);
    const followUp = new Date(installDate);
    followUp.setDate(followUp.getDate() + 10);

    return {
      dayBefore: dayBefore.toLocaleDateString(),
      dayOf: dayOf.toLocaleDateString(),
      followUp: followUp.toLocaleDateString()
    };
  };

const formatCustomerInfo = async () => {};
const clearForm = () => {};
const saveCustomer = async () => {};
const loadCustomers = async () => {};
const deleteCustomer = async (id: string) => {};
const startEditingCustomer = (customer: any) => {};
const cancelEdit = () => {};
const handleDateClick = (date: Date, installations: any[]) => {};
const handleSectionChange = (section: string) => {};
const updateCustomer = async () => {};
const filterAndSortCustomers = (term: string, filter: string, sort: string, order: 'asc' | 'desc') => {};
const handleSearchChange = (e: any) => {};
const handleSortChange = (e: any) => {};
const toggleSortOrder = () => {};
const handleFilterChange = (e: any) => {};
useEffect(() => {}, []);
useEffect(() => {}, []);
*/
