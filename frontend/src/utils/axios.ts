import axios, { AxiosHeaders } from 'axios';
import { AuthLogger } from './logging';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Set default base URL for all requests
axios.defaults.baseURL = API_BASE_URL;

// Configure axios defaults for the entire application
axios.defaults.withCredentials = true;
axios.defaults.timeout = 10000; // 10 second timeout

// Maximum number of retries for network errors
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second delay between retries

// Helper function to get token from various sources
export const getAuthToken = (): string | null => {
  // First try localStorage (most reliable between refreshes)
  const token = localStorage.getItem('access_token');
  if (token) return token;
  
  // If not in localStorage, try cookies
  const cookies = document.cookie.split(';');
  const tokenCookie = cookies.find(c => c.trim().startsWith('access_token='));
  if (tokenCookie) {
    const extractedToken = tokenCookie.split('=')[1];
    // Sync back to localStorage for future use
    localStorage.setItem('access_token', extractedToken);
    return extractedToken;
  }
  
  return null;
};

// Create function to determine if the endpoint needs URL transformation
export const getApiUrl = (endpoint: string): string => {
  // Extract the path part without any query parameters
  const pathOnly = endpoint.split('?')[0];
  
  // Check if this is an authentication endpoint (no /api prefix)
  // These endpoints are now handled directly by the frontend using the backend API
  const isAuthEndpoint = 
    pathOnly === '/login' || 
    pathOnly === '/register' || 
    pathOnly === '/logout' ||
    pathOnly === '/refresh' ||
    pathOnly === '/auth/me';
  
  // Check if this is an API endpoint that should use the /api prefix
  const isApiEndpoint = 
    pathOnly === '/profile' || 
    pathOnly.startsWith('/campaigns') || 
    pathOnly.startsWith('/submissions') || 
    pathOnly.startsWith('/users');
  
  if (isAuthEndpoint) {
    // Auth endpoints should not have /api prefix
    return endpoint.replace('/api', '');
  } else if (isApiEndpoint && !pathOnly.startsWith('/api/')) {
    // API endpoints should have /api prefix
    return `/api${endpoint}`;
  }
  
  // Otherwise, keep the endpoint as is
  return endpoint;
};

// Helper to set cookie with proper expiration
const setCookie = (name: string, value: string, days: number) => {
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = `; expires=${date.toUTCString()}`;
  }
  document.cookie = `${name}=${value}${expires}; path=/`;
};

// Helper to check if the backend is reachable
export const checkBackendConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/health`, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.error('Backend connection check failed:', error);
    return false;
  }
};

// Request interceptor to handle API URL transformation and authentication
axios.interceptors.request.use(
  config => {
    // Transform the URL if needed
    if (config.url) {
      config.url = getApiUrl(config.url);
    }
    
    // Get token from available sources
    const token = getAuthToken();
    
    // Add authentication token to headers if available
    if (token && config.headers) {
      // Flask-JWT-Extended expects the format "Bearer <token>"
      config.headers.Authorization = `Bearer ${token}`;
      
      // Ensure cookie is also set (for middleware)
      setCookie('access_token', token, 1);
      
      // Log the token being used (in dev mode only)
      if (process.env.NODE_ENV === 'development') {
        AuthLogger.debug(`Request to ${config.url} with token: ${token.substring(0, 15)}...`);
      }
    }
    
    // Ensure headers exist
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }
    
    // Safely set retry count for the request
    const headers = config.headers as Record<string, any>;
    if (headers['x-retry-count'] === undefined) {
      headers['x-retry-count'] = 0;
    }
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common error cases
axios.interceptors.response.use(
  response => {
    // If the response includes a new token, update it
    if (response.data && response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      setCookie('access_token', response.data.access_token, 1);
      
      if (response.data.refresh_token) {
        localStorage.setItem('refresh_token', response.data.refresh_token);
        setCookie('refresh_token', response.data.refresh_token, 30);
      }
      
      AuthLogger.debug('Updated tokens from response');
    }
    
    return response;
  },
  async error => {
    const originalRequest = error.config;
    
    // Handle network errors with retry logic
    if (error.code === 'ERR_NETWORK' && originalRequest) {
      const retryCount = originalRequest.headers['x-retry-count'] || 0;
      
      if (retryCount < MAX_RETRIES) {
        AuthLogger.warn(`Network error detected. Retrying request (${retryCount + 1}/${MAX_RETRIES})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        
        // Increment retry count
        originalRequest.headers['x-retry-count'] = retryCount + 1;
        
        // Log the retry attempt
        AuthLogger.debug(`Retrying ${originalRequest.method} request to ${originalRequest.url}`);
        
        return axios(originalRequest);
      } else {
        AuthLogger.error(`Network error persists after ${MAX_RETRIES} retries. Backend may be down.`);
      }
    }
    
    // Log the error for debugging
    AuthLogger.error('API Error:', error);
    
    if (axios.isAxiosError(error)) {
      // Handle network errors
      if (error.code === 'ERR_NETWORK') {
        AuthLogger.error('Network error - Backend may be down');
      }
      
      // Handle 401 Unauthorized errors (will be handled by AuthProvider for token refresh)
      if (error.response?.status === 401) {
        AuthLogger.warn('Unauthorized API access (401)');
      }
      
      // Handle 422 Unprocessable Entity (often related to auth)
      if (error.response?.status === 422) {
        AuthLogger.warn('Unprocessable entity (422) - Check request format');
      }
    }
    
    return Promise.reject(error);
  }
);

export default axios;