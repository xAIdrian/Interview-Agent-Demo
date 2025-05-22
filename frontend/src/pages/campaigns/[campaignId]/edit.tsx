import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { PrimaryButton } from '../../../components/Button';
import { PageTemplate } from '../../../components/PageTemplate';
import { Spinner } from '../../../components/ui/Spinner';
import { Modal } from '../../../components/ui/Modal';
import { TrashIcon, CheckCircleIcon, UserIcon, MapPinIcon, BriefcaseIcon, AcademicCapIcon, CalendarIcon, CurrencyDollarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/app/components/AuthProvider';
import Link from 'next/link';
// Import tabulator config before Tabulator
import configureTabulatorDependencies from '../../../utils/tabulator-config';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { AuthLogger } from '../../../utils/logging';
import "tabulator-tables/dist/css/tabulator.min.css";
import "../../../styles/tabulator.css"; // Import custom tabulator styles

// Initialize Tabulator with required dependencies
configureTabulatorDependencies();

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kwiks.io';

// Define interface for Question object
interface Question {
  id?: string;
  title: string;
  body?: string;
  scoring_prompt: string;
  max_points: number;
  original_prompt?: string;
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
  location?: string;
  work_mode?: string;
  education_level?: string;
  experience?: string;
  salary?: string;
  contract?: string;
  position?: string;
}

// Add Submission interface
interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  is_complete: boolean;
  total_points: number | null;
  email: string;
  user_name: string | null;
  campaign_name: string;
}

// Update the Tabulator Cell type
interface TabulatorCell {
  getValue: () => any;
  getRow: () => { getData: () => Submission };
}

