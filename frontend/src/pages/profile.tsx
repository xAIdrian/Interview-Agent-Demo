import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PageTemplate } from '../components/PageTemplate';

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
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add auth token setup on component mount
  useEffect(() => {
    // Setup axios default authorization header from localStorage
    const token = localStorage.getItem('accessToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      router.push('/login');
    }
  }, [router]);

  // Fetch the user profile using JWT token
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        // Get token from localStorage
        const token = localStorage.getItem('accessToken');
        if (!token) {
          router.push('/login');
          return;
        }
        
        // Send request with authorization header to the correct endpoint
        const response = await axios.get(`${API_BASE_URL}/api/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userData = response.data;
        setUser(userData);
        setFormData(prevData => ({
          ...prevData,
          name: userData.name || '',
          email: userData.email || ''
        }));
      } catch (err) {
        console.error('Error fetching profile:', err);
        
        // Handle different error types
        if (axios.isAxiosError(err)) {
          // Handle specific error status codes
          if (err.response?.status === 401) {
            setError('Your session has expired. Please login again.');
            router.push('/login');
          } else if (err.response?.status === 422) {
            setError('Invalid request format. Please try logging in again.');
            router.push('/login');
          } else if (err.response?.data?.error) {
            setError(`Failed to load profile: ${err.response.data.error}`);
          } else {
            setError('Failed to load profile. Please try again later.');
          }
        } else {
          setError('An unexpected error occurred. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
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
    
    // If changing password, current password is required
    if (formData.new_password && !formData.current_password) {
      setError('Current password is required to set a new password');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');
      
      // Get token from localStorage
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const authHeader = {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
      
      // If changing password, include the password fields
      if (formData.new_password && formData.current_password) {
        await axios.post(`${API_BASE_URL}/api/change-password`, {
          current_password: formData.current_password,
          new_password: formData.new_password
        }, authHeader);
      }
      
      // Update user profile information
      const updateData = {
        name: formData.name,
        email: formData.email
      };
      
      await axios.put(`${API_BASE_URL}/api/profile`, updateData, authHeader);
      
      setSuccess('Profile updated successfully!');
      
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