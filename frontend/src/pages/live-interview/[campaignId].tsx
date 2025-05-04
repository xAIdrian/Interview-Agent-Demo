import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import LiveKitInterviewComponent from '@/components/livekit/LiveKitInterviewComponent';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/app/components/AuthProvider';
import { Modal } from '@/components/Modal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

interface Campaign {
  id: string;
  title: string;
  job_description: string;
  campaign_context: string;
  max_user_submissions: number;
  max_points: number;
  created_at: string;
  updated_at: string;
  questions: Array<{
    id: string;
    title: string;
    body: string;
    scoring_prompt: string;
    max_points: number;
    order_index: number;
  }>;
  submissionId?: string;
}

const LiveKitInterviewPage: React.FC = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  const [token, setToken] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const { user } = useAuth();
  const [candidateData, setCandidateData] = useState({
    name: '',
    email: '',
    phoneNumber: ''
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [showMaxAttemptsModal, setShowMaxAttemptsModal] = useState(false);
  const [maxAttemptsMessage, setMaxAttemptsMessage] = useState<string | null>(null);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);

  useEffect(() => {
    if (campaignId) {
      const fetchCampaignData = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}`);
          if (!response.ok) {
            if (response.status === 401) {
              router.push('/login');
              return;
            }
            throw new Error('Failed to fetch campaign data');
          }
          const data = await response.json();
          setCampaign(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
          setLoading(false);
        }
      };

      fetchCampaignData();
    }
  }, [campaignId, router]);
  
  const onFormSubmit = async (token: string, room: string) => {
    setToken(token);
    setRoom(room);
  };
  
  const onDisconnect = () => {
    console.log('Interview disconnected, resetting state');
    setToken(null);
    setRoom(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCandidateData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const onStartInterview = async () => {
    if (!campaignId || typeof campaignId !== 'string') {
      setError('Invalid campaign ID');
      return;
    }

    // Validate inputs
    if (!candidateData.name || !candidateData.email) {
      setError('Name and email are required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidateData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!resumeFile) {
      setError('Please upload your resume');
      return;
    }

    setIsCreatingUser(true);
    setError(null);
    let newSubmissionId: string | null = null;

    try {
      // Create or get user
      const userResponse = await axios.post(`${API_BASE_URL}/api/users`, {
        name: candidateData.name,
        email: candidateData.email,
        phone_number: candidateData.phoneNumber,
        campaign_id: campaignId
      });

      // Check if user has reached maximum attempts for this campaign
      if (userResponse.data.max_attempts_reached) {
        setShowMaxAttemptsModal(true);
        setMaxAttemptsMessage(userResponse.data.message || 'Maximum attempts reached for this campaign');
        return;
      }

      const userId = userResponse.data.id;

      // Create submission
      const submissionResponse = await axios.post(`${API_BASE_URL}/api/submissions`, {
        campaign_id: campaignId,
        email: candidateData.email,
        name: candidateData.name
      });

      // Check if there's an error in the response
      if (submissionResponse.data.error === "Maximum submission limit reached for this campaign") {
        setShowMaxAttemptsModal(true);
        setMaxAttemptsMessage("You have reached the maximum number of attempts allowed for this position. Please contact the hiring team for more information.");
        return;
      }

      newSubmissionId = submissionResponse.data.id;
      setSubmissionId(newSubmissionId);

      // Upload resume
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('user_id', userId!);
      formData.append('submission_id', newSubmissionId!);
      formData.append('position_id', campaignId);

      const resumeResponse = await axios.post(`${API_BASE_URL}/api/upload_resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!resumeResponse.data.message) {
        throw new Error('Failed to upload resume');
      }

      // Get LiveKit token
      const tokenResponse = await axios.get(`${API_BASE_URL}/api/livekit/token`, {
        params: {
          room: `interview-${newSubmissionId}`,
          campaignId
        }
      });

      // If successful, proceed with the interview
      onFormSubmit(tokenResponse.data.token, tokenResponse.data.room);
    } catch (err) {
      console.error('Error starting interview:', err);
      
      // Cleanup on failure
      if (newSubmissionId) {
        try {
          await axios.delete(`${API_BASE_URL}/api/submissions/${newSubmissionId}`);
        } catch (cleanupErr) {
          console.error('Failed to cleanup submission:', cleanupErr);
        }
      }
      
      setError(err instanceof Error ? err.message : 'Failed to start interview');
    } finally {
      setIsCreatingUser(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

  if (token && room) {
    return (
      <>
        <LiveKitInterviewComponent
          campaignId={campaignId as string}
          onInterviewComplete={() => {
            console.log('Interview completed');
            setIsInterviewComplete(true);
          }}
          token={token}
          room={room}
          onDisconnect={onDisconnect}
          submissionId={submissionId!}
        />
        
        {/* Interview Complete Modal */}
        <Modal
          isOpen={isInterviewComplete}
          onClose={() => {}}
          title="Interview Complete"
        >
          <div className="p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Interview Successfully Completed</h3>
              <p className="text-gray-600 mb-6">
                Thank you for completing the interview. Your responses have been recorded.
              </p>
              <p>
                You can close this window now.
              </p>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{campaign?.title || 'AI Interview'}</title>
        <meta name="description" content="AI-Powered Interview Experience" />
      </Head>
      
      <div className="container mx-auto px-4 py-8">

        {campaign && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">{campaign.title}</h1>
            
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="grid gap-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Job Description</h2>
                  <p className="text-gray-700 mb-4">{campaign.job_description}</p>
                </div>
              </div>
            </div>

            {/* Candidate Information Section */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">Your Information</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Please provide your details to begin the interview.
                </p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={candidateData.name}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={candidateData.email}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
                
            {/* Resume Upload Section */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">Upload Your Resume</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Please upload your resume before starting the interview.
                </p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="resume-upload"
                      className={`flex flex-col items-center justify-center w-full h-64 border-2 
                        ${resumeFile ? 'border-green-300 bg-green-50' : 'border-gray-300 border-dashed'} 
                        rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {resumeFile ? (
                          <>
                            <svg className="w-10 h-10 mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <p className="mb-2 text-sm text-green-600">
                              Resume uploaded: {resumeFile.name}
                            </p>
                            <p className="text-xs text-green-500">
                              Click to change file
                            </p>
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-8 h-8 mb-4 text-gray-500"
                              aria-hidden="true"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 20 16"
                            >
                              <path
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                              />
                            </svg>
                            <p className="mb-2 text-sm text-gray-500">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">
                              PDF, DOC, or DOCX (MAX. 5MB)
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        id="resume-upload"
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setResumeFile(file);
                            setError(null); // Clear any previous errors
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <button
              onClick={onStartInterview}
              disabled={isCreatingUser}
              className={`w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold
                ${isCreatingUser ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            >
              {isCreatingUser ? 'Creating Account...' : 'Start Interview'}
            </button>
          </div>
        )}
      </div>

      {/* Maximum Attempts Modal - Updated to be non-closeable */}
      <Modal
        isOpen={showMaxAttemptsModal}
        onClose={() => {}} // Empty function to prevent closing
        title="Maximum Attempts Reached"
        hideCloseButton={true} // Add this prop to Modal component
      >
        <div className="p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Maximum Attempts Reached</h3>
            <p className="text-gray-600 mb-6">
              {maxAttemptsMessage}
            </p>
            <p className="text-sm text-gray-500">
              Please contact the hiring team for assistance.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LiveKitInterviewPage; 
