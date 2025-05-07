import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { API_BASE_URL } from '@/config';
import { PageTemplate } from '@/components/PageTemplate';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';

interface Question {
  id: string;
  title: string;
  body: string;
  scoring_prompt: string;
  max_points: number;
}

interface Campaign {
  id: string;
  title: string;
  questions: Question[];
}

export default function InterviewStartPage() {
  const router = useRouter();
  const { campaignId } = router.query;
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const fetchCampaign = async () => {
      if (!campaignId) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`${API_BASE_URL}/api/interview/campaigns/${campaignId}`);
        setCampaign(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load campaign details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  const startInterview = async () => {
    if (!campaign || isStarting) return;

    try {
      setIsStarting(true);
      // Create a new submission
      const response = await axios.post(`${API_BASE_URL}/api/submissions`, {
        campaign_id: campaign.id
      });

      if (response.data.success) {
        // Redirect to the interview page with the submission ID
        router.push(`/interview/submission/${response.data.data.id}`);
      } else {
        setError('Failed to start interview. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start interview');
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <PageTemplate>
        <div className="flex items-center justify-center min-h-screen">
          <Spinner size="large" />
        </div>
      </PageTemplate>
    );
  }

  if (error) {
    return (
      <PageTemplate>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Alert variant="error" title="Error" message={error} />
        </div>
      </PageTemplate>
    );
  }

  if (!campaign) {
    return (
      <PageTemplate>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Alert 
            variant="error" 
            title="Campaign Not Found" 
            message="The requested interview campaign could not be found." 
          />
        </div>
      </PageTemplate>
    );
  }

  return (
    <PageTemplate>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-6">{campaign.title}</h1>

          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Interview Instructions</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>This interview consists of {campaign.questions.length} questions.</li>
              <li>Each question will be presented one at a time.</li>
              <li>You will need to record a video response for each question.</li>
              <li>Make sure your camera and microphone are working properly.</li>
              <li>Find a quiet place with good lighting for the best results.</li>
              <li>Once you start, you cannot pause or restart the interview.</li>
            </ul>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Technical Requirements</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>A working webcam</li>
              <li>A working microphone</li>
              <li>A stable internet connection</li>
              <li>A modern web browser (Chrome, Firefox, Safari, or Edge)</li>
            </ul>
          </div>

          <div className="flex justify-center">
            <button
              onClick={startInterview}
              disabled={isStarting}
              className={`
                px-6 py-3 rounded-md text-white font-medium
                ${isStarting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'}
              `}
            >
              {isStarting ? 'Starting...' : 'Start Interview'}
            </button>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
} 
