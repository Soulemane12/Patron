'use client';

import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import { Customer } from '../../lib/supabase';
import 'react-calendar/dist/Calendar.css';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

interface InstallationCalendarProps {
  customers: Customer[];
  onDateClick: (date: Date, customers: Customer[]) => void;
}

interface StatusData {
  status: string;
  count: number;
  label: string;
  bgColor: string;
  textColor: string;
}

export default function InstallationCalendar({ customers, onDateClick }: InstallationCalendarProps) {
  const [value, setValue] = useState<Value>(new Date());
  const [selectedDateData, setSelectedDateData] = useState<StatusData[]>([]);

  // Group installations by date
  const installationsByDate: Record<string, Customer[]> = {};
  customers.forEach(customer => {
    const dateKey = customer.installation_date;
    if (!installationsByDate[dateKey]) {
      installationsByDate[dateKey] = [];
    }
    installationsByDate[dateKey].push(customer);
  });

  // Get status data with same colors as analytics
  const getStatusData = (customers: Customer[]): StatusData[] => {
    const statusCounts = customers.reduce((acc, customer) => {
      const status = customer.status || 'active';
      if (!acc[status]) acc[status] = 0;
      acc[status]++;
      return acc;
    }, {} as Record<string, number>);

    const statusMapping: Record<string, {label: string, bgColor: string, textColor: string}> = {
      'active': { label: 'Active', bgColor: 'bg-green-50', textColor: 'text-green-700' },
      'in_progress': { label: 'Missed Installation', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' },
      'cancelled': { label: 'Cancelled', bgColor: 'bg-red-50', textColor: 'text-red-700' },
      'paid': { label: 'Paid', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
      'not_paid': { label: 'Not Paid', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
      'completed': { label: 'Completed', bgColor: 'bg-blue-50', textColor: 'text-blue-700' }
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      label: statusMapping[status]?.label || status,
      bgColor: statusMapping[status]?.bgColor || 'bg-gray-50',
      textColor: statusMapping[status]?.textColor || 'text-gray-700'
    })).sort((a, b) => b.count - a.count);
  };

  // Initialize with today's data
  useEffect(() => {
    const today = new Date();
    const formattedDate = format(today, 'yyyy-MM-dd');
    const installationsOnDate = installationsByDate[formattedDate] || [];
    setSelectedDateData(getStatusData(installationsOnDate));
  }, [customers]);

  // Function to handle date change
  const handleDateChange = (value: Value) => {
    if (value instanceof Date) {
      setValue(value);

      // Format the selected date to match our installation_date format (YYYY-MM-DD)
      const formattedDate = format(value, 'yyyy-MM-dd');

      // Find installations for the selected date
      const installationsOnDate = installationsByDate[formattedDate] || [];

      // Update selected date data for display
      setSelectedDateData(getStatusData(installationsOnDate));

      // Call the callback with the date and installations
      onDateClick(value, installationsOnDate);
    }
  };

  // Simple tile content to show number of installations
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;

    const formattedDate = format(date, 'yyyy-MM-dd');
    const installationsOnDate = installationsByDate[formattedDate] || [];

    if (installationsOnDate.length > 0) {
      return (
        <div className="flex items-center justify-center">
          <div className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-1">
            {installationsOnDate.length}
          </div>
        </div>
      );
    }

    return null;
  };

  // Custom tile class to highlight dates with installations
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return '';

    const formattedDate = format(date, 'yyyy-MM-dd');
    const installationsOnDate = installationsByDate[formattedDate] || [];

    if (installationsOnDate.length > 0) {
      return 'has-installations';
    }

    return '';
  };

  return (
    <div className="installation-calendar">
      <style jsx global>{`
        .react-calendar {
          width: 100%;
          border: none;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          font-family: inherit;
          color: black;
          max-width: 100%;
          overflow: hidden;
        }
        .react-calendar__tile {
          padding: 0.5em 0.3em;
          position: relative;
          color: black;
          font-size: 0.9rem;
        }
        @media (min-width: 768px) {
          .react-calendar__tile {
            padding: 1em 0.5em;
            font-size: 1rem;
          }
        }
        .react-calendar__tile--now {
          background: #f0f9ff;
          color: black;
        }
        .react-calendar__tile--active {
          background: #dbeafe !important;
          color: black;
        }
        .has-installations {
          background-color: #f0f9ff;
          font-weight: bold;
          color: black;
        }
        .react-calendar__tile:hover {
          background-color: #e0e7ff;
        }
        .react-calendar__navigation {
          color: black;
        }
        .react-calendar__navigation button {
          font-size: 0.9rem;
          padding: 0.3rem;
          color: black;
        }
        @media (min-width: 768px) {
          .react-calendar__navigation button {
            font-size: 1rem;
            padding: 0.5rem;
          }
        }
        .react-calendar__navigation button:hover {
          background-color: #e0e7ff;
        }
        .react-calendar__month-view__weekdays {
          color: black;
          font-weight: bold;
          font-size: 0.8rem;
        }
        @media (min-width: 768px) {
          .react-calendar__month-view__weekdays {
            font-size: 0.9rem;
          }
        }
        .react-calendar__month-view__days__day {
          color: black;
        }
        .react-calendar__month-view__days__day--neighboringMonth {
          color: #666666;
        }
      `}</style>
      <Calendar
        onChange={handleDateChange}
        value={value}
        tileContent={tileContent}
        tileClassName={tileClassName}
        className="rounded-lg shadow-md"
      />

      {/* Selected Date Status Data */}
      {selectedDateData.length > 0 && (
        <div className="mt-6 p-4 bg-white rounded-lg shadow-md border">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            {value instanceof Date ? format(value, 'MMMM dd, yyyy') : 'Selected Date'} - Installation Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {selectedDateData.map((statusData) => (
              <div
                key={statusData.status}
                className={`${statusData.bgColor} p-4 rounded-lg text-center`}
              >
                <p className="text-sm text-black font-medium">{statusData.label}</p>
                <p className={`text-2xl font-bold ${statusData.textColor}`}>{statusData.count}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Total installations on selected date: {selectedDateData.reduce((sum, data) => sum + data.count, 0)}
          </div>
        </div>
      )}

      {selectedDateData.length === 0 && value instanceof Date && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-gray-600">No installations scheduled for {format(value, 'MMMM dd, yyyy')}</p>
        </div>
      )}
    </div>
  );
}