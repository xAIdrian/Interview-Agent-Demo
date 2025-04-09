import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../../components/PageTemplate';
import { PrimaryButton } from '../../../components/Button/PrimaryButton';
import { AuthLogger } from '../../../utils/logging';

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

// Interfaces
interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

interface Campaign {
  id: string;
  title: string;
  max_points: number;
}

interface Question {
  id: string;
  title: string;
  body: string;
  max_points: number;
}

interface Answer {
  id: string;
  question_id: string;
  transcript: string;
  score: number | null;
  score_rationale: string | null;
  question?: Question;
}

interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_complete: boolean;
  total_points: number | null;
  user?: User;
  campaign?: Campaign;
  answers?: Answer[];
  submission?: {
    is_complete: boolean;
  };
}

const SubmissionDetailsPage = () => {
  const router = useRouter();
  const { submissionId } = router.query;
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingError, setSavingError] = useState('');

  // Fetch submission data
  useEffect(() => {
    const fetchSubmission = async () => {
      if (!submissionId) return;
      
      try {
        setIsLoading(true);
        setError('');
        
        // Fetch submission details with related data
        const response = await axios.get(`${API_BASE_URL}/api/submissions/${submissionId}?include=user,campaign,answers`);
        
        // Ensure all IDs are strings for consistent handling
        const submissionWithStringIds = {
          ...response.data,
          id: String(response.data.id),
          campaign_id: String(response.data.campaign_id),
          user_id: String(response.data.user_id),
        };
        
        if (submissionWithStringIds.user) {
          submissionWithStringIds.user.id = String(submissionWithStringIds.user.id);
        }
        
        if (submissionWithStringIds.campaign) {
          submissionWithStringIds.campaign.id = String(submissionWithStringIds.campaign.id);
        }
        
        // Process answers
        if (submissionWithStringIds.answers) {
          submissionWithStringIds.answers = await Promise.all(submissionWithStringIds.answers.map(async (answer: any) => {
            // Convert IDs to strings
            const answerWithStringIds = {
              ...answer,
              id: String(answer.id),
              question_id: String(answer.question_id),
            };
            
            // Fetch question details for this answer
            try {
              const questionResponse = await axios.get(`${API_BASE_URL}/api/questions/${answerWithStringIds.question_id}`);
              answerWithStringIds.question = {
                ...questionResponse.data,
                id: String(questionResponse.data.id)
              };
            } catch (err) {
              console.error(`Error fetching question ${answerWithStringIds.question_id}:`, err);
            }
            
            return answerWithStringIds;
          }));
        }
        
        setSubmission(submissionWithStringIds);
        AuthLogger.info(`Loaded submission ${submissionId} details successfully`);
      } catch (err) {
        console.error('Error fetching submission details:', err);
        
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'Failed to load submission details.');
          AuthLogger.error('Error fetching submission:', err.response?.status, err.response?.data);
        } else {
          setError('An unexpected error occurred.');
          AuthLogger.error('Unexpected error fetching submission details:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId]);

  // Update score for a specific answer
  const updateAnswerScore = (answerId: string, score: number | null, rationale: string | null) => {
    if (!submission || !submission.answers) return;
    
    // Copy and update the answers array
    const updatedAnswers = submission.answers.map(answer => {
      if (answer.id === answerId) {
        return {
          ...answer,
          score,
          score_rationale: rationale
        };
      }
      return answer;
    });
    
    // Calculate new total points
    const newTotalPoints = updatedAnswers.reduce((total, answer) => {
      return total + (answer.score || 0);
    }, 0);
    
    // Update submission with new answers and total points
    setSubmission({
      ...submission,
      answers: updatedAnswers,
      total_points: newTotalPoints
    });
    
    setIsDirty(true);
  };

  // Save all changes
  const saveChanges = async () => {
    if (!submission || !submission.answers || !isDirty) return;
    
    try {
      setIsSaving(true);
      setSavingError('');
      
      // Track all promises for the update operations
      const updatePromises = [];
      
      // Update each answer individually using PUT endpoint
      for (const answer of submission.answers) {
        const updateAnswerPromise = axios.put(`${API_BASE_URL}/api/submission_answers/${answer.id}`, {
          score: answer.score,
          score_rationale: answer.score_rationale
        });
        updatePromises.push(updateAnswerPromise);
      }
      
      // Wait for all answer updates to complete
      await Promise.all(updatePromises);
      
      // Update the submission's total points using a separate endpoint
      await axios.put(`${API_BASE_URL}/api/submissions/${submission.id}`, {
        total_points: submission.total_points
      });
      
      AuthLogger.info(`Updated scores for submission ${submission.id}`);
      setIsDirty(false);
    } catch (err) {
      console.error('Error saving changes:', err);
      
      if (axios.isAxiosError(err)) {
        setSavingError(err.response?.data?.error || 'Failed to save changes.');
        AuthLogger.error('Error saving submission answers:', err.response?.status, err.response?.data);
      } else {
        setSavingError('An unexpected error occurred while saving.');
        AuthLogger.error('Unexpected error saving submission answers:', err);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete submission
  const deleteSubmission = async () => {
    if (!submission) return;
    
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_BASE_URL}/api/submissions/${submission.id}`);
      
      AuthLogger.info(`Deleted submission ${submission.id}`);
      
      // Redirect back to submissions list
      router.push(`/campaigns/${submission.campaign_id}/submissions`);
    } catch (err) {
      console.error('Error deleting submission:', err);
      
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to delete submission.');
        AuthLogger.error('Error deleting submission:', err.response?.status, err.response?.data);
      } else {
        setError('An unexpected error occurred while deleting.');
        AuthLogger.error('Unexpected error deleting submission:', err);
      }
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <PageTemplate title="Submission Details" maxWidth="lg">
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          {error}
        </div>
      ) : submission ? (
        <div className="bg-white shadow-md rounded-lg p-6">
          {/* Breadcrumbs */}
          <div className="text-sm text-gray-500 mb-6">
            <Link href="/campaigns" className="hover:text-blue-500">Campaigns</Link>
            {' / '}
            {submission.campaign && (
              <>
                <Link href={`/campaigns/${submission.campaign_id}`} className="hover:text-blue-500">
                  {submission.campaign.title}
                </Link>
                {' / '}
              </>
            )}
            <Link href={`/campaigns/${submission.campaign_id}/submissions`} className="hover:text-blue-500">
              Submissions
            </Link>
            {' / '}
            <span className="text-gray-700">Submission at {formatDate(submission.created_at)}</span>
          </div>
          
          {/* Action buttons */}
          <div className="flex justify-between mb-6">
            <div className="flex space-x-3">
              <Link 
                href={`/campaigns/${submission.campaign_id}/submissions`}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-700"
              >
                Back to Submissions
              </Link>
              <button
                onClick={deleteSubmission}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700"
              >
                Delete Submission
              </button>
            </div>
            
            {isDirty && (
              <PrimaryButton 
                onClick={saveChanges} 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </PrimaryButton>
            )}
          </div>
          
          {/* Error message for save operation */}
          {savingError && (
            <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md">
              {savingError}
            </div>
          )}
          
          {/* Submission details */}
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">Submission Information</h2>
                <p><span className="font-medium">ID:</span> {submission.id}</p>
                <p><span className="font-medium">Created:</span> {formatDate(submission.created_at)}</p>
                <p><span className="font-medium">Updated:</span> {formatDate(submission.updated_at)}</p>
                <p><span className="font-medium">Completed:</span> {formatDate(submission.completed_at)}</p>
                <p>
                  <span className="font-medium">Status:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-sm ${submission.is_complete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {submission.is_complete ? 'Completed' : 'In Progress'}
                  </span>
                </p>
                <p className="mt-2"><span className="font-medium">Total Score:</span> {submission.total_points ?? 'Not scored'}</p>
              </div>
              
              {submission.user && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Candidate Information</h2>
                  <p><span className="font-medium">Name:</span> {submission.user.name || 'N/A'}</p>
                  <p><span className="font-medium">Email:</span> {submission.user.email}</p>
                  <Link 
                    href={`/admin/users/${submission.user_id}`}
                    className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    View User Profile
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Answers and scoring */}
          <h2 className="text-xl font-bold mb-4">Questions & Answers</h2>
          
          {submission.answers && submission.answers.length > 0 ? (
            <div className="space-y-6">
              {submission.answers.map((answer, index) => (
                <div key={answer.id} className="border rounded-md p-4">
                  <h3 className="text-lg font-semibold mb-2">
                    {index + 1}. {answer.question?.title || 'Question'}
                  </h3>
                  
                  {answer.question?.body && (
                    <div className="mb-4 text-gray-700 bg-gray-50 p-3 rounded">
                      <p className="font-medium mb-1">Question:</p>
                      <p>{answer.question.body}</p>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <p className="font-medium mb-1">Answer:</p>
                    <div className="bg-gray-50 p-3 rounded whitespace-pre-wrap">
                      {answer.transcript || 'No answer provided'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium mb-1">Score:</label>
                      <input 
                        type="number" 
                        min="0" 
                        max={answer.question?.max_points || 100} 
                        value={answer.score === null ? '' : answer.score} 
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : parseInt(e.target.value, 10);
                          updateAnswerScore(answer.id, value, answer.score_rationale);
                        }}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Max: {answer.question?.max_points || 'N/A'} points
                      </p>
                    </div>
                    
                    <div>
                      <label className="block font-medium mb-1">Score Rationale:</label>
                      <textarea 
                        value={answer.score_rationale || ''}
                        onChange={(e) => updateAnswerScore(answer.id, answer.score, e.target.value)}
                        className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                        placeholder="Explain why this score was given..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-md">
              No answers available for this submission.
            </div>
          )}
          
          {/* Bottom save button when dirty */}
          {isDirty && (
            <div className="mt-6 flex justify-end">
              <PrimaryButton 
                onClick={saveChanges} 
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </PrimaryButton>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Submission not found.
        </div>
      )}
    </PageTemplate>
  );
};

export default SubmissionDetailsPage; 
