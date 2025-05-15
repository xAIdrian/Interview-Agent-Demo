import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../../components/PageTemplate';
import { PrimaryButton } from '../../../components/Button/PrimaryButton';
import { AuthLogger } from '../../../utils/logging';
import { Tab } from '@headlessui/react';

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
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysis | null>(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [candidateUser, setCandidateUser] = useState<User | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const fetchSubmissionData = async () => {
    if (!submissionId) return;
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/submissions/${submissionId}`);
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

  const fetchResumeAnalysis = async () => {
    if (!submissionId) return;
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/resume_analysis/${submissionId}`);
      setResumeAnalysis(response.data);
    } catch (error) {
      console.error('Error fetching resume analysis:', error);
    }
  };

  // Fetch candidate user info from query param as soon as possible
  useEffect(() => {
    const userId = router.query.userId as string;
    if (userId) {
      axios.get(`${API_BASE_URL}/api/users/${userId}`)
        .then(res => setCandidateUser(res.data))
        .catch(() => setCandidateUser(null));
    }
  }, [router.query.userId]);

  // Fetch campaignId from query param as soon as possible
  useEffect(() => {
    const campaignIdParam = router.query.campaignId as string;
    if (campaignIdParam) {
      setCampaignId(campaignIdParam);
    }
  }, [router.query.campaignId]);

  useEffect(() => {
    if (submissionId) {
      const fetchData = async () => {
        await Promise.all([
          fetchSubmissionData(),
          fetchDetailedAnswers(),
          fetchResumeAnalysis()
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

  // Breadcrumbs header for submission details
  const renderBreadcrumbs = () => (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-2">
      <nav className="flex items-center text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
        <button
          onClick={() => router.push(`/campaigns/${campaignId}`)}
          className="mr-3 p-1 rounded hover:bg-gray-200 focus:outline-none flex items-center"
          aria-label="Back to campaign"
          type="button"
        >
          <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span
          className="hover:text-blue-600 font-medium cursor-pointer"
          onClick={() => router.push('/campaigns')}
        >
          Home
        </span>
        <span className="mx-2">/</span>
        <span
          className="hover:text-blue-600 font-medium cursor-pointer"
          onClick={() => router.push(`/campaigns/${campaignId}`)}
        >
          Campaign
        </span>
        <span className="mx-2">/</span>
        <span
          className="hover:text-blue-600 font-medium cursor-pointer"
          onClick={() => router.push(`/campaigns/${campaignId}`)}
        >
          Submissions
        </span>
        <span className="mx-2">/</span>
        <span className="text-gray-700 font-semibold">{candidateUser?.name || 'Candidate'}</span>
      </nav>
    </div>
  );

  return (
    <PageTemplate maxWidth="full">
      {renderBreadcrumbs()}
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          {error}
        </div>
      ) : submission ? (
        <div className="flex flex-col gap-8 px-12">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{candidateUser?.name}</h1>
            <button
              onClick={deleteSubmission}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700 font-semibold"
            >
              Delete submission
            </button>
          </div>
          <div className="flex flex-col md:flex-row gap-8">
            {/* Left Column: Candidate Info */}
            <div className="w-full md:w-1/3 bg-white rounded-2xl shadow p-0 mb-6 md:mb-0 flex flex-col">
              {/* Header with avatar, name, job title, badge (horizontal row) */}
              <div className="flex items-center justify-between bg-blue-50 rounded-t-2xl px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white">
                    {candidateUser?.name ? candidateUser.name.split(' ').map(n => n[0]?.toUpperCase() || '').join('').slice(0,2) : 'ZZ'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-gray-900 leading-tight">{candidateUser?.name || 'Zakia ZAGHRARI'}</span>
                    <span className="text-sm text-blue-500 leading-tight">Business developer</span>
                  </div>
                </div>
                <span className="bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full flex items-center whitespace-nowrap">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Qualified profile
                </span>
              </div>
              {/* Info fields */}
              <div className="flex flex-col divide-y divide-gray-100">
                <div className="flex items-center gap-3 px-6 py-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4-4-1.79-4-4z" /></svg>
                  <div>
                    <div className="text-xs text-gray-400">Poste</div>
                    <div className="text-sm font-medium text-gray-900">Business Developer</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-9 4v8" /></svg>
                  <div>
                    <div className="text-xs text-gray-400">Téléphone</div>
                    <div className="text-sm font-medium text-gray-900">+2126 08 6466 31</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 12H8m8 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  <div>
                    <div className="text-xs text-gray-400">Adresse mail</div>
                    <div className="text-sm font-medium text-gray-900">z.zaghrari@gmail.com</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 12.414a4 4 0 10-5.657 5.657l4.243 4.243a8 8 0 1011.314-11.314l-4.243 4.243z" /></svg>
                  <div>
                    <div className="text-xs text-gray-400">Localisation</div>
                    <div className="text-sm font-medium text-gray-900">Casablanca, Morocco</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7" /></svg>
                  <div>
                    <div className="text-xs text-gray-400">Niveau d'étude</div>
                    <div className="text-sm font-medium text-gray-900">Bac + 5</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 17l4-4 4 4m0 0V3m0 14H4" /></svg>
                  <div>
                    <div className="text-xs text-gray-400">Experiences</div>
                    <div className="text-sm font-medium text-gray-900">3 ans</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 8v2m0-10V4" /></svg>
                  <div>
                    <div className="text-xs text-gray-400">Salaire actuelle</div>
                    <div className="text-sm font-medium text-gray-900">20 000 Dhs Net</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Right Column: Main Content */}
            <div className="w-full md:w-2/3">
              {/* Tabs and Main Content */}
              <Tab.Group selectedIndex={activeTab === 'analysis' ? 0 : 1} onChange={i => setActiveTab(i === 0 ? 'analysis' : 'answers')}>
                <Tab.List className="flex space-x-8 border-b mb-6">
                  <Tab className={({ selected }) => selected ? 'text-blue-700 border-b-2 border-blue-700 pb-2 font-semibold' : 'text-gray-500 pb-2'}>Resume Analysis</Tab>
                  <Tab className={({ selected }) => selected ? 'text-blue-700 border-b-2 border-blue-700 pb-2 font-semibold' : 'text-gray-500 pb-2'}>Questions & Answers</Tab>
                </Tab.List>
                <Tab.Panels>
                  {/* Resume Analysis Tab */}
                  <Tab.Panel>
                    {resumeAnalysis && (
                      <div>
                        <div className="mb-6 bg-white rounded-lg shadow p-6">
                          <div className="flex items-center mb-2">
                            <h2 className="text-xl font-bold text-gray-900 mr-4">Overall Fit</h2>
                          </div>
                            <span className="text-base font-semibold text-blue-700">Overall Score: {resumeAnalysis.percent_match}% Match</span>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${resumeAnalysis.percent_match}%` }} />
                          </div>
                          <p className="text-gray-700 mb-2">{resumeAnalysis.overall_fit}</p>
                        </div>
                        <div className="flex flex-col gap-6">
                          {/* Strengths Card */}
                          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                            <h3 className="text-green-700 font-bold mb-2">STRENGTHS</h3>
                            <ul className="list-disc pl-5 space-y-1">
                              {resumeAnalysis.strengths.map((s, i) => (
                                <li key={i} className="text-green-900">{s}</li>
                              ))}
                            </ul>
                          </div>
                          {/* Weaknesses Card */}
                          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                            <h3 className="text-red-700 font-bold mb-2">WEAKNESSES</h3>
                            <ul className="list-disc pl-5 space-y-1">
                              {resumeAnalysis.weaknesses.map((w, i) => (
                                <li key={i} className="text-red-900">{w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </Tab.Panel>
                  {/* Questions & Answers Tab */}
                  <Tab.Panel>
                    <div className="bg-white rounded-lg shadow p-6">
                      <div className="space-y-4">
                        {detailedAnswers.length > 0 ? detailedAnswers.map((answer, index) => (
                          <div key={answer.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-900">{answer.question_title}</h4>
                              <span className="text-sm font-medium text-gray-900">{answer.score !== null ? answer.score : 'Not scored'}</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{answer.transcript}</p>
                            {answer.score_rationale && (
                              <p className="text-sm text-gray-500 italic">{answer.score_rationale}</p>
                            )}
                          </div>
                        )) : (
                          <div className="text-gray-500 text-center">No answers available.</div>
                        )}
                      </div>
                    </div>
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
          </div>
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
