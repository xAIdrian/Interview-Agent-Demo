import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import LiveKitInterviewComponent from '@/components/livekit/LiveKitInterviewComponent';
import { useLiveKitInterview } from '@/components/livekit/useLiveKitInterview';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/app/components/AuthProvider';

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
  const { handleStartInterview: startInterview, isLoading: interviewLoading, error: interviewError, isUploadingResume, submissionId } = useLiveKitInterview(campaignId as string);
  const { user } = useAuth();

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

  const onStartInterview = async () => {
    if (!campaignId) return;
    
    // Validate resume file
    if (!resumeFile) {
      setError('Please upload your resume before starting the interview');
      return;
    }

    try {
      setError(null); // Clear any previous errors
      
      // Start interview with resume file
      const { token, room } = await startInterview(campaignId as string, resumeFile);
      
      // If successful, proceed with the interview
      onFormSubmit(token, room);
    } catch (err) {
      console.error('Error starting interview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview');
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
      <LiveKitInterviewComponent
        campaignId={campaignId as string}
        onInterviewComplete={() => {
          console.log('Interview completed');
          router.push('/campaigns');
        }}
        token={token}
        room={room}
        onDisconnect={onDisconnect}
        submissionId={submissionId}
      />
    );
  }

  return (
    <>
      <Head>
        <title>{campaign?.title || 'AI Interview'} | Gulpin-AI</title>
        <meta name="description" content="AI-Powered Interview Experience" />
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link 
              href="/campaigns" 
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Campaigns
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {campaign?.title || 'AI Interview'}
          </h1>
        </div>

        {campaign && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">{campaign.title}</h1>
            
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="grid gap-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Job Description</h2>
                  <p className="text-gray-700 mb-4">{campaign.job_description}</p>
                </div>
                
                <div>
                  <h2 className="text-xl font-semibold mb-2">Submission Details</h2>
                  <p className="text-gray-700">
                    Maximum Submissions: {campaign.max_user_submissions}
                  </p>
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

            {/* Error Display */}
            {error && (
              <div className="mb-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                  {error}
            </div>
          </div>
        )}
        
            {/* Start Interview Button */}
            <div className="mt-6">
            <button
                onClick={onStartInterview}
                disabled={interviewLoading || isUploadingResume || !resumeFile}
                className={`w-full py-3 px-4 rounded-md text-white 
                  ${interviewLoading || isUploadingResume || !resumeFile
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                  }`}
              >
                {interviewLoading || isUploadingResume 
                  ? 'Starting Interview...' 
                  : !resumeFile 
                    ? 'Upload Resume to Start'
                    : 'Start Interview'}
              </button>
                </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LiveKitInterviewPage; 
