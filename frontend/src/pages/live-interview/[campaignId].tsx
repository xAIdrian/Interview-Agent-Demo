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

interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

const LiveKitInterviewPage: React.FC = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  const [token, setToken] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const { handleStartInterview, isLoading: interviewLoading, error: interviewError } = useLiveKitInterview(campaignId as string);
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
          setSubmissionId(data.submissionId || null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
          setLoading(false);
        }
      };

      fetchCampaignData();
    }
  }, [campaignId, router]);

  const createSubmission = async (campaignId: string) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/submissions`,
        {
          campaign_id: campaignId,
          is_complete: false,
          user_id: user?.id,
        }
      );
      return response.data;
    } catch (err) {
      console.error('Error creating submission:', err);
      throw new Error('Failed to create submission');
    }
  };
  
  const onFormSubmit = async (token: string, room: string) => {
    setToken(token);
    setRoom(room);
  };
  
  const onDisconnect = () => {
    console.log('Interview disconnected, resetting state');
    setToken(null);
    setRoom(null);
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
        onInterviewComplete={() => {}}
        onDisconnect={onDisconnect}
        token={token}
        room={room}
        submissionId={submissionId || ''}
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
                  <p className="text-gray-700">
                    Maximum Points: {campaign.max_points}
                  </p>
                </div>
                
                <div>
                  <h2 className="text-xl font-semibold mb-2">Timeline</h2>
                  <p className="text-gray-700">
                    Created: {new Date(campaign.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-gray-700">
                    Last Updated: {new Date(campaign.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!token ? (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <button
              onClick={async () => {
                if (!campaignId) return;
                try {
                  // First create a submission
                  const newSubmission = await createSubmission(campaignId as string);
                  setSubmissionId(newSubmission.id);
                  
                  // Then start the interview with the submission ID
                  const { token, room } = await handleStartInterview(campaignId as string);
                  onFormSubmit(token, room);
                } catch (err) {
                  console.error('Error starting interview:', err);
                  setError(err instanceof Error ? err.message : 'Failed to start interview');
                }
              }}
              disabled={interviewLoading || !campaignId}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {interviewLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Starting Interview...
                </div>
              ) : (
                'Start Interview'
              )}
            </button>
            {interviewError && (
              <div className="mt-4 text-red-600 text-center">{interviewError}</div>
            )}
          </div>
        ) : (
          <LiveKitInterviewComponent 
            campaignId={campaignId as string}
            onInterviewComplete={() => {}}
            token={token} 
            room={room as string} 
            onDisconnect={onDisconnect}
            submissionId={submissionId || ''}
          />
        )}
      </div>
    </>
  );
};

export default LiveKitInterviewPage; 
