import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { AdminLayout } from '../../../components/Layout/AdminLayout';
import { AuthLogger } from '../../../utils/logging';

const CreateUserPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    is_admin: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      // Submit the data to create user API endpoint
      const response = await axios.post('/api/users', formData);
      
      setSuccessMessage('User created successfully!');
      AuthLogger.info('User created:', response.data);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        is_admin: false
      });
      
      // Redirect to users list after a brief delay
      setTimeout(() => {
        router.push('/admin/users');
      }, 2000);
      
    } catch (err) {
      console.error('Error creating user:', err);
      
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Failed to create user');
        AuthLogger.error('User creation error:', err.response?.status, err.response?.data);
      } else {
        setError('An unexpected error occurred');
        AuthLogger.error('Unexpected error creating user:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Create New User">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Create New User</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
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
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_admin"
              name="is_admin"
              checked={formData.is_admin}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_admin" className="ml-2 block text-sm text-gray-900">
              Admin User
            </label>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                loading ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default CreateUserPage; 