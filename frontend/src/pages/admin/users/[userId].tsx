import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../../components/PageTemplate';
import { AuthLogger } from '../../../utils/logging';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

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
    const fetchUser = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        const response = await axios.get(`${API_URL}/api/users/${userId}`);
        setUser(response.data);
        AuthLogger.info(`Loaded user #${userId} successfully`);
      } catch (err) {
        console.error('Error fetching user:', err);
        setError('Failed to load user details');
        
        if (axios.isAxiosError(err)) {
          AuthLogger.error('Error fetching user:', err.response?.status, err.response?.data);
        } else {
          AuthLogger.error('Unexpected error fetching user:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUser();
  }, [userId]);

  const handleDeleteUser = async () => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
      await axios.delete(`${API_URL}/api/users/${userId}`);
      AuthLogger.info(`User ${userId} deleted successfully`);
      router.push('/admin/users');
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user.');
      
      if (axios.isAxiosError(err)) {
        AuthLogger.error('Error deleting user:', err.response?.status, err.response?.data);
      } else {
        AuthLogger.error('Unexpected error deleting user:', err);
      }
    }
  };

  return (
    <PageTemplate title={user?.name || 'User Details'}>
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
          <div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">User ID</p>
              <p className="text-lg">{user.id}</p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-lg">{user.email}</p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">Name</p>
              <p className="text-lg">{user.name}</p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">Role</p>
              <p className="text-lg">{user.is_admin ? 'Administrator' : 'User'}</p>
            </div>
            <div className="flex mt-6 space-x-3">
              <Link href={`/admin/users/${user.id}/edit`} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
                Edit User
              </Link>
              <button
                onClick={handleDeleteUser}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Delete User
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            User not found.
          </div>
        )}
      </div>
    </PageTemplate>
  );
};

export default UserDetailPage;
