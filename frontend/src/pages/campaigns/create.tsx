import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { PrimaryButton } from '../../components/Button';
import { PageTemplate } from '../../components/PageTemplate';
import axios from '../../utils/axios';
import { AxiosError } from 'axios';
import { useAuth } from '../../app/components/AuthProvider';
import { Spinner } from '../../components/ui/Spinner';
import { Modal } from '../../components/ui/Modal';
import { 
  PlusCircleIcon, 
  TrashIcon, 
  SparklesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon
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
  job_description: string;
  max_user_submissions: number;
  is_public: boolean;
  questions: Question[];
  position: string;
  location: string;
  work_mode: string;
  education_level: string;
  experience: string;
  salary: string;
  contract: string;
}

const CreateCampaignPage = () => {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [campaignId, setCampaignId] = useState<string>('');
  const [directAccessUrl, setDirectAccessUrl] = useState<string>('');
  const [response, setResponse] = useState<any>(null);
  
  // Document processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('standard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Template options
  const templates = {
    'standard': 'General interview questions based on the job description',
    'technical': 'Technical role assessment with coding and problem-solving questions',
    'leadership': 'Leadership role assessment focusing on management and strategic thinking',
    'sales': 'Sales role assessment focusing on communication and persuasion skills',
    'customer_service': 'Customer service assessment focusing on communication and problem-solving'
  };
  
  // Campaign state
  const [campaign, setCampaign] = useState<Campaign>({
    title: '',
    campaign_context: '',
    job_description: '',
    max_user_submissions: 1,
    is_public: false,
    questions: [],
    position: '',
    location: '',
    work_mode: '',
    education_level: '',
    experience: '',
    salary: '',
    contract: ''
  });
  
  // AI optimization states
  const [optimizing, setOptimizing] = useState<{[key: number]: boolean}>({});
  const [optimizedPrompts, setOptimizedPrompts] = useState<{[key: number]: string}>({});
  const [showOptimized, setShowOptimized] = useState<{[key: number]: boolean}>({});
  
  // Add state for multi-step form
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // Step 1: File upload/manual entry state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Step 4: Candidate emails state
  const [candidateEmails, setCandidateEmails] = useState('');

  // Stepper sidebar steps
  const steps = [
    { label: 'Upload document', description: 'Upload the your job offer document' },
    { label: 'Campaign Details', description: 'Fill out the personal informations' },
    { label: 'Campaign Context', description: 'Fill out profile criterias' },
    { label: 'Select Candidates', description: 'Edit the AI made resume' },
    { label: 'Questions', description: 'Edit the AI made resume' },
  ];
  
  // Use client-side only rendering
  useEffect(() => {
    setIsClient(true);
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
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !user) return;

    setIsSubmitting(true);
    setError('');

    try {
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

      // Prepare questions data with all required fields
      const questionsData = campaign.questions.map(q => ({
        title: q.title,
        body: q.title, // Set body to title when submitting
        scoring_prompt: q.scoring_prompt,
        max_points: q.max_points,
        order_index: 0 // Add order_index as required by backend
      }));

      // Prepare the complete campaign payload
      const campaignPayload = {
        title: campaign.title.trim(),
        campaign_context: campaign.campaign_context.trim(),
        job_description: campaign.job_description.trim(),
        max_user_submissions: campaign.max_user_submissions,
        is_public: campaign.is_public,
        questions: questionsData,
        user_id: user.id,
        // Include all campaign details fields
        position: campaign.position.trim() || null,
        location: campaign.location.trim() || null,
        work_mode: campaign.work_mode.trim() || null,
        education_level: campaign.education_level.trim() || null,
        experience: campaign.experience.trim() || null,
        salary: campaign.salary.trim() || null,
        contract: campaign.contract.trim() || null
      };

      console.log('Sending campaign payload:', campaignPayload); // Debug log

      // Create the campaign with all fields
      const response = await axios.post(`${API_BASE_URL}/api/test-campaigns`, campaignPayload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        const campaignId = response.data.data.id;
        setCampaignId(campaignId);
        // Construct the direct access URL using localhost:3000
        const directUrl = `${API_BASE_URL}/start/${campaignId}`;
        setDirectAccessUrl(directUrl);
        setResponse(response.data);
        setShowSuccessModal(true);
      } else {
        setError(response.data.message || 'Failed to create campaign');
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      setError(error.response?.data?.message || 'Failed to create campaign. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.push('/campaigns');
  };
  
  // File upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setManualEntry(false);
      
      // Extract campaign title from filename
      const fileName = file.name;
      const titleFromFile = fileName.split('.')[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      setCampaign({
        ...campaign,
        title: titleFromFile
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file);
      setManualEntry(false);
      
      // Extract campaign title from filename
      const fileName = file.name;
      const titleFromFile = fileName.split('.')[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      setCampaign({
        ...campaign,
        title: titleFromFile
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Handle starting manual mode
  const handleManualEntryClick = () => {
    // If questions have been generated, show confirmation dialog
    if (campaign.questions.length > 0) {
      setShowConfirmDialog(true);
    } else {
      // Otherwise, just switch to manual mode
      setManualEntry(true);
      setUploadedFile(null);
    }
  };

  const handleConfirmManualEntry = () => {
    // Reset campaign data
    setCampaign({
      title: '',
      campaign_context: '',
      job_description: '',
      max_user_submissions: 1,
      is_public: false,
      questions: [],
      position: '',
      location: '',
      work_mode: '',
      education_level: '',
      experience: '',
      salary: '',
      contract: ''
    });
    
    // Switch to manual mode
    setManualEntry(true);
    setUploadedFile(null);
    setShowConfirmDialog(false);
  };

  const handleCancelManualEntry = () => {
    setShowConfirmDialog(false);
  };
  
  const handleNextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };
  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };
  
  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplate(e.target.value);
  };
  
  // Handle file upload and processing
  const handleProcessDocument = async () => {
    if (!uploadedFile) {
      setError('Please select a file to upload');
      return;
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(uploadedFile.type)) {
      setError('Please upload a PDF, Word document, or text file');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    // Create form data for file upload with template type
    const formData = new FormData();
    formData.append('document', uploadedFile);
    formData.append('template_type', selectedTemplate);
    
    try {
      // Process the document using the API
      const response = await axios.post(
        `${API_BASE_URL}/api/campaigns/create-from-doc`,
        formData,
        {
          timeout: 60000 // 60 second timeout
        }
      );
      
      // Get the response data with context, description and questions
      const extractedData = response.data;
      
      // Update campaign state with extracted data
      setCampaign(prevCampaign => {
        // Create questions array from extracted data
        const questions = Array.isArray(extractedData.questions) 
          ? extractedData.questions.map((q: { title?: string; scoring_prompt?: string; max_points?: number }) => ({
              title: q.title || '',
              scoring_prompt: q.scoring_prompt || '',
              max_points: q.max_points || 10,
              body: q.title || '' // Use title as body
            }))
          : [];
          
        // Return updated campaign object
        return {
          ...prevCampaign,
          campaign_context: extractedData.context || '',
          job_description: extractedData.description || '',
          questions
        };
      });
      
      // Move to step 2 automatically after successful processing
      setCurrentStep(2);
    } catch (error) {
      // Handle specific error types
      const axiosError = error as AxiosError;
      if (axiosError.code === 'ECONNABORTED') {
        setError('Request timed out. Please try uploading a smaller document or try again later.');
      } else if (axiosError.response?.status === 415) {
        setError('Unsupported file format. Please ensure you\'re uploading a valid document with text content.');
      } else if (axiosError.response?.status === 400) {
        setError('Unable to extract content from document. Please ensure the file contains extractable text and is not image-based or password-protected.');
      } else {
        console.error('Error processing document:', error);
        setError('Failed to process document. Please try again or create your campaign manually.');
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <PageTemplate maxWidth="full">
      <div className="flex justify-center w-full pt-12 pb-12">
        <div className="flex gap-6 w-[70%] max-w-5xl bg-transparent">
          {/* Sidebar Stepper */}
          <div className="w-1/3 max-w-xs">
            <div className="bg-white rounded-lg shadow-md p-6">
              <ol className="space-y-4">
                {steps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 cursor-pointer group"
                    onClick={() => setCurrentStep(idx + 1)}
                  >
                    <div className={`flex items-center justify-center h-8 w-8 rounded-full border-2 transition ${currentStep === idx + 1 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 group-hover:border-blue-400 group-hover:text-blue-600'}`}>{idx + 1}</div>
                    <div>
                      <div className={`font-semibold transition ${currentStep === idx + 1 ? 'text-blue-700' : 'text-gray-800 group-hover:text-blue-600'}`}>{step.label}</div>
                      <div className="text-xs text-gray-400">{step.description}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          {/* Step Content */}
          <div className="flex-1">
            {currentStep === 1 && (
              <div className="bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center min-h-[400px]">
                {!manualEntry ? (
                  <>
                    <div
                      className="w-full max-w-lg border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center py-16 cursor-pointer hover:border-blue-400 transition"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => document.getElementById('file-upload-input')?.click()}
                    >
                      <div className="flex flex-col items-center">
                        <div className="bg-gray-100 rounded-full p-3 mb-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
                        </div>
                        <span className="text-blue-600 font-medium cursor-pointer">Click to upload</span> <span className="text-gray-400">or drag and drop</span>
                        <span className="text-xs text-gray-400 mt-1">DOCX, DOC, PDF or text</span>
                      </div>
                      <input
                        id="file-upload-input"
                        type="file"
                        accept=".doc,.docx,.pdf,.txt"
                        className="hidden"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                      />
                    </div>
                    
                    {uploadedFile && (
                      <div className="mt-4 w-full">
                        <div className="text-green-600 text-sm mb-3">Selected file: {uploadedFile.name}</div>
                        
                        <div className="mb-4">
                          <label htmlFor="template_type" className="block text-sm font-medium text-gray-700 mb-2">
                            Template Type
                          </label>
                          <select
                            id="template_type"
                            name="template_type"
                            value={selectedTemplate}
                            onChange={handleTemplateChange}
                            className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        
                        <button
                          type="button"
                          onClick={handleProcessDocument}
                          disabled={isProcessing}
                          className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessing ? (
                            <div className="flex items-center justify-center space-x-2">
                              <div className="animate-spin h-5 w-5 border-t-2 border-white rounded-full"></div>
                              <span>Processing...</span>
                            </div>
                          ) : (
                            'Generate Campaign from Document'
                          )}
                        </button>
                      </div>
                    )}
                    
                    <div className="my-4 text-gray-400 text-sm w-full flex items-center justify-center">
                      <span className="mx-2">OR</span>
                    </div>
                    <div className="flex w-full justify-between items-center mt-4">
                      <button
                        type="button"
                        onClick={handleManualEntryClick}
                        className="border border-blue-600 text-blue-600 px-6 py-2 rounded-md hover:bg-blue-50 transition"
                      >
                        Do it manually
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className={`bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition ${!uploadedFile && !manualEntry ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!uploadedFile && !manualEntry}
                      >
                        Next Step
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full">
                      <h2 className="text-xl font-semibold mb-4">Manual Setup</h2>
                      <p className="text-gray-500 mb-4">
                        You've chosen to create your campaign manually. Please proceed to the next step to continue setting up your campaign.
                      </p>
                    </div>
                    <div className="flex w-full justify-between items-center mt-6">
                      <button
                        type="button"
                        onClick={() => setManualEntry(false)}
                        className="border border-gray-400 text-gray-600 px-4 py-2 rounded-md hover:bg-gray-100 transition"
                      >
                        Back to upload
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition"
                      >
                        Next Step
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {currentStep === 2 && (
              <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-2xl mx-auto">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title</label>
                  <input
                    type="text"
                    name="title"
                    value={campaign.title}
                    onChange={handleCampaignChange}
                    placeholder="e.g., Senior Software Engineer Position"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                    <input
                      type="text"
                      name="position"
                      value={campaign.position}
                      onChange={handleCampaignChange}
                      placeholder="e.g., Senior Software Engineer"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={campaign.location}
                      onChange={handleCampaignChange}
                      placeholder="e.g., New York, NY"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Mode</label>
                    <input
                      type="text"
                      name="work_mode"
                      value={campaign.work_mode}
                      onChange={handleCampaignChange}
                      placeholder="e.g., Remote, Hybrid, On-site"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Education Level</label>
                    <input
                      type="text"
                      name="education_level"
                      value={campaign.education_level}
                      onChange={handleCampaignChange}
                      placeholder="e.g., Bachelor's Degree"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                    <input
                      type="text"
                      name="experience"
                      value={campaign.experience}
                      onChange={handleCampaignChange}
                      placeholder="e.g., 3-5 years"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
                    <input
                      type="text"
                      name="salary"
                      value={campaign.salary}
                      onChange={handleCampaignChange}
                      placeholder="e.g., $50,000 - $70,000"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract</label>
                  <input
                    type="text"
                    name="contract"
                    value={campaign.contract}
                    onChange={handleCampaignChange}
                    placeholder="e.g., Full Time"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
                  <textarea
                    name="job_description"
                    value={campaign.job_description}
                    onChange={handleCampaignChange}
                    rows={6}
                    placeholder="Enter the detailed job description..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="flex w-full justify-between items-center mt-8">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="border border-blue-600 text-blue-600 px-8 py-2 rounded-md hover:bg-blue-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className={`bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition ${!campaign.title.trim() || !campaign.job_description.trim() || campaign.max_user_submissions < 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!campaign.title.trim() || !campaign.job_description.trim() || campaign.max_user_submissions < 1}
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}
            {currentStep === 3 && (
              <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-2xl mx-auto">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Context</label>
                  <textarea
                    name="campaign_context"
                    value={campaign.campaign_context}
                    onChange={handleCampaignChange}
                    rows={6}
                    placeholder="Enter the campaign context and requirements..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="flex w-full justify-between items-center mt-8">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="border border-blue-600 text-blue-600 px-8 py-2 rounded-md hover:bg-blue-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className={`bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition ${!campaign.campaign_context.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!campaign.campaign_context.trim()}
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}
            {currentStep === 4 && (
              <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-2xl mx-auto">
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mails list</label>
                  <textarea
                    name="candidate_emails"
                    value={candidateEmails}
                    onChange={e => setCandidateEmails(e.target.value)}
                    rows={12}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter one email per line"
                    required
                  />
                </div>
                <div className="flex w-full justify-between items-center mt-8">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="border border-blue-600 text-blue-600 px-8 py-2 rounded-md hover:bg-blue-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className={`bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition ${!candidateEmails.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!candidateEmails.trim()}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            {currentStep === 5 && (
              <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-2xl mx-auto">
                <div className="w-full">
                  <h2 className="text-xl font-semibold mb-4">Questions</h2>
                  {campaign.questions.length === 0 && (
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mb-4"
                    >
                      <PlusCircleIcon className="h-5 w-5 mr-2" />
                      Add Question
                    </button>
                  )}
                  {campaign.questions.map((question, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Question Title</label>
                        <input
                          type="text"
                          name="title"
                          value={question.title}
                          onChange={(e) => handleQuestionChange(index, e)}
                          placeholder="e.g., Describe your experience with React"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Scoring Prompt</label>
                        <textarea
                          name="scoring_prompt"
                          value={question.scoring_prompt}
                          onChange={(e) => handleQuestionChange(index, e)}
                          rows={3}
                          placeholder="Enter the scoring criteria for this question..."
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Max Points</label>
                        <input
                          type="number"
                          name="max_points"
                          value={question.max_points}
                          onChange={(e) => handleQuestionChange(index, e)}
                          min="1"
                          placeholder="e.g., 10"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm rounded-md text-red-600 hover:bg-red-50 focus:outline-none"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          Remove
                        </button>
                        
                        <div className="flex space-x-2">
                          {!optimizing[index] && !showOptimized[index] && (
                            <button
                              type="button"
                              onClick={() => optimizePrompt(index)}
                              className="inline-flex items-center px-2 py-1 border border-blue-600 text-sm rounded-md text-blue-600 hover:bg-blue-50 focus:outline-none"
                            >
                              <SparklesIcon className="h-4 w-4 mr-1" />
                              Optimize
                            </button>
                          )}
                          
                          {optimizing[index] && (
                            <div className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm rounded-md text-gray-500">
                              <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                              Optimizing...
                            </div>
                          )}
                          
                          {showOptimized[index] && (
                            <div className="flex space-x-1">
                              <button
                                type="button"
                                onClick={() => useOptimizedPrompt(index)}
                                className="inline-flex items-center px-2 py-1 border border-green-600 text-sm rounded-md text-green-600 hover:bg-green-50 focus:outline-none"
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Use
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => useOriginalPrompt(index)}
                                className="inline-flex items-center px-2 py-1 border border-red-600 text-sm rounded-md text-red-600 hover:bg-red-50 focus:outline-none"
                              >
                                <XCircleIcon className="h-4 w-4 mr-1" />
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {showOptimized[index] && (
                        <div className="bg-green-50 p-3 rounded-md border border-green-200 mt-3">
                          <p className="text-xs text-green-700 font-medium mb-1">Optimized Prompt:</p>
                          <p className="text-sm text-green-800">{optimizedPrompts[index]}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {campaign.questions.length > 0 && (
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <PlusCircleIcon className="h-5 w-5 mr-2" />
                      Add Question
                    </button>
                  )}
                </div>
                
                <div className="flex w-full justify-between items-center mt-8">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="border border-blue-600 text-blue-600 px-8 py-2 rounded-md hover:bg-blue-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    className={`bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition ${campaign.questions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={campaign.questions.length === 0}
                  >
                    Create Campaign
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading Modal */}
      <Modal 
        isOpen={isSubmitting}
        title="Creating Campaign"
      >
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="large" />
          <p className="text-gray-600 text-center">
            Please wait while we create your campaign...
          </p>
        </div>
      </Modal>
      
      {/* Document Processing Modal */}
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

      {/* Confirmation Dialog */}
      <Modal 
        isOpen={showConfirmDialog}
        onClose={handleCancelManualEntry}
        title="Switch to Manual Mode?"
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              This will erase all campaign data that has been generated from your document. Are you sure you want to start over manually?
            </p>
          </div>
          <div className="flex space-x-4 w-full">
            <button
              type="button"
              onClick={handleCancelManualEntry}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmManualEntry}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
            >
              Erase & Start Manual
            </button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal 
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        title="Campaign Created Successfully"
        shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/start/${campaignId}` : ''}
      >
        <div className="flex flex-col items-center space-y-4 w-full">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 w-full">
              <p className="text-sm text-gray-500 mb-2">Access Code:</p>
              <p className="text-lg font-mono font-semibold text-gray-800">{directAccessUrl && response?.data?.access_code}</p>
              <p className="text-xs text-gray-500 mt-2">Share this code with candidates to access the interview</p>
            </div>
          <div className="text-center space-y-4">
            <p className="text-gray-600">
              Your campaign has been created successfully!
            </p>
          </div>
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
