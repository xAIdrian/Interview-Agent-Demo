'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { AuthLogger } from '../../utils/logging';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface User {
  id: string;
  email: string;
  name?: string;
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Function to clear error state
  const clearError = () => setError(null);

  // Function to set cookies with more reliable expiration
  const setCookie = (name: string, value: string, days: number) => {
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${value}${expires}; path=/`;
    AuthLogger.debug(`Cookie set: ${name}`);
  };

  // Setup axios interceptors for JWT handling
  useEffect(() => {
    // Response interceptor to handle token refresh on 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response, 
      async (error) => {
        const originalRequest = error.config;
        
        // If error is 401 or 422 (unprocessable entity) and we haven't retried yet
        if ((error.response?.status === 401 || error.response?.status === 422) && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Try to refresh the token
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }
            
            AuthLogger.info('Attempting to refresh token');
            
            // Flask JWT expects the refresh token in the Authorization header with Bearer prefix
            const response = await axios.post('/refresh', {}, {
              headers: { 
                'Authorization': `Bearer ${refreshToken}`,
                'Content-Type': 'application/json'
              }
            });
            
            // Get new access token
            const { access_token } = response.data;
            if (!access_token) {
              throw new Error('Refresh response missing access token');
            }
            
            AuthLogger.info('Token refreshed successfully');
            localStorage.setItem('access_token', access_token);
            
            // Set cookie with proper expiration
            setCookie('access_token', access_token, 1); // 1 day
            
            // Update Authorization header for the retry
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // Log the refresh error
            AuthLogger.error('Token refresh failed:', refreshError);
            
            // Refresh token failed, force logout
            await handleLogout(false); // silent logout (don't call API)
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );

    // Cleanup function to remove interceptors when component unmounts
    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      try {
        // First try to get token from localStorage
        let accessToken = localStorage.getItem('access_token');
        
        // If not in localStorage, check for cookies
        if (!accessToken) {
          const cookies = document.cookie.split(';');
          const tokenCookie = cookies.find(c => c.trim().startsWith('access_token='));
          if (tokenCookie) {
            accessToken = tokenCookie.split('=')[1];
            // Sync the token back to localStorage
            localStorage.setItem('access_token', accessToken);
            AuthLogger.info('Retrieved token from cookie');
          }
        }
        
        if (!accessToken) {
          AuthLogger.info('No access token found in localStorage or cookies');
          setLoading(false);
          return;
        }
        
        AuthLogger.info('Verifying authentication');
        AuthLogger.logAuthState();
        
        // Make sure we have properly set the cookie for middleware
        setCookie('access_token', accessToken, 1); // 1 day
        
        try {
          // Get user data with the stored token
          const response = await axios.get('/auth/me', {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          // Log the full response in development mode
          if (process.env.NODE_ENV === 'development') {
            AuthLogger.debug('Auth check response:', JSON.stringify(response.data, null, 2));
          }
          
          // Set the user state with response data
          setUser(response.data);
          
          // Store user data in localStorage for persistence
          localStorage.setItem('user', JSON.stringify(response.data));
          localStorage.setItem('userId', response.data.id);
          localStorage.setItem('userName', response.data.name || '');
          localStorage.setItem('isAdmin', response.data.is_admin ? 'true' : 'false');
          
          AuthLogger.info('Authentication verified', response.data);
        } catch (apiError) {
          // Handle API errors specifically
          if (axios.isAxiosError(apiError)) {
            if (apiError.code === 'ERR_NETWORK') {
              AuthLogger.warn('Network error during auth check - attempting to use cached user data');
              
              // Fallback to locally stored user data if available
              const cachedUserData = localStorage.getItem('user');
              if (cachedUserData) {
                try {
                  const userData = JSON.parse(cachedUserData);
                  setUser(userData);
                  AuthLogger.info('Using cached user data due to network error', userData);
                  // Don't clear auth data - we want to try again when network is available
                } catch (parseError) {
                  AuthLogger.error('Failed to parse cached user data', parseError);
                  setUser(null);
                }
              } else {
                setUser(null);
              }
            } else if (apiError.response?.status === 401 || apiError.response?.status === 422) {
              AuthLogger.warn(`Invalid token (${apiError.response?.status}), logging out`);
              await handleLogout(false); // silent logout (don't call API)
            } else {
              AuthLogger.error('Authentication check failed with status:', apiError.response?.status);
              
              // Show detailed error information in development
              if (process.env.NODE_ENV === 'development') {
                AuthLogger.debug('Error details:', {
                  status: apiError.response?.status,
                  data: apiError.response?.data,
                  config: {
                    url: apiError.config?.url,
                    headers: apiError.config?.headers
                  }
                });
              }
              
              // For non-auth errors, try using cached data
              const cachedUserData = localStorage.getItem('user');
              if (cachedUserData) {
                try {
                  const userData = JSON.parse(cachedUserData);
                  setUser(userData);
                  AuthLogger.info('Using cached user data for non-auth error', userData);
                } catch (parseError) {
                  AuthLogger.error('Failed to parse cached user data', parseError);
                  setUser(null);
                }
              } else {
                setUser(null);
              }
            }
          } else {
            AuthLogger.error('Authentication check failed with unexpected error:', apiError);
            setUser(null);
          }
        }
      } catch (err) {
        AuthLogger.error('General error in authentication check:', err);
        
        // Try to use cached user data as fallback
        const cachedUserData = localStorage.getItem('user');
        if (cachedUserData) {
          try {
            const userData = JSON.parse(cachedUserData);
            setUser(userData);
            AuthLogger.info('Using cached user data as fallback', userData);
          } catch (parseError) {
            AuthLogger.error('Failed to parse cached user data', parseError);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      AuthLogger.info('Attempting login...');
      
      // Check if backend is reachable before attempting login
      let networkWorks = true;
      try {
        // Simple fetch with timeout to test network connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        await fetch(`${API_BASE_URL}/health`, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (networkError) {
        networkWorks = false;
        AuthLogger.warn('Network connectivity issue detected:', networkError);
        setError('Cannot connect to server. Please check your internet connection and try again.');
        setLoading(false);
        return false;
      }
      
      // We now use '/login' directly since axios config handles the URL transformation
      const response = await axios.post(`/login`, { email, password });
      
      // Log the full response in development mode to debug
      if (process.env.NODE_ENV === 'development') {
        AuthLogger.debug('Login response received:', JSON.stringify(response.data, null, 2));
      }
      
      if (response.data && response.data.access_token) {
        // Store user data
        const userData = response.data.user || {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
          is_admin: response.data.is_admin
        };
        
        setUser(userData);
        
        // Store tokens and user data in localStorage
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token || '');
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('userName', userData.name || '');
        localStorage.setItem('isAdmin', userData.is_admin ? 'true' : 'false');
        
        // Set cookies with proper expiration
        setCookie('access_token', response.data.access_token, 1); // 1 day
        if (response.data.refresh_token) {
          setCookie('refresh_token', response.data.refresh_token, 30); // 30 days
        }
        
        AuthLogger.info('Login successful', userData);
        AuthLogger.logAuthState();
        
        return true;
      } else {
        AuthLogger.warn('Login response missing token', response.data);
        setError(response.data.message || 'Login failed - No token received');
        return false;
      }
    } catch (err) {
      AuthLogger.error('Login error:', err);
      
      if (axios.isAxiosError(err)) {
        if (err.code === 'ERR_NETWORK') {
          setError('Cannot connect to the server. Please check your internet connection and try again later.');
        } else if (err.response?.status === 401) {
          setError('Invalid email or password. Please try again.');
        } else if (err.response?.status === 422) {
          setError('Invalid request format. Please check your input and try again.');
        } else if (err.response?.status === 429) {
          setError('Too many login attempts. Please wait a moment before trying again.');
        } else {
          setError(err.response?.data?.error || err.response?.data?.message || 'Login failed for an unknown reason');
        }
        
        // Log detailed error information in development
        if (process.env.NODE_ENV === 'development') {
          AuthLogger.debug('Login error details:', {
            code: err.code,
            status: err.response?.status,
            data: err.response?.data,
            message: err.message
          });
        }
      } else {
        setError('An unexpected error occurred during login');
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      // We now use '/register' directly since axios config handles the URL transformation
      const response = await axios.post(`/register`, { 
        name, 
        email, 
        password 
      });
      
      if (response.data.success) {
        return true;
      } else {
        setError(response.data.message || 'Registration failed');
        return false;
      }
    } catch (err) {
      console.error('Registration error:', err);
      
      if (axios.isAxiosError(err)) {
        if (err.code === 'ERR_NETWORK') {
          setError('Cannot connect to the server. Please check if the backend is running.');
        } else {
          setError(err.response?.data?.message || 'Registration failed');
        }
      } else {
        setError('An unexpected error occurred');
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const handleLogout = async (callApi = true) => {
    // Call the API logout endpoint if requested
    if (callApi) {
      try {
        await axios.post('/logout'); // Use '/logout' instead of '/api/logout'
      } catch (err) {
        console.error('Logout API error:', err);
      }
    }
    
    // Clear all auth data from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('isAdmin');
    
    // Clear cookies by setting expired date
    document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    document.cookie = 'remember_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    
    // Reset user state
    setUser(null);
    
    // Return to login page if not already there
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register' && path !== '/') {
        router.push('/login');
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout: handleLogout,
        clearError,
        isAuthenticated: !!user,
        isAdmin: !!user?.is_admin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
