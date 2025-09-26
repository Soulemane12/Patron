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
  const [inputText, setInputText] = useState(() => {
    // Try to restore input text from localStorage immediately on page load
    if (typeof window !== 'undefined') {
      try {
        const savedInputText = localStorage.getItem('patron-input-text') || 
                             sessionStorage.getItem('patron-input-text');
        if (savedInputText) {
          console.log('🔄 Restored input text from localStorage on page load');
          return savedInputText;
        }
      } catch (error) {
        console.warn('Could not load saved input text:', error);
      }
    }
    return '';
  });
  const [formattedInfo, setFormattedInfo] = useState<CustomerInfo | null>(() => {
    // Try to restore formatted info from localStorage immediately on page load
    if (typeof window !== 'undefined') {
      try {
        const savedFormattedInfo = localStorage.getItem('patron-formatted-info') || 
                                 sessionStorage.getItem('patron-formatted-info');
        if (savedFormattedInfo) {
          console.log('🔄 Restored formatted info from localStorage on page load');
          return JSON.parse(savedFormattedInfo);
        }
      } catch (error) {
        console.warn('Could not load saved formatted info:', error);
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateInstallations, setSelectedDateInstallations] = useState<Customer[]>([]);
  const [activeSection, setActiveSection] = useState<string>(() => {
    // Try to get the last active section from localStorage on page load
    if (typeof window !== 'undefined') {
      try {
        const savedSection = localStorage.getItem('patron-active-section');
        // Only return saved section if it's valid, otherwise default to pipeline
        if (savedSection && ['pipeline', 'calendar', 'add', 'stats'].includes(savedSection)) {
          return savedSection;
        }
      } catch (error) {
        console.warn('Could not load saved section:', error);
      }
    }
    return 'pipeline'; // Default fallback
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [gigSizeFilter, setGigSizeFilter] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [calendarStatusFilter, setCalendarStatusFilter] = useState<string>('all');
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isRefreshingSession, setIsRefreshingSession] = useState<boolean>(false);
  const [isManualSaving, setIsManualSaving] = useState(false); // Lock to prevent auto-save interference
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResults, setBatchResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
  const [batchPreview, setBatchPreview] = useState<CustomerInfo[]>([]);
  const [showBatchPreview, setShowBatchPreview] = useState(false);
  const [isPreviewingBatch, setIsPreviewingBatch] = useState(false);

  // Fallback function to load from localStorage
  const loadFromLocalStorageFallback = useCallback(() => {
    console.log('🔄 Trying localStorage fallback...');
    
    try {
      if (typeof window !== 'undefined') {
        const savedInputText = localStorage.getItem('patron-input-text') || 
                             sessionStorage.getItem('patron-input-text');
        const savedFormattedInfo = localStorage.getItem('patron-formatted-info') || 
                                 sessionStorage.getItem('patron-formatted-info');
        
        if (savedInputText && !inputText) {
          setInputText(savedInputText);
          console.log('📝 Restored input text from localStorage');
        }
        
        if (savedFormattedInfo && !formattedInfo) {
          setFormattedInfo(JSON.parse(savedFormattedInfo));
          console.log('📋 Restored formatted info from localStorage');
        }
        
        if (savedInputText || savedFormattedInfo) {
          console.log('✅ Successfully loaded from localStorage fallback');
        } else {
          console.log('📭 No saved data found in localStorage either');
        }
      }
    } catch (error) {
      console.warn('❌ localStorage fallback also failed:', error);
    }
  }, [inputText, formattedInfo]);

  // Load draft data from database when user authenticates
  const loadDraftFromDatabase = useCallback(async () => {
    console.log('🔄 Attempting to load draft from database...');
    
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session?.access_token) {
        console.log('❌ No session token available for draft loading');
        loadFromLocalStorageFallback();
        return;
      }

      console.log('✅ Session token found, making API request...');
      const response = await fetch('/api/drafts/load', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📥 API response:', data);
        
        if (data.success && data.draft) {
          console.log('✅ Draft found in database:', data.draft);
          if (data.draft.input_text && !inputText) {
            setInputText(data.draft.input_text);
            console.log('📝 Restored input text from database');
          }
          if (data.draft.formatted_info && !formattedInfo) {
            setFormattedInfo(data.draft.formatted_info);
            console.log('📋 Restored formatted info from database');
          }
          return; // Successfully loaded from database
        } else {
          console.log('📭 No draft found in database, trying localStorage fallback');
        }
      } else {
        console.warn('❌ API request failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.warn('Error details:', errorText);
      }
    } catch (error) {
      console.warn('❌ Database draft loading failed:', error);
    }
    
    // Fallback to localStorage if database fails
    loadFromLocalStorageFallback();
  }, [loadFromLocalStorageFallback]);

  // Auto-save input text to database whenever it changes
  const lastSavedData = useRef<{ inputText: string; formattedInfo: CustomerInfo | null }>({ inputText: '', formattedInfo: null });
  useEffect(() => {
    // Only save if data actually changed
    const dataChanged = 
      lastSavedData.current.inputText !== inputText ||
      JSON.stringify(lastSavedData.current.formattedInfo) !== JSON.stringify(formattedInfo);
    
    if (!dataChanged) return;

    // Always save to localStorage immediately for instant backup
    if (typeof window !== 'undefined') {
      try {
        if (inputText.trim()) {
          localStorage.setItem('patron-input-text', inputText);
          sessionStorage.setItem('patron-input-text', inputText);
        } else {
          localStorage.removeItem('patron-input-text');
          sessionStorage.removeItem('patron-input-text');
        }
        
        if (formattedInfo) {
          const formatted = JSON.stringify(formattedInfo);
          localStorage.setItem('patron-formatted-info', formatted);
          sessionStorage.setItem('patron-formatted-info', formatted);
        } else {
          localStorage.removeItem('patron-formatted-info');
          sessionStorage.removeItem('patron-formatted-info');
        }
      } catch (error) {
        console.warn('Could not save to localStorage backup:', error);
      }
    }

    // Update the ref
    lastSavedData.current = { inputText, formattedInfo };

    // If user is authenticated, also save to database
    // BUT NOT if a manual save operation is in progress (prevents interference)
    if (!isAuthenticated || !user || isManualSaving) return;
    
    const saveToDatabase = async () => {
      try {
        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) return;

        const response = await fetch('/api/drafts/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session.access_token}`
          },
          body: JSON.stringify({
            inputText: inputText || null,
            formattedInfo: formattedInfo || null
          })
        });

        if (!response.ok) {
          console.warn('❌ Failed to save draft to database:', response.status);
        }
      } catch (error) {
        console.warn('❌ Could not save draft to database:', error);
      }
    };

    // Debounce the database save operation to avoid too many API calls
    const timeoutId = setTimeout(saveToDatabase, 2000);
    return () => clearTimeout(timeoutId);
  }, [inputText, formattedInfo, isAuthenticated, user, isManualSaving]);

  // Load draft when user becomes authenticated (only once per session)
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    if (isAuthenticated && user && !draftLoaded) {
      // Always try to load draft when user authenticates, regardless of current state
      loadDraftFromDatabase();
      setDraftLoaded(true);
    }
  }, [isAuthenticated, user, draftLoaded, loadDraftFromDatabase]);

  // Handle page visibility changes to restore form data when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to the tab, try to restore any lost form data
        console.log('👁️ User returned to tab, checking for saved form data...');
        
        // Check if current form data exists, if not try to restore
        if (!inputText && !formattedInfo) {
          console.log('📭 No current form data, attempting restore...');
          if (isAuthenticated && user) {
            loadDraftFromDatabase(); // Try database first if authenticated
          } else {
            loadFromLocalStorageFallback(); // Use localStorage if not authenticated
          }
        } else {
          console.log('✅ Form data already present, no restore needed');
        }
      }
    };

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [inputText, formattedInfo, isAuthenticated, user, loadDraftFromDatabase, loadFromLocalStorageFallback]);

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

    // Listen for sign out events from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'patron-signout-event' && e.newValue) {
        console.log('Sign out detected from another tab');
        setIsAuthenticated(false);
        setUser(null);
        // Clear saved section preference on logout
        try {
          localStorage.removeItem('patron-active-section');
        } catch (e) {}
        window.location.replace('/login?fresh=true&signed_out=true');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Consolidated auth state listener will be set up below
    
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
            
            // Just try a simple session refresh - no localStorage needed
            console.log('Attempting simple session refresh...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Brief wait
            
            try {
              const { data: refreshedSessionData, error: refreshError } = await supabase.auth.getSession();
              if (!refreshError && refreshedSessionData.session) {
                console.log('Session refresh successful!');
                setUser(refreshedSessionData.session.user);
                setIsAuthenticated(true);
                setIsLoadingAuth(false);
                return;
              }
            } catch (e) {
              console.warn('Session refresh failed:', e);
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
        // Checking authentication silently

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

          // Check if user is approved before allowing access
          try {
            const approvalResponse = await fetch('/api/check-approval', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userId: session.user.id })
            });

            if (approvalResponse.ok) {
              const approvalData = await approvalResponse.json();

              if (!approvalData.isApproved) {
                // User is not approved, sign them out and redirect
                console.log('User not approved, redirecting to login');
                await supabase.auth.signOut();
                if (mounted) {
                  router.push('/login');
                }
                return;
              }

              if (approvalData.isPaused) {
                // User is paused, sign them out and redirect with message
                console.log('User is paused, redirecting to login');
                await supabase.auth.signOut();
                if (mounted) {
                  window.location.href = '/login?message=account_paused';
                }
                return;
              }
            }
          } catch (approvalError) {
            console.error('Error checking approval status:', approvalError);
            // Continue with login if approval check fails (fallback)
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

          // Check if user is approved before allowing access
          try {
            const approvalResponse = await fetch('/api/check-approval', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userId: user.id })
            });

            if (approvalResponse.ok) {
              const approvalData = await approvalResponse.json();

              if (!approvalData.isApproved) {
                // User is not approved, redirect to login
                console.log('User not approved, redirecting to login');
                if (mounted) {
                  router.push('/login');
                }
                return;
              }

              if (approvalData.isPaused) {
                // User is paused, redirect with message
                console.log('User is paused, redirecting to login');
                if (mounted) {
                  window.location.href = '/login?message=account_paused';
                }
                return;
              }
            }
          } catch (approvalError) {
            console.error('Error checking approval status:', approvalError);
            // Continue with login if approval check fails (fallback)
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

        // Auth state change: ${event} - ${session?.user?.email}

        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setUser(null);
          setIsAuthenticated(false);
          router.push('/login');
        } else if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in:', session.user.email);

          // Check if user is approved before allowing access
          try {
            const approvalResponse = await fetch('/api/check-approval', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userId: session.user.id })
            });

            if (approvalResponse.ok) {
              const approvalData = await approvalResponse.json();

              if (!approvalData.isApproved) {
                // User is not approved, sign them out
                console.log('User not approved, signing out');
                await supabase.auth.signOut();
                return;
              }

              if (approvalData.isPaused) {
                // User is paused, sign them out and redirect
                console.log('User is paused, signing out');
                await supabase.auth.signOut();
                window.location.href = '/login?message=account_paused';
                return;
              }
            }
          } catch (approvalError) {
            console.error('Error checking approval status:', approvalError);
            // Continue with login if approval check fails (fallback)
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
      window.removeEventListener('storage', handleStorageChange);
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

  const previewBatchLeads = async () => {
    if (!batchText.trim()) {
      setError('Please enter batch customer information');
      return;
    }

    setIsPreviewingBatch(true);
    setError('');

    try {
      const response = await fetch('/api/preview-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchText }),
      });

      if (!response.ok) {
        throw new Error('Failed to preview batch customers');
      }

      const result = await response.json();
      setBatchPreview(result.customers || []);
      setShowBatchPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred previewing batch customers');
    } finally {
      setIsPreviewingBatch(false);
    }
  };

  const processBatchLeads = async () => {
    if (!batchText.trim()) {
      setError('Please enter batch customer information');
      return;
    }

    // Count number of lines to estimate number of customers
    const lines = batchText.trim().split('\n').filter(line => line.trim()).length;

    // Show confirmation dialog
    if (!confirm(`Are you sure you want to process ${lines} batch lead${lines === 1 ? '' : 's'}?\n\nThis will:\n• Process and import all leads into your pipeline\n• Cannot be undone once processed\n\nClick OK to continue or Cancel to abort.`)) {
      return;
    }

    setBatchProcessing(true);
    setError('');
    setBatchResults({ success: 0, failed: 0, errors: [] });

    try {
      const response = await fetch('/api/batch-customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchText: batchText,
          userId: user?.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process batch customers');
      }

      const result = await response.json();
      setBatchResults(result);

      if (result.success > 0) {
        // Clear form and reload customers
        setBatchText('');
        setBatchPreview([]);
        setShowBatchPreview(false);
        await loadCustomers();
        setActiveSection('pipeline');

        try {
          localStorage.setItem('patron-active-section', 'pipeline');
        } catch (error) {
          console.warn('Could not save section change:', error);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred processing batch customers');
    } finally {
      setBatchProcessing(false);
    }
  };

  const clearForm = async () => {
    setInputText('');
    setFormattedInfo(null);
    setError('');
    setShowCopied(false);
    
    // Clear persisted form data from localStorage
    try {
      localStorage.removeItem('patron-input-text');
      localStorage.removeItem('patron-formatted-info');
      sessionStorage.removeItem('patron-input-text');
      sessionStorage.removeItem('patron-formatted-info');
      console.log('🧹 Cleared localStorage backup');
    } catch (error) {
      console.warn('Could not clear localStorage:', error);
    }
    
    // Clear persisted form data from database
    if (isAuthenticated && user) {
      try {
        const session = await supabase.auth.getSession();
        if (session.data.session?.access_token) {
          console.log('🧹 Clearing draft from database...');
          const response = await fetch('/api/drafts/clear', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.data.session.access_token}`
            }
          });
          
          if (response.ok) {
            console.log('✅ Draft cleared from database successfully');
          } else {
            console.warn('❌ Failed to clear draft from database:', response.status);
          }
        }
      } catch (error) {
        console.warn('❌ Could not clear draft from database:', error);
      }
    }
  };

  const saveCustomer = async () => {
    if (!formattedInfo || !user) {
      console.warn('Missing formattedInfo or user data');
      return;
    }

    // No special browser handling needed

    // Prevent multiple simultaneous saves
    if (isSaving) {
      console.log('Save already in progress, ignoring duplicate request');
      return;
    }

    setIsSaving(true);
    setIsManualSaving(true); // Lock auto-save to prevent interference
    setSaveProgress('');
    setError(''); // Clear any previous errors
    
    console.log('Starting save operation for customer:', formattedInfo.name);

    try {
      // Determine status - if leadSize indicates paid, set to completed
      let status = 'active'; // Default status for new customers

      const customerData = {
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
      };

      console.log('Inserting customer data:', customerData);

      // Simple, direct save with timeout and detailed logging
      console.log('Saving customer...');
      
      let data: any;
      
      try {
        // Add a timeout to prevent infinite hanging
        const savePromise = supabase
        .from('customers')
        .insert([customerData])
        .select();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save operation timed out after 15 seconds')), 15000)
        );
        
        console.log('📡 Making database request...');
        const result = await Promise.race([savePromise, timeoutPromise]);
        console.log('📡 Database request completed:', result);
        
        const { data: resultData, error } = result as any;

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(`Failed to save customer: ${error.message}`);
      }

        if (!resultData || resultData.length === 0) {
        throw new Error('No data returned from save operation');
        }
        
        data = resultData;
        
      } catch (dbError: any) {
        console.error('Database operation failed:', dbError);
        if (dbError.message?.includes('timed out')) {
          throw new Error('Save operation timed out. Please check your internet connection and try again.');
        }
        throw dbError;
      }

      console.log('Customer saved successfully:', data[0]);

      // Show success feedback
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);

      // Clear the form and reload customers
      await clearForm();
      
      // Small delay to ensure authentication state stabilizes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Simple reload - just refresh the customer list
      console.log('Reloading customers...');
      await loadCustomers();

      // Always switch to pipeline view after saving
      console.log('Switching to pipeline view...');
      setActiveSection('pipeline');
      try {
        localStorage.setItem('patron-active-section', 'pipeline');
      } catch (error) {
        console.warn('Could not save section change:', error);
      }

    } catch (error) {
      console.error('Error saving customer:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('timed out')) {
          setError('Save operation timed out. Please check your connection and try again.');
        } else if (error.message.includes('network')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(`Save failed: ${error.message}`);
        }
      } else {
        setError('An unexpected error occurred while saving the customer.');
      }
    } finally {
      // Ensure isSaving is always set to false and release the manual save lock
      setIsSaving(false);
      setIsManualSaving(false); // Release auto-save lock
      setSaveProgress('');
      console.log('Save operation finalized');
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

  // Function to switch to calendar view with status filtering
  const switchToCalendarWithFilter = (statusFilter: string) => {
    setCalendarStatusFilter(statusFilter);
    setActiveSection('calendar');

    // Save the new active section to localStorage
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('patron-active-section', 'calendar');
      }
    } catch (error) {
      console.warn('Could not save active section:', error);
    }
  };

  // Function to automatically update customer statuses based on installation date
  const updateExpiredCustomersStatus = useCallback(async (customers: Customer[]) => {
    if (!user || !isAuthenticated) return customers;

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const updatedCustomers = [];

    for (const customer of customers) {
      // Check if installation date has passed and customer is not already in completed status
      if (customer.installation_date < todayString &&
          customer.status !== 'completed' &&
          customer.status !== 'not_paid' &&
          customer.status !== 'paid' &&
          customer.status !== 'cancelled') {

        try {
          // Update customer status to 'not_paid' in database
          const { error } = await supabase
            .from('customers')
            .update({ status: 'not_paid' })
            .eq('id', customer.id)
            .eq('user_id', user.id);

          if (error) {
            console.error('Error updating customer status:', error);
            updatedCustomers.push(customer);
          } else {
            console.log(`Updated customer ${customer.name} status to not_paid (installation date passed)`);
            updatedCustomers.push({ ...customer, status: 'not_paid' as const });
          }
        } catch (error) {
          console.error('Error updating customer status:', error);
          updatedCustomers.push(customer);
        }
      } else {
        updatedCustomers.push(customer);
      }
    }

    return updatedCustomers;
  }, [user, isAuthenticated, supabase]);

  const loadCustomers = useCallback(async () => {
    if (!user || !isAuthenticated) {
      console.log('No user available or not authenticated, skipping loadCustomers');
      return;
    }
    
    try {
      // Loading customers for user: ${user.id}
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error loading customers:', error);
        throw error;
      }
      
      let loadedCustomers = data || [];
      console.log(`Loaded ${loadedCustomers.length} customers`);

      // Automatically update statuses for customers whose installation date has passed
      loadedCustomers = await updateExpiredCustomersStatus(loadedCustomers);

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
  }, [user, isAuthenticated, updateExpiredCustomersStatus]);

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
    
    // Save the active section to localStorage for persistence across reloads
    try {
      localStorage.setItem('patron-active-section', section);
    } catch (error) {
      console.warn('Could not save active section:', error);
    }
    
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
  const filterAndSortCustomers = useCallback((term: string, filter: string, sort: string, order: 'asc' | 'desc', location: string = 'all', gigSize: string = 'all') => {
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
    } else if (filter === 'in_progress') {
      filtered = filtered.filter(customer => customer.status === 'in_progress');
    } else if (filter === 'cancelled') {
      filtered = filtered.filter(customer => customer.status === 'cancelled');
    } else if (filter === 'completed') {
      filtered = filtered.filter(customer => customer.status === 'completed' || customer.status === 'not_paid' || customer.status === 'paid');
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

    // Apply gig size filter
    if (gigSize !== 'all') {
      filtered = filtered.filter(customer => customer.lead_size === gigSize);
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
          // Define an order for statuses: cancelled first, then completed, then not_paid, then paid, then in_progress, then active
          const statusOrder = { 'cancelled': 1, 'completed': 2, 'not_paid': 3, 'paid': 4, 'in_progress': 5, 'active': 6, 'undefined': 7 };
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
      filterAndSortCustomers(searchTerm, filterBy, sortBy, sortOrder, locationFilter, gigSizeFilter);
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
    filterAndSortCustomers(searchTerm, filterBy, newSortBy, sortOrder, locationFilter, gigSizeFilter);
  };

  // Handle sort order toggle
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    filterAndSortCustomers(searchTerm, filterBy, sortBy, newOrder, locationFilter, gigSizeFilter);
  };

  // Handle filter change
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilter = e.target.value;
    setFilterBy(newFilter);
    filterAndSortCustomers(searchTerm, newFilter, sortBy, sortOrder, locationFilter, gigSizeFilter);
  };

  // Handle location filter change
  const handleLocationFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocation = e.target.value;
    setLocationFilter(newLocation);
    filterAndSortCustomers(searchTerm, filterBy, sortBy, sortOrder, newLocation, gigSizeFilter);
  };

  // Handle gig size filter change
  const handleGigSizeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGigSize = e.target.value;
    setGigSizeFilter(newGigSize);
    filterAndSortCustomers(searchTerm, filterBy, sortBy, sortOrder, locationFilter, newGigSize);
  };

  // Load customers when user is authenticated
  // Load customers once when user becomes authenticated
  const [customersLoaded, setCustomersLoaded] = useState(false);
  useEffect(() => {
    if (isAuthenticated && user && !customersLoaded) {
      loadCustomers();
      setCustomersLoaded(true);
    } else if (!isAuthenticated) {
      setCustomersLoaded(false);
    }
  }, [isAuthenticated, user, customersLoaded]);

  // Initial filtering when customers are loaded
  useEffect(() => {
    if (customers.length > 0) {
      console.log('Initial filtering of customers:', {
        totalCustomers: customers.length,
        filterBy,
        searchTerm,
        customersWithStatus: customers.map(c => ({ name: c.name, status: c.status }))
      });
      filterAndSortCustomers(searchTerm, filterBy, sortBy, sortOrder, locationFilter, gigSizeFilter);
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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-blue-800">Installation Calendar</h2>
                {calendarStatusFilter !== 'all' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Filtered by:</span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {calendarStatusFilter === 'in_progress' ? 'Missed Installation' :
                       calendarStatusFilter === 'not_paid' ? 'Not Paid' :
                       calendarStatusFilter.charAt(0).toUpperCase() + calendarStatusFilter.slice(1)}
                    </span>
                    <button
                      onClick={() => setCalendarStatusFilter('all')}
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </div>
              {(() => {
                // Filter customers based on status filter
                const filteredCalendarCustomers = calendarStatusFilter === 'all'
                  ? customers
                  : customers.filter(customer => {
                      if (calendarStatusFilter === 'active') {
                        return customer.status === 'active' || customer.status === undefined;
                      }
                      return customer.status === calendarStatusFilter;
                    });

                return filteredCalendarCustomers.length > 0 ? (
                  <InstallationCalendar
                    customers={filteredCalendarCustomers}
                    onDateClick={handleDateClick}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-black">
                      {calendarStatusFilter === 'all'
                        ? "No installations scheduled yet. Add some leads to see them on the calendar."
                        : `No customers with status "${calendarStatusFilter === 'in_progress' ? 'Missed Installation' : calendarStatusFilter === 'not_paid' ? 'Not Paid' : calendarStatusFilter}" found.`
                      }
                    </p>
                    {calendarStatusFilter !== 'all' && (
                      <button
                        onClick={() => setCalendarStatusFilter('all')}
                        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        Show All Customers
                      </button>
                    )}
                  </div>
                );
              })()}
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
              <option value="active">Active Customers</option>
                  <option value="in_progress">Missed Installation Customers</option>
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

              {/* Gig Size Filter Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-black">Gig Size:</label>
                <select 
                  value={gigSizeFilter}
                  onChange={handleGigSizeFilterChange}
                  className="p-1 text-sm text-black border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Sizes</option>
                  <option value="500MB">500MB</option>
                  <option value="1GIG">1GIG</option>
                  <option value="2GIG">2GIG</option>
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
                                  status: e.target.value as 'active' | 'cancelled' | 'completed' | 'paid' | 'not_paid' | 'in_progress' 
                                })}
                                className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                              >
                <option value="active">Active</option>
                                <option value="in_progress">Missed Installation</option>
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
                                      : customer.status === 'in_progress'
                                      ? 'bg-yellow-100 text-yellow-800'
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
                                    {customer.status === 'not_paid' ? 'Not Paid' : customer.status === 'in_progress' ? 'Missed Installation' : customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
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
          <StatsPage
            customers={customers}
            onSwitchToCalendar={switchToCalendarWithFilter}
          />
        )}

        {/* Add New Lead Section */}
        {activeSection === 'add' && (
          <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6 md:mb-8 border-t-4 border-green-500">
            <div className="flex justify-between items-center mb-2 md:mb-4">
              <h2 className="text-lg md:text-xl font-semibold text-blue-800">Add New Sales Lead</h2>

              {/* Toggle between Single and Batch mode */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setBatchMode(false)}
                  className={`px-3 py-1 text-xs md:text-sm rounded-md transition-colors ${
                    !batchMode
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Single Lead
                </button>
                <button
                  onClick={() => setBatchMode(true)}
                  className={`px-3 py-1 text-xs md:text-sm rounded-md transition-colors ${
                    batchMode
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Batch Import
                </button>
              </div>
            </div>

            {!batchMode ? (
              /* Single Lead Mode */
              <>
                <p className="text-xs md:text-sm text-black mb-2">Paste your customer's information from your notes in any format - our AI will organize it automatically.</p>
                <p className="text-xs text-green-600 mb-3 md:mb-4">💾 Your form data is automatically saved both locally and to your secure account - works even when switching tabs or browsers!</p>
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
              </>
            ) : (
              /* Batch Import Mode */
              <>
                <p className="text-xs md:text-sm text-black mb-2">Paste multiple leads from your spreadsheet - each row should contain customer info. Our AI will process them all automatically.</p>
                <p className="text-xs text-blue-600 mb-2">📊 Supported formats: Copy from Excel, Google Sheets, or plain text with multiple entries</p>
                <p className="text-xs text-orange-600 mb-3 md:mb-4">⚡ Example: Paste multiple rows like "John Smith, 555-123-4567, john@email.com..." (one per line)</p>

                <textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={`Paste your spreadsheet data here... Example:
John Smith, 555-123-4567, john@email.com, 123 Main St, June 15th, 2pm
Jane Doe, 555-987-6543, jane@email.com, 456 Oak Ave, June 16th, 10am
Bob Wilson, 555-555-5555, bob@email.com, 789 Pine St, June 17th, 3pm`}
                  className="w-full h-40 p-4 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />

                <div className="flex flex-wrap gap-2 md:gap-4 mt-3 md:mt-4">
                  <button
                    onClick={previewBatchLeads}
                    disabled={isPreviewingBatch || batchProcessing}
                    className="px-4 md:px-6 py-2 bg-blue-600 text-white text-xs md:text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 md:gap-2"
                  >
                    {isPreviewingBatch ? <LoadingSpinner /> : null}
                    <span className="flex items-center gap-1 md:gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      {isPreviewingBatch ? 'Previewing...' : 'Preview Batch'}
                    </span>
                  </button>

                  <button
                    onClick={processBatchLeads}
                    disabled={batchProcessing || isPreviewingBatch}
                    className="px-4 md:px-6 py-2 bg-purple-600 text-white text-xs md:text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 md:gap-2"
                  >
                    {batchProcessing ? <LoadingSpinner /> : null}
                    <span className="flex items-center gap-1 md:gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 102 0V3a2 2 0 012 2v6.5l2.5-2.5a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4A1 1 0 116.5 9.5L9 12V5a2 2 0 01-2-2z" clipRule="evenodd" />
                      </svg>
                      {batchProcessing ? 'Processing Batch...' : 'Process Batch Leads'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setBatchText('');
                      setBatchPreview([]);
                      setShowBatchPreview(false);
                    }}
                    className="px-4 md:px-6 py-2 bg-gray-500 text-white text-xs md:text-sm rounded-lg hover:bg-gray-600"
                  >
                    Clear
                  </button>
                </div>

                {/* Batch Preview */}
                {showBatchPreview && batchPreview.length > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border-t-4 border-blue-500">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Review Batch Import</h3>
                      <button
                        onClick={() => setShowBatchPreview(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Found {batchPreview.length} customer{batchPreview.length === 1 ? '' : 's'} ready to import. Review the details below before proceeding:</p>

                    <div className="max-h-96 overflow-y-auto">
                      {batchPreview.map((customer, index) => (
                        <div key={index} className="bg-white p-4 rounded-lg shadow-sm mb-3 border-l-4 border-green-400">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                              <div className="text-sm text-gray-900">{customer.name}</div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                              <div className="text-sm text-gray-900">{customer.email}</div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                              <div className="text-sm text-gray-900">{customer.phone}</div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Service Address</label>
                              <div className="text-sm text-gray-900">{customer.serviceAddress}</div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Lead Size</label>
                              <div className="text-sm text-gray-900">{customer.leadSize}</div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Installation Date</label>
                              <div className="text-sm text-gray-900">{new Date(customer.installationDate).toLocaleDateString()}</div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Installation Time</label>
                              <div className="text-sm text-gray-900">{customer.installationTime}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={processBatchLeads}
                        disabled={batchProcessing}
                        className="px-6 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {batchProcessing ? <LoadingSpinner /> : null}
                        Import {batchPreview.length} Customer{batchPreview.length === 1 ? '' : 's'}
                      </button>
                      <button
                        onClick={() => setShowBatchPreview(false)}
                        className="px-6 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
                      >
                        Back to Edit
                      </button>
                    </div>
                  </div>
                )}

                {/* Batch Results */}
                {(batchResults.success > 0 || batchResults.failed > 0) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold text-sm text-gray-800 mb-2">Batch Import Results:</h3>
                    <div className="flex gap-4 mb-2">
                      <span className="text-green-600 text-sm">✅ Successful: {batchResults.success}</span>
                      <span className="text-red-600 text-sm">❌ Failed: {batchResults.failed}</span>
                    </div>
                    {batchResults.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-sm text-red-600 cursor-pointer">View Errors ({batchResults.errors.length})</summary>
                        <div className="mt-2 text-xs text-red-500 max-h-32 overflow-y-auto">
                          {batchResults.errors.map((error, index) => (
                            <div key={index} className="mb-1">• {error}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </>
            )}

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
