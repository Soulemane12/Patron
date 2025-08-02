'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from './components/LoadingSpinner';
import { supabase, Customer } from '../lib/supabase';

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  serviceAddress: string;
  installationDate: string;
  installationTime: string;
}

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [formattedInfo, setFormattedInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState('');
  const [isRunningCron, setIsRunningCron] = useState(false);
  const [cronStatus, setCronStatus] = useState('');

  // Calculate email notification dates
  const getEmailSchedule = (installationDate: string) => {
    const installDate = new Date(installationDate);
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

  const sendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailStatus('');
    
    try {
      const testCustomer = {
        name: "Test Customer",
        email: "test@example.com",
        phone: "555-123-4567",
        service_address: "123 Test Street, Test City, NC 27302",
        installation_date: "2024-12-25",
        installation_time: "2:00 PM"
      };

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: testCustomer,
          notificationType: 'day_before'
        }),
      });

      if (response.ok) {
        setTestEmailStatus('✅ Test email sent successfully! Check your inbox.');
      } else {
        const errorData = await response.json();
        setTestEmailStatus(`❌ Failed to send test email: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      setTestEmailStatus(`❌ Error sending test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSendingTestEmail(false);
    }
  };
  
  const runCronJob = async () => {
    setIsRunningCron(true);
    setCronStatus('');
    
    try {
      const response = await fetch('/api/cron/check-installations');
      
      if (response.ok) {
        const data = await response.json();
        setCronStatus(`✅ Cron job executed successfully! Found: ${data.today} installations today, ${data.tomorrow} tomorrow, ${data.followUp} follow-ups.`);
      } else {
        const errorData = await response.json();
        setCronStatus(`❌ Failed to run cron job: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      setCronStatus(`❌ Error running cron job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunningCron(false);
    }
  };

  const formatCustomerInfo = async () => {
    if (!inputText.trim()) {
      setError('Please enter customer information');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/format-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        throw new Error('Failed to format customer information');
      }

      const data = await response.json();
      setFormattedInfo(data);
      setShowCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setInputText('');
    setFormattedInfo(null);
    setError('');
    setShowCopied(false);
  };

  const saveCustomer = async () => {
    if (!formattedInfo) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([
          {
            name: formattedInfo.name,
            email: formattedInfo.email,
            phone: formattedInfo.phone,
            service_address: formattedInfo.serviceAddress,
            installation_date: formattedInfo.installationDate,
            installation_time: formattedInfo.installationTime,
          },
        ])
        .select();

      if (error) throw error;

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
      loadCustomers();
      clearForm();
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Customer Management System
          </h1>

        {/* Test Email Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Email & Cron Functionality</h2>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <p className="text-black mb-2">Send a test email to verify email configuration:</p>
              <button
                onClick={sendTestEmail}
                disabled={isSendingTestEmail}
                className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSendingTestEmail ? <LoadingSpinner /> : null}
                Send Test Email
              </button>
              {testEmailStatus && (
                <p className={`mt-2 ${testEmailStatus.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                  {testEmailStatus}
                </p>
              )}
            </div>
            <div className="flex-1">
              <p className="text-black mb-2">Run cron job manually to check for installations:</p>
              <button
                onClick={runCronJob}
                disabled={isRunningCron}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRunningCron ? <LoadingSpinner /> : null}
                Run Cron Job Now
              </button>
              {cronStatus && (
                <p className={`mt-2 ${cronStatus.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                  {cronStatus}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <p className="text-black text-sm">
              <strong>Note:</strong> The cron job checks for customers with installations tomorrow (day before), today (day of), and 10 days ago (follow-up).
              Current server date: <strong>{new Date().toLocaleDateString()}</strong>
            </p>
          </div>
        </div>

          {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Add Customer Information</h2>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste customer information in any format..."
            className="w-full h-32 p-4 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
          <div className="flex gap-4 mt-4">
                <button
              onClick={formatCustomerInfo}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? <LoadingSpinner /> : null}
              Format Information
                </button>
                <button
              onClick={clearForm}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Clear
                </button>
              </div>
          {error && <p className="text-red-600 mt-2">{error}</p>}
        </div>

        {/* Formatted Information */}
        {formattedInfo && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Formatted Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formattedInfo.name}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, name: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formattedInfo.email}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, email: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formattedInfo.phone}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, phone: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Address</label>
                <input
                  type="text"
                  value={formattedInfo.serviceAddress}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, serviceAddress: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
                <input
                  type="date"
                  value={formattedInfo.installationDate}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, installationDate: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installation Time</label>
                <input
                  type="text"
                  value={formattedInfo.installationTime}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, installationTime: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={saveCustomer}
              disabled={isSaving}
              className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <LoadingSpinner /> : null}
              Save Customer
            </button>
            {showSaved && (
              <p className="text-green-600 mt-2">Customer saved successfully!</p>
            )}
          </div>
        )}

        {/* Saved Customers */}
        {customers.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Saved Customers</h2>
            <div className="space-y-4">
              {customers.map((customer) => {
                const emailSchedule = getEmailSchedule(customer.installation_date);
                return (
                  <div key={customer.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                <div>
                        <h3 className="font-semibold text-lg text-black">{customer.name}</h3>
                        <p className="text-black">{customer.email}</p>
                        <p className="text-black">{customer.phone}</p>
                        <p className="text-black">{customer.service_address}</p>
                        <p className="text-black">
                          Installation: {new Date(customer.installation_date).toLocaleDateString()} at {customer.installation_time}
                        </p>
                    </div>
                      <button
                        onClick={() => deleteCustomer(customer.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                    
                    {/* Email Schedule */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <h4 className="font-medium text-black mb-2">Email Notifications:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                          <span className="text-black">Day Before:</span>
                          <span className="font-medium text-black">{emailSchedule.dayBefore}</span>
                    </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                          <span className="text-black">Day Of:</span>
                          <span className="font-medium text-black">{emailSchedule.dayOf}</span>
                    </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-blue-400 rounded-full"></span>
                          <span className="text-black">Follow Up:</span>
                          <span className="font-medium text-black">{emailSchedule.followUp}</span>
                  </div>
                </div>
                    </div>
                  </div>
                );
              })}
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
