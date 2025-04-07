import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import LiveKitInterviewComponent from '@/components/livekit/LiveKitInterviewComponent';
import LiveKitInterviewForm from '@/components/livekit/LiveKitInterviewForm';

interface Campaign {
  id: string;
  title: string;
  job_description: string;
  campaign_context: string;
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
  
  useEffect(() => {
    const fetchCampaign = async () => {
      if (!campaignId) return;
      
      try {

        const response = await axios.get(
          `http://localhost:5000/interview/campaigns/${campaignId}`,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        setCampaign(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching campaign:', err);
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          setError('Please log in to view this campaign');
          // Redirect to login page
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
              <h2 className="text-xl font-semibold mb-2">Job Description</h2>
              <p className="text-gray-700 mb-4">{campaign.job_description}</p>
              
              <h2 className="text-xl font-semibold mb-2">Interview Context</h2>
              <p className="text-gray-700">{campaign.campaign_context}</p>
            </div>
          </div>
        )}
        
        {!token ? (
          <LiveKitInterviewForm onSubmit={onFormSubmit} />
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
