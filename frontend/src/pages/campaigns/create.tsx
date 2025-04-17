import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { PrimaryButton } from '../../components/Button';
import { PageTemplate } from '../../components/PageTemplate';
import axios from '../../utils/axios';
import { useAuth } from '../../app/components/AuthProvider';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { 
  PlusCircleIcon, 
  TrashIcon, 
  SparklesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

// Define interface for Question object
interface Question {
  title: string;
  body?: string; // Will be set to same as title when submitting
  scoring_prompt: string;
  max_points: number;
  original_prompt?: string; // For storing original prompt during optimization
}

// Define interface for Campaign object
interface Campaign {
  title: string;
  campaign_context: string;
  job_description: string; // Added job description field
  max_user_submissions: number;
  is_public: boolean;
  questions: Question[];
}

// Add interface for User
interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
}

const CreateCampaignPage = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Campaign state
  const [campaign, setCampaign] = useState<Campaign>({
    title: '',
    campaign_context: '',
    job_description: '', // Added job description with empty initial value
    max_user_submissions: 1,
    is_public: false,
    questions: [
      {
        title: '',
        scoring_prompt: '',
        max_points: 10
      }
    ]
  });
  
  // AI optimization states
  const [optimizing, setOptimizing] = useState<{[key: number]: boolean}>({});
  const [optimizedPrompts, setOptimizedPrompts] = useState<{[key: number]: string}>({});
  const [showOptimized, setShowOptimized] = useState<{[key: number]: boolean}>({});
  
  // Candidate states
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  
  // Use client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Add useEffect to fetch candidates
  useEffect(() => {
    const fetchCandidates = async () => {
      setIsLoadingCandidates(true);
      try {
        const response = await axios.get('/api/users');
        const nonAdminUsers = response.data.filter((user: User) => !user.is_admin);
        setCandidates(nonAdminUsers);
      } catch (error) {
        console.error('Error fetching candidates:', error);
        setError('Failed to load candidates');
      } finally {
        setIsLoadingCandidates(false);
      }
    };

    fetchCandidates();
  }, []);
  
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
      const response = await axios.post('/api/optimize_prompt', {
        campaign_name: campaignTitle,
        campaign_context,
        question: questionTitle,
        prompt: scoring_prompt
      });
      
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
  
  // Add handler for candidate selection
  const handleCandidateSelection = (userId: string) => {
    setSelectedCandidates(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Validate form
    if (!campaign.title.trim()) {
      setError('Campaign title is required');
      setIsSubmitting(false);
      return;
    }

    if (!campaign.job_description.trim()) {
      setError('Job description is required');
      setIsSubmitting(false);
      return;
    }

    if (!campaign.campaign_context.trim()) {
      setError('Campaign context is required');
      setIsSubmitting(false);
      return;
    }

    if (campaign.questions.length === 0) {
      setError('At least one question is required');
      setIsSubmitting(false);
      return;
    }

    if (selectedCandidates.length === 0) {
      setError('At least one candidate must be selected');
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

    try {
      // Prepare questions data
      const questionsData = campaign.questions.map(q => ({
        ...q,
        body: q.title // Set body to title when submitting
      }));

      // First create the campaign
      const response = await axios.post(`${API_BASE_URL}/api/test-campaigns`, {
        ...campaign,
        questions: questionsData
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        const campaignId = response.data.data.id;
        
        // If candidates were selected, assign them to the campaign
        if (selectedCandidates.length > 0) {
          try {
            const assignmentResponse = await axios.post(`${API_BASE_URL}/api/campaigns/${campaignId}/assignments`, {
              user_ids: selectedCandidates
            });

            if (assignmentResponse.data.message === "Candidates assigned successfully") {
              setShowSuccessModal(true);
            } else {
              setError(assignmentResponse.data.message || 'Failed to assign candidates');
              setIsSubmitting(false);
              return;
            }
          } catch (error: any) {
            console.error('Error assigning candidates:', error);
            setError(error.response?.data?.error || 'Failed to assign candidates');
            setIsSubmitting(false);
            return;
          }
        }
      } else {
        setError(response.data.message || 'Failed to create campaign');
        setIsSubmitting(false);
        return;
      }
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      setError(error.response?.data?.message || 'Failed to create campaign. Please try again.');
      setIsSubmitting(false);
      return;
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.push('/campaigns');
  };
  
  return (
    <PageTemplate title="Create Campaign" maxWidth="lg">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Details */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Campaign Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                name="title"
                value={campaign.title}
                onChange={handleCampaignChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Job Description</label>
              <textarea
                name="job_description"
                value={campaign.job_description}
                onChange={handleCampaignChange}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Campaign Context</label>
              <textarea
                name="campaign_context"
                value={campaign.campaign_context}
                onChange={handleCampaignChange}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700">Max User Submissions</label>
                <input
                  type="number"
                  name="max_user_submissions"
                  value={campaign.max_user_submissions}
                  onChange={handleCampaignChange}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Add Candidate Selection Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Candidate Assignment</h2>
              <UserGroupIcon className="h-6 w-6 text-gray-500" />
            </div>
            
            <div className="border rounded-lg p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Select candidates to assign to this campaign. You can also assign candidates later.
              </p>
              
              {isLoadingCandidates ? (
                <div className="flex justify-center">
                  <Spinner size="small" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {candidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCandidates.includes(candidate.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleCandidateSelection(candidate.id)}
                    >
                      <div className="font-medium">{candidate.name}</div>
                      <div className="text-sm text-gray-600">{candidate.email}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {candidates.length === 0 && !isLoadingCandidates && (
                <div className="text-center text-gray-500 py-4">
                  No candidates available to assign.
                </div>
              )}
            </div>
          </div>

          {/* Questions Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Questions</h2>
              <button
                type="button"
                onClick={addQuestion}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Add Question
              </button>
            </div>

            {campaign.questions.map((question, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium">Question {index + 1}</h3>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Question Title</label>
                  <input
                    type="text"
                    name="title"
                    value={question.title}
                    onChange={(e) => handleQuestionChange(index, e)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Scoring Prompt</label>
                  <div className="mt-1 flex space-x-2">
                    <textarea
                      name="scoring_prompt"
                      value={question.scoring_prompt}
                      onChange={(e) => handleQuestionChange(index, e)}
                      rows={3}
                      className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {showOptimized[index] && (
                  <div className="mt-2 p-3 bg-purple-50 rounded-md">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-purple-700">{optimizedPrompts[index]}</p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          type="button"
                          onClick={() => useOptimizedPrompt(index)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <CheckCircleIcon className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => useOriginalPrompt(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <XCircleIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Points</label>
                  <input
                    type="number"
                    name="max_points"
                    value={question.max_points}
                    onChange={(e) => handleQuestionChange(index, e)}
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <PrimaryButton
              type="submit"
              disabled={isSubmitting}
              className="flex items-center"
            >
              {isSubmitting ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </PrimaryButton>
          </div>
        </form>
      </div>

      {/* Loading Modal */}
      <Modal 
        isOpen={isSubmitting}
        title="Creating Campaign"
      >
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="large" />
          <p className="text-gray-600 text-center">
            Please wait while we create your campaign and assign candidates...
          </p>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal 
        isOpen={showSuccessModal}
        title="Campaign Created Successfully"
      >
        <div className="flex flex-col items-center space-y-4">
          <CheckCircleIcon className="h-12 w-12 text-green-500" />
          <p className="text-gray-600 text-center">
            Your campaign has been created successfully! Click the button below to return to the campaigns page.
          </p>
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

export default CreateCampaignPage;
