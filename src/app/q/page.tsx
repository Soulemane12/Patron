'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_paused?: boolean;
  paused_at?: string;
  is_approved?: boolean;
  approved_at?: string;
  approved_by?: string;
  visible_on_branch?: boolean;
}

interface Customer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  service_address: string;
  installation_date: string;
  installation_time: string;
  status?: 'active' | 'cancelled' | 'completed' | 'paid' | 'not_paid' | 'in_progress';
  is_referral?: boolean;
  referral_source?: string;
  lead_size?: '500MB' | '1GIG' | '2GIG';
  visible_on_branch?: boolean;
  created_at: string;
  updated_at: string;
}

export default function PeoplePage() {
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userCustomers, setUserCustomers] = useState<Customer[]>([]);
  const [showUserAnalytics, setShowUserAnalytics] = useState(false);
  const [showBranchView, setShowBranchView] = useState(true);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load data from public API (manager access - only visible users)
      const response = await fetch('/api/public/users');

      if (!response.ok) {
        throw new Error('Failed to load data');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setCustomers(data.customers || []);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewUserCustomers = (user: User) => {
    setSelectedUser(user);
    const userCustomersList = customers.filter(c => c.user_id === user.id);
    setUserCustomers(userCustomersList);
  };

  const getCustomerStats = (userId: string) => {
    const userCustomersList = customers.filter(c => c.user_id === userId);
    const total = userCustomersList.length;
    const active = userCustomersList.filter(c => c.status === 'active' || c.status === undefined).length;
    const completed = userCustomersList.filter(c => c.status === 'completed' || c.status === 'not_paid' || c.status === 'paid').length;
    const notPaid = userCustomersList.filter(c => c.status === 'not_paid').length;
    const paid = userCustomersList.filter(c => c.status === 'paid').length;
    const cancelled = userCustomersList.filter(c => c.status === 'cancelled').length;

    return { total, active, completed, notPaid, paid, cancelled };
  };


  const getBranchPerformance = () => {
    const userStats = users.map(user => ({
      user,
      stats: getCustomerStats(user.id)
    }));

    // Sort by total customers, then by active customers
    return userStats
      .filter(item => item.user.is_approved && !item.user.is_paused)
      .sort((a, b) => {
        if (b.stats.total !== a.stats.total) {
          return b.stats.total - a.stats.total;
        }
        return b.stats.active - a.stats.active;
      })
      .slice(0, 10); // Top 10
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-blue-800">Q's Branch Management</h1>
              <p className="text-gray-600">View all users and customers in Q's branch</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-6">
              {/* User count only */}
              <div className="mb-6">
                <div className="bg-blue-50 p-4 rounded-lg inline-block">
                  <p className="text-sm text-gray-600">Users in Q's Branch</p>
                  <p className="text-2xl font-bold text-blue-700">{users.length}</p>
                </div>
              </div>

              {/* View Actions */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => {
                    setShowBranchView(!showBranchView);
                    setShowUserAnalytics(false);
                    setSelectedUser(null);
                    setUserCustomers([]);
                  }}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  {showBranchView ? 'Hide Performance View' : 'Show Performance View'}
                </button>
                <button
                  onClick={() => {
                    setShowUserAnalytics(!showUserAnalytics);
                    setShowBranchView(false);
                    setSelectedUser(null);
                    setUserCustomers([]);
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  {showUserAnalytics ? 'Hide User Analytics' : 'Show User Analytics'}
                </button>
              </div>

              {/* Branch Performance View */}
              {showBranchView && (
                <div className="bg-white rounded-lg shadow mb-6">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-800">📊 Branch Performance</h2>
                        <p className="text-gray-600">Top performers in Q's branch ranked by customer count</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="space-y-4">
                      {getBranchPerformance().map((entry, index) => (
                        <div
                          key={entry.user.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            index === 0
                              ? 'bg-yellow-50 border-yellow-200'
                              : index === 1
                              ? 'bg-gray-50 border-gray-200'
                              : index === 2
                              ? 'bg-orange-50 border-orange-200'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              index === 0
                                ? 'bg-yellow-500 text-white'
                                : index === 1
                                ? 'bg-gray-500 text-white'
                                : index === 2
                                ? 'bg-orange-500 text-white'
                                : 'bg-blue-500 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{entry.user.email}</div>
                              <div className="text-sm text-gray-500">
                                Active: {entry.stats.active} | Completed: {entry.stats.completed} | Total: {entry.stats.total}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-blue-600">{entry.stats.total}</span>
                            <span className="text-sm text-gray-500">customers</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {getBranchPerformance().length === 0 && (
                      <p className="text-center py-8 text-gray-500">No active users found in Q's branch.</p>
                    )}
                  </div>
                </div>
              )}

              {/* User Analytics View */}
              {showUserAnalytics && (
                <div className="bg-white rounded-lg shadow mb-6">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-800">📈 User Analytics</h2>
                        <p className="text-gray-600">Detailed analytics for users in Q's branch</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                      {users.map((user) => {
                        const stats = getCustomerStats(user.id);
                        return (
                          <div key={user.id} className="bg-gray-50 p-4 rounded-lg border">
                            <div className="mb-3">
                              <h3 className="font-medium text-gray-900 truncate" title={user.email}>
                                {user.email}
                              </h3>
                              <div className="flex gap-2 mt-1">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  user.is_approved
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {user.is_approved ? 'APPROVED' : 'PENDING'}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  user.is_paused
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {user.is_paused ? 'PAUSED' : 'ACTIVE'}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total:</span>
                                <span className="font-medium text-blue-600">{stats.total}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Active:</span>
                                <span className="font-medium text-green-600">{stats.active}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Completed:</span>
                                <span className="font-medium text-blue-600">{stats.completed}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Paid:</span>
                                <span className="font-medium text-green-600">{stats.paid}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Not Paid:</span>
                                <span className="font-medium text-orange-600">{stats.notPaid}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Cancelled:</span>
                                <span className="font-medium text-red-600">{stats.cancelled}</span>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="text-xs text-gray-500">
                                <div>Joined: {new Date(user.created_at).toLocaleDateString()}</div>
                                <div>Last Sign In: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}</div>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                if (selectedUser?.id === user.id) {
                                  setSelectedUser(null);
                                  setUserCustomers([]);
                                } else {
                                  viewUserCustomers(user);
                                }
                              }}
                              className={`w-full mt-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                selectedUser?.id === user.id
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              {selectedUser?.id === user.id ? 'Hide Customers' : 'View Customers'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Users List */}
              {!showUserAnalytics && !showBranchView && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">All Users</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
                            <tr key={user.id} className={`hover:bg-gray-50 ${user.is_paused ? 'bg-red-50' : !user.is_approved ? 'bg-yellow-50' : ''}`}>
                              <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  user.is_approved
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {user.is_approved ? 'APPROVED' : 'PENDING'}
                                </span>
                                {user.is_approved && user.approved_at && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Approved: {new Date(user.approved_at).toLocaleDateString()}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  user.is_paused
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {user.is_paused ? 'PAUSED' : 'ACTIVE'}
                                </span>
                                {user.is_paused && user.paused_at && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Paused: {new Date(user.paused_at).toLocaleDateString()}
                                  </div>
                                )}
                              </td>
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
                                    Active: {stats.active} | Completed: {stats.completed} | Not Paid: {stats.notPaid} | Paid: {stats.paid} | Cancelled: {stats.cancelled}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <button
                                  onClick={() => {
                                    if (selectedUser?.id === user.id) {
                                      setSelectedUser(null);
                                      setUserCustomers([]);
                                    } else {
                                      viewUserCustomers(user);
                                    }
                                  }}
                                  className={`px-3 py-1 rounded text-xs transition-colors ${
                                    selectedUser?.id === user.id
                                      ? 'bg-red-500 text-white hover:bg-red-600'
                                      : 'bg-blue-500 text-white hover:bg-blue-600'
                                  }`}
                                >
                                  {selectedUser?.id === user.id ? 'Hide Customers' : 'View Customers'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Selected User's Customers */}
              {selectedUser && (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      Customers for {selectedUser.email}
                    </h2>
                  </div>

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
                                  : customer.status === 'in_progress'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : customer.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : customer.status === 'paid'
                                  ? 'bg-purple-100 text-purple-800'
                                  : customer.status === 'not_paid'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {customer.status === 'not_paid' ? 'Not Paid' : customer.status === 'in_progress' ? 'Missed Installation' : customer.status || 'active'}
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