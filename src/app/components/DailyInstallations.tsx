'use client';

import { format } from 'date-fns';
import { Customer } from '../../lib/supabase';

interface DailyInstallationsProps {
  date: Date | null;
  installations: Customer[];
}

export default function DailyInstallations({ date, installations }: DailyInstallationsProps) {
  if (!date) return null;

  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');

  // Function to get status badge styling
  const getStatusBadge = (status: string | undefined) => {
    const statusConfig = {
      'active': { label: 'Active', bgColor: 'bg-green-100', textColor: 'text-green-800' },
      'in_progress': { label: 'Missed Installation', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
      'cancelled': { label: 'Cancelled', bgColor: 'bg-red-100', textColor: 'text-red-800' },
      'paid': { label: 'Paid', bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
      'not_paid': { label: 'Not Paid', bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
      'completed': { label: 'Completed', bgColor: 'bg-blue-100', textColor: 'text-blue-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['active'];
    return config;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mt-4">
      <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-blue-800">
        Schedule for {formattedDate}
      </h3>

      {installations.length === 0 ? (
        <p className="text-black">No installations scheduled for this date.</p>
      ) : (
        <div className="space-y-4">
          {installations.map(customer => {
            const statusBadge = getStatusBadge(customer.status);
            return (
              <div key={customer.id} className="border-l-4 border-blue-500 pl-3 md:pl-4 py-2">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-base md:text-lg text-black">{customer.name}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge.bgColor} ${statusBadge.textColor}`}>
                    {statusBadge.label}
                  </span>
                </div>
                <p className="text-sm md:text-base text-black">
                  <span className="font-medium">Time:</span> {customer.installation_time}
                </p>
                <p className="text-sm md:text-base text-black">
                  <span className="font-medium">Address:</span> {customer.service_address}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}