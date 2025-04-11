import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PrimaryButton } from '../../../components/Button';
import { PageTemplate } from '../../../components/PageTemplate';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

// Define interface for Question object
interface Question {
  id?: string; // ID is required for existing questions
  title: string;
  body?: string;
  scoring_prompt: string;
  max_points: number;
  original_prompt?: string; // For storing original prompt during optimization
}

// Define interface for Campaign object
interface Campaign {
  id?: string;
  title: string;
  campaign_context: string;
  job_description: string;
  max_user_submissions: number;
  is_public: boolean;
  questions: Question[];
}

const EditCampaignPage = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Campaign state
  const [campaign, setCampaign] = useState<Campaign>({
    title: '',
    campaign_context: '',
    job_description: '',
    max_user_submissions: 1,
    is_public: false,
    questions: []
  });
  
  // AI optimization states
  const [optimizing, setOptimizing] = useState<{[key: number]: boolean}>({});
  const [optimizedPrompts, setOptimizedPrompts] = useState<{[key: number]: string}>({});
  const [showOptimized, setShowOptimized] = useState<{[key: number]: boolean}>({});
  
  // Use client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Use useCallback to prevent dependency cycle
  const fetchCampaign = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Verify campaignId is available and is a string
      if (!campaignId) {
        setError('Invalid campaign ID');
        setIsLoading(false);
        return;
      }
      
      // Fetch campaign details
      const campaignResponse = await axios.get(
        `${API_URL}/api/campaigns/${campaignId}`
      );
      
      // Fetch questions for this campaign
      const questionsResponse = await axios.get(
        `${API_URL}/api/questions?campaign_id=${campaignId}`
      );
      
      const campaignData = campaignResponse.data;
      const questionsData = questionsResponse.data;
      
      // Combine data into campaign state
      setCampaign({
        id: campaignData.id.toString(), // Ensure ID is a string
        title: campaignData.title,
        campaign_context: campaignData.campaign_context || '',
        job_description: campaignData.job_description || '',
        max_user_submissions: parseInt(campaignData.max_user_submissions),
        is_public: Boolean(campaignData.is_public),
        questions: questionsData.map((q: any) => ({
          id: q.id.toString(), // Ensure ID is a string
          title: q.title,
          body: q.body || '',
          scoring_prompt: q.scoring_prompt || '',
          max_points: parseInt(q.max_points) || 10
        }))
      });
      
    } catch (error) {
      console.error('Error fetching campaign:', error);
      setError('Failed to load campaign data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);
  
  // Fetch campaign data
  useEffect(() => {
    if (isClient && campaignId) {
      fetchCampaign();
    }
  }, [isClient, campaignId, fetchCampaign]);
  
  if (!isClient) {
    return <div className="loading">Loading...</div>;
  }
  
  // Handle form field changes
  const handleCampaignChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    
    setCampaign({
      ...campaign,
      [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value
    });
  };
  
  // Handle question field changes
  const handleQuestionChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const updatedQuestions = [...campaign.questions];
    
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [name]: name === 'max_points' ? parseInt(value) || 0 : value
    };
    
    setCampaign({
      ...campaign,
      questions: updatedQuestions
    });
  };
  
  // Add a new question
  const addQuestion = () => {
    setCampaign({
      ...campaign,
      questions: [
        ...campaign.questions,
        {
          title: '',
          scoring_prompt: '',
          max_points: 10
        }
      ]
    });
  };
  
  // Remove a question
  const removeQuestion = (index: number) => {
    const updatedQuestions = [...campaign.questions];
    updatedQuestions.splice(index, 1);
    
    setCampaign({
      ...campaign,
      questions: updatedQuestions
    });
  };
  
  // Optimize prompt with AI
  const optimizePrompt = async (index: number) => {
    const { title: campaignTitle, campaign_context } = campaign;
    const { title: questionTitle, scoring_prompt } = campaign.questions[index];
    
    // Validate required fields
    if (!campaignTitle.trim()) {
      setError('Please enter a campaign title before optimizing');
      return;
    }
    
    if (!campaign_context.trim()) {
      setError('Please enter campaign context before optimizing');
      return;
    }
    
    if (!questionTitle.trim()) {
      setError('Please enter a question before optimizing');
      return;
    }
    
    if (!scoring_prompt.trim()) {
      setError('Please enter a scoring prompt before optimizing');
      return;
    }
    
    // Save original prompt
    const updatedQuestions = [...campaign.questions];
    updatedQuestions[index].original_prompt = scoring_prompt;
    setCampaign({
      ...campaign,
      questions: updatedQuestions
    });
    
    // Show loading state
    setOptimizing({...optimizing, [index]: true});
    setError('');
    
    try {
      const response = await axios.post(
        `${API_URL}/api/optimize_prompt`,
        {
          campaign_name: campaignTitle,
          campaign_context,
          question: questionTitle,
          prompt: scoring_prompt
        }
      );
      
      // Store optimized prompt
      setOptimizedPrompts({
        ...optimizedPrompts,
        [index]: response.data.optimized_prompt
      });
      
      // Show the optimized prompt
      setShowOptimized({
        ...showOptimized,
        [index]: true
      });
      
    } catch (error) {
      console.error('Error optimizing prompt:', error);
      setError('Failed to optimize prompt. Please try again.');
    } finally {
      setOptimizing({...optimizing, [index]: false});
    }
  };
  
  // Use optimized prompt
  const useOptimizedPrompt = (index: number) => {
    const updatedQuestions = [...campaign.questions];
    updatedQuestions[index].scoring_prompt = optimizedPrompts[index];
    
    setCampaign({
      ...campaign,
      questions: updatedQuestions
    });
    
    setShowOptimized({
      ...showOptimized,
      [index]: false
    });
  };
  
  // Use original prompt
  const useOriginalPrompt = (index: number) => {
    const updatedQuestions = [...campaign.questions];
    if (updatedQuestions[index].original_prompt) {
      updatedQuestions[index].scoring_prompt = updatedQuestions[index].original_prompt;
    }
    
    setCampaign({
      ...campaign,
      questions: updatedQuestions
    });
    
    setShowOptimized({
      ...showOptimized,
      [index]: false
    });
  };
  
  // Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    // Validate form
    if (!campaign.title.trim()) {
      setError('Campaign title is required');
      setIsSubmitting(false);
      return;
    }
    
    if (campaign.questions.length === 0) {
      setError('At least one question is required');
      setIsSubmitting(false);
      return;
    }
    
    for (const question of campaign.questions) {
      if (!question.title.trim()) {
        setError('All questions must have a title');
        setIsSubmitting(false);
        return;
      }
      
      if (!question.scoring_prompt.trim()) {
        setError('All questions must have a scoring prompt');
        setIsSubmitting(false);
        return;
      }
      
      if (question.max_points <= 0) {
        setError('All questions must have max points greater than 0');
        setIsSubmitting(false);
        return;
      }
    }
    
    // Prepare data for API
    const formData = {
      ...campaign,
      questions: campaign.questions.map(q => ({
        ...q,
        body: q.body || q.title, // Use body if available, otherwise use title as body
        // Ensure max_points is a number
        max_points: parseInt(String(q.max_points)) || 10
      }))
    };
    
    try {
      // Ensure campaignId is available
      if (!campaignId) {
        throw new Error('Campaign ID is missing');
      }
      
      const response = await axios.post(
        `${API_URL}/api/campaigns/${campaignId}/update`,
        formData
      );
      
      if (response.status === 200) {
        // Redirect to campaigns list
        router.push('/campaigns');
      } else {
        setError('Failed to update campaign');
      }
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      // More detailed error message that includes the server response if available
      const errorMessage = error.response?.data?.error || 'Failed to update campaign. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <PageTemplate title="Edit Campaign" maxWidth="lg">
        <div className="w-full bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
          </div>
        </div>
      </PageTemplate>
    );
  }
  
  return (
    <PageTemplate title="Edit Campaign" maxWidth="lg">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Edit Campaign</h2>
        
        {/* Display any error message */}
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign details */}
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Campaign Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                value={campaign.title}
                onChange={handleCampaignChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="campaign_context" className="block text-sm font-medium text-gray-700">
                Campaign Context
              </label>
              <textarea
                id="campaign_context"
                name="campaign_context"
                value={campaign.campaign_context}
                onChange={handleCampaignChange}
                rows={4}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Provide context about this role to help guide AI scoring"
              />
            </div>

            <div>
              <label htmlFor="job_description" className="block text-sm font-medium text-gray-700">
                Job Description
              </label>
              <textarea
                id="job_description"
                name="job_description"
                value={campaign.job_description}
                onChange={handleCampaignChange}
                rows={4}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter the complete job description for this role"
              />
            </div>
            
            <div>
              <label htmlFor="max_user_submissions" className="block text-sm font-medium text-gray-700">
                Max User Submissions
              </label>
              <input
                id="max_user_submissions"
                name="max_user_submissions"
                type="number"
                value={campaign.max_user_submissions}
                onChange={handleCampaignChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                required
              />
            </div>
            
            <div className="flex items-center">
              <input
                id="is_public"
                name="is_public"
                type="checkbox"
                checked={campaign.is_public}
                onChange={handleCampaignChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_public" className="ml-2 block text-sm text-gray-700">
                Publish Campaign
              </label>
            </div>
          </div>
          
          {/* Questions */}
          <div>
            <h3 className="text-xl font-bold mb-4">Questions</h3>
            
            <div className="space-y-8">
              {campaign.questions.map((question, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-md bg-gray-50">
                  <div className="space-y-4">
                    <div>
                      <label 
                        htmlFor={`question_${index}_title`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Question
                      </label>
                      <input
                        id={`question_${index}_title`}
                        name="title"
                        type="text"
                        value={question.title}
                        onChange={(e) => handleQuestionChange(index, e)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label 
                        htmlFor={`question_${index}_scoring_prompt`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Scoring Prompt
                      </label>
                      <textarea
                        id={`question_${index}_scoring_prompt`}
                        name="scoring_prompt"
                        value={question.scoring_prompt}
                        onChange={(e) => handleQuestionChange(index, e)}
                        rows={4}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => optimizePrompt(index)}
                        disabled={optimizing[index]}
                        className="mt-2 bg-green-500 text-white px-4 py-1 rounded hover:bg-green-700 text-sm disabled:bg-green-300"
                      >
                        {optimizing[index] ? 'Optimizing...' : 'Optimize with AI'}
                      </button>
                      
                      {/* Optimized prompt container */}
                      {showOptimized[index] && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700">
                            AI Optimized Prompt:
                          </label>
                          <div className="mt-2 p-3 bg-gray-100 border border-gray-300 rounded-md">
                            {optimizedPrompts[index]}
                          </div>
                          <div className="flex space-x-2 mt-2">
                            <button
                              type="button"
                              onClick={() => useOptimizedPrompt(index)}
                              className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-700 text-sm"
                            >
                              Use optimized
                            </button>
                            <button
                              type="button"
                              onClick={() => useOriginalPrompt(index)}
                              className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-700 text-sm"
                            >
                              Use original
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label 
                        htmlFor={`question_${index}_max_points`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Max Points
                      </label>
                      <input
                        id={`question_${index}_max_points`}
                        name="max_points"
                        type="number"
                        value={question.max_points}
                        onChange={(e) => handleQuestionChange(index, e)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        required
                      />
                    </div>
                    
                    {/* Delete question button (don't show for last question if there's only one) */}
                    {campaign.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="mt-2 bg-red-500 text-white px-4 py-1 rounded hover:bg-red-700 text-sm"
                      >
                        Delete Question
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add question button */}
            <button
              type="button"
              onClick={addQuestion}
              className="mt-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Add Another Question
            </button>
          </div>
          
          {/* Submit button */}
          <div className="pt-4">
            <PrimaryButton type="submit" disabled={isSubmitting} fullWidth>
              {isSubmitting ? 'Updating...' : 'Update Campaign'}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </PageTemplate>
  );
};

export default EditCampaignPage;
