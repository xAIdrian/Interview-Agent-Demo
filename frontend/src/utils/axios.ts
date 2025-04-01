import axios from 'axios';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000,
});

export default axiosInstance; 
