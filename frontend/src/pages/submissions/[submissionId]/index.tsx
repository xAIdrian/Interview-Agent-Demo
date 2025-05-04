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

interface ResumeAnalysis {
  strengths: string[];
  weaknesses: string[];
  overall_fit: string;
  percent_match: number;
  percent_match_reason: string;
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
  resume_analysis?: ResumeAnalysis;
}

interface SubmissionAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  video_path: string;
  transcript: string;
  score: number | null;
  score_rationale: string;
  question_title: string;
  max_points: number;
  body: string;
}

// Scoring Display component
function ScoringDisplay({ submission }: { submission: Submission }) {
  return (
    <div className="w-full bg-white rounded-lg shadow p-4 mb-4">
      <div className="space-y-6">
        {/* Strengths and Weaknesses Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-medium text-gray-900">Strengths and Weaknesses</h3>
            <div className="relative group">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute left-0 mt-2 w-64 bg-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <p className="text-xs text-gray-600">Analysis of your technical skills, experience, and qualifications compared to the job requirements.</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            {submission.resume_analysis ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Strengths</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {submission.resume_analysis.strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-gray-600">{strength}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Weaknesses</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {submission.resume_analysis.weaknesses.map((weakness, index) => (
                      <li key={index} className="text-sm text-gray-600">{weakness}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No resume analysis available</p>
            )}
          </div>
        </div>

        {/* Overall Fit Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-medium text-gray-900">Overall Fit</h3>
            <div className="relative group">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute left-0 mt-2 w-64 bg-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <p className="text-xs text-gray-600">A comprehensive assessment of how well your skills, experience, and responses align with the position requirements.</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            {submission.resume_analysis ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-900">
                  {submission.resume_analysis.percent_match}% Match
                </div>
                <p className="text-sm text-gray-600">{submission.resume_analysis.overall_fit}</p>
                <p className="text-sm text-gray-500">{submission.resume_analysis.percent_match_reason}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No overall fit assessment available</p>
            )}
          </div>
        </div>

        {/* Questions and Answers Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-medium text-gray-900">Questions and Answers</h3>
            <div className="relative group">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute left-0 mt-2 w-64 bg-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <p className="text-xs text-gray-600">Detailed scoring of your responses to each interview question, evaluating technical knowledge, problem-solving, and communication skills.</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-4">
              {submission.answers?.map((answer) => (
                <div key={answer.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">{answer.question?.title}</h4>
                    <span className="text-sm font-medium text-gray-900">{answer.score || 'Not scored'}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{answer.transcript}</p>
                  {answer.score_rationale && (
                    <p className="text-sm text-gray-500 italic">{answer.score_rationale}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SubmissionDetailsPage = () => {
  const router = useRouter();
  const { submissionId, returnToCampaign } = router.query;
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submissionAnswers, setSubmissionAnswers] = useState<Answer[]>([]);
  const [detailedAnswers, setDetailedAnswers] = useState<SubmissionAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingError, setSavingError] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);

  const fetchSubmissionData = async () => {
    if (!submissionId) return;
    try {
      setIsLoading(true);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/submissions/${submissionId}`);
      setSubmission(response.data);
      if (response.data.answers) {
        setSubmissionAnswers(response.data.answers);
      }
    } catch (err) {
      setError('Failed to fetch submission data');
      console.error('Error fetching submission:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDetailedAnswers = async () => {
    if (!submissionId) return;
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/submission_answers`, {
        params: { submission_id: submissionId }
      });
      setDetailedAnswers(response.data);
    } catch (error) {
      console.error('Error fetching detailed answers:', error);
    }
  };

  useEffect(() => {
    if (submissionId) {
      const fetchData = async () => {
        await Promise.all([
          fetchSubmissionData(),
          fetchDetailedAnswers()
        ]);
      };
      fetchData();
    }
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
    if (!submissionId) {
      setError('No submission ID provided');
      return;
    }
    
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_BASE_URL}/api/submissions/${submissionId}`);
      
      AuthLogger.info(`Deleted submission ${submissionId}`);
      
      router.push(`/campaigns/${returnToCampaign}/submissions`);
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
          {/* Action buttons */}
          <div className="flex justify-between mb-6">
            <div className="flex space-x-3">
              <Link 
                href={returnToCampaign 
                  ? `/campaigns/${returnToCampaign}` 
                  : `/campaigns/${submission.campaign_id}`}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-700"
              >
                Back to Campaign Submissions
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
          
          {/* Breadcrumbs */}
          <div className="text-sm text-gray-500 mb-6">
            <Link 
              href={returnToCampaign 
                ? `/campaigns/${returnToCampaign}/submissions` 
                : `/campaigns/${submission.campaign_id}/submissions`} 
              className="hover:text-blue-500"
            >
              {submission.campaign?.title || 'Campaign'} Submissions
            </Link>
            {' / '}
            <span className="text-gray-700">Submission at {formatDate(submission.created_at)}</span>
          </div>
          
          {/* Submission details */}
          {submission.user && (
            <div className="mb-6">
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
          
          {/* Resume Analysis Section */}
          {submission.resume_analysis && (
            <div className="mb-6">
              <div className="mt-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold mb-2">Overall Fit</h3>
                  <div className="relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute left-0 mt-2 w-64 bg-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <p className="text-xs text-gray-600">A comprehensive assessment of how well your skills, experience, and responses align with the position requirements.</p>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700 mb-4">{submission.resume_analysis.overall_fit}</p>
                
                <p className="text-gray-600 mt-2 text-sm">{submission.resume_analysis.percent_match_reason}</p>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${submission.resume_analysis.percent_match}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-lg font-semibold">{submission.resume_analysis.percent_match}% Match</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold mb-2">Strengths</h3>
                      <div className="relative group">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute left-0 mt-2 w-64 bg-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                          <p className="text-xs text-gray-600">Detailed scoring of your responses to each interview question, evaluating technical knowledge, problem-solving, and communication skills.</p>
                        </div>
                      </div>
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {submission.resume_analysis.strengths.map((strength, index) => (
                        <li key={index} className="text-green-600">{strength}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold mb-2">Weaknesses</h3>
                      <div className="relative group">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute left-0 mt-2 w-64 bg-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                          <p className="text-xs text-gray-600">Detailed scoring of your responses to each interview question, evaluating technical knowledge, problem-solving, and communication skills.</p>
                        </div>
                      </div>
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {submission.resume_analysis.weaknesses.map((weakness, index) => (
                        <li key={index} className="text-red-600">{weakness}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Detailed Answers Section */}
          <div className="mt-8">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">Detailed Answer Analysis</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Comprehensive view of all answers with transcripts and scoring details
                </p>
              </div>
              
              <div className="border-t border-gray-200">
                {detailedAnswers.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {detailedAnswers.map((answer, index) => (
                      <div key={answer.id} className="p-6">
                        <div className="mb-4">
                          <h3 className="text-lg font-medium text-gray-900">
                            Question {index + 1}: {answer.question_title}
                          </h3>
                          <p className="mt-2 text-sm text-gray-600">{answer.body}</p>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-4 mt-4">
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700">Transcript:</h4>
                            <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                              {answer.transcript || 'No transcript available'}
                            </p>
                          </div>
                          
                          {answer.video_path && (
                            <div className="mb-4">
                              <h4 className="text-sm font-medium text-gray-700">Video Response:</h4>
                              <div className="mt-2">
                                <video 
                                  src={answer.video_path} 
                                  controls 
                                  className="max-w-full h-auto rounded"
                                >
                                  Your browser does not support the video tag.
                                </video>
                              </div>
                            </div>
                          )}
                          
                          <div className="border-t border-gray-200 pt-4 mt-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700">Score:</h4>
                                <p className="mt-1 text-lg font-semibold text-gray-900">
                                  {answer.score !== null ? (
                                    <span>
                                      {answer.score} / {answer.max_points}
                                      <span className="ml-2 text-sm font-normal text-gray-500">
                                        ({((answer.score / answer.max_points) * 100).toFixed(1)}%)
                                      </span>
                                    </span>
                                  ) : (
                                    'Not scored'
                                  )}
                                </p>
                              </div>
                              {answer.score_rationale && (
                                <div className="ml-6 flex-1">
                                  <h4 className="text-sm font-medium text-gray-700">Scoring Rationale:</h4>
                                  <p className="mt-1 text-sm text-gray-600">{answer.score_rationale}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-5 sm:px-6 text-center text-gray-500">
                    No detailed answers available for this submission.
                  </div>
                )}
              </div>
            </div>
          </div>
          
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
