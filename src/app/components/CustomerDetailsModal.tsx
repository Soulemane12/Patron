'use client';

import { Customer } from '../../lib/supabase';

interface CustomerDetailsModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
}

export default function CustomerDetailsModal({ 
  customer, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete 
}: CustomerDetailsModalProps) {
  if (!isOpen || !customer) return null;

  const parseDateLocal = (isoDate: string) => new Date(`${isoDate}T00:00:00`);
  
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

  const emailSchedule = getEmailSchedule(customer.installation_date);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Customer Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Customer Name and Status */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{customer.name}</h3>
              <div className="flex gap-2">
                {customer.status && (
                  <span className={`text-sm px-3 py-1 rounded-full ${
                    customer.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : customer.status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                  </span>
                )}
                {customer.is_referral && (
                  <span className="text-sm px-3 py-1 rounded-full bg-purple-100 text-purple-800">
                    Referral
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:text-blue-800">
                    {customer.email}
                  </a>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${customer.phone}`} className="text-blue-600 hover:text-blue-800">
                    {customer.phone}
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-900">
                    {parseDateLocal(customer.installation_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installation Time</label>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-900">{customer.installation_time}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Service Address */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Address</label>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-gray-900">{customer.service_address}</span>
            </div>
          </div>

          {/* Referral Information */}
          {customer.is_referral && customer.referral_source && (
            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
              <label className="block text-sm font-medium text-purple-700 mb-1">Referral Information</label>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-purple-800">Referred by: {customer.referral_source}</span>
              </div>
            </div>
          )}

          {/* Email Schedule */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-3">Follow-up Reminders</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                <span className="text-sm text-blue-800">Pre-Install:</span>
                <span className="font-medium text-blue-900">{emailSchedule.dayBefore}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                <span className="text-sm text-blue-800">Install Day:</span>
                <span className="font-medium text-blue-900">{emailSchedule.dayOf}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-400 rounded-full"></span>
                <span className="text-sm text-blue-800">Follow-up:</span>
                <span className="font-medium text-blue-900">{emailSchedule.followUp}</span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm text-gray-600">
            <div>
              <span className="font-medium">Created:</span> {new Date(customer.created_at).toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Last Updated:</span> {new Date(customer.updated_at).toLocaleString()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => onEdit(customer)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Customer
            </button>
            <button
              onClick={() => onDelete(customer.id)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Customer
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
