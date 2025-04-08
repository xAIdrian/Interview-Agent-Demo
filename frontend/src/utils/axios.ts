import axios from 'axios';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://interview-agent-demo.onrender.com';

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: false // Since we're not using session-based auth
});

export default axiosInstance; 
