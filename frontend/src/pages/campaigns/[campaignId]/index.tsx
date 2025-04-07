import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';
import { AuthLogger } from '../../../utils/logging';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

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

      // Ensure campaignId is treated as string
      const campaignIdString = String(campaignId);

      try {
        setIsLoading(true);
        setError('');
        
        // Fetch campaign details
        const campaignResponse = await axios.get(
          `${API_BASE_URL}/api/campaigns/${campaignIdString}`
        );
        
        setCampaign(campaignResponse.data);
        AuthLogger.info('Campaign details loaded successfully');
        
        // Fetch questions for this campaign
        const questionsResponse = await axios.get(
          `${API_BASE_URL}/api/questions?campaign_id=${campaignIdString}`
        );
        
        setQuestions(questionsResponse.data);
        AuthLogger.info(`Loaded ${questionsResponse.data.length} questions for campaign`);
        
        // Fetch submission count for this campaign
        try {
          const submissionsResponse = await axios.get(
            `${API_BASE_URL}/api/submissions?campaign_id=${campaignIdString}`
          );
          
          setSubmissionCount(submissionsResponse.data.length);
          AuthLogger.info(`Found ${submissionsResponse.data.length} submissions for campaign`);
        } catch (submissionErr) {
          console.error('Error fetching submissions:', submissionErr);
          // Don't set an error for this, just set count to 0
          setSubmissionCount(0);
          AuthLogger.error('Failed to fetch submissions', submissionErr);
        }
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
  }, [campaignId]);

  const handleStartInterview = async () => {
    try {
      setIsLoading(true);
      
      // Get the auth token from localStorage
      const token = localStorage.getItem('access_token');
      
      // Create a submission for this campaign
      const response = await axios.post(`${API_BASE_URL}/api/submissions`, {
        campaign_id: String(campaignId)
      });
      
      // Ensure the submission ID is a string
      const newSubmissionId = String(response.data.id);
      
      // Navigate to the interview page with the submission ID
      router.push(`/interview/${newSubmissionId}`);
    } catch (error) {
      console.error('Error creating submission:', error);
      setErrorMessage('Failed to start interview. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <PageTemplate title="Campaign Details" maxWidth="lg">
      <div className="flex justify-between mb-4 items-center">
        <h1 className="text-2xl font-bold">Campaign Details</h1>
        <div className="space-x-2">
          {isAdmin && (
            <Link 
              href={`/campaigns/${campaignId}/submissions`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              View Submissions ({submissionCount})
            </Link>
          )}
          <Link 
            href="/campaigns"
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Back to Campaigns
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {!isAdmin && (
        <div className="mb-4 p-2 bg-yellow-100 text-yellow-700 rounded">
          Note: Some features require admin privileges.
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
              <h2 className="text-lg leading-6 font-medium text-gray-900">Campaign Information</h2>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Title</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{campaign.title}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <span className={`px-2 py-1 rounded ${campaign.is_public ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {campaign.is_public ? 'Public' : 'Private'}
                    </span>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Maximum Points</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{campaign.max_points}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Max Submissions Per User</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{campaign.max_user_submissions}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Campaign Context</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">{campaign.campaign_context}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Job Description</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">{campaign.job_description}</dd>
                </div>
              </dl>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">Questions ({questions.length})</h2>
          
          {questions.length > 0 ? (
            questions.map((question) => (
              <div key={question.id} className="bg-white shadow overflow-hidden sm:rounded-lg mb-4">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">{question.title}</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Max Points: {question.max_points}</p>
                </div>
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Question</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">{question.body}</dd>
                    </div>
                    {isAdmin && (
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Scoring Prompt</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">{question.scoring_prompt}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 bg-gray-50 rounded">
              <p className="text-gray-500">No questions found for this campaign.</p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Campaign not found. Please check the URL or go back to the dashboard.
        </div>
      )}
    </PageTemplate>
  );
};

export default CampaignDetailsPage;
