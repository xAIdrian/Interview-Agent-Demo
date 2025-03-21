import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Position {
  id: string;
  title: string;
  max_user_submissions: number;
  max_points: number;
  is_public: boolean;
  campaign_context: string;
  job_description: string;
}

const PositionDetailsPage = () => {
  const router = useRouter();
  const { positionId } = router.query;
  
  const [position, setPosition] = useState<Position | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      router.push('/login');
    }
  }, [router]);

  // Fetch position details
  useEffect(() => {
    const fetchPositionDetails = async () => {
      if (!positionId) return;

      try {
        setIsLoading(true);
        setError('');
        
        const response = await axios.get(`${API_BASE_URL}/api/campaigns/${positionId}`);
        
        setPosition(response.data);
      } catch (err) {
        console.error('Error fetching position details:', err);
        
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            router.push('/login');
          } else if (err.response?.status === 404) {
            setError('Position not found or not available');
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
          } else {
            setError('Failed to load position details');
          }
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPositionDetails();
  }, [positionId, router]);

  return (
    <PageTemplate title={position?.title || 'Position Details'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link 
            href="/candidate/positions"
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            ← Back to Positions
          </Link>
        </div>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        ) : position ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-2xl leading-6 font-bold text-gray-900">{position.title}</h3>
              </div>
              <Link
                href={`/candidate/apply/${position.id}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Apply Now
              </Link>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Position Details</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">
                    {position.job_description || 'No detailed description available for this position.'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">About the Interview</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <p>This position uses an AI-powered interview process. When you apply, you'll:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Upload your resume</li>
                      <li>Complete a video interview with our AI assistant</li>
                      <li>Answer position-specific questions</li>
                      <li>Receive feedback on your application</li>
                    </ul>
                    <p className="mt-2">The interview typically takes 15-20 minutes to complete.</p>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Maximum Applications</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    You can apply for this position up to {position.max_user_submissions} times.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-500">Position not found or no longer available.</p>
          </div>
        )}
      </div>
    </PageTemplate>
  );
};

export default PositionDetailsPage;