const EditCampaignPage = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  const { user } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
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
  
  // Add submissions state and ref
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);
  const tabulatorRef = useRef<Tabulator | null>(null);
  
  // Use client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Modify fetchCampaign to include submissions
  const fetchCampaign = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      if (!campaignId) {
        setError('Invalid campaign ID');
        setIsLoading(false);
        return;
      }
      
      // Fetch campaign details
      const campaignResponse = await axios.get(
        `${API_URL}/api/campaigns/${campaignId}`
      );
      
      // Fetch questions for this campaign from the canonical questions endpoint
      const questionsResponse = await axios.get(
        `${API_URL}/api/questions?campaign_id=${campaignId}`
      );

      // Fetch submissions for this campaign
      const submissionsResponse = await axios.get(
        `${API_URL}/api/submissions?campaign_id=${campaignId}`
      );
      
      const campaignData = campaignResponse.data;
      const questionsData = questionsResponse.data.map((q: any) => ({
        id: q.id,
        title: q.title,
        body: q.body || q.title,
        scoring_prompt: q.scoring_prompt || '',
        max_points: parseInt(q.max_points) || 10
      }));
      const submissionsData = submissionsResponse.data.map((submission: any) => ({
        ...submission,
        id: String(submission.id),
        campaign_id: String(submission.campaign_id),
        user_id: String(submission.user_id)
      }));
      
      setCampaign({
        id: campaignData.id.toString(),
        title: campaignData.title,
        campaign_context: campaignData.campaign_context || '',
        job_description: campaignData.job_description || '',
        max_user_submissions: parseInt(campaignData.max_user_submissions),
        is_public: Boolean(campaignData.is_public),
        questions: questionsData,
        location: campaignData.location || '',
        work_mode: campaignData.work_mode || '',
        education_level: campaignData.education_level || '',
        experience: campaignData.experience || '',
        salary: campaignData.salary || '',
        contract: campaignData.contract || '',
        position: campaignData.position || ''
      });

      setSubmissions(submissionsData);
      
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
  
  // Add Tabulator initialization effect
  useEffect(() => {
    if (isLoading || !tableRef.current || submissions.length === 0) return;
    
    try {
      const formatDate = (date: string | null) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleString();
      };
      
      tabulatorRef.current = new Tabulator(tableRef.current, {
        data: submissions,
        layout: "fitColumns",
        pagination: true,
        paginationSize: 10,
        paginationSizeSelector: [5, 10, 20, 50],
        movableColumns: true,
        resizableRows: true,
        columns: [
          { 
            title: "Candidate", 
            field: "email", 
            headerFilter: true, 
            widthGrow: 2,
            formatter: function(cell: any) {
              const data = cell._cell.row.data;
              const name = data.user_name || 'No name';
              const email = data.email;
              return `<div>
                <div class="font-medium">${name}</div>
              </div>`;
            }
          },
          { 
            title: "Created", 
            field: "created_at", 
            formatter: (cell) => formatDate(cell.getValue()),
            sorter: "datetime",
            widthGrow: 1
          },
          { 
            title: "Score", 
            field: "total_points", 
            formatter: (cell) => {
              const value = cell.getValue();
              return value !== null ? value : 'Not scored';
            },
            sorter: "number",
            widthGrow: 1
          },
          {
            title: "Actions",
            field: "id",
            hozAlign: "center",
            formatter: (cell: any) => {
              const submissionId = String(cell.getValue());
              const container = document.createElement("div");
              container.className = "flex space-x-2";
              
              const viewButton = document.createElement("a");
              viewButton.innerHTML = "View Answers";
              viewButton.className = "px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm";
              const returnToCampaign = String(campaignId);
              console.log('🚀 ~ Creating view button with returnToCampaign:', returnToCampaign);
              viewButton.href = `/submissions/${submissionId}?returnToCampaign=${encodeURIComponent(returnToCampaign)}`;
              container.appendChild(viewButton);
              
              return container;
            }
          }
        ],
        initialSort: [
          { column: "created_at", dir: "desc" }
        ]
      });
    } catch (err) {
      console.error("Error initializing tabulator:", err);
      setError("Failed to initialize submission table. Please refresh the page.");
    }
    
    return () => {
      if (tabulatorRef.current) {
        tabulatorRef.current.destroy();
        tabulatorRef.current = null;
      }
    };
  }, [submissions, isLoading]);
  
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
  
  // Handle form submission
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
    
    try {
      // Update the campaign
      const response = await axios.post(
        `${API_URL}/api/campaigns/${campaignId}/update`,
        {
          ...campaign,
          questions: campaign.questions.map(q => ({
            ...q,
            body: q.body || q.title
          })),
          position: campaign.position || ''
        }
      );

      if (response.status === 200) {
        setShowSuccessModal(true);
      } else {
        setError('Failed to update campaign');
      }
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      setError(error.response?.data?.error || 'Failed to update campaign. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    router.push('/campaigns');
  };
  
  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default behavior
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/live-interview/${campaignId}`;
    const button = document.querySelector('#copy-link-button');
    
    try {
      // Create a temporary textarea element
      const textarea = document.createElement('textarea');
      textarea.value = link;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position: fixed; pointer-events: none; opacity: 0;'; // Use fixed positioning and make invisible
      
      document.body.appendChild(textarea);
      textarea.select();
      
      // Try the modern clipboard API first
      try {
        await navigator.clipboard.writeText(link);
      } catch (clipboardErr) {
        // Fallback to the older execCommand method
        document.execCommand('copy');
      }
      
      document.body.removeChild(textarea);
      
      // Update button text temporarily
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Show error state on button
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Failed to copy';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    }
  };
  
  const handleDeleteCampaign = async () => {
    if (!campaignId) return;
    
    try {
      setIsDeleting(true);
      const response = await axios.delete(`${API_URL}/api/campaigns/${campaignId}`);
      
      if (response.data.success) {
        router.push('/campaigns');
      } else {
        setError('Failed to delete campaign');
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setError('Failed to delete campaign. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
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
    <PageTemplate>
      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <nav className="flex items-center text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
          <button
            onClick={() => router.push('/campaigns')}
            className="mr-2 p-1 rounded hover:bg-gray-200 focus:outline-none flex items-center"
            aria-label="Back to campaigns"
            type="button"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Link href="/campaigns" className="hover:text-blue-600 font-medium">Campaigns</Link>
          <span className="mx-2">/</span>
          <Link href={`/campaigns/${campaignId}`} className="hover:text-blue-600 font-medium">{campaign?.title || 'Campaign'}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 font-semibold">Edit</span>
        </nav>
      </div>

      {/* Header Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Edit Campaign</h1>
        </div>
      </div>

      {/* Campaign Title Input */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 mb-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title</label>
          <input
            type="text"
            name="title"
            value={campaign.title}
            onChange={handleCampaignChange}
            className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-gray-900"
            placeholder="Enter campaign title"
            required
          />
        </div>
      </div>

      {/* Editable Summary Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {/* Position */}
            <div className="flex items-center px-6 py-5">
              <span className="mr-4 text-blue-500">
                <UserIcon className="h-6 w-6" />
              </span>
              <div className="w-full">
                <label className="block text-sm text-gray-500 font-medium mb-1">Position</label>
                <input
                  type="text"
                  name="position"
                  value={campaign.position || ''}
                  onChange={handleCampaignChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-gray-900"
                  placeholder="Enter position"
                />
              </div>
            </div>
            {/* Location */}
            <div className="flex items-center px-6 py-5">
              <span className="mr-4 text-blue-500">
                <MapPinIcon className="h-6 w-6" />
              </span>
              <div className="w-full">
                <label className="block text-sm text-gray-500 font-medium mb-1">Location</label>
                <input
                  type="text"
                  name="location"
                  value={campaign.location}
                  onChange={handleCampaignChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-gray-900"
                  placeholder="Enter location"
                />
              </div>
            </div>
            {/* Work Mode */}
            <div className="flex items-center px-6 py-5">
              <span className="mr-4 text-blue-500">
                <BriefcaseIcon className="h-6 w-6" />
              </span>
              <div className="w-full">
                <label className="block text-sm text-gray-500 font-medium mb-1">Work Mode</label>
                <input
                  type="text"
                  name="work_mode"
                  value={campaign.work_mode}
                  onChange={handleCampaignChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-gray-900"
                  placeholder="Enter work mode"
                />
              </div>
            </div>
            {/* Education Level */}
            <div className="flex items-center px-6 py-5">
              <span className="mr-4 text-blue-500">
                <AcademicCapIcon className="h-6 w-6" />
              </span>
              <div className="w-full">
                <label className="block text-sm text-gray-500 font-medium mb-1">Education Level</label>
                <input
                  type="text"
                  name="education_level"
                  value={campaign.education_level}
                  onChange={handleCampaignChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-gray-900"
                  placeholder="Enter education level"
                />
              </div>
            </div>
            {/* Experience */}
            <div className="flex items-center px-6 py-5">
              <span className="mr-4 text-blue-500">
                <CalendarIcon className="h-6 w-6" />
              </span>
              <div className="w-full">
                <label className="block text-sm text-gray-500 font-medium mb-1">Experience</label>
                <input
                  type="text"
                  name="experience"
                  value={campaign.experience}
                  onChange={handleCampaignChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-gray-900"
                  placeholder="Enter experience"
                />
              </div>
            </div>
            {/* Salary */}
            <div className="flex items-center px-6 py-5">
              <span className="mr-4 text-blue-500">
                <CurrencyDollarIcon className="h-6 w-6" />
              </span>
              <div className="w-full">
                <label className="block text-sm text-gray-500 font-medium mb-1">Salary</label>
                <input
                  type="text"
                  name="salary"
                  value={campaign.salary}
                  onChange={handleCampaignChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-gray-900"
                  placeholder="Enter salary"
                />
              </div>
            </div>
            {/* Contract */}
            <div className="flex items-center px-6 py-5">
              <span className="mr-4 text-blue-500">
                <DocumentTextIcon className="h-6 w-6" />
              </span>
              <div className="w-full">
                <label className="block text-sm text-gray-500 font-medium mb-1">Contract</label>
                <input
                  type="text"
                  name="contract"
                  value={campaign.contract}
                  onChange={handleCampaignChange}
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500 text-base font-semibold text-gray-900"
                  placeholder="Enter contract type"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campaign details */}
            <div className="space-y-4">
              <div>
                <label htmlFor="campaign_context" className="block text-sm font-medium text-gray-700">Campaign Context</label>
                <textarea
                  id="campaign_context"
                  name="campaign_context"
                  value={campaign.campaign_context}
                  onChange={handleCampaignChange}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="job_description" className="block text-sm font-medium text-gray-700">Job Description</label>
                <textarea
                  id="job_description"
                  name="job_description"
                  value={campaign.job_description}
                  onChange={handleCampaignChange}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="max_user_submissions" className="block text-sm font-medium text-gray-700">Max Submissions</label>
                  <input
                    type="number"
                    id="max_user_submissions"
                    name="max_user_submissions"
                    value={campaign.max_user_submissions}
                    onChange={handleCampaignChange}
                    min="1"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="is_public" className="block text-sm font-medium text-gray-700">Visibility</label>
                  <select
                    id="is_public"
                    name="is_public"
                    value={campaign.is_public ? "true" : "false"}
                    onChange={handleCampaignChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="true">Public</option>
                    <option value="false">Private</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Questions Section */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Interview Questions</h2>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                >
                  Add Question
                </button>
              </div>

              <div className="space-y-6">
                {campaign.questions.map((question, index) => (
                  <div key={index} className="bg-gray-50 p-6 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Question {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor={`question-${index}-title`} className="block text-sm font-medium text-gray-700">Question Title</label>
                        <input
                          type="text"
                          id={`question-${index}-title`}
                          value={question.title}
                          onChange={(e) => handleQuestionChange(index, e)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor={`question-${index}-body`} className="block text-sm font-medium text-gray-700">Question Body</label>
                        <textarea
                          id={`question-${index}-body`}
                          value={question.body}
                          onChange={(e) => handleQuestionChange(index, e)}
                          rows={3}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor={`question-${index}-scoring_prompt`} className="block text-sm font-medium text-gray-700">Scoring Prompt</label>
                        <div className="mt-1 flex gap-2">
                          <textarea
                            id={`question-${index}-scoring_prompt`}
                            name="scoring_prompt"
                            value={question.scoring_prompt}
                            onChange={(e) => handleQuestionChange(index, e)}
                            rows={3}
                            className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            required
                            style={{ zIndex: 1, position: 'relative', background: 'white' }}
                          />
                          <button
                            type="button"
                            onClick={() => optimizePrompt(index)}
                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700 transition whitespace-nowrap"
                          >
                            Optimize
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor={`question-${index}-max_points`} className="block text-sm font-medium text-gray-700">Max Points</label>
                        <input
                          type="number"
                          id={`question-${index}-max_points`}
                          value={question.max_points}
                          onChange={(e) => handleQuestionChange(index, e)}
                          min="1"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8">
              <button
                type="button"
                onClick={() => router.push(`/campaigns/${campaignId}`)}
                className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Campaign"
        >
          <div className="p-6">
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete this campaign? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCampaign}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PageTemplate>
  );
};

export default EditCampaignPage;
