
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../../../components/PageTemplate';
import { INTERNAL_API_TOKEN } from '../../../../utils/internalApiToken';

interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

const EditUserPage = () => {
  const router = useRouter();
  const { userId } = router.query;
  
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    is_admin: false,
    reset_password: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        const userData = response.data;
        setUser(userData);
        setFormData({
          email: userData.email,
          name: userData.name,
          is_admin: userData.is_admin,
          reset_password: false
        });
      } catch (err) {
        console.error('Error fetching user:', err);
        setError('Failed to load user details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');
      
      const updatedData = {
        email: formData.email,
        name: formData.name,
        is_admin: formData.is_admin
      };
      
      await axios.put(`http://127.0.0.1:5000/api/users/${userId}`, updatedData, {
        headers: {
          'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
        }
      });
      
      // If reset_password is true, make additional API call
      if (formData.reset_password) {
        // This would depend on your API structure - here's a placeholder
        await axios.post(`http://127.0.0.1:5000/api/users/${userId}/reset-password`, {}, {
          headers: {
            'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
          }
        });
      }
      
      setSuccess('User updated successfully!');
      
      // Navigate back to user detail page after a short delay
      setTimeout(() => {
        router.push(`/users/${userId}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageTemplate title="Edit User" maxWidth="md">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Edit User</h1>
        
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
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_admin"
                name="is_admin"
                checked={formData.is_admin}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="is_admin" className="block text-sm font-medium text-gray-700">
                Admin
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="reset_password"
                name="reset_password"
                checked={formData.reset_password}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="reset_password" className="block text-sm font-medium text-gray-700">
                Reset Password
              </label>
            </div>
            
            <div className="pt-4 flex space-x-4">
              <button 
                type="submit" 
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
                disabled={isSaving}
              >
                {isSaving ? 'Updating...' : 'Update User'}
             