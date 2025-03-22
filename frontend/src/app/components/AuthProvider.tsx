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

  // Setup axios interceptors for JWT handling
  useEffect(() => {
    // Response interceptor to handle token refresh on 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response, 
      async (error) => {
        const originalRequest = error.config;
        
        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Try to refresh the token
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }
            
            const response = await axios.post('/refresh', {}, {
              headers: { 'Authorization': `Bearer ${refreshToken}` }
            });
            
            // Get new access token
            const { access_token } = response.data;
            localStorage.setItem('access_token', access_token);
            
            // Also update the cookie for middleware
            document.cookie = `access_token=${access_token}; path=/; max-age=3600`;
            
            // Retry the original request with the new token
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // Refresh token failed, force logout
            await handleLogout();
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
        const accessToken = localStorage.getItem('access_token');
        
        if (!accessToken) {
          AuthLogger.info('No access token found');
          setLoading(false);
          return;
        }
        
        AuthLogger.info('Verifying authentication');
        AuthLogger.logAuthState();
        
        // Get user data with the stored token - use /profile instead of /api/profile
        // Our axios config will handle adding the /api prefix
        const response = await axios.get('/profile');
        
        // Set the user state with response data
        setUser(response.data);
        
        // Also update other local storage items for convenience
        localStorage.setItem('userId', response.data.id);
        localStorage.setItem('userName', response.data.name || '');
        localStorage.setItem('isAdmin', response.data.is_admin ? 'true' : 'false');
        
        AuthLogger.info('Authentication verified', response.data);
      } catch (err) {
        AuthLogger.error('Authentication check failed:', err);
        
        // Clear auth data if token is invalid or expired
        if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 422)) {
          AuthLogger.warn('Invalid token, logging out');
          await handleLogout(false); // silent logout (don't call API)
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
      
      // We now use '/login' directly since axios config handles the URL transformation
      const response = await axios.post(`/login`, { email, password });
      
      if (response.data.success) {
        // Store user data
        const userData = response.data.user;
        setUser(userData);
        
        // Store tokens and user data in localStorage
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('userName', userData.name || '');
        localStorage.setItem('isAdmin', userData.is_admin ? 'true' : 'false');
        
        // Set a cookie for middleware authentication
        document.cookie = `access_token=${response.data.access_token}; path=/; max-age=3600`;
        
        AuthLogger.info('Login successful', userData);
        AuthLogger.logAuthState();
        
        return true;
      } else {
        AuthLogger.warn('Login failed', response.data);
        setError(response.data.message || 'Login failed');
        return false;
      }
    } catch (err) {
      AuthLogger.error('Login error:', err);
      
      if (axios.isAxiosError(err)) {
        if (err.code === 'ERR_NETWORK') {
          setError('Cannot connect to the server. Please check if the backend is running.');
        } else {
          setError(err.response?.data?.message || 'Invalid credentials');
        }
      } else {
        setError('An unexpected error occurred');
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
    
    // Clear all auth data
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('isAdmin');
    
    // Clear cookies
    document.cookie = 'access_token=; path=/; max-age=0';
    document.cookie = 'remember_token=; path=/; max-age=0';
    document.cookie = 'refresh_token=; path=/; max-age=0';
    
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
