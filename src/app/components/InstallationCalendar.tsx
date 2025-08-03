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

  // Custom tile content to show number of installations
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
        }
        .react-calendar__tile {
          padding: 1em 0.5em;
          position: relative;
          color: black;
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
          font-size: 1rem;
          padding: 0.5rem;
          color: black;
        }
        .react-calendar__navigation button:hover {
          background-color: #e0e7ff;
        }
        .react-calendar__month-view__weekdays {
          color: black;
          font-weight: bold;
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