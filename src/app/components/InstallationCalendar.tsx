'use client';

import { useState, useMemo } from 'react';
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [leadSizeFilter, setLeadSizeFilter] = useState<string>('all');
  const [referralFilter, setReferralFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Filter customers based on selected filters
  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && !(customer.status === 'active' || customer.status === undefined)) {
          return false;
        } else if (statusFilter !== 'active' && customer.status !== statusFilter) {
          return false;
        }
      }

      // Lead size filter
      if (leadSizeFilter !== 'all' && customer.lead_size !== leadSizeFilter) {
        return false;
      }

      // Referral filter
      if (referralFilter === 'referral' && !customer.is_referral) {
        return false;
      } else if (referralFilter === 'non_referral' && customer.is_referral) {
        return false;
      }

      return true;
    });
  }, [customers, statusFilter, leadSizeFilter, referralFilter]);

  // Group filtered installations by date
  const installationsByDate: Record<string, Customer[]> = {};
  filteredCustomers.forEach(customer => {
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

  // Custom tile class to highlight dates with installations and show status colors
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return '';

    const formattedDate = format(date, 'yyyy-MM-dd');
    const installationsOnDate = installationsByDate[formattedDate] || [];

    if (installationsOnDate.length > 0) {
      // Determine the dominant status for the day
      const statusCounts = installationsOnDate.reduce((acc, customer) => {
        const status = customer.status || 'active';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dominantStatus = Object.entries(statusCounts).reduce((a, b) =>
        statusCounts[a[0]] > statusCounts[b[0]] ? a : b
      )[0];

      // Return appropriate class based on dominant status
      switch (dominantStatus) {
        case 'active':
          return 'has-installations has-active';
        case 'in_progress':
          return 'has-installations has-missed';
        case 'completed':
          return 'has-installations has-completed';
        case 'not_paid':
          return 'has-installations has-not-paid';
        case 'paid':
          return 'has-installations has-paid';
        case 'cancelled':
          return 'has-installations has-cancelled';
        default:
          return 'has-installations';
      }
    }

    return '';
  };

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setLeadSizeFilter('all');
    setReferralFilter('all');
  };

  // Get filter count
  const activeFilterCount = [statusFilter, leadSizeFilter, referralFilter].filter(filter => filter !== 'all').length;

  return (
    <div className="installation-calendar">
      {/* Filter Section */}
      <div className="mb-4 bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Calendar Filters</h3>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </span>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="in_progress">Missed Installation</option>
                  <option value="completed">Completed</option>
                  <option value="not_paid">Not Paid</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Lead Size Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lead Size</label>
                <select
                  value={leadSizeFilter}
                  onChange={(e) => setLeadSizeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Sizes</option>
                  <option value="500MB">500MB</option>
                  <option value="1GIG">1GIG</option>
                  <option value="2GIG">2GIG</option>
                </select>
              </div>

              {/* Referral Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Referral Status</label>
                <select
                  value={referralFilter}
                  onChange={(e) => setReferralFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Customers</option>
                  <option value="referral">Referrals Only</option>
                  <option value="non_referral">Non-Referrals Only</option>
                </select>
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {filteredCustomers.length} of {customers.length} customers
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Color Legend */}
      <div className="mb-4 bg-white rounded-lg shadow-sm border p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Calendar Color Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-green-600 bg-green-100"></div>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-amber-600 bg-amber-100"></div>
            <span>Missed Installation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-blue-600 bg-blue-100"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-orange-600 bg-orange-100"></div>
            <span>Not Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-purple-600 bg-purple-100"></div>
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-l-4 border-red-600 bg-red-100"></div>
            <span>Cancelled</span>
          </div>
        </div>
      </div>

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
        .has-active {
          background-color: #dcfce7;
          border-left: 4px solid #16a34a;
        }
        .has-missed {
          background-color: #fef3c7;
          border-left: 4px solid #d97706;
        }
        .has-completed {
          background-color: #dbeafe;
          border-left: 4px solid #2563eb;
        }
        .has-not-paid {
          background-color: #fed7aa;
          border-left: 4px solid #ea580c;
        }
        .has-paid {
          background-color: #e9d5ff;
          border-left: 4px solid #9333ea;
        }
        .has-cancelled {
          background-color: #fecaca;
          border-left: 4px solid #dc2626;
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