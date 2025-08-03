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
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-4">
      <h3 className="text-xl font-semibold mb-4 text-blue-800">
        Installations for {formattedDate}
      </h3>
      
      {installations.length === 0 ? (
        <p className="text-gray-500">No installations scheduled for this date.</p>
      ) : (
        <div className="space-y-4">
          {installations.map(customer => (
            <div key={customer.id} className="border-l-4 border-blue-500 pl-4 py-2">
              <h4 className="font-semibold text-lg">{customer.name}</h4>
              <p className="text-gray-700">
                <span className="font-medium">Time:</span> {customer.installation_time}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Address:</span> {customer.service_address}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Phone:</span> {customer.phone}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Email:</span> {customer.email}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}