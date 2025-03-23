import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Position {
  id: string;
  title: string;
}

const ApplicationPage = () => {
  const router = useRouter();
  const { positionId } = router.query;
  
  const [position, setPosition] = useState<Position | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  // Set a default userId for demo purposes - using a numeric ID to match database expectations
  const [userId, setUserId] = useState(1);
  const [existingSubmissions, setExistingSubmissions] = useState<number>(0);
  const [maxSubmissions, setMaxSubmissions] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);

  // Fetch position details when positionId changes
  useEffect(() => {
    const fetchPositionDetails = async () => {
      if (!positionId) return; // Only check for positionId, userId is pre-set

      try {
        setIsLoading(true);
        setError('');
        
        // Fetch the position details
        const positionResponse = await axios.get(`${API_BASE_URL}/api/campaigns/${positionId}`);
        setPosition(positionResponse.data);
        setMaxSubmissions(positionResponse.data.max_user_submissions || 1);
        
        // Check if user has existing submissions for this position
        const submissionsResponse = await axios.get(
          `${API_BASE_URL}/api/submissions?campaign_id=${positionId}&user_id=${userId}&is_complete=1` // only track completed submissions
        );
        
        setExistingSubmissions(submissionsResponse.data.length);
        
      } catch (err) {
        console.error('Error fetching position details:', err);
        
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            router.push('/login');
          } else if (err.response?.status === 404) {
            setError('Position not found');
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
          } else {
            setError('Failed to load position details');
          }
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPositionDetails();
  }, [positionId, userId, router]);

  // Set up drag and drop event listeners
  useEffect(() => {
    // Function to prevent default behavior for all drag events
    const preventDefault = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragOver = (e: DragEvent) => {
      preventDefault(e);
      setIsDragging(true);
    };

    const handleDragEnter = (e: DragEvent) => {
      preventDefault(e);
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      preventDefault(e);
      setIsDragging(false);
    };

    const handleDrop = (e: DragEvent) => {
      preventDefault(e);
      setIsDragging(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        
        if (fileExtension && ['pdf', 'doc', 'docx'].includes(fileExtension)) {
          setResume(file);
        } else {
          setError('Please upload a PDF, DOC, or DOCX file');
        }
      }
    };

    // Add global document event listeners
    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', preventDefault);

    const dropArea = dropAreaRef.current;
    if (dropArea) {
      dropArea.addEventListener('dragover', handleDragOver);
      dropArea.addEventListener('dragenter', handleDragEnter);
      dropArea.addEventListener('dragleave', handleDragLeave);
      dropArea.addEventListener('drop', handleDrop);
    }

    return () => {
      // Remove global document event listeners
      document.removeEventListener('dragover', preventDefault);
      document.removeEventListener('drop', preventDefault);

      if (dropArea) {
        dropArea.removeEventListener('dragover', handleDragOver);
        dropArea.removeEventListener('dragenter', handleDragEnter);
        dropArea.removeEventListener('dragleave', handleDragLeave);
        dropArea.removeEventListener('drop', handleDrop);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension && ['pdf', 'doc', 'docx'].includes(fileExtension)) {
        setResume(file);
        setError(''); // Clear any previous errors
      } else {
        setResume(null);
        setError('Please upload a PDF, DOC, or DOCX file');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resume) {
      setError('Please upload your resume');
      return;
    }
    
    if (!positionId || !userId) {
      setError('Missing required information');
      return;
    }
    
    let submissionId: string | null = null;

    try {
      setIsUploading(true);
      setError('');
      
      // First, create a new submission
      const createSubmissionResponse = await axios.post(`${API_BASE_URL}/api/submissions`, {
        campaign_id: positionId,
        user_id: userId,
        created_at: new Date().toISOString(),
        is_complete: false,
        total_points: null
      });
      
      submissionId = createSubmissionResponse.data.submission_id;
      
      if (!submissionId) {
        throw new Error('Failed to create submission: No submission ID returned');
      }
      
      // Then, upload the resume with the submission ID
      const formData = new FormData();
      formData.append('resume', resume);
      formData.append('position_id', positionId as string);
      formData.append('user_id', userId.toString());
      formData.append('submission_id', submissionId.toString());
      
      // Upload the resume
      await axios.post(`${API_BASE_URL}/api/upload_resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Redirect to the interview room
      router.push(`/interview/${submissionId}`);
      
    } catch (err) {
      console.error('Error creating application:', err);
      
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else {
          setError('Failed to submit your application');
        }
      } else {
        setError('An unexpected error occurred');
      }
      
      // If upload fails, delete the submission
      if (submissionId) {
        try {
          await axios.delete(`${API_BASE_URL}/api/submissions/${submissionId}`);
        } catch (deleteErr) {
          console.error('Failed to delete submission after upload error:', deleteErr);
        }
      }
      setIsUploading(false);
    }
  };

  return (
    <PageTemplate title="Apply for Position">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link 
            href="/candidate/positions"
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            ← Back to Positions
          </Link>
        </div>
        
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Application Process</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              {isLoading ? 'Loading position details...' : position ? `Apply for: ${position.title}` : 'Position not found'}
            </p>
          </div>
          
          {error && (
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {isLoading ? (
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
              </div>
            </div>
          ) : position ? (
            existingSubmissions >= maxSubmissions ? (
              <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                <div className="rounded-md bg-yellow-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Application Limit Reached</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>You have already reached the maximum number of applications ({maxSubmissions}) for this position.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                  <div className="mb-6">
                    <h4 className="text-base font-medium text-gray-900">Step 1: Upload Your Resume</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      Please upload your resume in PDF, DOC, or DOCX format.
                    </p>
                    <div className="mt-3">
                      <div 
                        ref={dropAreaRef}
                        className={`flex items-center justify-center px-6 pt-5 pb-6 border-2 ${
                          isDragging ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300'
                        } border-dashed rounded-md transition-colors duration-200`}
                      >
                        <div className="space-y-1 text-center">
                          <svg
                            className={`mx-auto h-12 w-12 ${isDragging ? 'text-indigo-400' : 'text-gray-400'}`}
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="flex text-sm text-gray-600">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                            >
                              <span>Upload a file</span>
                              <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                className="sr-only"
                                accept=".pdf,.doc,.docx"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">PDF, DOC, DOCX up to 10MB</p>
                        </div>
                      </div>
                      {resume && (
                        <div className="mt-3 text-sm text-gray-500 flex items-center">
                          <span className="flex-shrink-0">Selected file: </span>
                          <span className="font-medium text-gray-900 ml-1 truncate">{resume.name}</span> 
                          <span className="ml-1">({(resume.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-base font-medium text-gray-900">Step 2: Start Your Interview</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      After uploading your resume, you'll be directed to an AI-powered interview experience.
                      The interview will take approximately 15-20 minutes to complete.
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      Make sure you're in a quiet environment with a working microphone and camera.
                    </p>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">
                        {existingSubmissions} of {maxSubmissions} application(s) used
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={isUploading || !resume}
                      className={`inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
                        isUploading || !resume
                          ? 'bg-blue-300 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      }`}
                    >
                      {isUploading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        'Continue to Interview'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )
          ) : (
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <div className="text-center py-4">
                <p className="text-gray-500">Position not found or no longer available.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTemplate>
  );
};

export default ApplicationPage;
