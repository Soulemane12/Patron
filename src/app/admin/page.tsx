'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_approved: boolean;
  is_paused: boolean;
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
  status: string;
  lead_size: string;
  is_referral: boolean;
  referral_source: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  paid: 'bg-emerald-100 text-emerald-800',
  not_paid: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async (pw: string) => {
    setLoading(true);
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${pw}` },
    });
    if (!res.ok) {
      setAuthError('Wrong password');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsers(data.users);
    setCustomers(data.customers);
    setAuthed(true);
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    fetchData(password);
  };

  const togglePause = async (userId: string, isPaused: boolean) => {
    setActionLoading(userId);
    await fetch('/api/admin/users/pause', {
      method: 'POST',
      headers: { Authorization: `Bearer ${password}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: isPaused ? 'unpause' : 'pause' }),
    });
    await fetchData(password);
    setActionLoading(null);
  };

  const toggleApprove = async (userId: string, isApproved: boolean) => {
    setActionLoading(userId);
    await fetch('/api/admin/users/approve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${password}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: isApproved ? 'disapprove' : 'approve' }),
    });
    await fetchData(password);
    setActionLoading(null);
  };

  const userCustomers = selectedUser
    ? customers.filter((c) => c.user_id === selectedUser.id)
    : [];

  const filteredCustomers = userCustomers.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.service_address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = (uid: string) => {
    const uc = customers.filter((c) => c.user_id === uid);
    return {
      total: uc.length,
      paid: uc.filter((c) => c.status === 'paid').length,
      active: uc.filter((c) => c.status === 'active').length,
    };
  };

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Admin</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-2 border border-gray-300 rounded text-black bg-white focus:ring-2 focus:ring-blue-500"
              required
            />
            {authError && <p className="text-red-600 text-sm">{authError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Loading...' : 'Enter'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <div className="text-sm text-gray-500">{users.length} users · {customers.length} total customers</div>
        </div>

        <div className="flex gap-6">
          {/* Users list */}
          <div className="w-80 shrink-0">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-medium text-gray-700 text-sm">Users</div>
              <div className="divide-y divide-gray-100 max-h-[calc(100vh-180px)] overflow-y-auto">
                {users
                  .sort((a, b) => stats(b.id).total - stats(a.id).total)
                  .map((user) => {
                    const s = stats(user.id);
                    const isSelected = selectedUser?.id === user.id;
                    return (
                      <button
                        key={user.id}
                        onClick={() => { setSelectedUser(user); setSearch(''); setStatusFilter('all'); }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {s.total} customers · {s.paid} paid
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {user.is_paused && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Paused</span>
                            )}
                            {!user.is_approved && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Pending</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 min-w-0">
            {!selectedUser ? (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
                Select a user to view their data
              </div>
            ) : (
              <div className="space-y-4">
                {/* User info card */}
                <div className="bg-white rounded-lg shadow p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{selectedUser.email}</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Joined {new Date(selectedUser.created_at).toLocaleDateString()}
                        {selectedUser.last_sign_in_at && (
                          <> · Last seen {new Date(selectedUser.last_sign_in_at).toLocaleDateString()}</>
                        )}
                      </p>
                      <div className="flex gap-3 mt-3 text-sm">
                        <span className="font-medium text-gray-900">{stats(selectedUser.id).total} customers</span>
                        <span className="text-green-700">{stats(selectedUser.id).paid} paid</span>
                        <span className="text-blue-700">{stats(selectedUser.id).active} active</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleApprove(selectedUser.id, selectedUser.is_approved)}
                        disabled={actionLoading === selectedUser.id}
                        className={`text-sm px-3 py-1.5 rounded font-medium ${
                          selectedUser.is_approved
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } disabled:opacity-50`}
                      >
                        {selectedUser.is_approved ? 'Revoke' : 'Approve'}
                      </button>
                      <button
                        onClick={() => togglePause(selectedUser.id, selectedUser.is_paused)}
                        disabled={actionLoading === selectedUser.id}
                        className={`text-sm px-3 py-1.5 rounded font-medium ${
                          selectedUser.is_paused
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        } disabled:opacity-50`}
                      >
                        {selectedUser.is_paused ? 'Unpause' : 'Pause'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Customers */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                    <h3 className="font-medium text-gray-700 text-sm flex-1">Customers</h3>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search..."
                      className="text-sm border border-gray-200 rounded px-2 py-1 text-black bg-white w-40"
                    />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="text-sm border border-gray-200 rounded px-2 py-1 text-black bg-white"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="in_progress">In Progress</option>
                      <option value="paid">Paid</option>
                      <option value="not_paid">Not Paid</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {filteredCustomers.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No customers found</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filteredCustomers
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((customer) => (
                          <div key={customer.id} className="px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-gray-900">{customer.name}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[customer.status] || 'bg-gray-100 text-gray-600'}`}>
                                    {customer.status?.replace('_', ' ')}
                                  </span>
                                  {customer.lead_size && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                      {customer.lead_size}
                                    </span>
                                  )}
                                  {customer.is_referral && (
                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                      Referral
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{customer.service_address}</p>
                                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                                  {customer.phone && <span>{customer.phone}</span>}
                                  {customer.email && <span>{customer.email}</span>}
                                  {customer.installation_date && (
                                    <span>Install: {new Date(`${customer.installation_date}T00:00:00`).toLocaleDateString()} {customer.installation_time}</span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 shrink-0">
                                {new Date(customer.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
