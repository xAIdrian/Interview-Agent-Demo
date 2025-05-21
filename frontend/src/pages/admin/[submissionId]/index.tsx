import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';
import { AuthLogger } from '../../../utils/logging';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kwiks.io';

interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  is_complete: boolean;
  total_points: number;
  email: string;
  campaign_name: string;
}

interface SubmissionAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  video_path: string;
  transcript: string;
  score: number | null;
  score_rationale: string;
  question_title?: string;
}

interface Question {
  id: string;
  campaign_id: string;
  title: string;
  body: string;
  scoring_prompt: string;
  max_points: number;
}

const SubmissionPage = () => {
  const router = useRouter();
  const { submissionId } = router.query;
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submissionAnswers, setSubmissionAnswers] = useState<SubmissionAnswer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Setup auth on component mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const isAdminUser = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(isAdminUser);
    
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Fetch submission and related data
  useEffect(() => {
    const fetchSubmissionData = async () => {
      if (!submissionId) return;

      try {
        setIsLoading(true);
        setError('');
        
        // Use the new direct endpoint to fetch a submission by ID
        const submissionResponse = await axios.get(`/api/submissions/${submissionId}`);
        
        // Check if we got a valid submission
        if (submissionResponse.data) {
          const submissionData = submissionResponse.data;
          setSubmission(submissionData);
          setCampaignId(submissionData.campaign_id);
          
          try {
            // Fetch submission answers using the correct API endpoint format
            // Use the explicit submission_id parameter to avoid ambiguity
            const answersResponse = await axios.get(`/api/submission_answers?submission_id=${submissionId}`);
            
            // Get question details from the answers
            const questionsData = answersResponse.data.map((answer: any) => ({
              id: answer.question_id,
              title: answer.question_title,
              body: answer.body || answer.question_title,
              scoring_prompt: answer.scoring_prompt || '',
              max_points: answer.max_points
            }));
            
            setQuestions(questionsData);
            
            // Merge question titles with submission answers
            const answersWithQuestionTitles = answersResponse.data.map((answer: SubmissionAnswer) => {
              const matchingQuestion = questionsData.find(
                (q: Question) => q.id === answer.question_id
              );
              return {
                ...answer,
                question_title: matchingQuestion ? matchingQuestion.title : 'Unknown Question'
              };
            });
            
            setSubmissionAnswers(answersWithQuestionTitles);
          } catch (innerErr) {
            console.error('Error fetching answers or questions:', innerErr);
            if (axios.isAxiosError(innerErr) && innerErr.response?.status === 500) {
              setError('Database error when loading submission answers. Please contact support.');
            } else {
              setError('Failed to load submission answers or questions.');
            }
          }
        } else {
          setError('Submission not found');
        }
      } catch (err) {
        console.error('Error fetching submission data:', err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            router.push('/login');
          } else if (err.response?.status === 403) {
            setError('Admin access required to view submission details');
          } else if (err.response?.status === 404) {
            setError('Submission not found');
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
          } else {
            setError('Failed to load submission data');
          }
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissionData();
  }, [submissionId, router]);

  // Function to get video filename from path
  const getVideoFilename = (path: string) => {
    if (!path) return '';
    return path.split('/').pop() || '';
  };

  return (
    <PageTemplate title={`Submission ${submission?.id || ''}`}>
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-end mb-4 items-center">
          {submission && isAdmin && (
            <Link 
              href={`/submission/${submissionId}/edit`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Edit Submission
            </Link>
          )}
        </div>
        
        {error && (
          <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {!isAdmin && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-700 rounded">
            Note: Some features require admin privileges.
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
          </div>
        ) : submission ? (
          <>
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">Submission Information</h2>
                {campaignId && (
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    <Link href={`/campaigns/${campaignId}`} className="text-blue-600 hover:underline">
                      View Campaign Details
                    </Link>
                    {isAdmin && (
                      <> | <Link href={`/campaigns/${campaignId}/submissions`} className="text-blue-600 hover:underline">
                        View All Submissions
                      </Link>
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Campaign</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{submission.campaign_name}</dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Candidate</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{submission.email}</dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {new Date(submission.created_at).toLocaleString()}
                    </dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <span className={`px-2 py-1 rounded ${submission.is_complete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {submission.is_complete ? 'Completed' : 'In Progress'}
                      </span>
                    </dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Total Score</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {submission.total_points !== null ? submission.total_points : 'Not scored'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <h2 className="text-xl font-bold mb-4">Answers</h2>
            
            {submissionAnswers.length > 0 ? (
              submissionAnswers.map((answer) => (
                <div key={answer.id} className="bg-white shadow overflow-hidden sm:rounded-lg mb-4">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">{answer.question_title}</h3>
                    {/* If we have question details, show the max points */}
                    {questions.find(q => q.id === answer.question_id) && (
                      <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        Max Points: {questions.find(q => q.id === answer.question_id)?.max_points}
                      </p>
                    )}
                  </div>
                  <div className="border-t border-gray-200">
                    <dl>
                      {/* Show question text if available */}
                      {isAdmin && questions.find(q => q.id === answer.question_id)?.body && (
                        <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">Question Text</dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">
                            {questions.find(q => q.id === answer.question_id)?.body}
                          </dd>
                        </div>
                      )}
                      
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Video</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {answer.video_path ? (
                            <a 
                              href={`${API_BASE_URL}/watch_video/${getVideoFilename(answer.video_path)}`} 
                              className="text-blue-600 hover:text-blue-900" 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              Watch Video
                            </a>
                          ) : (
                            'No video uploaded'
                          )}
                        </dd>
                      </div>
                      <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Transcript</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">
                          {answer.transcript || 'No transcript available'}
                        </dd>
                      </div>
                      <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                        <dt className="text-sm font-medium text-gray-500">Score</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {answer.score !== null ? answer.score : 'Not scored'}
                        </dd>
                      </div>
                      {answer.score_rationale && (
                        <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500">Score Rationale</dt>
                          <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">
                            {answer.score_rationale}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 bg-gray-50 rounded">
                <p className="text-gray-500">No answers found for this submission.</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Submission not found. Please check the URL or go back to the dashboard.
          </div>
        )}
        
        <div className="mt-6 space-x-2">
          {campaignId && (
            <Link
              href={`/campaigns/${campaignId}`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 inline-block"
            >
              Back to Campaign
            </Link>
          )}
          <button 
            onClick={() => router.push('/')}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            Home
          </button>
        </div>
      </div>
    </PageTemplate>
  );
};

export default SubmissionPage;
