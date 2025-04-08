import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PrimaryButton } from '../../../components/Button';
import { PageTemplate } from '../../../components/PageTemplate';
import { INTERNAL_API_TOKEN } from '../../../utils/internalApiToken';

// This is the user creation page component
const CreateUserPage = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Use client-side only rendering to avoid hydration mismatch
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    // Return a simple loading state or placeholder on server
    return <div className="loading">Loading...</div>;
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await axios.post('https://interview-agent-demo.onrender.com/api/users/create', 
        { 
          email, 
          name, 
          is_admin: isAdmin 
        },
        {
          headers: {
            'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
          }
        }
      );
      
      if (response.status === 200 || response.status === 201) {
        // Redirect to users list page after successful creation
        router.push('/users');
      }
    } catch (error) {
      console.error('User creation failed:', error);
      setError('Failed to create user. Please try again.');
    }
  };

  return (
    <PageTemplate title="Create User" maxWidth="sm">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Create New User</h2>
        
        {/* Display any error message */}
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {/* User creation form */}
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          <div className="flex items-center">
            <input
              id="is_admin"
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_admin" className="ml-2 block text-sm text-gray-700">
              Admin
            </label>
          </div>
          
          <div className="pt-4">
            <PrimaryButton type="submit" fullWidth>
              Create User
            </PrimaryButton>
          </div>
        </form>
      </div>
    </PageTemplate>
  );
};

// Make sure this is exported correctly
export default CreateUserPage;
