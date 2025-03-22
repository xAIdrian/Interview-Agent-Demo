import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../components/PageTemplate';
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

const PositionsPage = () => {
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');

  // Get username if available
  useEffect(() => {
    const name = localStorage.getItem('userName');
    if (name) {
      setUserName(name);
    }
  }, []);

  // Fetch available public positions (campaigns)
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        const response = await axios.get(`${API_BASE_URL}/api/public_campaigns`);
        
        setPositions(response.data);
      } catch (err) {
        console.error('Error fetching positions:', err);
        
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            router.push('/login');
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
          } else {
            setError('Failed to load available positions');
          }
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPositions();
  }, [router]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('isAdmin');
    router.push('/login');
  };

  return (
    <PageTemplate title="Available Positions">
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Available Positions</h1>
              <p className="mt-1 text-sm text-gray-500">
                Apply for open positions and complete an AI interview
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Welcome, {userName || 'Candidate'}</span>
              <button
                onClick={handleLogout}
                className="ml-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Content */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 my-4">
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
          ) : positions.length > 0 ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {positions.map((position) => (
                <div key={position.id} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900">{position.title}</h3>
                    
                    <div className="mt-3 text-sm text-gray-500 line-clamp-3">
                      {position.job_description ? (
                        <p className="whitespace-pre-line">
                          {position.job_description.length > 200 
                            ? `${position.job_description.substring(0, 200)}...` 
                            : position.job_description}
                        </p>
                      ) : (
                        <p>No job description available</p>
                      )}
                    </div>
                    
                    <div className="mt-5 flex space-x-3">
                      <Link
                        href={`/candidate/position/${position.id}`}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View Details
                      </Link>
                      
                      <Link
                        href={`/candidate/apply/${position.id}`}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Apply Now
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-6 mt-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900">No positions available</h3>
                <p className="mt-2 text-sm text-gray-500">
                  There are currently no open positions available. Please check back later.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTemplate>
  );
};

export default PositionsPage;
