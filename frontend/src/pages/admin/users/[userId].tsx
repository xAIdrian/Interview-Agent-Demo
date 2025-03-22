
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../../components/PageTemplate';
import { INTERNAL_API_TOKEN } from '../../../utils/internalApiToken';

interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

const UserDetailPage = () => {
  const router = useRouter();
  const { userId } = router.query;
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`http://127.0.0.1:5000/api/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
          }
        });
        setUser(response.data);
      } catch (err) {
        console.error('Error fetching user:', err);
        setError('Failed to load user details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleDeleteUser = async () => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
      await axios.delete(`http://127.0.0.1:5000/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
        }
      });
      router.push('/users');
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user. Please try again.');
    }
  };

  return (
    <PageTemplate title={user?.name || 'User Details'} maxWidth="md">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-6">User Details</h1>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">ID</h3>
                <p className="mt-1 text-sm text-gray-900">{user.id}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1 text-sm text-gray-900">{user.email}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Name</h3>
                <p className="mt-1 text-sm text-gray-900">{user.name}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">User Type</h3>
                <p className="mt-1 text-sm text-gray-900">{user.is_admin ? 'Admin' : 'Candidate'}</p>
              </div>
            </div>
            
            <div className="flex space-x-4 pt-4 border-t mt-6">
              <Link 
                href={`/users/${userId}/edit`}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Edit User
              </Link>
              
              <button 
                onClick={handleDeleteUser}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Delete User
              </button>
              
              <Link 
                href="/users"
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Back to Users
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            User not found
          </div>
        )}
      </div>
    </PageTemplate>
  );
};

export default UserDetailPage;