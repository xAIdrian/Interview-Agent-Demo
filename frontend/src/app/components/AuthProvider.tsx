'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios, { isAxiosError } from 'axios';
import { AuthLogger } from '../../utils/logging';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
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
        // If error is 401 (Unauthorized), don't treat it as an error
        if (isAxiosError(err) && err.response?.status === 401) {
          setUser(null);
          AuthLogger.info('No authenticated user');
        } else {
          setUser(null);
          AuthLogger.info('No authenticated user or session expired');
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
      
      const response = await axios.post('/login', { email, password });
      
      // Log the full response in development mode to debug
      if (process.env.NODE_ENV === 'development') {
        AuthLogger.debug('Login response received:', JSON.stringify(response.data, null, 2));
      }
      
      // Store user data
      if (response.data.user) {
        setUser(response.data.user);
        AuthLogger.info('Login successful');
        return true;
      } else {
        setError('Invalid response from server');
        AuthLogger.error('Login failed: Invalid response format');
        return false;
      }
    } catch (err) {
      AuthLogger.error('Login error:', err);
      
      if (isAxiosError(err)) {
        if (err.response) {
          // Server responded with error
          setError(err.response.data.message || 'Login failed');
        } else if (err.request) {
          // Request made but no response
          setError('No response from server. Please check your connection.');
        } else {
          // Something else went wrong
          setError('An unexpected error occurred');
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
  const logout = async () => {
    try {
      setLoading(true);
      await axios.post('/logout');
      setUser(null);
      AuthLogger.info('Logout successful');
      router.push('/login');
    } catch (err) {
      AuthLogger.error('Logout error:', err);
      // Even if logout fails, clear user data and redirect
      setUser(null);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    clearError,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
