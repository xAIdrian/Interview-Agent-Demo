import axios from 'axios';

export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

/**
 * Gets the current user from localStorage
 */
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') {
    return null; // Return null during SSR
  }
  
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr) as User;
  } catch (e) {
    console.error('Error parsing user data from localStorage', e);
    return null;
  }
}

/**
 * Fetches the currently logged in user's profile from the API
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    // First check if we have user in localStorage
    const storedUser = getStoredUser();
    if (storedUser) {
      return storedUser;
    }
    
    // If not found in localStorage, try fetching from API
    const response = await axios.get('/api/profile');
    
    // Store the user data in localStorage for future use
    localStorage.setItem('user', JSON.stringify(response.data));
    
    return response.data;
  } catch (error) {
    console.error('Error fetching current user:', error);
    
    // If there was an auth error, clear any stored user data
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('user');
    }
    
    return null;
  }
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

/**
 * Checks if the current user is an admin
 */
export function isAdmin(): boolean {
  const user = getStoredUser();
  return user?.is_admin || false;
}