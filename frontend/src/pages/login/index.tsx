// pages/login.tsx
import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PrimaryButton } from '../../components/Button';
import { PageTemplate } from '../../components/PageTemplate';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error state
    setError('');
    setIsLoading(true);
    
    try {
      // Configure axios to include credentials
      const response = await axios.post('/api/login', { email, password }, {
        withCredentials: true
      });
      
      if (response.status === 200) {
        const userData = response.data;
        
        // Store the JWT tokens
        localStorage.setItem('accessToken', userData.access_token);
        localStorage.setItem('userId', userData.id);
        localStorage.setItem('refreshToken', userData.refresh_token);
        
        // Store user data in localStorage for client-side access
        localStorage.setItem('user', JSON.stringify({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          is_admin: userData.is_admin
        }));
        
        // Set authorization header for future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.access_token}`;
        
        // Redirect based on user role
        if (userData.is_admin) {
          router.push('/campaigns');
        } else {
          router.push('/candidate');
        }
      }
    } catch (error) {
      console.error('Login failed:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        // Handle specific error responses
        if (error.response.status === 401) {
          setError('Invalid email or password. Please try again.');
        } else if (error.response.data?.error) {
          setError(error.response.data.error);
        } else {
          setError('Login failed. Please try again later.');
        }
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageTemplate title="Welcome" centered maxWidth="sm">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Login</h2>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="pt-2">
            <PrimaryButton type="submit" fullWidth disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </PrimaryButton>
          </div>
          
          <div className="text-sm text-center mt-4">
            <a href="#" className="text-blue-600 hover:text-blue-800">
              Forgot your password?
            </a>
          </div>
        </form>
      </div>
    </PageTemplate>
  );
};

export default LoginPage;
