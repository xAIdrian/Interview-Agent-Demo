import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PageTemplate } from '../components/PageTemplate';
import { INTERNAL_API_TOKEN } from '../utils/internalApiToken';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query; // Get userId from URL query parameter
  
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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

  // Add auth token setup on component mount
  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Get current user's ID from localStorage
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    
    // Load current user data first
    loadUserData(currentUserId, true);
    
    // Then load the requested user's data if viewing someone else's profile
    if (userId && userId !== currentUserId) {
      loadUserData(userId as string, false);
      setViewingOwnProfile(false);
    }
  }, [router, userId]);

  // Function to load user data from the API
  const loadUserData = async (id: string, isCurrentUser: boolean) => {
    try {
      setIsLoading(true);
      setError('');
      
      // Use the internal API token for admin-level access
      const response = await axios.get(`${API_BASE_URL}/api/users/${id}`, {
        headers: {
          'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
        }
      });
      
      const userData = response.data;
      
      if (isCurrentUser) {
        setCurrentUser(userData);
        
        // If we're not viewing someone else's profile, set this as the main user
        if (!userId || userId === id) {
          setUser(userData);
          setFormData({
            ...formData,
            name: userData.name || '',
            email: userData.email || '',
            is_admin: userData.is_admin || false
          });
          setViewingOwnProfile(true);
        }
      } else {
        setUser(userData);
        setFormData({
          ...formData,
          name: userData.name || '',
          email: userData.email || '',
          is_admin: userData.is_admin || false
        });
      }
    } catch (err) {
      console.error(`Error loading ${isCurrentUser ? 'current' : 'requested'} user data:`, err);
      
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          router.push('/login');
        } else if (err.response?.status === 404) {
          setError('User not found');
        } else if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else {
          setError(`Failed to load ${isCurrentUser ? 'your' : 'user'} profile`);
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
      
      // Use internal API token for admin-level access
      const authHeader = {
        headers: {
          'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
        }
      };
      
      // Update user profile information
      const updateData: Record<string, any> = {
        name: formData.name,
        email: formData.email
      };
      
      // If admin is updating another user, they can update admin status
      if (currentUser?.is_admin && !viewingOwnProfile) {
        updateData.is_admin = formData.is_admin;
      }
      
      // Update user profile
      await axios.put(`${API_BASE_URL}/api/users/${user.id}`, updateData, authHeader);
      
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
        
        await axios.post(`${API_BASE_URL}/api/change-password`, passwordData, authHeader);
      }
      
      setSuccess('Profile updated successfully!');
      
      // Refresh user data
      loadUserData(user.id, viewingOwnProfile);
      
      // Clear password fields
      setFormData({
        ...formData,
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      
    } catch (err) {
      console.error('Error updating profile:', err);
      
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

  // Rest of the component remains the same
  return (
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
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
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
            
            <div className="pt-4 border-t border-gray-200">
              <h2 className="text-lg font-medium mb-2">Change Password</h2>
              
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
                {isSaving ? 'Updating...' : 'Update Profile'}
              </button>
              
              <button 
                type="button"
                onClick={() => router.push('/dashboard')}
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
  );
};

export default ProfilePage;