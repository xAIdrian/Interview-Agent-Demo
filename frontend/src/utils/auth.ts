import axios from 'axios';
import { AuthLogger } from './logging';

export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

/**
 * Gets the user data from localStorage if available
 */
export function getStoredUser(): User | null {
  try {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      return JSON.parse(userJson);
    }
    return null;
  } catch (error) {
    console.error('Error parsing stored user:', error);
    return null;
  }
}

/**
 * Fetches the currently logged in user's profile from the API
 * This function is now deprecated and should use the AuthProvider context instead.
 * It is kept for backward compatibility with existing code.
 * @deprecated Use useAuth() hook from AuthProvider instead
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    AuthLogger.warn('getCurrentUser() is deprecated, use useAuth() hook instead');
    
    // First check if we have user in localStorage
    const storedUser = getStoredUser();
    if (storedUser) {
      return storedUser;
    }
    
    // If not found in localStorage, try fetching from API
    const response = await axios.get('/profile');
    
    // Store the user data in localStorage for future use
    localStorage.setItem('user', JSON.stringify(response.data));
    
    return response.data;
  } catch (error) {
    AuthLogger.error('Error fetching current user:', error);
    
    // If there was an auth error, clear any stored user data
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('user');
    }
    
    return null;
  }
}

/**
 * Checks if the current user is an admin
 * This function is now deprecated and should use the AuthProvider context instead.
 * @deprecated Use useAuth() hook's isAdmin property instead
 */
export function isAdmin(): boolean {
  AuthLogger.warn('isAdmin() is deprecated, use useAuth().isAdmin instead');
  const isAdminString = localStorage.getItem('isAdmin');
  return isAdminString === 'true';
}

/**
 * Checks if a user is currently authenticated
 * This function is now deprecated and should use the AuthProvider context instead.
 * @deprecated Use useAuth() hook's isAuthenticated property instead
 */
export function isAuthenticated(): boolean {
  AuthLogger.warn('isAuthenticated() is deprecated, use useAuth().isAuthenticated instead');
  return !!localStorage.getItem('access_token');
}

/**
 * Checks if the user is logged in
 */
export function isLoggedIn(): boolean {
  return getStoredUser() !== null;
}

/**
 * Logs the user out
 */
export async function logout(): Promise<void> {
  try {
    await axios.post('/api/logout');
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
}