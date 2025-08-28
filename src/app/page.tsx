'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from './components/LoadingSpinner';
import { supabase, Customer } from '../lib/supabase';
import InstallationCalendar from './components/InstallationCalendar';
import DailyInstallations from './components/DailyInstallations';
import Navbar from './components/Navbar';
import StatsPage from './components/StatsPage';
import CustomerDetailsModal from './components/CustomerDetailsModal';

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  serviceAddress: string;
  installationDate: string;
  installationTime: string;
  isReferral: boolean;
  referralSource: string;
  leadSize?: '500MB' | '1GIG' | '2GIG';
}

export default function Home() {
  const router = useRouter();
  // Parse a YYYY-MM-DD string as a local-timezone date (avoids UTC shift)
  const parseDateLocal = (isoDate: string) => new Date(`${isoDate}T00:00:00`);
  const [inputText, setInputText] = useState('');
  const [formattedInfo, setFormattedInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateInstallations, setSelectedDateInstallations] = useState<Customer[]>([]);
  const [activeSection, setActiveSection] = useState<string>('pipeline');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isRefreshingSession, setIsRefreshingSession] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track user activity to prevent automatic logouts
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, []);

  // Check authentication status with improved session handling
  useEffect(() => {
    let mounted = true;
    let authCheckAttempts = 0;
    const maxAuthAttempts = 3;
    let retryTimeout: NodeJS.Timeout | null = null;
    
    // Add shorter timeout to prevent infinite loading on mobile
    const loadingTimeout = setTimeout(() => {
      if (mounted && isLoadingAuth) {
        console.log('Loading timeout reached, checking for mobile token...');
        
        // Check for mobile backup token in cookies before giving up
        const mobileCookieCheck = async () => {
          try {
            console.log('Timeout reached, attempting mobile session recovery...');
            
            // Check for Safari mobile specific session recovery
            const isSafariMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
            
            if (isSafariMobile) {
              console.log('Safari mobile timeout - checking for Safari session cookie');
              const cookies = document.cookie.split('; ');
              const safariCookie = cookies.find(c => c.startsWith('patron-safari-session='));
              
              if (safariCookie) {
                console.log('Found Safari session cookie, attempting recovery');
                try {
                  // Force a session refresh with the found token
                  await supabase.auth.refreshSession();
                  const { data: recoveredSession } = await supabase.auth.getSession();
                  
                  if (recoveredSession.session) {
                    console.log('Successfully recovered Safari mobile session');
                    setUser(recoveredSession.session.user);
                    setIsAuthenticated(true);
                    setIsLoadingAuth(false);
                    return;
                  }
                } catch (e) {
                  console.warn('Safari session recovery failed:', e);
                }
              }
            }
            
            // Try one more time to get the session with a fresh attempt
            try {
              const { data: freshSessionData, error: freshError } = await supabase.auth.getSession();
              if (!freshError && freshSessionData.session) {
                console.log('Found session on final attempt!');
                setUser(freshSessionData.session.user);
                setIsAuthenticated(true);
                setIsLoadingAuth(false);
                return;
              }
            } catch (e) {
              console.warn('Fresh session attempt failed:', e);
            }
            
            console.log('No valid session found, redirecting to login');
            setIsLoadingAuth(false);
            window.location.href = '/login';
          } catch (e) {
            console.error('Error in mobile recovery:', e);
            setIsLoadingAuth(false);
            window.location.href = '/login';
          }
        };
        
        mobileCookieCheck();
      }
    }, 8000); // 8 second timeout with mobile recovery attempt

    // Faster auth check with timeout handling
    const checkAuth = async () => {
      try {
        console.log('Checking authentication...');

        // Get current session with increased timeout for mobile
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);

          // Only retry for network errors, not for auth errors
          if (authCheckAttempts < maxAuthAttempts && !sessionError.message?.includes('Invalid JWT')) {
            authCheckAttempts++;
            console.log(`Auth check attempt ${authCheckAttempts}/${maxAuthAttempts}`);
            if (mounted) {
              retryTimeout = setTimeout(checkAuth, 2000); // Retry after 2 seconds
            }
            return;
          }

          // For critical auth errors, redirect immediately
          if (mounted && (sessionError.message?.includes('Invalid JWT') || sessionError.message?.includes('expired'))) {
            console.log('Critical auth error, redirecting to login');
            router.push('/login');
          } else {
            console.log('Non-critical auth error, continuing with current session');
          }
          return;
        }

        // If we have a valid session, use it
        if (session?.user) {
          console.log('Valid session found for user:', session.user.email);

          // Check if user is paused
          try {
            const { data: userStatus, error: statusError } = await supabase
              .from('user_status')
              .select('is_paused')
              .eq('user_id', session.user.id)
              .single();

            if (statusError && statusError.code !== 'PGRST116') {
              console.error('User status check error:', statusError);
            }

            if (userStatus?.is_paused) {
              // User is paused, redirect to login with message
              console.log('User account is paused, signing out...');
              await supabase.auth.signOut();
              // Clear all local storage to ensure no cached data
              localStorage.clear();
              sessionStorage.clear();
              if (mounted) {
                router.push('/login?message=account_paused');
              }
              return;
            }
          } catch (statusError) {
            console.error('Error checking user status:', statusError);
            // Don't logout on status check errors, continue with session
          }

          if (mounted) {
            setUser(session.user);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
          }
          return;
        }

        // If no session, try to get user (for cases where session is stored but not current)
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
          console.error('Auth error:', error);

          // Only retry for network errors, not for auth errors
          if (authCheckAttempts < maxAuthAttempts && !error.message?.includes('Invalid JWT')) {
            authCheckAttempts++;
            console.log(`Auth check attempt ${authCheckAttempts}/${maxAuthAttempts}`);
            if (mounted) {
              retryTimeout = setTimeout(checkAuth, 2000); // Retry after 2 seconds
            }
            return;
          }

          // For critical auth errors, redirect immediately
          if (mounted && (error.message?.includes('Invalid JWT') || error.message?.includes('expired'))) {
            console.log('Critical auth error, redirecting to login');
            router.push('/login');
          } else {
            console.log('Non-critical auth error, continuing with current session');
          }
          return;
        }

        if (user) {
          console.log('User found:', user.email);

          // Check if user is paused
          try {
            const { data: userStatus, error: statusError } = await supabase
              .from('user_status')
              .select('is_paused')
              .eq('user_id', user.id)
              .single();

            if (statusError && statusError.code !== 'PGRST116') {
              console.error('User status check error:', statusError);
            }

            if (userStatus?.is_paused) {
              await supabase.auth.signOut();
              if (mounted) {
                router.push('/login?message=account_paused');
              }
              return;
            }
          } catch (statusError) {
            console.error('Error checking user status:', statusError);
          }

          if (mounted) {
            setUser(user);
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
          }
          return;
        }

        // No user found, redirect to login
        console.log('No authenticated user found');
        if (mounted) {
          router.push('/login');
        }

      } catch (error) {
        console.error('Auth check failed:', error);

        // Only retry for network errors
        if (authCheckAttempts < maxAuthAttempts && mounted) {
          authCheckAttempts++;
          console.log(`Auth check attempt ${authCheckAttempts}/${maxAuthAttempts}`);
          retryTimeout = setTimeout(checkAuth, 2000); // Retry after 2 seconds
          return;
        }

        if (mounted) {
          router.push('/login');
        }
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    // Initial auth check with a small delay
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);

    // Listen for auth changes with improved handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state change:', event, session?.user?.email);

        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setUser(null);
          setIsAuthenticated(false);
          router.push('/login');
        } else if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in:', session.user.email);
          
          // Check if user is paused on sign in
          try {
            const { data: userStatus, error: statusError } = await supabase
              .from('user_status')
              .select('is_paused')
              .eq('user_id', session.user.id)
              .single();
            
            if (statusError && statusError.code !== 'PGRST116') {
              console.error('User status check error:', statusError);
            }
            
            if (userStatus?.is_paused) {
              await supabase.auth.signOut();
              router.push('/login?message=account_paused');
              return;
            }
          } catch (statusError) {
            console.error('Error checking user status on sign in:', statusError);
          }
          
          setUser(session.user);
          setIsAuthenticated(true);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Handle token refresh to maintain session
          console.log('Token refreshed for user:', session.user.email);
          setUser(session.user);
          setIsAuthenticated(true);
        } else if (event === 'USER_UPDATED' && session?.user) {
          // Handle user updates
          console.log('User updated:', session.user.email);
          setUser(session.user);
          setIsAuthenticated(true);
        }
      }
    );

    // Set up aggressive session refresh to prevent timeouts
    const sessionRefreshInterval = setInterval(async () => {
      if (mounted && isAuthenticated && user) {
        try {
          setIsRefreshingSession(true);
          
          // Check if user has been active in the last 30 minutes
          const timeSinceActivity = Date.now() - lastActivity;
          const thirtyMinutes = 30 * 60 * 1000;
          
          if (timeSinceActivity < thirtyMinutes) {
            // User is active, refresh session
            const { data: { session }, error } = await supabase.auth.getSession();
            if (!error && session) {
              console.log('Session refresh check - session valid, user active');
              
              // Force token refresh if needed
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              if (!refreshError && refreshData.session) {
                console.log('Session refreshed successfully');
                setUser(refreshData.user);
              }
            } else {
              console.log('Session refresh check - attempting to recover session');
              // Try to get user data as fallback
              const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
              if (!userError && currentUser) {
                console.log('Recovered user session');
                setUser(currentUser);
                setIsAuthenticated(true);
              }
            }
          } else {
            console.log('User inactive for 30+ minutes, skipping session refresh');
          }
        } catch (error) {
          console.error('Session refresh check failed:', error);
          // Don't logout on refresh errors, just log them
        } finally {
          setIsRefreshingSession(false);
        }
      }
    }, 2 * 60 * 1000); // Check every 2 minutes instead of 5

    return () => {
      mounted = false;
      clearTimeout(timer);
      clearTimeout(loadingTimeout);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      clearInterval(sessionRefreshInterval);
      subscription.unsubscribe();
    };
  }, [router, isAuthenticated, user, lastActivity]);

  // Calculate email notification dates
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

  const formatCustomerInfo = async () => {
    if (!inputText.trim()) {
      setError('Please enter customer information');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/format-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        throw new Error('Failed to format customer information');
      }

      const data = await response.json();
      // Initialize referral fields
      setFormattedInfo({
        ...data,
        isReferral: false,
        referralSource: ''
      });
      setShowCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setInputText('');
    setFormattedInfo(null);
    setError('');
    setShowCopied(false);
  };

  const saveCustomer = async () => {
    if (!formattedInfo || !user) return;

    setIsSaving(true);
    setError(''); // Clear any previous errors

    // Add timeout to prevent hanging
    const saveTimeout = setTimeout(() => {
      setError('Save operation timed out. Please try again.');
      setIsSaving(false);
    }, 30000); // 30 second timeout

    try {
      console.log('Saving customer...');

      // Determine status - if leadSize indicates paid, set to completed
      let status = 'active'; // Default status for new customers

      // Create a promise that can be aborted
      const savePromise = supabase
        .from('customers')
        .insert([
          {
            user_id: user.id,
            name: formattedInfo.name,
            email: formattedInfo.email,
            phone: formattedInfo.phone,
            service_address: formattedInfo.serviceAddress,
            installation_date: formattedInfo.installationDate,
            installation_time: formattedInfo.installationTime,
            status: status,
            is_referral: formattedInfo.isReferral || false,
            referral_source: formattedInfo.isReferral ? formattedInfo.referralSource : null,
            lead_size: formattedInfo.leadSize || '2GIG', // Default to 2GIG as requested
          },
        ])
        .select();

      // Add timeout to the save operation
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Save operation timed out')), 25000);
      });

      const result = await Promise.race([savePromise, timeoutPromise]);
      const { data, error } = result;

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(`Failed to save customer: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from save operation');
      }

      console.log('Customer saved successfully:', data[0]);

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);

      // Clear the form first
      clearForm();

      // Add a small delay to ensure the database operation is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reload customers with the new data
      await loadCustomers();

      // Switch to customers view after saving
      setActiveSection('pipeline');

    } catch (error) {
      console.error('Error saving customer:', error);
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          setError('Save operation timed out. Please check your connection and try again.');
        } else {
          setError(error.message);
        }
      } else {
        setError('Failed to save customer');
      }
    } finally {
      clearTimeout(saveTimeout);
      setIsSaving(false);
    }
  };

  // Modal handlers
  const openCustomerModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const closeCustomerModal = () => {
    setSelectedCustomer(null);
    setIsModalOpen(false);
  };

  const handleModalEdit = (customer: Customer) => {
    closeCustomerModal();
    startEditingCustomer(customer);
  };

  const handleModalDelete = (customerId: string) => {
    closeCustomerModal();
    deleteCustomer(customerId);
  };

  const loadCustomers = async () => {
    if (!user || !isAuthenticated) {
      console.log('No user available or not authenticated, skipping loadCustomers');
      return;
    }
    
    try {
      console.log('Loading customers for user:', user.id);
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error loading customers:', error);
        throw error;
      }
      
      const loadedCustomers = data || [];
      console.log(`Loaded ${loadedCustomers.length} customers`);
      
      // Debug logging to check actual status values
      console.log('Loaded customers with statuses:', loadedCustomers.map(c => ({
        name: c.name,
        status: c.status,
        installation_date: c.installation_date,
        created_at: c.created_at
      })));
      
      // Update both states
      setCustomers(loadedCustomers);
      // Don't set filteredCustomers here - it will be handled by the debounced search effect
      
    } catch (error) {
      console.error('Error loading customers:', error);
      // Don't throw here, just log the error to prevent breaking the UI
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Ensure user can only delete their own customers

      if (error) throw error;
      loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const startEditingCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
  };

  const cancelEdit = () => {
    setEditingCustomer(null);
  };
  
  const handleDateClick = (date: Date, installations: Customer[]) => {
    setSelectedDate(date);
    setSelectedDateInstallations(installations);
  };
  
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    
    // If switching to calendar view, reset the selected date
    if (section === 'calendar' && !selectedDate) {
      setSelectedDate(new Date());
    }
  };

  const updateCustomer = async () => {
    if (!editingCustomer || !user) return;

    setIsUpdating(true);
    try {
      console.log('Updating customer with status:', editingCustomer.status);
      
      // Set default status to 'active' if not specified
      let status = editingCustomer.status || 'active';
      
      // Remove the problematic logic that changes 'paid' to 'completed'
      // Each status should remain as selected by the user
      
      const { data, error } = await supabase
        .from('customers')
        .update({
          name: editingCustomer.name,
          email: editingCustomer.email,
          phone: editingCustomer.phone,
          service_address: editingCustomer.service_address,
          installation_date: editingCustomer.installation_date,
          installation_time: editingCustomer.installation_time,
          status: status,
          is_referral: editingCustomer.is_referral || false,
          referral_source: editingCustomer.is_referral ? (editingCustomer.referral_source || '') : null,
          lead_size: editingCustomer.lead_size || '2GIG',
        })
        .eq('id', editingCustomer.id)
        .eq('user_id', user.id) // Ensure user can only update their own customers
        .select();

      if (error) {
        console.error('Supabase error updating customer:', error);
        throw error;
      }

      console.log('Customer updated successfully:', data);

      setEditingCustomer(null);
      
      // Add a small delay to ensure the database operation is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reload customers with the updated data
      await loadCustomers();
      
    } catch (error) {
      console.error('Error updating customer:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Get unique locations from customers
  const getUniqueLocations = () => {
    const locations = new Set<string>();
    customers.forEach(customer => {
      const addressParts = customer.service_address.split(',');
      let location = 'Unknown';
      if (addressParts.length > 1) {
        const cityState = addressParts[addressParts.length - 2]?.trim();
        if (cityState) {
          location = cityState;
        }
      }
      locations.add(location);
    });
    return Array.from(locations).sort();
  };

  // Filter and sort customers based on search term, filter, and sort options
  const filterAndSortCustomers = useCallback((term: string, filter: string, sort: string, order: 'asc' | 'desc', location: string = 'all') => {
    let filtered = [...customers];
    
    // Apply search filter
    if (term.trim()) {
      const lowerCaseTerm = term.toLowerCase();
      filtered = filtered.filter(customer => 
        customer.name.toLowerCase().includes(lowerCaseTerm) ||
        customer.email.toLowerCase().includes(lowerCaseTerm) ||
        customer.phone.toLowerCase().includes(lowerCaseTerm) ||
        customer.service_address.toLowerCase().includes(lowerCaseTerm) ||
        customer.installation_date.includes(lowerCaseTerm) ||
        customer.installation_time.toLowerCase().includes(lowerCaseTerm)
      );
    }
    
    // Apply status and date filters
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    // Status filters
    if (filter === 'active') {
      filtered = filtered.filter(customer => customer.status === 'active' || customer.status === undefined);
    } else if (filter === 'cancelled') {
      filtered = filtered.filter(customer => customer.status === 'cancelled');
    } else if (filter === 'completed') {
      filtered = filtered.filter(customer => customer.status === 'completed');
    } else if (filter === 'not_paid') {
      filtered = filtered.filter(customer => customer.status === 'not_paid');
    } else if (filter === 'paid') {
      filtered = filtered.filter(customer => customer.status === 'paid');
    } else if (filter === 'referrals') {
      filtered = filtered.filter(customer => customer.is_referral === true);
    }
    // Date filters
    else if (filter === 'upcoming') {
      filtered = filtered.filter(customer => customer.installation_date >= todayString);
    } else if (filter === 'past') {
      filtered = filtered.filter(customer => customer.installation_date < todayString);
    } else if (filter === 'this_week') {
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(today.getDate() + 7);
      const oneWeekString = oneWeekFromNow.toISOString().split('T')[0];
      filtered = filtered.filter(customer => 
        customer.installation_date >= todayString && 
        customer.installation_date <= oneWeekString
      );
    } else if (filter === 'this_month') {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const firstDayString = firstDayOfMonth.toISOString().split('T')[0];
      const lastDayString = lastDayOfMonth.toISOString().split('T')[0];
      filtered = filtered.filter(customer => 
        customer.installation_date >= firstDayString && 
        customer.installation_date <= lastDayString
      );
    }
    
    // Apply location filter
    if (location !== 'all') {
      filtered = filtered.filter(customer => {
        const addressParts = customer.service_address.split(',');
        let customerLocation = 'Unknown';
        if (addressParts.length > 1) {
          const cityState = addressParts[addressParts.length - 2]?.trim();
          if (cityState) {
            customerLocation = cityState;
          }
        }
        return customerLocation === location;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sort) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'installation_date':
          aValue = new Date(a.installation_date);
          bValue = new Date(b.installation_date);
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'status':
          // Define an order for statuses: cancelled first, then completed, then not_paid, then paid, then active
          const statusOrder = { 'cancelled': 1, 'completed': 2, 'not_paid': 3, 'paid': 4, 'active': 5, 'undefined': 6 };
          aValue = statusOrder[a.status || 'undefined'];
          bValue = statusOrder[b.status || 'undefined'];
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }
      
      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    console.log('Filtered customers result:', {
      originalCount: customers.length,
      filteredCount: filtered.length,
      filter,
      searchTerm,
      filteredCustomers: filtered.map(c => ({ name: c.name, status: c.status }))
    });
    setFilteredCustomers(filtered);
  }, [customers]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
  };

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      filterAndSortCustomers(searchTerm, filterBy, sortBy, sortOrder, locationFilter);
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, filterAndSortCustomers, filterBy, sortBy, sortOrder, locationFilter]);

  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSortBy = e.target.value;
    setSortBy(newSortBy);
    filterAndSortCustomers(searchTerm, filterBy, newSortBy, sortOrder, locationFilter);
  };

  // Handle sort order toggle
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    filterAndSortCustomers(searchTerm, filterBy, sortBy, newOrder, locationFilter);
  };

  // Handle filter change
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilter = e.target.value;
    setFilterBy(newFilter);
    filterAndSortCustomers(searchTerm, newFilter, sortBy, sortOrder, locationFilter);
  };

  // Handle location filter change
  const handleLocationFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocation = e.target.value;
    setLocationFilter(newLocation);
    filterAndSortCustomers(searchTerm, filterBy, sortBy, sortOrder, newLocation);
  };

  // Load customers when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadCustomers();
    }
  }, [isAuthenticated, user]);

  // Initial filtering when customers are loaded
  useEffect(() => {
    if (customers.length > 0) {
      console.log('Initial filtering of customers:', {
        totalCustomers: customers.length,
        filterBy,
        searchTerm,
        customersWithStatus: customers.map(c => ({ name: c.name, status: c.status }))
      });
      filterAndSortCustomers(searchTerm, filterBy, sortBy, sortOrder, locationFilter);
    } else {
      // If no customers, set filtered to empty array
      setFilteredCustomers([]);
    }
  }, [customers, filterAndSortCustomers]);

  // Show fast loading indicator while checking authentication
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 flex flex-col items-center justify-center">
        <div className="mb-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
        <div className="text-blue-600 text-sm font-medium">Loading your account...</div>
      </div>
    );
  }

  // Show login redirect if not authenticated
  if (!isAuthenticated && !isLoadingAuth) {
    // Force direct navigation to login for more reliability
    console.log('Not authenticated, redirecting to login...');
    window.location.href = '/login';
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 flex flex-col items-center justify-center">
        <div className="text-blue-600 text-sm font-medium">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50 py-4 md:py-8">
      <div className="max-w-4xl mx-auto px-3 md:px-4">
        <div className="text-center mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-800 mb-1 md:mb-2">
            Sales Pro Tracker
          </h1>
          <p className="text-sm md:text-base text-gray-600">Your door-to-door sales assistant</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className="text-xs text-gray-500">Logged in as: {user?.email}</span>
            {isRefreshingSession && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Refreshing session...
              </span>
            )}
          </div>
        </div>
        
        <Navbar activeSection={activeSection} onSectionChange={handleSectionChange} />


        {/* Calendar View - Only shows installations for the selected date */}
        {activeSection === 'calendar' && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500">
              <h2 className="text-xl font-semibold mb-4 text-blue-800">Installation Calendar</h2>
              {customers.length > 0 ? (
                <InstallationCalendar 
                  customers={customers} 
                  onDateClick={handleDateClick} 
                />
              ) : (
                <p className="text-center py-8 text-black">No installations scheduled yet. Add some leads to see them on the calendar.</p>
              )}
            </div>
            
            {selectedDate && (
              <DailyInstallations 
                date={selectedDate} 
                installations={selectedDateInstallations} 
              />
            )}
          </div>
        )}

        {/* Sales Pipeline - Only shows saved customers */}
        {activeSection === 'pipeline' && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8 border-t-4 border-blue-500">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-blue-800">Your Saved Customers</h2>
            
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                  </svg>
                </div>
                <input 
                  type="search" 
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="block w-full p-2 pl-10 text-sm text-black border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Search customers by name, email, phone..." 
                />
              </div>
            </div>

            {/* Filter and Sort Controls */}
            <div className="mb-4 flex flex-wrap gap-3 items-center">
              {/* Filter Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-black">Filter:</label>
                <select 
                  value={filterBy}
                  onChange={handleFilterChange}
                  className="p-1 text-sm text-black border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Customers</option>
              <option value="active">In Progress Customers</option>
                  <option value="cancelled">Cancelled Customers</option>
                  <option value="completed">Completed Installations</option>
                  <option value="not_paid">Completed - Not Paid</option>
                  <option value="paid">Paid Customers</option>
                  <option value="referrals">Referrals</option>
                  <option value="upcoming">Upcoming Installations</option>
                  <option value="past">Past Installations</option>
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                </select>
              </div>

              {/* Location Filter Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-black">Location:</label>
                <select 
                  value={locationFilter}
                  onChange={handleLocationFilterChange}
                  className="p-1 text-sm text-black border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Locations</option>
                  {getUniqueLocations().map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-black">Sort by:</label>
                <select 
                  value={sortBy}
                  onChange={handleSortChange}
                  className="p-1 text-sm text-black border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="created_at">Date Added</option>
                  <option value="name">Name</option>
                  <option value="installation_date">Installation Date</option>
                  <option value="status">Status</option>
                  <option value="email">Email</option>
                </select>
              </div>

              {/* Sort Order Toggle */}
              <button
                onClick={toggleSortOrder}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                {sortOrder === 'asc' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    A-Z
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                    </svg>
                    Z-A
                  </>
                )}
              </button>
            </div>
            
            {filteredCustomers.length > 0 ? (
              <div className="space-y-4">
                {filteredCustomers.map((customer) => {
                const emailSchedule = getEmailSchedule(customer.installation_date);
                return (
                  <div key={customer.id} className={`border ${editingCustomer?.id === customer.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'} rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow`}>
                    {editingCustomer?.id === customer.id ? (
                      /* Edit Mode */
                      <>
                        <div className="mb-3">
                          <h3 className="font-semibold text-base md:text-lg text-blue-800 mb-2">Edit Customer Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Status</label>
                              <select
                                value={editingCustomer.status || 'active'}
                                onChange={(e) => setEditingCustomer({ 
                                  ...editingCustomer, 
                                  status: e.target.value as 'active' | 'cancelled' | 'completed' | 'paid' | 'not_paid' 
                                })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              >
                <option value="active">In Progress</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="completed">Completed</option>
                                <option value="not_paid">Completed - Not Paid</option>
                                <option value="paid">Paid</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Name</label>
                              <input
                                type="text"
                                value={editingCustomer.name}
                                onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Email</label>
                              <input
                                type="email"
                                value={editingCustomer.email}
                                onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Phone</label>
                              <input
                                type="tel"
                                value={editingCustomer.phone}
                                onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Service Address</label>
                              <input
                                type="text"
                                value={editingCustomer.service_address}
                                onChange={(e) => setEditingCustomer({ ...editingCustomer, service_address: e.target.value })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Installation Date</label>
                              <input
                                type="date"
                                value={editingCustomer.installation_date}
                                onChange={(e) => setEditingCustomer({ ...editingCustomer, installation_date: e.target.value })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Installation Time</label>
                              <input
                                type="text"
                                value={editingCustomer.installation_time}
                                onChange={(e) => setEditingCustomer({ ...editingCustomer, installation_time: e.target.value })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Lead Size</label>
                              <select
                                value={editingCustomer.lead_size || '2GIG'}
                                onChange={(e) => setEditingCustomer({ ...editingCustomer, lead_size: e.target.value as '500MB' | '1GIG' | '2GIG' })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              >
                                <option value="500MB">500MB</option>
                                <option value="1GIG">1GIG</option>
                                <option value="2GIG">2GIG</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs md:text-sm font-medium text-black mb-1">Is Referral?</label>
                              <div className="flex items-center gap-4 mt-1">
                                <label className="inline-flex items-center">
                                  <input
                                    type="radio"
                                    name="is_referral"
                                    checked={editingCustomer.is_referral === true}
                                    onChange={() => setEditingCustomer({ ...editingCustomer, is_referral: true })}
                                    className="form-radio h-4 w-4 text-blue-600"
                                  />
                                  <span className="ml-2 text-sm text-black">Yes</span>
                                </label>
                                <label className="inline-flex items-center">
                                  <input
                                    type="radio"
                                    name="is_referral"
                                    checked={editingCustomer.is_referral === false || editingCustomer.is_referral === undefined}
                                    onChange={() => setEditingCustomer({ ...editingCustomer, is_referral: false, referral_source: '' })}
                                    className="form-radio h-4 w-4 text-blue-600"
                                  />
                                  <span className="ml-2 text-sm text-black">No</span>
                                </label>
                              </div>
                            </div>
                            {editingCustomer.is_referral && (
                              <div>
                                <label className="block text-xs md:text-sm font-medium text-black mb-1">Referral Source</label>
                                <input
                                  type="text"
                                  value={editingCustomer.referral_source || ''}
                                  onChange={(e) => setEditingCustomer({ ...editingCustomer, referral_source: e.target.value })}
                                  placeholder="Who referred this customer?"
                                  className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button
                              onClick={updateCustomer}
                              disabled={isUpdating}
                              className="px-3 py-1 bg-green-600 text-white text-xs md:text-sm rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isUpdating ? <LoadingSpinner /> : null}
                              {isUpdating ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 bg-gray-500 text-white text-xs md:text-sm rounded hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 
                                className="font-semibold text-base md:text-lg text-black cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => openCustomerModal(customer)}
                                title="Click to view full details"
                              >
                                {customer.name}
                              </h3>
                              <div className="flex gap-1">
                                {customer.status && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    customer.status === 'active' 
                                      ? 'bg-green-100 text-green-800' 
                                      : customer.status === 'cancelled'
                                      ? 'bg-red-100 text-red-800'
                                      : customer.status === 'paid'
                                      ? 'bg-purple-100 text-purple-800'
                                      : customer.status === 'not_paid'
                                      ? 'bg-orange-100 text-orange-800'
                                      : customer.status === 'completed'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {customer.status === 'not_paid' ? 'Not Paid' : customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                                  </span>
                                )}
                                {customer.is_referral && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                    Referral
                                  </span>
                                )}
                                {/* Debug: Show raw status value */}
                                <span className="text-xs text-gray-500">
                                  (DB: {customer.status || 'null'})
                                </span>
                              </div>
                            </div>
                            <p className="text-sm md:text-base text-black">
                              <a href={`mailto:${customer.email}`} className="text-blue-600 hover:text-blue-800">
                                {customer.email}
                              </a>
                            </p>
                            <p className="text-sm md:text-base text-black">
                              <a href={`tel:${customer.phone}`} className="text-blue-600 hover:text-blue-800">
                                {customer.phone}
                              </a>
                            </p>
                            <p 
                              className="text-sm md:text-base text-black cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => openCustomerModal(customer)}
                              title="Click to view full details"
                            >
                              {customer.service_address}
                            </p>
                            <p 
                              className="text-sm md:text-base text-black cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => openCustomerModal(customer)}
                              title="Click to view full details"
                            >
                              <span className="font-medium">Installation:</span> {parseDateLocal(customer.installation_date).toLocaleDateString()} at {customer.installation_time}
                            </p>
                            <p 
                              className="text-sm md:text-base text-black cursor-pointer hover:text-blue-600 transition-colors"
                              onClick={() => openCustomerModal(customer)}
                              title="Click to view full details"
                            >
                              <span className="font-medium">Lead Size:</span> 
                              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                                customer.lead_size === '500MB' 
                                  ? 'bg-orange-100 text-orange-800' 
                                  : customer.lead_size === '1GIG'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {customer.lead_size || '2GIG'}
                              </span>
                            </p>
                            {customer.is_referral && customer.referral_source && (
                              <p 
                                className="text-sm md:text-base text-purple-700 mt-1 cursor-pointer hover:text-purple-900 transition-colors"
                                onClick={() => openCustomerModal(customer)}
                                title="Click to view full details"
                              >
                                <span className="font-medium">Referred by:</span> {customer.referral_source}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2 md:mt-0">
                            <button
                              onClick={() => startEditingCustomer(customer)}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-xs md:text-sm hover:bg-blue-600"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteCustomer(customer.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-xs md:text-sm hover:bg-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* Email Schedule - Always shown */}
                    <div className="bg-blue-50 rounded-lg p-2 md:p-3">
                      <h4 className="font-medium text-sm md:text-base text-black mb-2">Follow-up Reminders:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs md:text-sm">
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="w-2 h-2 md:w-3 md:h-3 bg-yellow-400 rounded-full"></span>
                          <span className="text-black">Pre-Install:</span>
                          <span className="font-medium text-black">{emailSchedule.dayBefore}</span>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="w-2 h-2 md:w-3 md:h-3 bg-green-400 rounded-full"></span>
                          <span className="text-black">Install Day:</span>
                          <span className="font-medium text-black">{emailSchedule.dayOf}</span>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="w-2 h-2 md:w-3 md:h-3 bg-blue-400 rounded-full"></span>
                          <span className="text-black">Follow-up:</span>
                          <span className="font-medium text-black">{emailSchedule.followUp}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              <p className="text-center py-8 text-black">
                {searchTerm || filterBy !== 'all' ? 
                  `No customers found with the current filters. Try adjusting your search or filter settings.` : 
                  "No saved customers yet. Add a new lead to get started."
                }
              </p>
            )}
          </div>
        )}
        




        {/* Stats Section */}
        {activeSection === 'stats' && (
          <StatsPage customers={customers} />
        )}

        {/* Add New Lead Section */}
        {activeSection === 'add' && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8 border-t-4 border-green-500">
            <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 text-blue-800">Add New Sales Lead</h2>
            <p className="text-xs md:text-sm text-black mb-3 md:mb-4">Paste your customer's information from your notes in any format - our AI will organize it automatically.</p>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Example: John Smith, phone 555-123-4567, email john@example.com, address 123 Main St, installation scheduled for June 15th at 2pm..."
              className="w-full h-32 p-4 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
                      <div className="flex flex-wrap gap-2 md:gap-4 mt-3 md:mt-4">
                <button
              onClick={formatCustomerInfo}
              disabled={isLoading}
              className="px-4 md:px-6 py-2 bg-green-600 text-white text-xs md:text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 md:gap-2"
            >
              {isLoading ? <LoadingSpinner /> : null}
              <span className="flex items-center gap-1 md:gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Process Lead
              </span>
                </button>
                <button
              onClick={clearForm}
              className="px-4 md:px-6 py-2 bg-gray-500 text-white text-xs md:text-sm rounded-lg hover:bg-gray-600"
                >
                  Clear
                </button>
              </div>
            {error && <p className="text-red-600 mt-2">{error}</p>}
          </div>
        )}

        {/* Formatted Information - Only show when in Add section */}
        {activeSection === 'add' && formattedInfo && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8 border-t-4 border-purple-500">
            <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 text-blue-800">Review Lead Information</h2>
            <p className="text-xs md:text-sm text-black mb-3 md:mb-4">Verify the details below before saving this lead to your sales pipeline.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Name</label>
                <input
                  type="text"
                  value={formattedInfo.name}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, name: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
                    </div>
                <div>
                  <label className="block text-xs md:text-sm font-medium text-black mb-1">Is Referral?</label>
                  <div className="flex items-center gap-4 mt-1">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="formatted_is_referral"
                        checked={formattedInfo.isReferral === true}
                        onChange={() => setFormattedInfo({ ...formattedInfo, isReferral: true })}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-black">Yes</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="formatted_is_referral"
                        checked={formattedInfo.isReferral === false || formattedInfo.isReferral === undefined}
                        onChange={() => setFormattedInfo({ ...formattedInfo, isReferral: false, referralSource: '' })}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-black">No</span>
                    </label>
                  </div>
                </div>
                <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Email</label>
                <input
                  type="email"
                  value={formattedInfo.email}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, email: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
                    </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Phone</label>
                <input
                  type="tel"
                  value={formattedInfo.phone}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, phone: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
                    </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Service Address</label>
                <input
                  type="text"
                  value={formattedInfo.serviceAddress}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, serviceAddress: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
                </div>
                <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Installation Date</label>
                <input
                  type="date"
                  value={formattedInfo.installationDate}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, installationDate: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Installation Time</label>
                <input
                  type="text"
                  value={formattedInfo.installationTime}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, installationTime: e.target.value })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-black mb-1">Lead Size</label>
                <select
                  value={formattedInfo.leadSize || '2GIG'}
                  onChange={(e) => setFormattedInfo({ ...formattedInfo, leadSize: e.target.value as '500MB' | '1GIG' | '2GIG' })}
                  className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="500MB">500MB</option>
                  <option value="1GIG">1GIG</option>
                  <option value="2GIG">2GIG</option>
                </select>
              </div>
              {formattedInfo.isReferral && (
                <div>
                  <label className="block text-xs md:text-sm font-medium text-black mb-1">Referral Source</label>
                  <input
                    type="text"
                    value={formattedInfo.referralSource || ''}
                    onChange={(e) => setFormattedInfo({ ...formattedInfo, referralSource: e.target.value })}
                    placeholder="Who referred this customer?"
                    className="w-full p-2 md:p-3 text-sm md:text-base border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  />
                </div>
              )}
            </div>
            <button
              onClick={saveCustomer}
              disabled={isSaving}
              className="mt-3 md:mt-4 px-4 md:px-6 py-2 bg-green-600 text-white text-xs md:text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 md:gap-2"
            >
              {isSaving ? <LoadingSpinner /> : null}
              <span className="flex items-center gap-1 md:gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
                </svg>
                {isSaving ? 'Saving...' : 'Add to Pipeline'}
              </span>
            </button>
            {showSaved && (
              <p className="text-green-600 mt-2">Customer saved successfully!</p>
            )}
          </div>
        )}

        {/* Customer Details Modal */}
        <CustomerDetailsModal
          customer={selectedCustomer}
          isOpen={isModalOpen}
          onClose={closeCustomerModal}
          onEdit={handleModalEdit}
          onDelete={handleModalDelete}
        />

      </div>
    </div>
  );
}
