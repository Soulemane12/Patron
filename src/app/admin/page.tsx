'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../components/LoadingSpinner';
import { supabase, Customer } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  email_confirmed_at: string;
  phone: string;
  confirmed_at: string;
  is_paused: boolean;
  paused_at: string | null;
}

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  serviceAddress: string;
  installationDate: string;
  installationTime: string;
  isReferral: boolean;
  referralSource: string;
  leadSize?: '500MB' | '1GIG' | '2GIG';
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userCustomers, setUserCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [error, setError] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'add-lead' | 'analytics'>('users');
  
  // Add lead form state
  const [inputText, setInputText] = useState('');
  const [formattedInfo, setFormattedInfo] = useState<CustomerInfo | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Check admin authentication
  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/login');
          return;
        }

        // Check if user is admin (you can modify this logic)
        if (session.user.email === 'thechosen1351@gmail.com') {
          setIsAuthenticated(true);
          loadAdminData();
        } else {
          setError('Access denied. Admin privileges required.');
        }
      } catch (error) {
        console.error('Admin auth error:', error);
        setError('Authentication failed');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAuth();
  }, [router]);

  const loadAdminData = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': 'Bearer soulemane'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch admin data');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setAllCustomers(data.customers || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('Failed to load admin data');
    }
  };

  const loadUserCustomers = async (userId: string) => {
    setIsLoadingCustomers(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserCustomers(data || []);
    } catch (error) {
      console.error('Error loading user customers:', error);
      setError('Failed to load user customers');
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const toggleUserPause = async (userId: string, isPaused: boolean) => {
    try {
      const { error } = await supabaseAdmin
        .from('user_status')
        .upsert({
          user_id: userId,
          is_paused: isPaused,
          paused_at: isPaused ? new Date().toISOString() : null
        });

      if (error) throw error;
      
      // Refresh admin data
      loadAdminData();
    } catch (error) {
      console.error('Error toggling user pause:', error);
      setError('Failed to update user status');
    }
  };

  const formatCustomerInfo = async () => {
    if (!inputText.trim()) {
      setError('Please enter customer information');
      return;
    }

    setIsFormatting(true);
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
      setFormattedInfo({
        ...data,
        isReferral: false,
        referralSource: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsFormatting(false);
    }
  };

  const saveCustomerForUser = async (userId: string) => {
    if (!formattedInfo || !selectedUser) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('customers')
        .insert([
          {
            user_id: userId,
            name: formattedInfo.name,
            email: formattedInfo.email,
            phone: formattedInfo.phone,
            service_address: formattedInfo.serviceAddress,
            installation_date: formattedInfo.installationDate,
            installation_time: formattedInfo.installationTime,
            status: 'active',
            is_referral: formattedInfo.isReferral || false,
            referral_source: formattedInfo.isReferral ? formattedInfo.referralSource : null,
            lead_size: formattedInfo.leadSize || '2GIG',
          },
        ])
        .select();

      if (error) throw error;

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
      
      // Clear form and refresh data
      setInputText('');
      setFormattedInfo(null);
      loadUserCustomers(userId);
      loadAdminData();
      
    } catch (error) {
      console.error('Error saving customer:', error);
      setError('Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCustomer = async (customerId: string, userId: string) => {
    try {
      const { error } = await supabaseAdmin
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;
      
      loadUserCustomers(userId);
      loadAdminData();
    } catch (error) {
      console.error('Error deleting customer:', error);
      setError('Failed to delete customer');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-3 md:px-4">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-800 mb-1 md:mb-2">
            Admin Dashboard
          </h1>
          <p className="text-sm md:text-base text-gray-600">Manage all users and their data</p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex space-x-4 border-b">
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-2 px-4 font-medium ${
                activeTab === 'users'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('add-lead')}
              className={`pb-2 px-4 font-medium ${
                activeTab === 'add-lead'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Add Lead for User
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`pb-2 px-4 font-medium ${
                activeTab === 'analytics'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              System Analytics
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-800">User Management</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customers
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Sign In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => {
                    const userCustomerCount = allCustomers.filter(c => c.user_id === user.id).length;
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.email}</div>
                              <div className="text-sm text-gray-500">ID: {user.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_paused
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {user.is_paused ? 'Paused' : 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {userCustomerCount} customers
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.last_sign_in_at 
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                loadUserCustomers(user.id);
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Customers
                            </button>
                            <button
                              onClick={() => toggleUserPause(user.id, !user.is_paused)}
                              className={`${
                                user.is_paused
                                  ? 'text-green-600 hover:text-green-900'
                                  : 'text-red-600 hover:text-red-900'
                              }`}
                            >
                              {user.is_paused ? 'Activate' : 'Pause'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* User Customers Modal */}
            {selectedUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedUser(null)}></div>
                <div className="relative bg-white w-full max-w-4xl mx-4 rounded-lg shadow-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-black">
                      Customers for {selectedUser.email}
                    </h3>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-sm px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-black transition-colors"
                    >
                      ✕ Close
                    </button>
                  </div>
                  
                  {isLoadingCustomers ? (
                    <LoadingSpinner />
                  ) : userCustomers.length > 0 ? (
                    <div className="max-h-96 overflow-auto">
                      <div className="grid gap-3">
                        {userCustomers.map((customer) => (
                          <div key={customer.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg">{customer.name}</h4>
                                <p className="text-sm text-gray-600">{customer.email}</p>
                                <p className="text-sm text-gray-600">{customer.phone}</p>
                                <p className="text-sm text-gray-600">{customer.service_address}</p>
                                <p className="text-sm text-gray-600">
                                  Installation: {new Date(customer.installation_date).toLocaleDateString()} at {customer.installation_time}
                                </p>
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-2 ${
                                  customer.status === 'active' 
                                    ? 'bg-green-100 text-green-800' 
                                    : customer.status === 'cancelled'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {customer.status}
                                </span>
                              </div>
                              <button
                                onClick={() => deleteCustomer(customer.id, selectedUser.id)}
                                className="text-red-600 hover:text-red-900 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500">No customers found for this user.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Lead Tab */}
        {activeTab === 'add-lead' && (
          <div className="space-y-6">
            {/* User Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-blue-800">Add Lead for User</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select User
                </label>
                <select
                  value={selectedUser?.id || ''}
                  onChange={(e) => {
                    const user = users.find(u => u.id === e.target.value);
                    setSelectedUser(user || null);
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a user...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email} ({allCustomers.filter(c => c.user_id === user.id).length} customers)
                    </option>
                  ))}
                </select>
              </div>

              {selectedUser && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Adding lead for: <strong>{selectedUser.email}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Lead Form */}
            {selectedUser && (
              <>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold mb-4 text-blue-800">Lead Information</h3>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste customer information in any format..."
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={formatCustomerInfo}
                      disabled={isFormatting}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isFormatting ? <LoadingSpinner /> : null}
                      Format Information
                    </button>
                    <button
                      onClick={() => {
                        setInputText('');
                        setFormattedInfo(null);
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Formatted Information */}
                {formattedInfo && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4 text-blue-800">Review Lead Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={formattedInfo.name}
                          onChange={(e) => setFormattedInfo({ ...formattedInfo, name: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={formattedInfo.email}
                          onChange={(e) => setFormattedInfo({ ...formattedInfo, email: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={formattedInfo.phone}
                          onChange={(e) => setFormattedInfo({ ...formattedInfo, phone: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Service Address</label>
                        <input
                          type="text"
                          value={formattedInfo.serviceAddress}
                          onChange={(e) => setFormattedInfo({ ...formattedInfo, serviceAddress: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
                        <input
                          type="date"
                          value={formattedInfo.installationDate}
                          onChange={(e) => setFormattedInfo({ ...formattedInfo, installationDate: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Installation Time</label>
                        <input
                          type="text"
                          value={formattedInfo.installationTime}
                          onChange={(e) => setFormattedInfo({ ...formattedInfo, installationTime: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => saveCustomerForUser(selectedUser.id)}
                      disabled={isSaving}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving ? <LoadingSpinner /> : null}
                      Save Lead for {selectedUser.email}
                    </button>
                    {showSaved && (
                      <p className="text-green-600 mt-2">Lead saved successfully!</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-800">System Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800">Total Users</h3>
                <p className="text-3xl font-bold text-blue-600">{users.length}</p>
                <p className="text-sm text-blue-600">
                  {users.filter(u => !u.is_paused).length} active, {users.filter(u => u.is_paused).length} paused
                </p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800">Total Customers</h3>
                <p className="text-3xl font-bold text-green-600">{allCustomers.length}</p>
                <p className="text-sm text-green-600">
                  Across all users
                </p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-800">Average Customers/User</h3>
                <p className="text-3xl font-bold text-purple-600">
                  {users.length > 0 ? Math.round(allCustomers.length / users.length) : 0}
                </p>
                <p className="text-sm text-purple-600">
                  Per active user
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4 text-blue-800">Customer Status Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {allCustomers.filter(c => c.status === 'active').length}
                  </div>
                  <div className="text-sm text-gray-600">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {allCustomers.filter(c => c.status === 'completed').length}
                  </div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {allCustomers.filter(c => c.status === 'not_paid').length}
                  </div>
                  <div className="text-sm text-gray-600">Not Paid</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {allCustomers.filter(c => c.status === 'paid').length}
                  </div>
                  <div className="text-sm text-gray-600">Paid</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {allCustomers.filter(c => c.status === 'cancelled').length}
                  </div>
                  <div className="text-sm text-gray-600">Cancelled</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
