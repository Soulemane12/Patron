'use client';

import { useState } from 'react';
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

export default function InstallationCalendar({ customers, onDateClick }: InstallationCalendarProps) {
  const [value, setValue] = useState<Value>(new Date());
  
  // Group installations by date
  const installationsByDate: Record<string, Customer[]> = {};
  customers.forEach(customer => {
    const dateKey = customer.installation_date;
    if (!installationsByDate[dateKey]) {
      installationsByDate[dateKey] = [];
    }
    installationsByDate[dateKey].push(customer);
  });

  // Function to handle date change
  const handleDateChange = (value: Value) => {
    if (value instanceof Date) {
      setValue(value);
      
      // Format the selected date to match our installation_date format (YYYY-MM-DD)
      const formattedDate = format(value, 'yyyy-MM-dd');
      
      // Find installations for the selected date
      const installationsOnDate = installationsByDate[formattedDate] || [];
      
      // Call the callback with the date and installations
      onDateClick(value, installationsOnDate);
    }
  };

  // Get the color for a status that matches the analytics colors
  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'paid':
        return 'bg-purple-500';
      case 'not_paid':
        return 'bg-orange-500';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Custom tile content to show number of installations with status colors
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;

    const formattedDate = format(date, 'yyyy-MM-dd');
    const installationsOnDate = installationsByDate[formattedDate] || [];

    if (installationsOnDate.length > 0) {
      // Group by status to show different colored dots
      const statusGroups = installationsOnDate.reduce((acc, customer) => {
        const status = customer.status || 'active';
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {} as Record<string, number>);

      const statusEntries = Object.entries(statusGroups);

      if (statusEntries.length === 1) {
        // Single status - show one dot with count
        const [status, count] = statusEntries[0];
        return (
          <div className="flex items-center justify-center">
            <div className={`${getStatusColor(status)} text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mt-1`}>
              {count}
            </div>
          </div>
        );
      } else {
        // Multiple statuses - show multiple smaller dots
        return (
          <div className="flex items-center justify-center flex-wrap gap-0.5 mt-1">
            {statusEntries.slice(0, 3).map(([status, count], index) => (
              <div
                key={status}
                className={`${getStatusColor(status)} text-white rounded-full w-3 h-3 flex items-center justify-center text-xs`}
                title={`${status}: ${count}`}
              >
                {count}
              </div>
            ))}
            {statusEntries.length > 3 && (
              <div className="bg-gray-400 text-white rounded-full w-3 h-3 flex items-center justify-center text-xs">
                +
              </div>
            )}
          </div>
        );
      }
    }

    return null;
  };

  // Custom tile class to highlight dates with installations
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return '';

    const formattedDate = format(date, 'yyyy-MM-dd');
    const installationsOnDate = installationsByDate[formattedDate] || [];

    if (installationsOnDate.length > 0) {
      // Get the most common status for background color
      const statusCounts = installationsOnDate.reduce((acc, customer) => {
        const status = customer.status || 'active';
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {} as Record<string, number>);

      const primaryStatus = Object.entries(statusCounts)
        .sort(([,a], [,b]) => b - a)[0][0];

      return `has-installations status-${primaryStatus}`;
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
          font-weight: bold;
          color: black;
        }
        .status-active {
          background-color: #dcfce7; /* green-100 */
        }
        .status-in_progress {
          background-color: #fef3c7; /* yellow-100 */
        }
        .status-cancelled {
          background-color: #fee2e2; /* red-100 */
        }
        .status-paid {
          background-color: #f3e8ff; /* purple-100 */
        }
        .status-not_paid {
          background-color: #fed7aa; /* orange-100 */
        }
        .status-completed {
          background-color: #dbeafe; /* blue-100 */
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
    </div>
  );
}