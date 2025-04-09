import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';
import { AuthLogger } from '../../../utils/logging';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

interface Campaign {
  id: string;
  title: string;
  max_user_submissions: number;
  max_points: number;
  is_public: boolean;
  campaign_context: string;
  job_description: string;
}

interface Question {
  id: string;
  campaign_id: string;
  title: string;
  body: string;
  scoring_prompt: string;
  max_points: number;
}

const CampaignDetailsPage = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissionCount, setSubmissionCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Setup auth on component mount
  useEffect(() => {
    const isAdminUser = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(isAdminUser);
  }, []);

  // Fetch campaign data
  useEffect(() => {
    const fetchCampaignData = async () => {
      if (!campaignId) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`/api/campaigns/${campaignId}`);
        setCampaign(response.data);
        
        // Fetch questions for this campaign
        const questionsResponse = await axios.get(`/api/campaigns/${campaignId}`);
        setQuestions(questionsResponse.data);
        
        // If admin, fetch submission count
        if (isAdmin) {
          const submissionsResponse = await axios.get(`/api/submissions?campaign_id=${campaignId}`);
          setSubmissionCount(submissionsResponse.data.length);
        }
        
        AuthLogger.info(`Loaded campaign #${campaignId} successfully`);
      } catch (err) {
        console.error('Error fetching campaign data:', err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError('Campaign not found');
            AuthLogger.error('Campaign not found', err.response?.status);
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
            AuthLogger.error('API error fetching campaign', err.response?.status, err.response?.data);
          } else {
            setError('Failed to load campaign data');
            AuthLogger.error('Unknown error fetching campaign', err.response?.status);
          }
        } else {
          setError('An unexpected error occurred');
          AuthLogger.error('Unexpected error fetching campaign data', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaignData();
  }, [campaignId, isAdmin]);

  const handleStartInterview = async () => {
    try {
      setIsLoading(true);
      
      // Create a submission for this campaign
      // const response = await axios.post(`/api/submissions`, {
      //   campaign_id: String(campaignId)
      // });
      
      // // Ensure the submission ID is a string
      // const newSubmissionId = String(response.data.id);
      
      // Navigate to the interview page with the submission ID
      router.push(`/live-interview/${campaignId}`);
    } catch (error) {
      console.error('Error creating submission:', error);
      setErrorMessage('Failed to start interview. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <PageTemplate title={isAdmin ? "Campaign Details" : "Position Details"} maxWidth="lg">
      <div className="flex justify-end mb-4 items-center">
        <div className="space-x-2">
          {isAdmin && (
            <>
              <Link 
                href={`/campaigns/${campaignId}/submissions`}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                View Submissions ({submissionCount})
              </Link>
              <Link 
                href={`/campaigns/${campaignId}/edit`}
                className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Edit Campaign
              </Link>
            </>
          )}
          {!isAdmin && (
            <button
              onClick={handleStartInterview}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700"
              disabled={isLoading}
            >
              {isLoading ? 'Starting...' : 'Start Interview'}
            </button>
          )}
          <Link 
            href="/campaigns"
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Back to {isAdmin ? 'Campaigns' : 'Positions'}
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {errorMessage && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
        </div>
      ) : campaign ? (
        <>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-gray-900">Position Information</h2>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Title</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{campaign.title}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Job Description</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{campaign.job_description}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <span className={`px-2 py-1 rounded ${campaign.is_public ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {campaign.is_public ? 'Public' : 'Private'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">Interview Questions</h2>
              </div>
              <div className="border-t border-gray-200">
                <ul className="divide-y divide-gray-200">
                  {questions.map((question, index) => (
                    <li key={question.id} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Question {index + 1}</p>
                          <p className="mt-1 text-sm text-gray-500">{question.body}</p>
                        </div>
                        <div className="ml-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {question.max_points} points
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Campaign not found.
        </div>
      )}
    </PageTemplate>
  );
};

export default CampaignDetailsPage;
