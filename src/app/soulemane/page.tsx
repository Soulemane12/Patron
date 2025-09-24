'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_paused?: boolean;
  paused_at?: string;
  is_approved?: boolean;
  approved_at?: string;
  approved_by?: string;
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
  status?: 'active' | 'cancelled' | 'completed' | 'paid' | 'not_paid' | 'in_progress';
  is_referral?: boolean;
  referral_source?: string;
  lead_size?: '500MB' | '1GIG' | '2GIG';
  created_at: string;
  updated_at: string;
}

interface NewCustomerData {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  service_address: string;
  installation_date: string;
  installation_time: string;
  status: 'active' | 'cancelled' | 'completed' | 'paid' | 'not_paid' | 'in_progress';
  is_referral: boolean;
  referral_source?: string;
  lead_size: '500MB' | '1GIG' | '2GIG';
  processed_timestamp?: number;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userCustomers, setUserCustomers] = useState<AdminCustomer[]>([]);
  const [pausingUser, setPausingUser] = useState<string | null>(null);
  const [approvingUser, setApprovingUser] = useState<string | null>(null);
  const [showAddLeadForm, setShowAddLeadForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
  const [editingCustomer, setEditingCustomer] = useState<AdminCustomer | null>(null);
  const [newCustomerData, setNewCustomerData] = useState<NewCustomerData>({
    user_id: '',
    name: '',
    email: '',
    phone: '',
    service_address: '',
    installation_date: '',
    installation_time: '',
    status: 'active',
    is_referral: false,
    referral_source: '',
    lead_size: '2GIG'
  });
  
  // Check authentication on component mount
  useEffect(() => {
    const authStatus = localStorage.getItem('adminAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      // Don't load data automatically
    }
  }, []);
  
  // No effects for data persistence - keeping it simple
  const [customerInputText, setCustomerInputText] = useState('');
  const [isFormattingCustomer, setIsFormattingCustomer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [justAddedLead, setJustAddedLead] = useState(false);
  // Removed processedCustomerData state to simplify

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'soulemane') {
      setIsAuthenticated(true);
      setError('');
      localStorage.setItem('adminAuthenticated', 'true');
      // Don't load data automatically
    } else {
      setError('Incorrect password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setError('');
    setUsers([]);
    setCustomers([]);
    setSelectedUser(null);
    setUserCustomers([]);
    setShowAddLeadForm(false);
    setEditingCustomer(null);
    setJustAddedLead(false);
    setDataLoaded(false);
    localStorage.removeItem('adminAuthenticated');
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
      setDataLoaded(true);
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
    const completed = userCustomersList.filter(c => c.status === 'completed' || c.status === 'not_paid' || c.status === 'paid').length;
    const notPaid = userCustomersList.filter(c => c.status === 'not_paid').length;
    const paid = userCustomersList.filter(c => c.status === 'paid').length;
    const cancelled = userCustomersList.filter(c => c.status === 'cancelled').length;
    
    return { total, active, completed, notPaid, paid, cancelled };
  };

  const handleBatchImport = async () => {
    if (!batchText.trim()) {
      alert('Please enter batch customer information');
      return;
    }

    if (!selectedUserId) {
      alert('Please select a user to assign the customers to');
      return;
    }

    setBatchProcessing(true);
    setBatchResults({ success: 0, failed: 0, errors: [] });

    try {
      const response = await fetch('/api/batch-customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer soulemane'
        },
        body: JSON.stringify({
          batchText: batchText,
          userId: selectedUserId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process batch customers');
      }

      const result = await response.json();
      setBatchResults(result);

      if (result.success > 0) {
        // Clear form and reload data
        setBatchText('');
        setSelectedUserId('');
        loadAllData();
        alert(`Successfully imported ${result.success} customers${result.failed > 0 ? ` (${result.failed} failed)` : ''}!`);
      }
    } catch (error: any) {
      console.error('Error processing batch customers:', error);
      alert(`Failed to process batch customers: ${error.message || 'Unknown error'}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleApproveUser = async (userId: string, action: 'approve' | 'disapprove') => {
    setApprovingUser(userId);
    try {
      const response = await fetch('/api/admin/users/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer soulemane'
        },
        body: JSON.stringify({ userId, action })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} user`);
      }

      const result = await response.json();
      alert(result.message || `User ${action}d successfully`);

      // Reload data to reflect changes
      loadAllData();
    } catch (error: any) {
      console.error(`Error ${action}ing user:`, error);
      alert(`Failed to ${action} user: ${error.message || 'Unknown error'}`);
    } finally {
      setApprovingUser(null);
    }
  };

  const handlePauseUser = async (userId: string, action: 'pause' | 'unpause') => {
    setPausingUser(userId);
    try {
      // First check if user_status table exists
      const checkResponse = await fetch('/api/admin/users', {
        headers: {
          'Authorization': 'Bearer soulemane'
        }
      });
      
      if (!checkResponse.ok) {
        throw new Error('Failed to check user status');
      }
      
      // Now attempt the pause/unpause
      const response = await fetch('/api/admin/users/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer soulemane'
        },
        body: JSON.stringify({ userId, action })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action.replace('_', ' ')} user`);
      }

      const result = await response.json();
      alert(result.message || `User ${action.replace('_', ' ')}d successfully`);

      // Reload data to reflect changes
      loadAllData();
    } catch (error: any) {
      console.error(`Error ${action.replace('_', ' ')}ing user:`, error);
      alert(`Failed to ${action.replace('_', ' ')} user: ${error.message || 'Unknown error'}`);
    } finally {
      setPausingUser(null);
    }
  };

  const formatCustomerInfo = async () => {
    if (!customerInputText.trim()) {
      alert('Please enter customer information');
      return;
    }

    setIsFormattingCustomer(true);
    try {
      const response = await fetch('/api/format-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: customerInputText }),
      });

      if (!response.ok) {
        throw new Error('Failed to format customer information');
      }

      const data = await response.json();
      
      // Simply update the form with formatted data
      setNewCustomerData({
        ...newCustomerData,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        service_address: data.serviceAddress || '',
        installation_date: data.installationDate || '',
        installation_time: data.installationTime || ''
      });
      
    } catch (error) {
      console.error('Error formatting customer info:', error);
      alert('Failed to format customer information. Please try again or enter details manually.');
    } finally {
      setIsFormattingCustomer(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation - just check if we have a user selected
    if (!newCustomerData.user_id) {
      alert('Please select a user');
      return;
    }
    
    // Directly use the current form data, no complex restoration logic
    const dataToSubmit = {...newCustomerData};

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer soulemane'
        },
        body: JSON.stringify(dataToSubmit)
      });

      if (!response.ok) {
        throw new Error('Failed to add customer');
      }

      // Simply reset form and reload data
      setNewCustomerData({
        user_id: '',
        name: '',
        email: '',
        phone: '',
        service_address: '',
        installation_date: '',
        installation_time: '',
        status: 'active',
        is_referral: false,
        referral_source: '',
        lead_size: '2GIG'
      });
      setCustomerInputText('');
      
      setShowAddLeadForm(false);
      setJustAddedLead(true);
      loadAllData();
      alert('Customer added successfully!');
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer soulemane'
        },
        body: JSON.stringify(editingCustomer)
      });

      if (!response.ok) {
        throw new Error('Failed to update customer');
      }

      setEditingCustomer(null);
      loadAllData();
      alert('Customer updated successfully!');
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Failed to update customer');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer soulemane'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete customer');
      }

      loadAllData();
      alert('Customer deleted successfully!');
      setJustAddedLead(false); // Reset the just added state
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Failed to delete customer');
    }
  };

  const startEditingCustomer = (customer: AdminCustomer) => {
    setEditingCustomer(customer);
  };

  const cancelEdit = () => {
    setEditingCustomer(null);
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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-blue-800">Admin Dashboard</h1>
              <p className="text-gray-600">View all users and their customer data</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
          
          {!dataLoaded ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <p className="text-gray-600">Click the button below to load user data</p>
              <button
                onClick={loadAllData}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading Data...' : 'Load All Data'}
              </button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-6">
              {/* User count only */}
              <div className="mb-6">
                <div className="bg-blue-50 p-4 rounded-lg inline-block">
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-blue-700">{users.length}</p>
                </div>
              </div>

              {/* Admin Actions */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => {
                    if (justAddedLead) {
                      setJustAddedLead(false);
                    }
                    setShowAddLeadForm(!showAddLeadForm);
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  {showAddLeadForm ? 'Cancel Add Lead' : justAddedLead ? 'Add Another Lead' : 'Add New Lead'}
                </button>

                <button
                  onClick={() => {
                    setShowBatchImport(!showBatchImport);
                    setBatchResults({ success: 0, failed: 0, errors: [] });
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {showBatchImport ? 'Cancel Batch Import' : 'Batch Import Leads'}
                </button>
              </div>

              {/* Add Lead Form */}
              {showAddLeadForm && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Add New Lead</h3>
                  <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assign to User</label>
                      <select
                        value={newCustomerData.user_id}
                        onChange={(e) => setNewCustomerData({...newCustomerData, user_id: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select User</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>
                            {user.email} {user.is_paused ? '(PAUSED)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paste Customer Information</label>
                      <textarea
                        value={customerInputText}
                        onChange={(e) => setCustomerInputText(e.target.value)}
                        rows={4}
                        placeholder="Example: John Smith, phone 555-123-4567, email john@example.com, address 123 Main St, installation scheduled for June 15th at 2pm..."
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={formatCustomerInfo}
                          disabled={isFormattingCustomer || !customerInputText.trim()}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isFormattingCustomer ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Processing...
                            </>
                          ) : (
                            <>Process Lead</>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={newCustomerData.name}
                        onChange={(e) => setNewCustomerData({...newCustomerData, name: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={newCustomerData.email}
                        onChange={(e) => setNewCustomerData({...newCustomerData, email: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={newCustomerData.phone}
                        onChange={(e) => setNewCustomerData({...newCustomerData, phone: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Address</label>
                      <input
                        type="text"
                        value={newCustomerData.service_address}
                        onChange={(e) => setNewCustomerData({...newCustomerData, service_address: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
                      <input
                        type="date"
                        value={newCustomerData.installation_date}
                        onChange={(e) => setNewCustomerData({...newCustomerData, installation_date: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Installation Time</label>
                      <input
                        type="text"
                        value={newCustomerData.installation_time}
                        onChange={(e) => setNewCustomerData({...newCustomerData, installation_time: e.target.value})}
                        required
                        placeholder="e.g., 2:00 PM"
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={newCustomerData.status}
                        onChange={(e) => setNewCustomerData({...newCustomerData, status: e.target.value as any})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="in_progress">Missed Installation</option>
                        <option value="completed">Completed</option>
                        <option value="not_paid">Not Paid</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lead Size</label>
                      <select
                        value={newCustomerData.lead_size}
                        onChange={(e) => setNewCustomerData({...newCustomerData, lead_size: e.target.value as any})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="500MB">500MB</option>
                        <option value="1GIG">1GIG</option>
                        <option value="2GIG">2GIG</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Is Referral?</label>
                      <div className="flex items-center gap-4 mt-2">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="is_referral"
                            checked={newCustomerData.is_referral === true}
                            onChange={() => setNewCustomerData({...newCustomerData, is_referral: true})}
                            className="form-radio h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700">Yes</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="is_referral"
                            checked={newCustomerData.is_referral === false}
                            onChange={() => setNewCustomerData({...newCustomerData, is_referral: false, referral_source: ''})}
                            className="form-radio h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700">No</span>
                        </label>
                      </div>
                    </div>
                    {newCustomerData.is_referral && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Referral Source</label>
                        <input
                          type="text"
                          value={newCustomerData.referral_source || ''}
                          onChange={(e) => setNewCustomerData({...newCustomerData, referral_source: e.target.value})}
                          placeholder="Who referred this customer?"
                          className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    <div className="md:col-span-2 lg:col-span-3">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? 'Adding...' : 'Add Customer'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Batch Import Form */}
              {showBatchImport && (
                <div className="bg-purple-50 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Batch Import Leads</h3>
                  <p className="text-sm text-gray-600 mb-4">Import multiple customers at once from your spreadsheet. Select a user to assign these customers to, then paste your data.</p>

                  <div className="space-y-4">
                    {/* User Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign to User</label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-purple-500"
                        required
                      >
                        <option value="">Select User</option>
                        {users.filter(user => user.is_approved && !user.is_paused).map(user => (
                          <option key={user.id} value={user.id}>
                            {user.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Batch Data Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Customer Data</label>
                      <p className="text-xs text-gray-500 mb-2">
                        Paste data from Excel, Google Sheets, or CSV. Each row should contain customer info.
                      </p>
                      <textarea
                        value={batchText}
                        onChange={(e) => setBatchText(e.target.value)}
                        rows={8}
                        placeholder={`Example format:
John Smith, 555-123-4567, john@email.com, 123 Main St, June 15th, 2pm
Jane Doe, 555-987-6543, jane@email.com, 456 Oak Ave, June 16th, 10am
Bob Wilson, 555-555-5555, bob@email.com, 789 Pine St, June 17th, 3pm`}
                        className="w-full p-3 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-purple-500 resize-none"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleBatchImport}
                        disabled={batchProcessing || !selectedUserId || !batchText.trim()}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {batchProcessing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                            Process Batch Import
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setBatchText('');
                          setBatchResults({ success: 0, failed: 0, errors: [] });
                        }}
                        className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Batch Results */}
                    {(batchResults.success > 0 || batchResults.failed > 0) && (
                      <div className="mt-4 p-4 bg-white rounded-lg border border-purple-200">
                        <h4 className="font-semibold text-sm text-gray-800 mb-3">Import Results:</h4>
                        <div className="flex gap-6 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                            <span className="text-sm text-green-600">Successful: {batchResults.success}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                            <span className="text-sm text-red-600">Failed: {batchResults.failed}</span>
                          </div>
                        </div>

                        {batchResults.errors.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-sm text-red-600 cursor-pointer font-medium">
                              View Error Details ({batchResults.errors.length})
                            </summary>
                            <div className="mt-2 p-3 bg-red-50 rounded max-h-40 overflow-y-auto">
                              {batchResults.errors.map((error, index) => (
                                <div key={index} className="text-xs text-red-600 mb-1">
                                  • {error}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Users List */}
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
                               <div className="flex gap-2 flex-wrap">
                                 <button
                                   onClick={() => viewUserCustomers(user)}
                                   className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
                                 >
                                   View Customers
                                 </button>

                                 {/* Approval Actions */}
                                 {user.is_approved ? (
                                   <button
                                     onClick={() => handleApproveUser(user.id, 'disapprove')}
                                     disabled={approvingUser === user.id}
                                     className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600 disabled:opacity-50"
                                   >
                                     {approvingUser === user.id ? 'Disapproving...' : 'Disapprove'}
                                   </button>
                                 ) : (
                                   <button
                                     onClick={() => handleApproveUser(user.id, 'approve')}
                                     disabled={approvingUser === user.id}
                                     className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-50"
                                   >
                                     {approvingUser === user.id ? 'Approving...' : 'Approve'}
                                   </button>
                                 )}

                                 {/* Pause Actions */}
                                 {user.is_paused ? (
                                   <button
                                     onClick={() => handlePauseUser(user.id, 'unpause')}
                                     disabled={pausingUser === user.id}
                                     className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-50"
                                   >
                                     {pausingUser === user.id ? 'Unpausing...' : 'Unpause'}
                                   </button>
                                 ) : (
                                   <button
                                     onClick={() => handlePauseUser(user.id, 'pause')}
                                     disabled={pausingUser === user.id}
                                     className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 disabled:opacity-50"
                                   >
                                     {pausingUser === user.id ? 'Pausing...' : 'Pause'}
                                   </button>
                                 )}
                               </div>
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
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                            <td className="px-4 py-3 text-sm">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEditingCustomer(customer)}
                                  className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomer(customer.id)}
                                  className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                                >
                                  Delete
                                </button>
                              </div>
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

              {/* Edit Customer Form */}
              {editingCustomer && (
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Customer</h3>
                  <form onSubmit={handleUpdateCustomer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={editingCustomer.name}
                        onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editingCustomer.email}
                        onChange={(e) => setEditingCustomer({...editingCustomer, email: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editingCustomer.phone}
                        onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Address</label>
                      <input
                        type="text"
                        value={editingCustomer.service_address}
                        onChange={(e) => setEditingCustomer({...editingCustomer, service_address: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
                      <input
                        type="date"
                        value={editingCustomer.installation_date}
                        onChange={(e) => setEditingCustomer({...editingCustomer, installation_date: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Installation Time</label>
                      <input
                        type="text"
                        value={editingCustomer.installation_time}
                        onChange={(e) => setEditingCustomer({...editingCustomer, installation_time: e.target.value})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={editingCustomer.status || 'active'}
                        onChange={(e) => setEditingCustomer({...editingCustomer, status: e.target.value as any})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="in_progress">Missed Installation</option>
                        <option value="completed">Completed</option>
                        <option value="not_paid">Not Paid</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lead Size</label>
                      <select
                        value={editingCustomer.lead_size || '2GIG'}
                        onChange={(e) => setEditingCustomer({...editingCustomer, lead_size: e.target.value as any})}
                        required
                        className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="500MB">500MB</option>
                        <option value="1GIG">1GIG</option>
                        <option value="2GIG">2GIG</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Is Referral?</label>
                      <div className="flex items-center gap-4 mt-2">
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="edit_is_referral"
                            checked={editingCustomer.is_referral === true}
                            onChange={() => setEditingCustomer({...editingCustomer, is_referral: true})}
                            className="form-radio h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700">Yes</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="edit_is_referral"
                            checked={editingCustomer.is_referral === false || editingCustomer.is_referral === undefined}
                            onChange={() => setEditingCustomer({...editingCustomer, is_referral: false, referral_source: ''})}
                            className="form-radio h-4 w-4 text-blue-600"
                          />
                          <span className="ml-2 text-sm text-gray-700">No</span>
                        </label>
                      </div>
                    </div>
                    {editingCustomer.is_referral && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Referral Source</label>
                        <input
                          type="text"
                          value={editingCustomer.referral_source || ''}
                          onChange={(e) => setEditingCustomer({...editingCustomer, referral_source: e.target.value})}
                          placeholder="Who referred this customer?"
                          className="w-full p-2 border border-gray-300 rounded bg-white text-black focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    <div className="md:col-span-2 lg:col-span-3 flex gap-4">
                      <button
                        type="submit"
                        disabled={isUpdating}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isUpdating ? 'Updating...' : 'Update Customer'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
