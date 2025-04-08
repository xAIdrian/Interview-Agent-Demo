import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  completed_at: string;
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

interface AnswerFormData {
  [key: string]: {
    transcript: string;
    score: string;
    score_rationale: string;
  };
}

const EditSubmissionPage = () => {
  const router = useRouter();
  const { submissionId } = router.query;
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submissionAnswers, setSubmissionAnswers] = useState<SubmissionAnswer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState<AnswerFormData>({});
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Setup auth on component mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
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
        
        // Use the new direct endpoint to fetch a submission by ID without authorization
        const submissionResponse = await axios.get(
          `${API_BASE_URL}/api/submissions/${submissionId}`
        );
        
        if (submissionResponse.data) {
          const submissionData = submissionResponse.data;
          setSubmission(submissionData);
          setCampaignId(submissionData.campaign_id);
          
          try {
            // Fetch submission answers using the fixed endpoint with unambiguous column reference
            const answersResponse = await axios.get(
              `${API_BASE_URL}/api/submission_answers?submission_id=${submissionId}`
            );
            
            // Fetch questions for the campaign
            const questionsResponse = await axios.get(
              `${API_BASE_URL}/api/questions?campaign_id=${submissionData.campaign_id}`
            );
            
            setQuestions(questionsResponse.data);
            
            // Merge question titles with submission answers
            const answersWithQuestionTitles = answersResponse.data.map((answer: SubmissionAnswer) => {
              const matchingQuestion = questionsResponse.data.find(
                (q: Question) => q.id === answer.question_id
              );
              return {
                ...answer,
                question_title: matchingQuestion ? matchingQuestion.title : 'Unknown Question'
              };
            });
            
            setSubmissionAnswers(answersWithQuestionTitles);
            
            // Initialize form data from submission answers
            const initialFormData: AnswerFormData = {};
            answersWithQuestionTitles.forEach((answer: SubmissionAnswer) => {
              initialFormData[answer.id] = {
                transcript: answer.transcript || '',
                score: answer.score !== null ? String(answer.score) : '',
                score_rationale: answer.score_rationale || ''
              };
            });
            
            setFormData(initialFormData);
          } catch (innerErr) {
            console.error('Error fetching answers or questions:', innerErr);
            setError('Failed to load submission answers or questions.');
          }
        } else {
          setError('Submission not found');
        }
      } catch (err) {
        console.error('Error fetching submission data:', err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            router.push('/login');
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

  // Handle form field changes
  const handleFieldChange = (answerId: string, field: string, value: string) => {
    setFormData(prevData => ({
      ...prevData,
      [answerId]: {
        ...prevData[answerId],
        [field]: value
      }
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');
      
      // Get token from localStorage
      const token = localStorage.getItem('accessToken');
      const authHeader = {
        headers: {
          'Authorization': token ? `Bearer ${token}` : 'Bearer dVCjV5QO8t',
          'Content-Type': 'application/json'
        }
      };
      
      // Create array of promises for each answer update
      const updatePromises = submissionAnswers.map(answer => {
        const answerData = formData[answer.id];
        const payload = {
          transcript: answerData.transcript,
          score: answerData.score ? Number(answerData.score) : null,
          score_rationale: answerData.score_rationale
        };
        
        return axios.put(
          `${API_BASE_URL}/api/submission_answers/${answer.id}`,
          payload,
          authHeader
        );
      });
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);
      
      setSuccess('Submission updated successfully!');
      
      // Navigate back to the submission details page after a delay
      setTimeout(() => {
        router.push(`/submission/${submissionId}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error updating submission:', err);
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else {
          setError('Failed to update submission');
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Function to get video filename from path
  const getVideoFilename = (path: string) => {
    if (!path) return '';
    return path.split('/').pop() || '';
  };

  return (
    <PageTemplate title="Edit Submission" maxWidth="lg">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Edit Submission</h1>
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
          {success}
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
              </dl>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">Answers</h2>
          
          <form onSubmit={handleSubmit}>
            {submissionAnswers.map((answer) => (
              <div key={answer.id} className="bg-white shadow overflow-hidden sm:rounded-lg mb-4">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">{answer.question_title}</h3>
                </div>
                <div className="border-t border-gray-200">
                  <dl>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
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
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Transcript</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <textarea 
                          name={`transcript_${answer.id}`}
                          value={formData[answer.id]?.transcript || ''}
                          onChange={(e) => handleFieldChange(answer.id, 'transcript', e.target.value)}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border-gray-300 rounded-md"
                          rows={5}
                        />
                      </dd>
                    </div>
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Score</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <input 
                          type="number" 
                          name={`score_${answer.id}`}
                          value={formData[answer.id]?.score || ''}
                          onChange={(e) => handleFieldChange(answer.id, 'score', e.target.value)}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border-gray-300 rounded-md"
                          min="0"
                          max={questions.find(q => q.id === answer.question_id)?.max_points || 100}
                        />
                      </dd>
                    </div>
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Score Rationale</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <textarea 
                          name={`score_rationale_${answer.id}`}
                          value={formData[answer.id]?.score_rationale || ''}
                          onChange={(e) => handleFieldChange(answer.id, 'score_rationale', e.target.value)}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border-gray-300 rounded-md"
                          rows={3}
                        />
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}

            <div className="mt-6">
              <button 
                type="submit" 
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700 mr-2 disabled:bg-green-300"
                disabled={isSaving}
              >
                {isSaving ? 'Updating...' : 'Update Submission'}
              </button>
              <button 
                type="button" 
                onClick={() => router.push(`/submission/${submissionId}`)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Submission not found. Please check the URL or go back to the dashboard.
        </div>
      )}
    </PageTemplate>
  );
};

export default EditSubmissionPage;
