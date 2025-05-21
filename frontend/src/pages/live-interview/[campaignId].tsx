import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import LiveKitInterviewComponent from '@/components/livekit/LiveKitInterviewComponent';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/app/components/AuthProvider';
import { Modal } from '@/components/Modal';
import MicTest from '@/components/livekit/MicTest';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kwiks.io';

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
    phoneNumber: '',
    countryCode: '+1',
    lastName: ''
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [showMaxAttemptsModal, setShowMaxAttemptsModal] = useState(false);
  const [maxAttemptsMessage, setMaxAttemptsMessage] = useState<string | null>(null);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [showMicTest, setShowMicTest] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fr'>('en');

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
      if (userResponse.data.max_attempts_reached) {
        setShowMaxAttemptsModal(true);
        setMaxAttemptsMessage(userResponse.data.message || 'Maximum attempts reached for this campaign');
        setShowMicTest(false);
        return;
      }
      // Prefer API response, fallback to useAuth user.id
      const userId = userResponse.data.id || user?.id;
      // Create submission
      const submissionResponse = await axios.post(`${API_BASE_URL}/api/submissions`, {
        campaign_id: campaignId,
        email: candidateData.email,
        name: candidateData.name
      });
      if (submissionResponse.data.error === "Maximum submission limit reached for this campaign") {
        setShowMaxAttemptsModal(true);
        setMaxAttemptsMessage("You have reached the maximum number of attempts allowed for this position. Please contact the hiring team for more information.");
        setShowMicTest(false);
        return;
      }
      newSubmissionId = submissionResponse.data.id;
      setSubmissionId(newSubmissionId);
      // Upload resume
      if (!resumeFile) {
        throw new Error('Resume file is missing');
      }
      if (!userId) {
        throw new Error('User ID is missing');
      }
      const formData = new FormData();
      formData.append('resume', resumeFile);
      formData.append('user_id', userId);
      formData.append('submission_id', newSubmissionId!);
      if (typeof campaignId !== 'string') {
        throw new Error('Campaign ID is missing or invalid');
      }
      formData.append('position_id', campaignId);
      const resumeResponse = await axios.post(`${API_BASE_URL}/api/upload_resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log("resumeResponse", resumeResponse.data.message);
      if (resumeResponse.data.error) {
        setErrorDialogMessage(resumeResponse.data.error);
        setShowErrorDialog(true);
        setShowMicTest(false);
        setIsCreatingUser(false);
        return;
      }
      // Instead of starting the interview, show the mic test stage
      setShowMicTest(true);
    } catch (err) {
      console.error('Error uploading resume:', err);
      setErrorDialogMessage(err instanceof Error ? err.message : 'Failed to upload resume');
      setShowErrorDialog(true);
      setShowMicTest(false);
      setIsCreatingUser(false);
    }

  };

  const handleMicTestSuccess = async () => {
    try{
      // Get LiveKit token
      const tokenResponse = await axios.get(`${API_BASE_URL}/api/livekit/token`, {
        params: {
          room: `interview-${submissionId}`,
          campaignId,
          language: selectedLanguage
        }
      });
      // If successful, proceed with the interview
      setToken(tokenResponse.data.token);
      setRoom(tokenResponse.data.room);
      setShowMicTest(false);
    } catch (err) {
      console.error('Error starting interview:', err);
      if (submissionId) {
        try {
          await axios.delete(`${API_BASE_URL}/api/submissions/${submissionId}`);
        } catch (cleanupErr) {
          console.error('Failed to cleanup submission:', cleanupErr);
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      setShowMicTest(false);
    } finally {
      setIsCreatingUser(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col flex-1 justify-center items-center bg-[#f5f7fa] w-full">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col flex-1 justify-center items-center bg-[#f5f7fa] w-full">
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

  if (showMicTest) {
    return <MicTest onSuccess={handleMicTestSuccess} showVideoToggle={true} />;
  }

  if (token && room) {
    return (
      <LiveKitInterviewComponent
        campaignId={campaignId as string}
        onInterviewComplete={() => {
          setIsInterviewComplete(true);
        }}
        token={token}
        room={room}
        onDisconnect={onDisconnect}
        submissionId={submissionId!}
        candidateName={candidateData.name}
        language={selectedLanguage}
      />
    );
  }

  return (
    <>
      <Head>
        <title>{campaign?.title || 'AI Interview'}</title>
        <meta name="description" content="AI-Powered Interview Experience" />
      </Head>
      
      <div className="min-h-screen flex flex-col flex-1 justify-center items-center bg-[#f5f7fa] w-full">
        <div className="w-full max-w-3xl bg-white shadow-md rounded-lg p-12 md:p-16 mx-auto mt-16">
          <h2 className="text-3xl font-bold mb-10 text-center">Interview Application</h2>
          <form onSubmit={e => { e.preventDefault(); onStartInterview(); }}>
            <div className="flex gap-6 mb-6">
              <div className="w-1/2">
                <label htmlFor="name" className="block text-lg font-medium text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={candidateData.name}
                      onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-3 px-5 text-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="w-1/2">
                <label htmlFor="lastName" className="block text-lg font-medium text-gray-700 mb-2">Last name</label>
                <input
                  type="text"
                  name="lastName"
                  id="lastName"
                  value={candidateData.lastName || ''}
                  onChange={e => setCandidateData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-3 px-5 text-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div className="mb-6">
              <label htmlFor="phoneNumber" className="block text-lg font-medium text-gray-700 mb-2">Telephone</label>
              <div className="flex">
                <select
                  className="border border-gray-300 rounded-l-md py-3 px-4 bg-gray-50 text-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  style={{ minWidth: 90 }}
                  value={candidateData.countryCode || '+1'}
                  onChange={e => setCandidateData(prev => ({ ...prev, countryCode: e.target.value }))}
                  required
                >
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+91">🇮🇳 +91</option>
                  {/* Add more as needed */}
                </select>
                <input
                  type="tel"
                  name="phoneNumber"
                  id="phoneNumber"
                  value={candidateData.phoneNumber}
                  onChange={handleInputChange}
                  className="mt-0 block w-full border border-gray-300 rounded-r-md shadow-sm py-3 px-5 text-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="608 646631"
                      required
                    />
                  </div>
            </div>
            <div className="mb-6">
              <label htmlFor="email" className="block text-lg font-medium text-gray-700 mb-2">Email address</label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={candidateData.email}
                      onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-3 px-5 text-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
            </div>
            <div className="mb-8">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center bg-gray-50 relative">
                      <input
                        id="resume-upload"
                        type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setResumeFile(file);
                      setError(null);
                    }
                  }}
                  required
                />
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <svg className="w-14 h-14 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="mb-3 text-lg text-blue-600 font-semibold">Click to upload</p>
                  <p className="mb-3 text-lg text-gray-500">or drag and drop</p>
                  <p className="text-base text-gray-400">DOCX, DOC, PDF or text</p>
                  <div className="mt-4">
                    <label htmlFor="resume-upload" className="inline-block px-6 py-3 bg-blue-500 text-white rounded text-lg cursor-pointer pointer-events-auto">Browse Files</label>
                  </div>
                  {resumeFile && (
                    <div className="mt-4 text-green-600 text-lg">{resumeFile.name}</div>
                  )}
                </div>
              </div>
            </div>
            {error && (
              <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-center text-lg">
                {error}
              </div>
            )}
            {/* Language Selection */}
            <div className="mb-6">
              <label className="block text-lg font-medium text-gray-700 mb-2">
                Select Interview Language
              </label>
              <div className="flex gap-6">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio h-5 w-5 text-blue-600"
                    name="language"
                    value="en"
                    checked={selectedLanguage === 'en'}
                    onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'fr')}
                  />
                  <span className="ml-2 text-lg">English</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio h-5 w-5 text-blue-600"
                    name="language"
                    value="fr"
                    checked={selectedLanguage === 'fr'}
                    onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'fr')}
                  />
                  <span className="ml-2 text-lg">Français</span>
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={isCreatingUser}
              className={`w-full bg-blue-600 text-white py-4 px-8 rounded-lg font-semibold text-xl transition-colors duration-200 ${isCreatingUser ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            >
              {isCreatingUser ? 'Creating Account...' : 'Start the interview'}
            </button>
          </form>
        </div>
        <div className="mt-12 text-center text-gray-400 text-lg w-full">
          Powered by <span className="font-semibold text-gray-500">KWIKS.</span>
          </div>
      </div>

      {/* Error Dialog */}
      <Modal
        isOpen={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        title="Error"
      >
        <div className="p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-6">
              {errorDialogMessage}
            </p>
            <button
              onClick={() => setShowErrorDialog(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Maximum Attempts Modal */}
      <Modal
        isOpen={showMaxAttemptsModal}
        onClose={() => {}}
        title="Maximum Attempts Reached"
        hideCloseButton={true}
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
