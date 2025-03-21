import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  isAuthenticated: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('accessToken');
        
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }
        
        const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        setUser(response.data);
        
        // Update localStorage with latest server data
        localStorage.setItem('userName', response.data.name);
        localStorage.setItem('userId', response.data.id);
        localStorage.setItem('isAdmin', response.data.is_admin.toString());
        
      } catch (err) {
        console.error('Auth verification error:', err);
        
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userId');
          localStorage.removeItem('userName');
          localStorage.removeItem('isAdmin');
          setError('Authentication failed');
          setUser(null);
        } else {
          setError('Failed to verify authentication');
        }
      } finally {
        setLoading(false);
      }
    };
    
    verifyAuth();
  }, []);

  const logout = async () => {
    try {
      // Call logout endpoint (optional)
      await axios.post(`${API_BASE_URL}/api/logout`);
    } catch (e) {
      console.error('Logout API error:', e);
    } finally {
      // Always clear local storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('isAdmin');
      setUser(null);
      router.push('/login');
    }
  };

  const requireAdmin = () => {
    useEffect(() => {
      if (!loading && user) {
        if (!user.is_admin) {
          router.push('/unauthorized');
        }
      } else if (!loading && !user) {
        router.push('/login');
      }
    }, [user, loading, router]);
  };

  const requireAuth = () => {
    useEffect(() => {
      if (!loading && !user) {
        router.push('/login');
      }
    }, [user, loading, router]);
  };

  return { 
    user, 
    loading, 
    error, 
    isAuthenticated: !!user?.isAuthenticated,
    isAdmin: !!user?.is_admin,
    logout,
    requireAdmin,
    requireAuth
  };
};
