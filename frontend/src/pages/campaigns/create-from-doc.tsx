import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PrimaryButton } from '../../components/Button';
import { PageTemplate } from '../../components/PageTemplate';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { UserGroupIcon } from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

// Define interfaces similar to create.tsx
interface Question {
  title: string;
  body?: string;
  scoring_prompt: string;
  max_points: number;
  original_prompt?: string;
}

interface Campaign {
  title: string;
  campaign_context: string;
  job_description: string;
  max_user_submissions: number;
  is_public: boolean;
  questions: Question[];
}

interface Template {
  [key: string]: string;
}

// Add interface for User
interface User {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
}

const CreateCampaignFromDocPage = () => {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Campaign state
  const [campaign, setCampaign] = useState<Campaign>({
    title: '',
    campaign_context: '',
    job_description: '',
    max_user_submissions: 1,
    is_public: false,
    questions: []
  });
  
  // AI optimization states (same as in create.tsx)
  const [optimizing, setOptimizing] = useState<{[key: number]: boolean}>({});
  const [optimizedPrompts, setOptimizedPrompts] = useState<{[key: number]: string}>({});
  const [showOptimized, setShowOptimized] = useState<{[key: number]: boolean}>({});
  
  // Template options
  const templates = {
    'standard': 'General interview questions based on the job description',
    'technical': 'Technical role assessment with coding and problem-solving questions',
    'leadership': 'Leadership role assessment focusing on management and strategic thinking',
    'sales': 'Sales role assessment focusing on communication and persuasion skills',
    'customer_service': 'Customer service assessment focusing on communication and problem-solving'
  };
  
  // Add useEffect to fetch candidates
  const [candidates, setCandidates] = useState<User[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  
  // Use client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    const fetchCandidates = async () => {
      setIsLoadingCandidates(true);
      try {
        const response = await axios.get(`${API_URL}/api/users`);
        console.log('🚀 ~ fetchCandidates ~ response:', response);
        const nonAdminUsers = response.data.filter((user: User) => !user.is_admin);
        setCandidates(nonAdminUsers);
      } catch (error) {
        console.error('Error fetching candidates:', error);
      } finally {
        setIsLoadingCandidates(false);
      }
    };

    fetchCandidates();
  }, []);
  
  if (!isClient) {
    return <div className="loading">Loading...</div>;
  }
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      
      // Extract candidate title from filename
      const fileName = e.target.files[0].name;
      const titleFromFile = fileName.split('.')[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      setCampaign({
        ...campaign,
        title: titleFromFile
      });
      
      setError('');
    }
  };
  
  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplate(e.target.value);
  };
  
  // Handle file upload and processing
  const handleProcessDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, Word document, or text file');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    // Create form data for file upload with template type
    const formData = new FormData();
    formData.append('document', file);
    formData.append('template_type', selectedTemplate);
    
    try {
      let response;
      try {
        response = await axios.post(
          `${API_URL}/api/campaigns/create-from-doc`,
          formData,
          {
            timeout: 60000 // 60 second timeout
          }
        );
      } catch (err) {
        console.error('Error extracting text from document:', err);
        if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
          setError('Request timed out. Please try uploading a smaller document or try again later.');
        } else {
          setError('No text could be extracted from the document. Please ensure you\'re not using "Print to PDF" as this converts text to images. Try a different document format.');
        }
        setIsProcessing(false);
        return;
      }
      
      // Get the response data with context, description and questions
      const extractedData = response.data;
      
      // Update campaign state
      setCampaign({
        ...campaign,
        campaign_context: extractedData.context || '',
        job_description: extractedData.description || '',
        questions: Array.isArray(extractedData.questions) ? extractedData.questions.map((q: { title?: string; scoring_prompt?: string; max_points?: number }) => ({
          title: q.title || '',
          scoring_prompt: q.scoring_prompt || '',
          max_points: q.max_points || 10,
          body: q.title || '' // Use title as body
        })) : []
      });
      
    } catch (error) {
      console.error('Error processing document:', error);
      setError('Failed to process document. Please try again or create a campaign manually.');
    } finally {
      setIsProcessing(false);
    }
  };
  
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
  
  // Add handler for candidate selection
  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidates(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId);
      } else {
        return [...prev, candidateId];
      }
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
        body: q.body || q.title // Use body if available, otherwise use title as body
      }))
    };
    
    try {
      const response = await axios.post(
        `${API_URL}/api/test-campaigns`,
        formData
      );
      
      // if (response.status === 201) {
      //   // After successful campaign creation, assign selected candidates
      //   if (selectedCandidates.length > 0) {
      //     await axios.post(`${API_URL}/api/campaigns/assign-candidates`, {
      //       campaignId: response.data.id,
      //       candidateIds: selectedCandidates
      //     });
      //   }

      // } else {
      //   setError('Failed to create campaign');
      // }
      router.push('/campaigns');
    } catch (error) {
      console.error('Error creating campaign:', error);
      setError('Failed to create campaign. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <PageTemplate title="Create Campaign from Document" maxWidth="lg">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Create Campaign from Document</h2>
        
        {/* Display any error message */}
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {/* Document upload section */}
        <div className="mb-8 p-6 border border-dashed border-gray-300 rounded-md">
          <h3 className="text-lg font-medium mb-4">Upload Job Description Document</h3>
          <p className="text-gray-600 mb-4">
            Upload a PDF, Word document, or text file containing a job description. The system will extract relevant information
            to create a campaign.
          </p>
          
          <form onSubmit={handleProcessDocument} className="flex flex-col space-y-4">
            <div>
              <label htmlFor="template_type" className="block text-sm font-medium text-gray-700 mb-2">
                Template Type
              </label>
              <select
                id="template_type"
                name="template_type"
                value={selectedTemplate}
                onChange={handleTemplateChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(templates).map(([key, description]) => (
                  <option key={key} value={key}>
                    {description}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Select the type of questions you'd like to generate
              </p>
            </div>
            
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
                accept=".pdf,.doc,.docx,.txt"
              />
              <p className="mt-1 text-xs text-gray-500">
                Supported formats: PDF, Word (.doc, .docx), Text (.txt)
              </p>
            </div>
            
            <div>
              <PrimaryButton 
                type="submit" 
                disabled={isProcessing || !file}
                className="w-auto"
              >
                {isProcessing ? (
                  <div className="flex items-center space-x-2">
                    <Spinner size="small" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Extract Campaign Information'
                )}
              </PrimaryButton>
            </div>
          </form>
        </div>
        
        {/* Loading Modal */}
        <Modal 
          isOpen={isProcessing}
          title="Processing Document"
        >
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="large" />
            <p className="text-gray-600 text-center">
              Please wait while we process your document and extract campaign information...
            </p>
          </div>
        </Modal>
        
        {/* Only show the campaign form if there are questions (indicating successful document processing) */}
        {campaign.questions.length > 0 && (
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
                  Publish Immediately
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
                      
                      {/* Delete question button (don't show if there's only one) */}
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
            
            {/* Add Candidate Selection Section */}
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Assign Candidates</h3>
                <div className="mt-2 max-w-xl text-sm text-gray-500">
                  <p>Select candidates to assign to this campaign.</p>
                </div>
                <div className="mt-5">
                  {isLoadingCandidates ? (
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {candidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          className={`relative rounded-lg border p-4 cursor-pointer ${
                            selectedCandidates.includes(candidate.id)
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          onClick={() => handleCandidateSelect(candidate.id)}
                        >
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <UserGroupIcon className="h-6 w-6 text-gray-400" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{candidate.name}</p>
                              <p className="text-sm text-gray-500">{candidate.email}</p>
                            </div>
                          </div>
                          {selectedCandidates.includes(candidate.id) && (
                            <div className="absolute top-2 right-2">
                              <div className="rounded-full bg-indigo-500 p-1">
                                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Submit button */}
            <div className="pt-4">
              <PrimaryButton type="submit" disabled={isSubmitting} fullWidth>
                {isSubmitting ? 'Creating...' : 'Create Campaign'}
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </PageTemplate>
  );
};

export default CreateCampaignFromDocPage;
