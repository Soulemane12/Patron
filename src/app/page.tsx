'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from './components/LoadingSpinner';
import { supabase, Customer } from '../lib/supabase';
import InstallationCalendar from './components/InstallationCalendar';
import DailyInstallations from './components/DailyInstallations';
import Navbar from './components/Navbar';

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

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateInstallations, setSelectedDateInstallations] = useState<Customer[]>([]);
  const [activeSection, setActiveSection] = useState<string>('pipeline');


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
      
      // Switch to pipeline view after saving
      setActiveSection('pipeline');
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

  const startEditingCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    // Scroll to top to show edit form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingCustomer(null);
  };
  
  const handleDateClick = (date: Date, installations: Customer[]) => {
    setSelectedDate(date);
    setSelectedDateInstallations(installations);
  };
  
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    
    // If switching to calendar view, reset the selected date
    if (section === 'calendar' && !selectedDate) {
      setSelectedDate(new Date());
    }
  };

  const updateCustomer = async () => {
    if (!editingCustomer) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: editingCustomer.name,
          email: editingCustomer.email,
          phone: editingCustomer.phone,
          service_address: editingCustomer.service_address,
          installation_date: editingCustomer.installation_date,
          installation_time: editingCustomer.installation_time,
        })
        .eq('id', editingCustomer.id);

      if (error) throw error;

      setEditingCustomer(null);
      loadCustomers();
    } catch (error) {
      console.error('Error updating customer:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 py-4 md:py-8">
      <div className="max-w-4xl mx-auto px-3 md:px-4">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-800 mb-1 md:mb-2">
            Sales Pro Tracker
          </h1>
          <p className="text-sm md:text-base text-gray-600">Your door-to-door sales assistant</p>
        </div>
        
        <Navbar activeSection={activeSection} onSectionChange={handleSectionChange} />


        {/* Calendar View */}
        {activeSection === 'calendar' && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500">
              <h2 className="text-xl font-semibold mb-4 text-blue-800">Installation Calendar</h2>
              {customers.length > 0 ? (
                <InstallationCalendar 
                  customers={customers} 
                  onDateClick={handleDateClick} 
                />
              ) : (
                <p className="text-center py-8 text-black">No installations scheduled yet. Add some leads to see them on the calendar.</p>
              )}
            </div>
            
            {selectedDate && (
              <DailyInstallations 
                date={selectedDate} 
                installations={selectedDateInstallations} 
              />
            )}
          </div>
        )}

        {/* Sales Pipeline - Only shows saved customers */}
        {activeSection === 'pipeline' && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8 border-t-4 border-blue-500">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-blue-800">Your Saved Customers</h2>
            {customers.length > 0 ? (
              <div className="space-y-4">
                {customers.map((customer) => {
                const emailSchedule = getEmailSchedule(customer.installation_date);
                return (
                  <div key={customer.id} className="border border-gray-200 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-base md:text-lg text-black">{customer.name}</h3>
                        <p className="text-sm md:text-base text-black">{customer.email}</p>
                        <p className="text-sm md:text-base text-black">{customer.phone}</p>
                        <p className="text-sm md:text-base text-black">{customer.service_address}</p>
                        <p className="text-sm md:text-base text-black">
                          <span className="font-medium">Installation:</span> {parseDateLocal(customer.installation_date).toLocaleDateString()} at {customer.installation_time}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2 md:mt-0">
                        <button
                          onClick={() => startEditingCustomer(customer)}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-xs md:text-sm hover:bg-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCustomer(customer.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-xs md:text-sm hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    
                    {/* Email Schedule */}
                    <div className="bg-blue-50 rounded-lg p-2 md:p-3">
                      <h4 className="font-medium text-sm md:text-base text-black mb-2">Follow-up Reminders:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs md:text-sm">
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="w-2 h-2 md:w-3 md:h-3 bg-yellow-400 rounded-full"></span>
                          <span className="text-black">Pre-Install:</span>
                          <span className="font-medium text-black">{emailSchedule.dayBefore}</span>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="w-2 h-2 md:w-3 md:h-3 bg-green-400 rounded-full"></span>
                          <span className="text-black">Install Day:</span>
                          <span className="font-medium text-black">{emailSchedule.dayOf}</span>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="w-2 h-2 md:w-3 md:h-3 bg-blue-400 rounded-full"></span>
                          <span className="text-black">Follow-up:</span>
                          <span className="font-medium text-black">{emailSchedule.followUp}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              <p className="text-center py-8 text-black">No saved customers yet. Add a new lead to get started.</p>
            )}
          </div>
        )}
        


        {/* Edit Customer Form */}
        {editingCustomer && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-blue-800">Update Customer Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Name</label>
                <input
                  type="text"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Email</label>
                <input
                  type="email"
                  value={editingCustomer.email}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Phone</label>
                <input
                  type="tel"
                  value={editingCustomer.phone}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Service Address</label>
                <input
                  type="text"
                  value={editingCustomer.service_address}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, service_address: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Installation Date</label>
                <input
                  type="date"
                  value={editingCustomer.installation_date}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, installation_date: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Installation Time</label>
                <input
                  type="text"
                  value={editingCustomer.installation_time}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, installation_time: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-4 mt-3 md:mt-4">
              <button
                onClick={updateCustomer}
                disabled={isUpdating}
                className="px-4 md:px-6 py-2 bg-green-600 text-white text-xs md:text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 md:gap-2"
              >
                {isUpdating ? <LoadingSpinner /> : null}
                Update Customer
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 md:px-6 py-2 bg-gray-500 text-white text-xs md:text-sm rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Add New Lead Section */}
        {activeSection === 'add' && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8 border-t-4 border-green-500">
            <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 text-blue-800">Add New Sales Lead</h2>
            <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">Paste your customer's information from your notes in any format - our AI will organize it automatically.</p>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Example: John Smith, phone 555-123-4567, email john@example.com, address 123 Main St, installation scheduled for June 15th at 2pm..."
              className="w-full h-32 p-4 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
                      <div className="flex flex-wrap gap-2 md:gap-4 mt-3 md:mt-4">
                <button
              onClick={formatCustomerInfo}
              disabled={isLoading}
              className="px-4 md:px-6 py-2 bg-green-600 text-white text-xs md:text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 md:gap-2"
            >
              {isLoading ? <LoadingSpinner /> : null}
              <span className="flex items-center gap-1 md:gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Process Lead
              </span>
                </button>
                <button
              onClick={clearForm}
              className="px-4 md:px-6 py-2 bg-gray-500 text-white text-xs md:text-sm rounded-lg hover:bg-gray-600"
                >
                  Clear
                </button>
              </div>
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </div>
        )}

        {/* Formatted Information - Only show when in Add section */}
        {activeSection === 'add' && formattedInfo && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8 border-t-4 border-purple-500">
            <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 text-blue-800">Review Lead Information</h2>
            <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">Verify the details below before saving this lead to your sales pipeline.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Name</label>
                <input
                  type="text"
                  value={formattedInfo.name}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, name: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Email</label>
                <input
                  type="email"
                  value={formattedInfo.email}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, email: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Phone</label>
                <input
                  type="tel"
                  value={formattedInfo.phone}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, phone: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Service Address</label>
                <input
                  type="text"
                  value={formattedInfo.serviceAddress}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, serviceAddress: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Installation Date</label>
                <input
                  type="date"
                  value={formattedInfo.installationDate}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, installationDate: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Installation Time</label>
                <input
                  type="text"
                  value={formattedInfo.installationTime}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, installationTime: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
            </div>
            <button
              onClick={saveCustomer}
              disabled={isSaving}
              className="mt-3 md:mt-4 px-4 md:px-6 py-2 bg-green-600 text-white text-xs md:text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 md:gap-2"
            >
              {isSaving ? <LoadingSpinner /> : null}
              <span className="flex items-center gap-1 md:gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
                </svg>
                Add to Pipeline
              </span>
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditingCustomer(customer)}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCustomer(customer.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                        >
                          Delete
                        </button>
                    </div>
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
