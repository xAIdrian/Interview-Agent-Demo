'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from '../../utils/axios';
import { useRouter } from 'next/navigation';
import { AuthLogger } from '../../utils/logging';

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

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      
      try {
        // Get user profile from the server
        const response = await axios.get('/api/profile');
        
        if (response.data && response.data.id) {
          setUser(response.data);
          AuthLogger.info('User authenticated from session');
        } else {
          setUser(null);
          AuthLogger.info('No authenticated user');
        }
      } catch (err) {
        setUser(null);
        AuthLogger.info('No authenticated user or session expired');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Function to check if API is available
  const checkApiStatus = async () => {
    try {
      const response = await fetch(`${axios.defaults.baseURL}/health`, {
        method: 'HEAD',
        mode: 'cors',
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  // Login function
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      clearError();
      
      AuthLogger.info('Attempting login...');
      
      // Check if the backend is reachable
      let networkWorks = true;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${axios.defaults.baseURL}/health`, {
          method: 'HEAD',
          cache: 'no-cache',
          credentials: 'include',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Check if the response indicates the server is healthy
        if (!response.ok) {
          networkWorks = false;
          AuthLogger.warn(`Backend health check failed with status: ${response.status}`);
          setError('Cannot connect to server. Please check your internet connection and try again.');
          setLoading(false);
          return false;
        }
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
      
      if (response.data && response.data.success) {
        // Store user data
        const userData = response.data.user;
        setUser(userData);
        
        AuthLogger.info('Login successful', userData);
        return true;
      } else {
        AuthLogger.warn('Login response missing success flag', response.data);
        setError(response.data.message || 'Login failed');
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
      
      if (response.data.message && response.data.message.includes('success')) {
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
  const handleLogout = async () => {
    // Call the API logout endpoint
    try {
      await axios.post('/logout');
      setUser(null);
      
      // Return to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Logout error:', err);
      // Even if the API call fails, clear the user locally
      setUser(null);
      
      // Return to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
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
