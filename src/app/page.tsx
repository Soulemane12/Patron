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
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState('');
  const [cronSchedule, setCronSchedule] = useState('');
  const [newCronSchedule, setNewCronSchedule] = useState('');
  const [cronParts, setCronParts] = useState({
    minute: '0',
    hour: '9'
  });
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState('');

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

  // Convert UTC cron to EST time display
  const utcToEst = (utcCron: string) => {
    const parts = utcCron.split(' ');
    if (parts.length === 5) {
      const minute = parseInt(parts[0]);
      const hour = parseInt(parts[1]);
      // Convert UTC to EST (UTC-5) or EDT (UTC-4)
      const estHour = (hour - 5 + 24) % 24; // EST is UTC-5
      return `${minute} ${estHour} ${parts[2]} ${parts[3]} ${parts[4]}`;
    }
    return utcCron;
  };

  // Convert EST time to UTC cron
  const estToUtc = (estCron: string) => {
    const parts = estCron.split(' ');
    if (parts.length === 5) {
      const minute = parseInt(parts[0]);
      const estHour = parseInt(parts[1]);
      // Convert EST to UTC (EST+5)
      const utcHour = (estHour + 5) % 24;
      return `${minute} ${utcHour} ${parts[2]} ${parts[3]} ${parts[4]}`;
    }
    return estCron;
  };

  const loadCronSchedule = async () => {
    try {
      const response = await fetch('/api/cron/schedule');
      if (response.ok) {
        const data = await response.json();
        const utcSchedule = data.schedule;
        setCronSchedule(utcSchedule);
        // Convert UTC to EST for display
        const estSchedule = utcToEst(utcSchedule);
        setNewCronSchedule(estSchedule);
        
        // Parse the EST schedule into parts
        const parts = estSchedule.split(' ');
        if (parts.length === 5) {
          setCronParts({
            minute: parts[0],
            hour: parts[1]
          });
        }
      }
    } catch (error) {
      console.error('Error loading cron schedule:', error);
    }
  };

  const updateCronSchedule = async () => {
    setIsUpdatingSchedule(true);
    setScheduleStatus('');
    
    try {
      // Build cron string from parts (always daily emails)
      const estCronString = `${cronParts.minute} ${cronParts.hour} * * *`;
      
      // Convert EST input to UTC for storage
      const utcSchedule = estToUtc(estCronString);
      
      const response = await fetch('/api/cron/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schedule: utcSchedule }),
      });

      if (response.ok) {
        const data = await response.json();
        setCronSchedule(data.schedule);
        setNewCronSchedule(estCronString);
        setScheduleStatus('✅ Schedule updated in memory! (This is temporary - will reset on function restart)');
      } else {
        const errorData = await response.json();
        setScheduleStatus(`❌ Failed to update schedule: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      setScheduleStatus(`❌ Error updating schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  // Generate preview of what the cron will do
  const getCronPreview = () => {
    const estCronString = `${cronParts.minute} ${cronParts.hour} * * *`;
    const utcCronString = estToUtc(estCronString);
    
    const preview = `Daily at ${cronParts.hour}:${cronParts.minute.padStart(2, '0')} EST`;
    
    return {
      est: estCronString,
      utc: utcCronString,
      preview: preview
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
    loadCronSchedule();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Customer Management System
        </h1>

        {/* Cron Schedule Management */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Cron Schedule Management</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm">
              <strong>Note:</strong> This is a temporary preview feature. To permanently change the cron schedule, 
              edit the <code className="bg-yellow-100 px-1 rounded">vercel.json</code> file directly.
            </p>
          </div>
          <p className="text-gray-600 mb-4">Current schedule (UTC): <span className="font-mono bg-gray-100 px-2 py-1 rounded">{cronSchedule}</span></p>
          <p className="text-gray-600 mb-2">Current schedule (EST): <span className="font-mono bg-gray-100 px-2 py-1 rounded">{utcToEst(cronSchedule)}</span></p>
          
          {/* Cron Parts Input */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minute</label>
              <input
                type="text"
                value={cronParts.minute}
                onChange={(e) => setCronParts({...cronParts, minute: e.target.value})}
                placeholder="0"
                className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hour (EST)</label>
              <input
                type="text"
                value={cronParts.hour}
                onChange={(e) => setCronParts({...cronParts, hour: e.target.value})}
                placeholder="9"
                className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-center"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-2">Preview:</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">EST Schedule:</span> <span className="font-mono bg-white px-2 py-1 rounded">{getCronPreview().est}</span></p>
              <p><span className="font-medium">UTC Schedule:</span> <span className="font-mono bg-white px-2 py-1 rounded">{getCronPreview().utc}</span></p>
              <p><span className="font-medium">Description:</span> <span className="text-blue-600">{getCronPreview().preview}</span></p>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <button
              onClick={updateCronSchedule}
              disabled={isUpdatingSchedule}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isUpdatingSchedule ? <LoadingSpinner /> : null}
              Update Schedule
            </button>
            <p className="text-xs text-gray-500">Daily email reminders at the specified time (temporary preview)</p>
          </div>
          {scheduleStatus && (
            <p className={`mt-2 ${scheduleStatus.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
              {scheduleStatus}
            </p>
          )}
        </div>

        {/* Test Email Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Email Functionality</h2>
          <p className="text-gray-600 mb-4">Click the button below to send a test email and verify the email system is working.</p>
          <button
            onClick={sendTestEmail}
            disabled={isSendingTestEmail}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
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
                          Installation: {parseDateLocal(customer.installation_date).toLocaleDateString()} at {customer.installation_time}
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
