import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../components/PageTemplate';
import { PrimaryButton } from '../../components/Button';
import { INTERNAL_API_TOKEN } from '../../utils/internalApiToken';

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
  campaign_context: string;
  job_description: string; // Added job description field
  max_user_submissions: number;
  max_points: number;
  is_public: boolean;
  questions?: Question[];
}

const CampaignDetailPage = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Use client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Fetch campaign data when campaignId is available
  useEffect(() => {
    if (!isClient || !campaignId) return;
    
    const fetchCampaignData = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        // Fetch campaign details
        const campaignResponse = await axios.get(`http://127.0.0.1:5000/api/campaigns/${campaignId}`, {
          headers: {
            'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
          }
        });
        
        // Fetch questions for this campaign
        const questionsResponse = await axios.get(`http://127.0.0.1:5000/api/questions`, {
          params: { campaign_id: campaignId },
          headers: {
            'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
          }
        });
        
        setCampaign(campaignResponse.data);
        setQuestions(questionsResponse.data);
      } catch (err) {
        console.error('Error fetching campaign data:', err);
        setError('Failed to load campaign details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCampaignData();
  }, [campaignId, isClient]);
  
  const handleDeleteCampaign = async () => {
    if (!campaign || !window.confirm('Are you sure you want to delete this campaign? This will also delete all associated questions and submissions.')) {
      return;
    }
    
    try {
      setIsDeleting(true);
      
      await axios.delete(`http://127.0.0.1:5000/api/campaigns/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
        }
      });
      
      router.push('/campaigns');
    } catch (err) {
      console.error('Error deleting campaign:', err);
      setError('Failed to delete campaign. Please try again.');
      setIsDeleting(false);
    }
  };
  
  if (!isClient) {
    return <div className="loading">Loading...</div>;
  }
  
  if (isLoading) {
    return (
      <PageTemplate title="Campaign Details" maxWidth="lg">
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
        </div>
      </PageTemplate>
    );
  }
  
  if (error || !campaign) {
    return (
      <PageTemplate title="Error" maxWidth="lg">
        <div className="bg-red-100 p-4 rounded-md text-red-700">
          {error || 'Campaign not found'}
        </div>
        <Link href="/campaigns" className="mt-4 inline-block text-blue-500 hover:underline">
          ← Back to campaigns
        </Link>
      </PageTemplate>
    );
  }
  
  return (
    <PageTemplate title={campaign.title} maxWidth="lg">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        {/* Campaign header with action buttons */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{campaign.title}</h2>
          <div className="flex space-x-3">
            <Link href={`/campaigns/edit/${campaignId}`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
              Edit Campaign
            </Link>
            <button
              onClick={handleDeleteCampaign}
              disabled={isDeleting}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-red-300">
              {isDeleting ? 'Deleting...' : 'Delete Campaign'}
            </button>
          </div>
        </div>
        
        {/* Campaign details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <div>
              <span className="font-medium text-gray-700">Status:</span>
              <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded ${
                campaign.is_public 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {campaign.is_public ? 'Published' : 'Draft'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Maximum User Submissions:</span>
              <span className="ml-2">{campaign.max_user_submissions}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Maximum Points:</span>
              <span className="ml-2">{campaign.max_points}</span>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Campaign Context:</h3>
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              {campaign.campaign_context || 'No context provided'}
            </div>
          </div>
        </div>
        
        {/* Job Description Section */}
        <div className="mb-6">
          <h3 className="font-medium text-gray-700 mb-2">Job Description:</h3>
          <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap">
            {campaign.job_description || 'No job description provided'}
          </div>
        </div>
        
        {/* Questions section */}
        <div>
          <h3 className="text-xl font-bold mb-4">Questions</h3>
          
          {questions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No questions found for this campaign.
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <div className="flex justify-between">
                    <h4 className="text-lg font-semibold mb-2">
                      {index + 1}. {question.title}
                    </h4>
                    <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                      Max Points: {question.max_points}
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-gray-700 mb-1">Scoring Prompt:</h5>
                    <div className="bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap">
                      {question.scoring_prompt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="mt-8 space-x-4 flex">
          <Link href="/campaigns" className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700">
            Back to Campaigns
          </Link>
          
          <Link href={`/campaigns/${campaignId}/submissions`} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700">
            View Submissions
          </Link>
        </div>
      </div>
    </PageTemplate>
  );
};

export default CampaignDetailPage;