// pages/login.tsx
import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PrimaryButton } from '../../components/Button';
import { PageTemplate } from '../../components/PageTemplate';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/login', { email, password });
      if (response.status === 200) {
        router.push('/candidate');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <PageTemplate title="Welcome" centered maxWidth="sm">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Login</h2>
        
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
            />
          </div>
          
          <div className="pt-2">
            <PrimaryButton type="submit" fullWidth>
              Sign In
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
