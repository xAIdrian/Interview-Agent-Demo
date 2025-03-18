'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  name?: string;
  is_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to set up axios request interceptor for JWT
  const setupAxiosInterceptors = () => {
    axios.interceptors.request.use(
      (config) => {
        // Don't add auth header for login/register requests
        if (config.url?.includes('/api/login') || config.url?.includes('/api/register')) {
          return config;
        }
        
        // Add authorization header with JWT
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.id) {
          config.headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add a response interceptor to handle token refresh
    axios.interceptors.response.use(
      (response) => {
        return response;
      }, 
      async (error) => {
        const originalRequest = error.config;
        
        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Try to refresh the token
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
              // No refresh token, need to re-login
              throw new Error('No refresh token available');
            }
            
            const response = await axios.post('/api/refresh', {}, {
              headers: { 'Authorization': `Bearer ${refreshToken}` }
            });
            
            // Get new access token
            const { access_token } = response.data;
            localStorage.setItem('access_token', access_token);
            
            // Retry the original request with the new token
            originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // Refresh token failed, force logout
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  };

  useEffect(() => {
    // Setup axios interceptors for JWT handling
    setupAxiosInterceptors();
    
    // Check for user data in localStorage on initial load
    const storedUser = localStorage.getItem('user');
    const accessToken = localStorage.getItem('access_token');
    
    if (storedUser && accessToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await axios.post('/api/login', { email, password });
      
      if (response.data.success && response.data.user) {
        // Store the user data
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Store tokens in localStorage
        // Note: In a production app, consider more secure options like HTTP-only cookies
        if (response.data.access_token) {
          localStorage.setItem('access_token', response.data.access_token);
        }
        if (response.data.refresh_token) {
          localStorage.setItem('refresh_token', response.data.refresh_token);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Call the backend logout endpoint
      await axios.post('/api/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state regardless of API success
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
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
