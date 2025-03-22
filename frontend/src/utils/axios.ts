import axios from 'axios';
import { AuthLogger } from './logging';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Set default base URL for all requests
axios.defaults.baseURL = API_BASE_URL;

// Configure axios defaults for the entire application
axios.defaults.withCredentials = true;

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
    pathOnly === '/refresh';
  
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

// Request interceptor to handle API URL transformation and authentication
axios.interceptors.request.use(
  config => {
    // Transform the URL if needed
    if (config.url) {
      config.url = getApiUrl(config.url);
    }
    
    // Add authentication token to headers if available
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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