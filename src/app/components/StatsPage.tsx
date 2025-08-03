'use client';

import { useState, useEffect } from 'react';
import { Customer } from '../../lib/supabase';

interface StatsPageProps {
  customers: Customer[];
}

interface MonthlyStats {
  month: string;
  count: number;
}

export default function StatsPage({ customers }: StatsPageProps) {
  const [totalCustomers, setTotalCustomers] = useState<number>(0);
  const [upcomingInstallations, setUpcomingInstallations] = useState<number>(0);
  const [pastInstallations, setPastInstallations] = useState<number>(0);
  const [thisMonthInstallations, setThisMonthInstallations] = useState<number>(0);
  const [activeCustomers, setActiveCustomers] = useState<number>(0);
  const [cancelledCustomers, setCancelledCustomers] = useState<number>(0);
  const [completedCustomers, setCompletedCustomers] = useState<number>(0);
  const [referralCustomers, setReferralCustomers] = useState<number>(0);
  const [referralSources, setReferralSources] = useState<{source: string, count: number}[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [mostPopularDay, setMostPopularDay] = useState<string>('');
  const [topAreas, setTopAreas] = useState<{area: string, count: number}[]>([]);

  useEffect(() => {
    if (!customers || customers.length === 0) return;

    // Calculate basic stats
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    // Total customers
    setTotalCustomers(customers.length);
    
    // Upcoming installations
    const upcoming = customers.filter(c => c.installation_date >= todayString);
    setUpcomingInstallations(upcoming.length);
    
    // Past installations
    const past = customers.filter(c => c.installation_date < todayString);
    setPastInstallations(past.length);
    
    // This month installations
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const thisMonth = customers.filter(c => {
      const installDate = new Date(c.installation_date);
      return installDate.getMonth() === currentMonth && installDate.getFullYear() === currentYear;
    });
    setThisMonthInstallations(thisMonth.length);
    
    // Status statistics
    const active = customers.filter(c => c.status === 'active' || c.status === undefined);
    setActiveCustomers(active.length);
    
    const cancelled = customers.filter(c => c.status === 'cancelled');
    setCancelledCustomers(cancelled.length);
    
    const completed = customers.filter(c => c.status === 'completed');
    setCompletedCustomers(completed.length);
    
    // Referral statistics
    const referrals = customers.filter(c => c.is_referral === true);
    setReferralCustomers(referrals.length);
    
    // Calculate top referral sources
    const sourceCount: {[key: string]: number} = {};
    referrals.forEach(c => {
      if (c.referral_source) {
        const source = c.referral_source;
        sourceCount[source] = (sourceCount[source] || 0) + 1;
      }
    });
    
    const sortedSources = Object.entries(sourceCount)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    setReferralSources(sortedSources);
    
    // Calculate monthly stats for the last 6 months
    const monthlyData: MonthlyStats[] = [];
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const month = monthDate.toLocaleString('default', { month: 'short' });
      const year = monthDate.getFullYear();
      const monthYear = `${month} ${year}`;
      
      const count = customers.filter(c => {
        const installDate = new Date(c.installation_date);
        return installDate.getMonth() === monthDate.getMonth() && 
               installDate.getFullYear() === monthDate.getFullYear();
      }).length;
      
      monthlyData.push({ month: monthYear, count });
    }
    setMonthlyStats(monthlyData.reverse());
    
    // Calculate most popular day of week
    const dayCount: {[key: string]: number} = {
      'Sunday': 0,
      'Monday': 0,
      'Tuesday': 0,
      'Wednesday': 0,
      'Thursday': 0,
      'Friday': 0,
      'Saturday': 0
    };
    
    customers.forEach(c => {
      const installDate = new Date(c.installation_date);
      const day = installDate.toLocaleString('default', { weekday: 'long' });
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    
    let maxDay = '';
    let maxCount = 0;
    Object.entries(dayCount).forEach(([day, count]) => {
      if (count > maxCount) {
        maxDay = day;
        maxCount = count;
      }
    });
    
    setMostPopularDay(`${maxDay} (${maxCount} installations)`);
    
    // Calculate top areas
    const areaCount: {[key: string]: number} = {};
    customers.forEach(c => {
      // Extract city or zip code from address
      const addressParts = c.service_address.split(',');
      let area = 'Unknown';
      
      if (addressParts.length > 1) {
        // Try to get city and state
        const cityState = addressParts[addressParts.length - 2]?.trim();
        if (cityState) {
          area = cityState;
        }
      }
      
      areaCount[area] = (areaCount[area] || 0) + 1;
    });
    
    const sortedAreas = Object.entries(areaCount)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    setTopAreas(sortedAreas);
    
  }, [customers]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8 border-t-4 border-purple-500">
      <h2 className="text-lg md:text-xl font-semibold mb-4 text-blue-800">Sales Analytics</h2>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Total Customers</p>
          <p className="text-2xl font-bold text-blue-700">{totalCustomers}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Upcoming Installations</p>
          <p className="text-2xl font-bold text-green-700">{upcomingInstallations}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Completed Installations</p>
          <p className="text-2xl font-bold text-yellow-700">{pastInstallations}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">This Month</p>
          <p className="text-2xl font-bold text-purple-700">{thisMonthInstallations}</p>
        </div>
        <div className="bg-pink-50 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-600">Total Referrals</p>
          <p className="text-2xl font-bold text-pink-700">{referralCustomers}</p>
        </div>
      </div>
      
      {/* Monthly Trend */}
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-3 text-gray-700">Monthly Installation Trend</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-end h-40 gap-2">
            {monthlyStats.map((stat, index) => {
              const maxCount = Math.max(...monthlyStats.map(s => s.count));
              const height = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
              
              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div 
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}%` }}
                  ></div>
                  <p className="text-xs mt-1 text-gray-600">{stat.month}</p>
                  <p className="text-xs font-semibold">{stat.count}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-md font-semibold mb-2 text-gray-700">Most Popular Day</h3>
          <p className="text-black">{mostPopularDay || 'Not enough data'}</p>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-md font-semibold mb-2 text-gray-700">Top Service Areas</h3>
          {topAreas.length > 0 ? (
            <ul className="text-black">
              {topAreas.map((area, index) => (
                <li key={index} className="flex justify-between mb-1">
                  <span>{area.area}</span>
                  <span className="font-semibold">{area.count} customers</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-black">Not enough data</p>
          )}
        </div>
      </div>
      
      {/* Referral Insights */}
      <div className="mt-6 bg-purple-50 p-4 rounded-lg">
        <h3 className="text-md font-semibold mb-3 text-purple-800">Referral Statistics</h3>
        
        <div className="flex items-center mb-3">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mr-4">
            <span className="text-2xl font-bold text-purple-700">{referralCustomers}</span>
          </div>
          <div>
            <p className="font-medium text-black">Total Referrals</p>
            <p className="text-sm text-gray-600">
              {totalCustomers > 0 ? Math.round((referralCustomers / totalCustomers) * 100) : 0}% of all customers
            </p>
          </div>
        </div>
        
        {referralSources.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium text-black mb-2">Top Referral Sources:</h4>
            <ul className="space-y-1">
              {referralSources.map((source, index) => (
                <li key={index} className="flex justify-between">
                  <span className="text-sm text-black">{source.source}</span>
                  <span className="text-sm font-medium text-purple-700">{source.count} referrals</span>
                </li>
              ))}
            </ul>
          </div>
        ) : referralCustomers > 0 ? (
          <p className="text-sm text-black">No specific sources recorded</p>
        ) : (
          <p className="text-sm text-black">No referrals recorded yet</p>
        )}
      </div>
      
      {/* Status Breakdown */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-md font-semibold mb-3 text-gray-700">Customer Status Breakdown</h3>
        
        {/* Active Customers */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-black">Active Customers</span>
            <span className="text-sm font-medium text-black">{activeCustomers} ({totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-green-600 h-2.5 rounded-full" 
              style={{ width: `${totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
        
        {/* Completed Customers */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-black">Completed Installations</span>
            <span className="text-sm font-medium text-black">{completedCustomers} ({totalCustomers > 0 ? Math.round((completedCustomers / totalCustomers) * 100) : 0}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${totalCustomers > 0 ? (completedCustomers / totalCustomers) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
        
        {/* Cancelled Customers */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-black">Cancelled Customers</span>
            <span className="text-sm font-medium text-black">{cancelledCustomers} ({totalCustomers > 0 ? Math.round((cancelledCustomers / totalCustomers) * 100) : 0}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-red-600 h-2.5 rounded-full" 
              style={{ width: `${totalCustomers > 0 ? (cancelledCustomers / totalCustomers) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {/* Customer Growth */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-md font-semibold mb-2 text-gray-700">Customer Growth</h3>
        <div className="flex items-center">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded-full">
              <div 
                className="h-4 bg-green-500 rounded-full" 
                style={{ width: `${totalCustomers > 0 ? 100 : 0}%` }}
              ></div>
            </div>
          </div>
          <span className="ml-4 text-sm font-semibold text-black">
            {totalCustomers} total
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Keep adding customers to see your growth over time!
        </p>
      </div>
    </div>
  );
}