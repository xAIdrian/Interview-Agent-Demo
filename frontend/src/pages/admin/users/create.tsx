import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import { AuthLogger } from '../../../utils/logging';
import { 
  UserPlusIcon, 
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

const CreateUserPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    is_admin: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      // Submit the data to create user API endpoint
      const response = await axios.post(`${API_URL}/api/users`, formData);
      
      setSuccessMessage('Admin user created successfully!');
      AuthLogger.info('Admin user created:', response.data);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        is_admin: true
      });
      
      // Redirect to users list after a brief delay
      setTimeout(() => {
        router.push('/admin/users');
      }, 2000);
      
    } catch (err) {
      console.error('Error creating admin user:', err);
      
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to create admin user');
        AuthLogger.error('Admin user creation error:', err.response?.status, err.response?.data);
      } else {
        setError('An unexpected error occurred');
        AuthLogger.error('Unexpected error creating admin user:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTemplate>
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex items-center mb-6">
          <ShieldCheckIcon className="h-6 w-6 text-indigo-600 mr-2" />
          <h2 className="text-xl font-semibold">Create New Admin User</h2>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md flex items-center">
            <XCircleIcon className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md flex items-center">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            {successMessage}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center justify-center ${
                loading ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Creating Admin...
                </>
              ) : (
                <>
                  <UserPlusIcon className="h-5 w-5 mr-2" />
                  Create Admin User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </PageTemplate>
  );
};

export default CreateUserPage; 
