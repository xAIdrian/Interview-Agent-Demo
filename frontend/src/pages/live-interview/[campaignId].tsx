import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import LiveKitInterviewComponent from '@/components/livekit/LiveKitInterviewComponent';
import { useLiveKitInterview } from '@/components/livekit/LiveKitInterviewForm';

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
}

const LiveKitInterviewPage = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  const [token, setToken] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { handleStartInterview, loading: interviewLoading, error: interviewError } = useLiveKitInterview();
  
  useEffect(() => {
    const fetchCampaign = async () => {
      if (!campaignId) return;
      
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/interview/campaigns/${campaignId}`
        );
        setCampaign(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching campaign:', err);
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          setError('Please log in to view this campaign');
          router.push('/login');
        } else {
          setError('Failed to load campaign details');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId, router]);
  
  const onFormSubmit = (name: string, token: string, roomName: string) => {
    console.log('Parent component received interview data:', { name, token, roomName });
    setUserName(name);
    setToken(token);
    setRoom(roomName);
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
  
  return (
    <>
      <Head>
        <title>{campaign?.title || 'AI Interview'} | Gulpin-AI</title>
        <meta name="description" content="AI-Powered Interview Experience" />
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        {campaign && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">{campaign.title}</h1>
            
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                try {
                  const { token, room } = await handleStartInterview('Candidate');
                  onFormSubmit('Candidate', token, room);
                } catch (err) {
                  // Error is already handled in the hook
                }
              }}
              disabled={interviewLoading}
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
            token={token} 
            room={room as string} 
            userName={userName}
            onDisconnect={onDisconnect}
          />
        )}
      </div>
    </>
  );
};

export default LiveKitInterviewPage; 
