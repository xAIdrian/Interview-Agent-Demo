import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';
import { AuthLogger } from '../../../utils/logging';
import { useAuth } from '@/app/components/AuthProvider';
import { Modal } from '../../../components/ui/Modal';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { PrimaryButton } from '../../../components/Button/PrimaryButton';

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
  access_code?: string;
}

interface Question {
  id: string;
  title: string;
  body: string;
  scoring_prompt: string;
  max_points: number;
  order_index?: number;
}

interface SubmissionStatus {
  total_submissions: number;
  completed_submissions: number;
  max_submissions: number;
  can_submit: boolean;
  has_completed_submission: boolean;
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
  const { user } = useAuth();
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    total_submissions: 0,
    completed_submissions: 0,
    max_submissions: 0,
    can_submit: true,
    has_completed_submission: false,
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Handle copying campaign link
  const handleCopyLink = () => {
    const campaignLink = `${window.location.origin}/live-interview/${campaignId}`;
    navigator.clipboard.writeText(campaignLink).then(() => {
      const button = document.getElementById('copy-link-button');
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    });
  };

  // Setup auth on component mount
  useEffect(() => {
    const isAdminUser = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(isAdminUser);
  }, []);

  // Fetch campaign data and submission status
  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId) return;

      try {
        setIsLoading(true);
        setError('');
        
        // Fetch campaign details and access code in parallel
        const [campaignResponse, accessCodeResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/campaigns/${campaignId}`),
          axios.get(`${API_BASE_URL}/api/campaigns/${campaignId}/access-code`)
        ]);

        console.log('Access Code Response:', accessCodeResponse.data);
        const accessCode = accessCodeResponse.data.data.access_code;
        console.log('Extracted Access Code:', accessCode);

        // Add access code to campaign data
        const campaignData = {
          ...campaignResponse.data,
          access_code: accessCode
        };
        console.log('Campaign Data with Access Code:', campaignData);
        
        setCampaign(campaignData);
        
        // Fetch submission answers for this campaign with proper error handling
        try {
          const answersResponse = await axios.get(`${API_BASE_URL}/api/submission_answers`, {
            params: { campaign_id: campaignId }
          });
          
          if (answersResponse.data && Array.isArray(answersResponse.data)) {
            // Sort answers by their order if available
            const sortedAnswers = answersResponse.data.sort((a, b) => 
              (a.order_index || 0) - (b.order_index || 0)
            );
            
            // Transform the answers to match the questions format
            const transformedQuestions = sortedAnswers.map(answer => ({
              id: answer.question_id,
              title: answer.question_title,
              max_points: answer.max_points,
              scoring_prompt: answer.scoring_prompt || '',
              body: answer.body || answer.question_title
            }));
            
            setQuestions(transformedQuestions);
          } else {
            console.error('Invalid answers data format:', answersResponse.data);
            setQuestions([]);
          }
        } catch (answersError) {
          console.error('Error fetching answers:', answersError);
          setQuestions([]);
        }

        // If admin, fetch submission count
        if (isAdmin) {
          const submissionsResponse = await axios.get(`${API_BASE_URL}/api/submissions?campaign_id=${campaignId}`);
          setSubmissionCount(submissionsResponse.data.length);
        }

        // Fetch submission status for non-admin users
        if (!isAdmin && user?.id) {
          const submissionsResponse = await axios.get(`${API_BASE_URL}/api/submissions`, {
            params: {
              campaign_id: campaignId,
              user_id: user.id
            }
          });

          const submissions = submissionsResponse.data;
          const completedSubmissions = submissions.filter((sub: any) => sub.is_complete).length;
          
          setSubmissionStatus({
            total_submissions: submissions.length,
            completed_submissions: completedSubmissions,
            max_submissions: campaignResponse.data.max_user_submissions,
            can_submit: submissions.length < campaignResponse.data.max_user_submissions && 
                       completedSubmissions < campaignResponse.data.max_user_submissions,
            has_completed_submission: completedSubmissions > 0
          });
        }
        
        AuthLogger.info(`Loaded campaign #${campaignId} successfully`);
      } catch (err) {
        console.error('Error fetching data:', err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError('Campaign not found');
            AuthLogger.error('Campaign not found', err.response?.status);
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
            AuthLogger.error('API error fetching data', err.response?.status, err.response?.data);
          } else {
            setError('Failed to load data');
            AuthLogger.error('Unknown error fetching data', err.response?.status);
          }
        } else {
          setError('An unexpected error occurred');
          AuthLogger.error('Unexpected error fetching data', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [campaignId, isAdmin, user?.id]);

  const handleStartInterview = async () => {
    try {
      setIsLoading(true);
      router.push(`/live-interview/${campaignId}`);
    } catch (error) {
      console.error('Error creating submission:', error);
      setErrorMessage('Failed to start interview. Please try again.');
      setIsLoading(false);
    }
  };

  const renderStartInterviewButton = () => {
    if (isLoading) {
      return (
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed"
          disabled
        >
          Loading...
        </button>
      );
    }

    if (!submissionStatus.can_submit) {
      return (
        <div className="flex items-start space-x-2">
          <div className="flex flex-col items-center">
            <button
              className="bg-gray-400 text-white px-4 py-2 rounded cursor-not-allowed"
              disabled
            >
              Interview Not Available
            </button>
            <p className="text-sm text-red-600 mt-1">
              {submissionStatus.has_completed_submission 
                ? "You have already completed this interview"
                : `Maximum attempts reached (${submissionStatus.max_submissions})`}
            </p>
          </div>
          <Link 
            href="/campaigns"
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700 mt-0"
          >
            Back to Positions
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        <Link 
          href="/campaigns"
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Back to Positions
        </Link>
      </div>
    );
  };

  // Update submission status to ensure numbers don't exceed max
  const safeSubmissionStatus = {
    ...submissionStatus,
    total_submissions: Math.min(submissionStatus.total_submissions, submissionStatus.max_submissions),
    completed_submissions: Math.min(submissionStatus.completed_submissions, submissionStatus.max_submissions)
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.push('/campaigns');
  };

  // Debug effect for campaign state
  useEffect(() => {
    if (campaign) {
      console.log('Campaign State Updated:', campaign);
    }
  }, [campaign]);

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
          {!isAdmin && renderStartInterviewButton()}
          {isAdmin && (
            <Link 
              href="/campaigns"
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Back to Campaigns
            </Link>
          )}
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
              </dl>
            </div>
          </div>

          {/* Campaign Link Section - Only visible for admin users */}
          {isAdmin && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-700">Campaign Link</h3>
                <button
                  id="copy-link-button"
                  type="button"
                  onClick={handleCopyLink}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Copy Link
                </button>
              </div>
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-600 break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/live-interview/${campaignId}` : ''}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-gray-500 mb-1">Access Code:</p>
                    <p className="text-base font-mono font-semibold text-gray-800">
                      {campaign?.access_code || 'Loading...'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Share this code with candidates to access the interview</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Questions Section - Show for both admin and candidates */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-6">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                {isAdmin ? 'Interview Questions' : 'Position Questions'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin 
                  ? 'Review and manage the questions for this campaign.' 
                  : 'Preview of the questions you will be asked during the interview.'}
              </p>
            </div>
            <div className="border-t border-gray-200">
              {questions.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {questions.map((question, index) => (
                    <li key={question.id} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-grow">
                          <p className="text-sm font-medium text-gray-900">
                            Question {index + 1}: {question.body}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-5 sm:px-6 text-center text-gray-500">
                  {isLoading ? (
                    <div className="flex justify-center items-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700"></div>
                    </div>
                  ) : (
                    <p>No questions available for this {isAdmin ? 'campaign' : 'position'}.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* Success Modal */}
      <Modal 
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        title="Campaign Created Successfully"
      >
        <div className="flex flex-col items-center space-y-4">
          <CheckCircleIcon className="h-12 w-12 text-green-500" />
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Your campaign has been created successfully!
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/live-interview/${campaignId}` : ''}
              </p>
            </div>
          </div>
          <PrimaryButton
            onClick={handleSuccessModalClose}
            className="mt-4"
          >
            Return to Campaigns
          </PrimaryButton>
        </div>
      </Modal>
    </PageTemplate>
  );
};

export default CampaignDetailsPage;
