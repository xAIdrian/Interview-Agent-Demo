import axios, { AxiosHeaders } from 'axios';
import { AuthLogger } from './logging';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Set default base URL for all requests
axios.defaults.baseURL = API_BASE_URL;

// Configure axios defaults for the entire application
axios.defaults.withCredentials = true; // Important for sending cookies with requests
axios.defaults.timeout = 10000; // 10 second timeout

// Maximum number of retries for network errors
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second delay between retries

// Create function to determine if the endpoint needs URL transformation
export const getApiUrl = (endpoint: string): string => {
  // Extract the path part without any query parameters
  const pathOnly = endpoint.split('?')[0];
  
  // Check if this is an authentication endpoint (no /api prefix)
  const isAuthEndpoint = 
    pathOnly === '/login' || 
    pathOnly === '/register' || 
    pathOnly === '/logout';
  
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

// Helper to check if the backend is reachable
export const checkBackendConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/health`, { 
      method: 'HEAD',
      cache: 'no-cache',
      credentials: 'include',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Check if we got a successful response
    if (response.ok) {
      return true;
    } else {
      console.error(`Backend health check returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Backend connection check failed:', error);
    return false;
  }
};

// Request interceptor to handle API URL transformation
axios.interceptors.request.use(
  config => {
    // Transform the URL if needed
    if (config.url) {
      config.url = getApiUrl(config.url);
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
      
      // Handle 422 Unprocessable Entity (often related to auth)
      if (error.response?.status === 422) {
        AuthLogger.warn('Unprocessable entity (422) - Check request format');
      }
    }
    
    return Promise.reject(error);
  }
);

export default axios;