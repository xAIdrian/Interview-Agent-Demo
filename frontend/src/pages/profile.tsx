import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PageTemplate } from '../components/PageTemplate';
import { useAuth } from '../app/components/AuthProvider';
import { Spinner } from '../components/ui/Spinner';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { AuthLogger } from '../utils/logging';
import Head from 'next/head';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

// Use the same User interface that matches both the backend and AuthProvider
interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  [key: string]: any; // To accommodate any additional fields from AuthProvider
}

const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query; // Get userId from URL query parameter
  const { user: authUser, isAdmin } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    is_admin: false,
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewingOwnProfile, setViewingOwnProfile] = useState(true);

  // Load user data on component mount
  useEffect(() => {
    if (!authUser) return;
    
    const currentUserId = authUser.id;
    
    // If no userId in URL or it matches current user, view own profile
    if (!userId || userId === currentUserId) {
      setUser(authUser as User);
      setFormData({
        ...formData,
        name: authUser.name || '',
        email: authUser.email || '',
        is_admin: authUser.is_admin || false
      });
      setViewingOwnProfile(true);
      setIsLoading(false);
    } else {
      // Only admins can view other profiles
      if (!isAdmin) {
        router.push('/unauthorized');
        return;
      }
      
      // Load the requested user's data
      loadUserData(userId as string);
      setViewingOwnProfile(false);
    }
  }, [router, userId, authUser, isAdmin]);

  // Function to load user data from the API
  const loadUserData = async (id: string) => {
    try {
      setIsLoading(true);
      setError('');
      
      AuthLogger.info(`Loading user data for ID: ${id}`);
      
      const response = await axios.get(`/users/${id}`);
      const userData = response.data;
      
      setUser(userData);
      setFormData({
        ...formData,
        name: userData.name || '',
        email: userData.email || '',
        is_admin: userData.is_admin || false
      });
      
      AuthLogger.info('User data loaded successfully', userData);
    } catch (err) {
      AuthLogger.error('Error loading user data:', err);
      
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          router.push('/login');
        } else if (err.response?.status === 404) {
          setError('User not found');
        } else if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else {
          setError('Failed to load user profile');
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const validateForm = () => {
    // Reset errors
    setError('');
    
    // Check if passwords match when changing password
    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      setError('New passwords do not match');
      return false;
    }
    
    // If changing password, current password is required (only for own profile)
    if (viewingOwnProfile && formData.new_password && !formData.current_password) {
      setError('Current password is required to set a new password');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) {
      return;
    }
    
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');
      
      // Update user profile information
      const updateData: Record<string, any> = {
        name: formData.name,
        email: formData.email
      };
      
      // If admin is updating another user, they can update admin status
      if (isAdmin && !viewingOwnProfile) {
        updateData.is_admin = formData.is_admin;
      }
      
      AuthLogger.info('Updating user profile', updateData);
      
      // Update user profile
      const endpoint = viewingOwnProfile ? '/profile' : `/users/${user.id}`;
      await axios.put(endpoint, updateData);
      
      // If changing password
      if (formData.new_password) {
        const passwordData: Record<string, string> = {
          new_password: formData.new_password
        };
        
        // Add current password only if user is changing their own password
        if (viewingOwnProfile) {
          passwordData.current_password = formData.current_password;
        }
        
        // Add user_id if admin is changing someone else's password
        if (!viewingOwnProfile) {
          passwordData.user_id = user.id;
        }
        
        AuthLogger.info('Changing password');
        await axios.post('/change-password', passwordData);
      }
      
      setSuccess('Profile updated successfully!');
      
      // Refresh user data if viewing someone else's profile
      if (!viewingOwnProfile) {
        loadUserData(user.id);
      }
      
      // Clear password fields
      setFormData({
        ...formData,
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      
    } catch (err) {
      AuthLogger.error('Error updating profile:', err);
      
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError('Your session has expired. Please login again.');
          router.push('/login');
        } else if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else {
          setError('Failed to update profile. Please try again.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Render the component inside a ProtectedRoute
  return (
    <>
      <Head>
        <title>My Profile</title>
      </Head>
      <ProtectedRoute>
        <PageTemplate title="Edit Profile" maxWidth="md">
          <div className="w-full bg-white shadow-md rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>
            
            {error && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
                {success}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Spinner />
              </div>
            ) : user ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name:
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email:
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                
                {/* Admin toggle (only visible to admins editing other users) */}
                {isAdmin && !viewingOwnProfile && (
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_admin"
                        checked={formData.is_admin}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Admin User</span>
                    </label>
                  </div>
                )}
                
                <div className="pt-4 border-t border-gray-200">
                  <h2 className="text-lg font-medium mb-2">Change Password</h2>
                  
                  {viewingOwnProfile && (
                    <div className="space-y-2">
                      <label htmlFor="current_password" className="block text-sm font-medium text-gray-700">
                        Current Password:
                      </label>
                      <input
                        type="password"
                        id="current_password"
                        name="current_password"
                        value={formData.current_password}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">
                      New Password:
                    </label>
                    <input
                      type="password"
                      id="new_password"
                      name="new_password"
                      value={formData.new_password}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                      Confirm New Password:
                    </label>
                    <input
                      type="password"
                      id="confirm_password"
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    />
                  </div>
                </div>
                
                <div className="pt-4 flex space-x-4">
                  <button 
                    type="submit" 
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <span className="flex items-center">
                        <Spinner size="small" />
                        <span className="ml-2">Updating...</span>
                      </span>
                    ) : 'Update Profile'}
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => router.push(isAdmin ? '/admin/users' : '/dashboard')}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Profile not found. Please login again.
              </div>
            )}
          </div>
        </PageTemplate>
      </ProtectedRoute>
    </>
  );
};

export default ProfilePage;
