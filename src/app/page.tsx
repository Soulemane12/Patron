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

  const formatCustomerInfo = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to format');
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
    setShowSaved(false);
  };

  const saveCustomer = async () => {
    if (!formattedInfo) return;
    
    setIsSaving(true);
    setError('');
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          name: formattedInfo.name,
          email: formattedInfo.email,
          phone: formattedInfo.phone,
          service_address: formattedInfo.serviceAddress,
          installation_date: formattedInfo.installationDate,
          installation_time: formattedInfo.installationTime
        }])
        .select();

      if (error) throw error;
      
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
      clearForm();
      loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('installation_date', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Input Customer Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Information (any format)
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste customer information here...&#10;&#10;Example:&#10;Mauricio Elizondo&#10;mauricio.elizondo333@yahoo.com&#10;980-253-6315&#10;Service address&#10;1307 Montreux Ct&#10;Mebane, NC 27302&#10;Installation&#10;Saturday, August 02, 2025 2-4 p.m."
                    className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-black"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={formatCustomerInfo}
                  disabled={isLoading || !inputText.trim()}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? <LoadingSpinner /> : 'Format Information'}
                </button>
                <button
                  onClick={clearForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Output Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Formatted Information
            </h2>
            
            {formattedInfo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formattedInfo.name}
                      onChange={(e) => setFormattedInfo({...formattedInfo, name: e.target.value})}
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formattedInfo.email}
                      onChange={(e) => setFormattedInfo({...formattedInfo, email: e.target.value})}
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formattedInfo.phone}
                      onChange={(e) => setFormattedInfo({...formattedInfo, phone: e.target.value})}
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Address
                    </label>
                    <textarea
                      value={formattedInfo.serviceAddress}
                      onChange={(e) => setFormattedInfo({...formattedInfo, serviceAddress: e.target.value})}
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                </div>

                  <div className="grid grid-cols-2 gap-4">
                <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Installation Date
                      </label>
                      <input
                        type="text"
                        value={formattedInfo.installationDate}
                        onChange={(e) => setFormattedInfo({...formattedInfo, installationDate: e.target.value})}
                        className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Installation Time
                      </label>
                      <input
                        type="text"
                        value={formattedInfo.installationTime}
                        onChange={(e) => setFormattedInfo({...formattedInfo, installationTime: e.target.value})}
                        className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={saveCustomer}
                    disabled={isSaving}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? <LoadingSpinner /> : showSaved ? 'Saved!' : 'Save Customer'}
                  </button>
                <button
                    onClick={async () => {
                      const text = `Name: ${formattedInfo.name}
Email: ${formattedInfo.email}
Phone: ${formattedInfo.phone}
Service Address: ${formattedInfo.serviceAddress}
Installation Date: ${formattedInfo.installationDate}
Installation Time: ${formattedInfo.installationTime}`;
                      await navigator.clipboard.writeText(text);
                      setShowCopied(true);
                      setTimeout(() => setShowCopied(false), 2000);
                    }}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    {showCopied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <div className="text-6xl mb-4">📋</div>
                <p>Formatted information will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer List Section */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Saved Customers ({customers.length})
          </h2>
          
          {customers.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-4">📋</div>
              <p>No customers saved yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {customers.map((customer) => (
                <div key={customer.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                      <p className="text-sm text-gray-600">{customer.email}</p>
                      <p className="text-sm text-gray-600">{customer.phone}</p>
                      <p className="text-sm text-gray-600 mt-2">{customer.service_address}</p>
                      <div className="mt-2 flex gap-4 text-sm">
                        <span className="text-blue-600 font-medium">
                          📅 {new Date(customer.installation_date).toLocaleDateString()}
                        </span>
                        <span className="text-green-600 font-medium">
                          ⏰ {customer.installation_time}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from('customers')
                          .delete()
                          .eq('id', customer.id);
                        
                        if (!error) {
                          loadCustomers();
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
