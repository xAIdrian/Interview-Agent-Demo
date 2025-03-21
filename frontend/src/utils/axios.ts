
import axios from 'axios';

// Configure axios defaults for the entire application
axios.defaults.withCredentials = true;

// If your backend and frontend are on different domains or ports
// you'll need to set the base URL
if (process.env.NODE_ENV === 'development') {
  axios.defaults.baseURL = 'http://127.0.0.1:5000';
}

// Add a response interceptor to handle common errors
axios.interceptors.response.use(
  response => response,
  error => {
    // Handle 401 Unauthorized errors
    if (error.response && error.response.status === 401) {
      // If we're not on the login page, redirect to login
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        console.log('Unauthorized, redirecting to login');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default axios;