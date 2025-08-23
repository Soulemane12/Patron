'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
}

interface AdminCustomer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  service_address: string;
  installation_date: string;
  installation_time: string;
  status?: 'active' | 'cancelled' | 'completed' | 'paid';
  is_referral?: boolean;
  referral_source?: string;
  lead_size?: '500MB' | '1GIG' | '2GIG';
  created_at: string;
  updated_at: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userCustomers, setUserCustomers] = useState<AdminCustomer[]>([]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'soulemane') {
      setIsAuthenticated(true);
      setError('');
      loadAllData();
    } else {
      setError('Incorrect password');
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load all data from admin API
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': 'Bearer soulemane'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load admin data');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewUserCustomers = (user: AdminUser) => {
    setSelectedUser(user);
    const userCustomersList = customers.filter(c => c.user_id === user.id);
    setUserCustomers(userCustomersList);
  };

  const getCustomerStats = (userId: string) => {
    const userCustomersList = customers.filter(c => c.user_id === userId);
    const total = userCustomersList.length;
    const active = userCustomersList.filter(c => c.status === 'active' || c.status === undefined).length;
    const completed = userCustomersList.filter(c => c.status === 'completed' || c.status === 'paid').length;
    const paid = userCustomersList.filter(c => c.status === 'paid').length;
    const cancelled = userCustomersList.filter(c => c.status === 'cancelled').length;
    
    return { total, active, completed, paid, cancelled };
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-semibold text-blue-800 mb-4 text-center">Admin Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-blue-800 mb-4">Admin Dashboard</h1>
          <p className="text-gray-600 mb-4">View all users and their customer data</p>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overall Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-blue-700">{users.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-green-700">{customers.length}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Completed Customers</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {customers.filter(c => c.status === 'completed' || c.status === 'paid').length}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Paid Customers</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {customers.filter(c => c.status === 'paid').length}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600">Cancelled</p>
                  <p className="text-2xl font-bold text-red-700">
                    {customers.filter(c => c.status === 'cancelled').length}
                  </p>
                </div>
              </div>

              {/* Users List */}
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">All Users</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Sign In</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customers</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((user) => {
                        const stats = getCustomerStats(user.id);
                        return (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="space-y-1">
                                <div>Total: {stats.total}</div>
                                <div className="text-xs text-gray-500">
                                  Active: {stats.active} | Completed: {stats.completed} | Paid: {stats.paid} | Cancelled: {stats.cancelled}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <button
                                onClick={() => viewUserCustomers(user)}
                                className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
                              >
                                View Customers
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Selected User's Customers */}
              {selectedUser && (
                <div className="mt-8">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    Customers for {selectedUser.email}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Installation</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Size</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {userCustomers.map((customer) => (
                          <tr key={customer.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{customer.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{customer.email}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{customer.phone}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={customer.service_address}>
                              {customer.service_address}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div>
                                <div>{new Date(customer.installation_date).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">{customer.installation_time}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                customer.status === 'active' || customer.status === undefined
                                  ? 'bg-green-100 text-green-800'
                                  : customer.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : customer.status === 'paid'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {customer.status || 'active'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{customer.lead_size || '2GIG'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(customer.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {userCustomers.length === 0 && (
                    <p className="text-center py-8 text-gray-500">No customers found for this user.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
