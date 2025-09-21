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
  const [inProgressCustomers, setInProgressCustomers] = useState<number>(0);
  const [cancelledCustomers, setCancelledCustomers] = useState<number>(0);
  const [completedCustomers, setCompletedCustomers] = useState<number>(0);
  const [notPaidCustomers, setNotPaidCustomers] = useState<number>(0);
  const [paidCustomers, setPaidCustomers] = useState<number>(0);
  const [referralCustomers, setReferralCustomers] = useState<number>(0);
  const [referralSources, setReferralSources] = useState<{source: string, count: number}[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [mostPopularDay, setMostPopularDay] = useState<string>('');
  const [topAreas, setTopAreas] = useState<{area: string, count: number}[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalCustomers, setModalCustomers] = useState<Customer[]>([]);

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

    const inProgress = customers.filter(c => c.status === 'in_progress');
    setInProgressCustomers(inProgress.length);

    const cancelled = customers.filter(c => c.status === 'cancelled');
    setCancelledCustomers(cancelled.length);
    
    // For analytics, "completed" should include both 'completed' and 'not_paid' statuses
    // since both represent completed installations
    const completed = customers.filter(c => c.status === 'completed' || c.status === 'not_paid' || c.status === 'paid');
    setCompletedCustomers(completed.length);
    
    const notPaid = customers.filter(c => c.status === 'not_paid');
    setNotPaidCustomers(notPaid.length);
    
    const paid = customers.filter(c => c.status === 'paid');
    setPaidCustomers(paid.length);
    
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
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
        {/* Total Customers */}
        <div
          className="bg-blue-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            setModalCustomers(customers);
            setModalTitle(`Total Customers (${customers.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setModalCustomers(customers);
              setModalTitle(`Total Customers (${customers.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">Total Customers</p>
          <p className="text-2xl font-bold text-blue-700">{totalCustomers}</p>
        </div>
        {/* Upcoming Installations */}
        <div
          className="bg-green-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const todayString = new Date().toISOString().split('T')[0];
            const list = customers.filter(c => c.installation_date >= todayString);
            setModalCustomers(list);
            setModalTitle(`Upcoming Installations (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const todayString = new Date().toISOString().split('T')[0];
              const list = customers.filter(c => c.installation_date >= todayString);
              setModalCustomers(list);
              setModalTitle(`Upcoming Installations (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">Upcoming Installations</p>
          <p className="text-2xl font-bold text-green-700">{upcomingInstallations}</p>
        </div>
        {/* Completed Installations (by status) */}
        <div
          className="bg-yellow-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            // Include all completed installations: completed, not_paid, and paid
            const list = customers.filter(c => c.status === 'completed' || c.status === 'not_paid' || c.status === 'paid');
            setModalCustomers(list);
            setModalTitle(`Completed Installations (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              // Include all completed installations: completed, not_paid, and paid
              const list = customers.filter(c => c.status === 'completed' || c.status === 'not_paid' || c.status === 'paid');
              setModalCustomers(list);
              setModalTitle(`Completed Installations (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">Completed Installations</p>
          <p className="text-2xl font-bold text-yellow-700">{completedCustomers}</p>
        </div>

        {/* This Month */}
        <div
          className="bg-purple-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const list = customers.filter(c => {
              const d = new Date(c.installation_date);
              return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });
            setModalCustomers(list);
            setModalTitle(`This Month (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              const list = customers.filter(c => {
                const d = new Date(c.installation_date);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
              });
              setModalCustomers(list);
              setModalTitle(`This Month (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">This Month</p>
          <p className="text-2xl font-bold text-purple-700">{thisMonthInstallations}</p>
        </div>
        {/* Total Referrals */}
        <div
          className="bg-pink-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.is_referral === true);
            setModalCustomers(list);
            setModalTitle(`Total Referrals (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.is_referral === true);
              setModalCustomers(list);
              setModalTitle(`Total Referrals (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">Total Referrals</p>
          <p className="text-2xl font-bold text-pink-700">{referralCustomers}</p>
        </div>
        {/* Missed Installation Customers */}
        <div
          className="bg-yellow-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'in_progress');
            setModalCustomers(list);
            setModalTitle(`Missed Installation Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'in_progress');
              setModalCustomers(list);
              setModalTitle(`Missed Installation Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">Missed Installation Customers</p>
          <p className="text-2xl font-bold text-yellow-700">{inProgressCustomers}</p>
        </div>
        {/* Not Paid Customers */}
        <div
          className="bg-orange-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'not_paid');
            setModalCustomers(list);
            setModalTitle(`Not Paid Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'not_paid');
              setModalCustomers(list);
              setModalTitle(`Not Paid Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">Not Paid Customers</p>
          <p className="text-2xl font-bold text-orange-700">{notPaidCustomers}</p>
        </div>
        {/* Paid Customers */}
        <div
          className="bg-purple-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'paid');
            setModalCustomers(list);
            setModalTitle(`Paid Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'paid');
              setModalCustomers(list);
              setModalTitle(`Paid Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">Paid Customers</p>
          <p className="text-2xl font-bold text-purple-700">{paidCustomers}</p>
        </div>
        {/* Cancelled */}
        <div
          className="bg-red-50 p-4 rounded-lg text-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'cancelled');
            setModalCustomers(list);
            setModalTitle(`Cancelled Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'cancelled');
              setModalCustomers(list);
              setModalTitle(`Cancelled Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <p className="text-sm text-black">Cancelled</p>
          <p className="text-2xl font-bold text-red-700">{cancelledCustomers}</p>
        </div>
      </div>
      
      {/* Monthly Trend */}
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-3 text-black">Monthly Installation Trend</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-end h-40 gap-2">
            {monthlyStats.map((stat, index) => {
              const maxCount = Math.max(...monthlyStats.map(s => s.count));
              const height = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
              
              return (
                <div 
                  key={index} 
                  className="flex flex-col items-center flex-1 cursor-pointer hover:bg-blue-50 p-2 rounded transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const [month, year] = stat.month.split(' ');
                    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
                    const yearNum = parseInt(year);
                    const list = customers.filter(c => {
                      const installDate = new Date(c.installation_date);
                      return installDate.getMonth() === monthIndex && installDate.getFullYear() === yearNum;
                    });
                    setModalCustomers(list);
                    setModalTitle(`${stat.month} Installations (${list.length})`);
                    setIsModalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const [month, year] = stat.month.split(' ');
                      const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
                      const yearNum = parseInt(year);
                      const list = customers.filter(c => {
                        const installDate = new Date(c.installation_date);
                        return installDate.getMonth() === monthIndex && installDate.getFullYear() === yearNum;
                      });
                      setModalCustomers(list);
                      setModalTitle(`${stat.month} Installations (${list.length})`);
                      setIsModalOpen(true);
                    }
                  }}
                >
                  <div className="w-full h-32 flex items-end">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                      style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : 0 }}
                    ></div>
                  </div>
                  <p className="text-xs mt-1 text-black font-medium">{stat.month}</p>
                  <p className="text-xs font-semibold text-blue-700">{stat.count}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          className="bg-gray-50 p-4 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (mostPopularDay) {
              const dayMatch = mostPopularDay.match(/^(\w+)/);
              if (dayMatch) {
                const dayName = dayMatch[1];
                const list = customers.filter(c => {
                  const installDate = new Date(c.installation_date);
                  const day = installDate.toLocaleString('default', { weekday: 'long' });
                  return day === dayName;
                });
                setModalCustomers(list);
                setModalTitle(`${dayName} Installations (${list.length})`);
                setIsModalOpen(true);
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (mostPopularDay) {
                const dayMatch = mostPopularDay.match(/^(\w+)/);
                if (dayMatch) {
                  const dayName = dayMatch[1];
                  const list = customers.filter(c => {
                    const installDate = new Date(c.installation_date);
                    const day = installDate.toLocaleString('default', { weekday: 'long' });
                    return day === dayName;
                  });
                  setModalCustomers(list);
                  setModalTitle(`${dayName} Installations (${list.length})`);
                  setIsModalOpen(true);
                }
              }
            }
          }}
        >
          <h3 className="text-md font-semibold mb-2 text-black">Most Popular Day</h3>
          <p className="text-black font-medium">{mostPopularDay || 'Not enough data'}</p>
          <p className="text-xs text-gray-600 mt-1">Click to view all installations on this day</p>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-md font-semibold mb-2 text-black">Top Service Areas</h3>
          {topAreas.length > 0 ? (
            <ul className="text-black">
              {topAreas.map((area, index) => (
                <li 
                  key={index} 
                  className="flex justify-between mb-1 cursor-pointer hover:bg-gray-100 p-1 rounded transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const list = customers.filter(c => {
                      const addressParts = c.service_address.split(',');
                      let customerArea = 'Unknown';
                      if (addressParts.length > 1) {
                        const cityState = addressParts[addressParts.length - 2]?.trim();
                        if (cityState) {
                          customerArea = cityState;
                        }
                      }
                      return customerArea === area.area;
                    });
                    setModalCustomers(list);
                    setModalTitle(`${area.area} Customers (${list.length})`);
                    setIsModalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const list = customers.filter(c => {
                        const addressParts = c.service_address.split(',');
                        let customerArea = 'Unknown';
                        if (addressParts.length > 1) {
                          const cityState = addressParts[addressParts.length - 2]?.trim();
                          if (cityState) {
                            customerArea = cityState;
                          }
                        }
                        return customerArea === area.area;
                      });
                      setModalCustomers(list);
                      setModalTitle(`${area.area} Customers (${list.length})`);
                      setIsModalOpen(true);
                    }
                  }}
                >
                  <span className="font-medium">{area.area}</span>
                  <span className="font-semibold text-blue-700">{area.count} customers</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-black">Not enough data</p>
          )}
          <p className="text-xs text-gray-600 mt-2">Click on any area to view customers</p>
        </div>
      </div>
      
      {/* Referral Insights */}
      <div className="mt-6 bg-purple-50 p-4 rounded-lg">
        <h3 className="text-md font-semibold mb-3 text-purple-800">Referral Statistics</h3>
        
        <div 
          className="flex items-center mb-3 cursor-pointer hover:bg-purple-100 p-2 rounded transition-colors"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.is_referral === true);
            setModalCustomers(list);
            setModalTitle(`All Referral Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.is_referral === true);
              setModalCustomers(list);
              setModalTitle(`All Referral Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mr-4">
            <span className="text-2xl font-bold text-purple-700">{referralCustomers}</span>
          </div>
          <div>
            <p className="font-medium text-black">Total Referrals</p>
            <p className="text-sm text-black">
              {totalCustomers > 0 ? Math.round((referralCustomers / totalCustomers) * 100) : 0}% of all customers
            </p>
            <p className="text-xs text-purple-600 mt-1">Click to view all referral customers</p>
          </div>
        </div>
        
        {referralSources.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium text-black mb-2">Top Referral Sources:</h4>
            <ul className="space-y-1">
              {referralSources.map((source, index) => (
                <li 
                  key={index} 
                  className="flex justify-between cursor-pointer hover:bg-purple-50 p-1 rounded transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const list = customers.filter(c => c.is_referral === true && c.referral_source === source.source);
                    setModalCustomers(list);
                    setModalTitle(`${source.source} Referrals (${list.length})`);
                    setIsModalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const list = customers.filter(c => c.is_referral === true && c.referral_source === source.source);
                      setModalCustomers(list);
                      setModalTitle(`${source.source} Referrals (${list.length})`);
                      setIsModalOpen(true);
                    }
                  }}
                >
                  <span className="text-sm text-black font-medium">{source.source}</span>
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
      
      {/* Status Breakdown */
      }
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-md font-semibold mb-3 text-black">Customer Status Breakdown</h3>
        
        {/* Active Customers */}
        <div
          className="mb-3 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'active' || c.status === undefined);
            setModalCustomers(list);
            setModalTitle(`Active Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'active' || c.status === undefined);
              setModalCustomers(list);
              setModalTitle(`Active Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
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

        {/* Missed Installation Customers */}
        <div
          className="mb-3 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'in_progress');
            setModalCustomers(list);
            setModalTitle(`Missed Installation Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'in_progress');
              setModalCustomers(list);
              setModalTitle(`Missed Installation Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-black">Missed Installation Customers</span>
            <span className="text-sm font-medium text-black">{inProgressCustomers} ({totalCustomers > 0 ? Math.round((inProgressCustomers / totalCustomers) * 100) : 0}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-yellow-600 h-2.5 rounded-full"
              style={{ width: `${totalCustomers > 0 ? (inProgressCustomers / totalCustomers) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
        
        {/* Completed Customers */}
        <div
          className="mb-3 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            // Include all completed installations: completed, not_paid, and paid
            const list = customers.filter(c => c.status === 'completed' || c.status === 'not_paid' || c.status === 'paid');
            setModalCustomers(list);
            setModalTitle(`Completed Installations (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              // Include all completed installations: completed, not_paid, and paid
              const list = customers.filter(c => c.status === 'completed' || c.status === 'not_paid' || c.status === 'paid');
              setModalCustomers(list);
              setModalTitle(`Completed Installations (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
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
        
        {/* Not Paid Customers */}
        <div
          className="mb-3 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'not_paid');
            setModalCustomers(list);
            setModalTitle(`Not Paid Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'not_paid');
              setModalCustomers(list);
              setModalTitle(`Not Paid Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-black">Not Paid Customers</span>
            <span className="text-sm font-medium text-black">{notPaidCustomers} ({totalCustomers > 0 ? Math.round((notPaidCustomers / totalCustomers) * 100) : 0}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-orange-600 h-2.5 rounded-full" 
              style={{ width: `${totalCustomers > 0 ? (notPaidCustomers / totalCustomers) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
        
        {/* Paid Customers */}
        <div
          className="mb-3 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'paid');
            setModalCustomers(list);
            setModalTitle(`Paid Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'paid');
              setModalCustomers(list);
              setModalTitle(`Paid Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-black">Paid Customers</span>
            <span className="text-sm font-medium text-black">{paidCustomers} ({totalCustomers > 0 ? Math.round((paidCustomers / totalCustomers) * 100) : 0}%)</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-purple-600 h-2.5 rounded-full" 
              style={{ width: `${totalCustomers > 0 ? (paidCustomers / totalCustomers) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
        
        {/* Cancelled Customers */}
        <div
          className="cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            const list = customers.filter(c => c.status === 'cancelled');
            setModalCustomers(list);
            setModalTitle(`Cancelled Customers (${list.length})`);
            setIsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const list = customers.filter(c => c.status === 'cancelled');
              setModalCustomers(list);
              setModalTitle(`Cancelled Customers (${list.length})`);
              setIsModalOpen(true);
            }
          }}
        >
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-4xl mx-4 rounded-lg shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-black">{modalTitle}</h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-sm px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-black transition-colors"
              >
                ✕ Close
              </button>
            </div>
            {modalCustomers.length > 0 ? (
              <div className="max-h-96 overflow-auto">
                <div className="grid gap-3">
                  {modalCustomers.map((c) => (
                    <div key={c.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="font-semibold text-black text-lg">{c.name}</h5>
                            {c.status && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                c.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : c.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                              </span>
                            )}
                            {c.is_referral && (
                              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                                Referral
                              </span>
                            )}
                            {c.lead_size && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                c.lead_size === '500MB' 
                                  ? 'bg-orange-100 text-orange-800' 
                                  : c.lead_size === '1GIG'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {c.lead_size}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">📧</span>
                              <a href={`mailto:${c.email}`} className="text-blue-600 hover:text-blue-800">
                                {c.email}
                              </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">📞</span>
                              <a href={`tel:${c.phone}`} className="text-blue-600 hover:text-blue-800">
                                {c.phone}
                              </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">📅</span>
                              <span className="text-black">
                                {new Date(c.installation_date).toLocaleDateString()} at {c.installation_time}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">📍</span>
                              <span className="text-black">{c.service_address}</span>
                            </div>
                          </div>
                          {c.is_referral && c.referral_source && (
                            <div className="mt-2 text-sm">
                              <span className="text-purple-600 font-medium">Referred by:</span> {c.referral_source}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 md:mt-0 md:ml-4">
                          <div className="text-xs text-gray-500">
                            <div>Created: {new Date(c.created_at).toLocaleDateString()}</div>
                            <div>Updated: {new Date(c.updated_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg">No customers found in this category.</p>
                <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or add more customers.</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Customer Growth */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="text-md font-semibold mb-2 text-black">Customer Growth</h3>
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
        <p className="text-xs text-black mt-2">
          Keep adding customers to see your growth over time!
        </p>
      </div>
    </div>
  );
}