'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import axios from '../../utils/axios';
import { AuthLogger } from '../../utils/logging';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
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
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          AuthLogger.info('User authenticated from localStorage');
        } else {
          setUser(null);
          AuthLogger.info('No authenticated user');
        }
      } catch (err) {
        setUser(null);
        AuthLogger.info('Error reading user data from localStorage');
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
      
      const response = await axios.post(`${API_BASE_URL}/login`, { email, password });
      
      if (response.data.user) {
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
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
          // Handle specific status codes
          switch (err.response.status) {
            case 401:
              setError('Invalid email or password. Please try again.');
              break;
            case 403:
              setError('Access denied. Please contact your administrator.');
              break;
            case 404:
              setError('User not found. Please check your email.');
              break;
            case 500:
              setError('Server error. Please try again later.');
              break;
            default:
              setError(err.response.data.message || 'Login failed');
          }
        } else if (err.request) {
          setError('No response from server. Please check your connection.');
        } else {
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
  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    router.push('/login');
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
    login,
    logout,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
