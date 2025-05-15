import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';
import { AuthLogger } from '../../../utils/logging';
import { useAuth } from '@/app/components/AuthProvider';
import { Modal } from '../../../components/ui/Modal';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { PrimaryButton } from '../../../components/Button/PrimaryButton';
import CampaignSubmissionsPage from './submissions';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

interface Campaign {
  id: string;
  title: string;
  max_user_submissions: number;
  max_points: number;
  is_public: boolean;
  campaign_context: string;
  job_description: string;
  access_code?: string;
}

interface Question {
  id: string;
  title: string;
  body: string;
  scoring_prompt: string;
  max_points: number;
  order_index?: number;
}

interface SubmissionStatus {
  total_submissions: number;
  completed_submissions: number;
  max_submissions: number;
  can_submit: boolean;
  has_completed_submission: boolean;
}

const CampaignDetailsPage = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissionCount, setSubmissionCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { user } = useAuth();
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    total_submissions: 0,
    completed_submissions: 0,
    max_submissions: 0,
    can_submit: true,
    has_completed_submission: false,
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'submissions'>('info');
  const [campaignLink, setCampaignLink] = useState('');

  // Handle copying campaign link
  const handleCopyLink = () => {
    const campaignLink = `${window.location.origin}/start/${campaignId}`;
    navigator.clipboard.writeText(campaignLink).then(() => {
      const button = document.getElementById('copy-link-button');
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    });
  };

  // Setup auth on component mount
  useEffect(() => {
    const isAdminUser = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(isAdminUser);
  }, []);

  // Fetch campaign data and submission status
  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId) return;

      try {
        setIsLoading(true);
        setError('');
        
        // Fetch campaign details and access code in parallel
        const [campaignResponse, accessCodeResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/campaigns/${campaignId}`),
          axios.get(`${API_BASE_URL}/api/campaigns/${campaignId}/access-code`)
        ]);

        console.log('Access Code Response:', accessCodeResponse.data);
        const accessCode = accessCodeResponse.data.data.access_code;
        console.log('Extracted Access Code:', accessCode);

        // Add access code to campaign data
        const campaignData = {
          ...campaignResponse.data,
          access_code: accessCode
        };
        console.log('Campaign Data with Access Code:', campaignData);
        
        setCampaign(campaignData);
        
        // Fetch submission answers for this campaign with proper error handling
        try {
          const answersResponse = await axios.get(`${API_BASE_URL}/api/submission_answers`, {
            params: { campaign_id: campaignId }
          });
          
          if (answersResponse.data && Array.isArray(answersResponse.data)) {
            // Sort answers by their order if available
            const sortedAnswers = answersResponse.data.sort((a, b) => 
              (a.order_index || 0) - (b.order_index || 0)
            );
            
            // Transform the answers to match the questions format
            const transformedQuestions = sortedAnswers.map(answer => ({
              id: answer.question_id,
              title: answer.question_title,
              max_points: answer.max_points,
              scoring_prompt: answer.scoring_prompt || '',
              body: answer.body || answer.question_title
            }));
            
            setQuestions(transformedQuestions);
          } else {
            console.error('Invalid answers data format:', answersResponse.data);
            setQuestions([]);
          }
        } catch (answersError) {
          console.error('Error fetching answers:', answersError);
          setQuestions([]);
        }

        // If admin, fetch submission count
        if (isAdmin) {
          const submissionsResponse = await axios.get(`${API_BASE_URL}/api/submissions?campaign_id=${campaignId}`);
          setSubmissionCount(submissionsResponse.data.length);
        }

        // Fetch submission status for non-admin users
        if (!isAdmin && user?.id) {
          const submissionsResponse = await axios.get(`${API_BASE_URL}/api/submissions`, {
            params: {
              campaign_id: campaignId,
              user_id: user.id
            }
          });

          const submissions = submissionsResponse.data;
          const completedSubmissions = submissions.filter((sub: any) => sub.is_complete).length;
          
          setSubmissionStatus({
            total_submissions: submissions.length,
            completed_submissions: completedSubmissions,
            max_submissions: campaignResponse.data.max_user_submissions,
            can_submit: submissions.length < campaignResponse.data.max_user_submissions && 
                       completedSubmissions < campaignResponse.data.max_user_submissions,
            has_completed_submission: completedSubmissions > 0
          });
        }
        
        AuthLogger.info(`Loaded campaign #${campaignId} successfully`);
      } catch (err) {
        console.error('Error fetching data:', err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError('Campaign not found');
            AuthLogger.error('Campaign not found', err.response?.status);
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
            AuthLogger.error('API error fetching data', err.response?.status, err.response?.data);
          } else {
            setError('Failed to load data');
            AuthLogger.error('Unknown error fetching data', err.response?.status);
          }
        } else {
          setError('An unexpected error occurred');
          AuthLogger.error('Unexpected error fetching data', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [campaignId, isAdmin, user?.id]);

  useEffect(() => {
    if (typeof window !== 'undefined' && campaignId) {
      setCampaignLink(`${window.location.origin}/start/${campaignId}`);
    }
  }, [campaignId]);

  // Debug effect for campaign state
  useEffect(() => {
    if (campaign) {
      console.log('Campaign State Updated:', campaign);
    }
  }, [campaign]);

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
          <span className="text-gray-700 font-semibold">{campaign ? campaign.title : 'Campaign'}</span>
        </nav>
      </div>
      {/* Header Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">{campaign ? campaign.title : 'Campaign Title'}</h1>
      </div>
      {/* Menu as text headers */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-8">
        <span
          className={`cursor-pointer text-base font-semibold pb-1 border-b-2 ${activeTab === 'info' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-700'}`}
          onClick={() => setActiveTab('info')}
        >
          Informations générale
        </span>
        <span
          className={`cursor-pointer text-base font-semibold pb-1 border-b-2 ${activeTab === 'submissions' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-700'}`}
          onClick={() => setActiveTab('submissions')}
        >
          Submissions
        </span>
      </div>
      {/* Tab views */}
      {activeTab === 'info' ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-8">
          {/* Left column: menu as text headers and campaign details */}
          <div className="flex-shrink-0" style={{ width: '410px' }}>
            {/* Campaign details card */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="mb-4">
                <div className="text-xs text-gray-400 font-semibold mb-1">Poste</div>
                <div className="font-medium text-gray-900">{campaign?.title || 'UX/UI Designer'}</div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-gray-400 font-semibold mb-1">Localisation</div>
                <div className="text-gray-700">Casablanca, Morocco</div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-gray-400 font-semibold mb-1">Mode de travail</div>
                <div className="text-gray-700">Hybrid</div>
        </div>
              <div className="mb-4">
                <div className="text-xs text-gray-400 font-semibold mb-1">Niveau d'étude</div>
                <div className="text-gray-700">Bac + 5</div>
        </div>
              <div className="mb-4">
                <div className="text-xs text-gray-400 font-semibold mb-1">Experiences</div>
                <div className="text-gray-700">3 ans → 5 ans</div>
        </div>
              <div className="mb-4">
                <div className="text-xs text-gray-400 font-semibold mb-1">Salaire</div>
                <div className="text-gray-700">20 000 Dhs Net</div>
                </div>
              <div>
                <div className="text-xs text-gray-400 font-semibold mb-1">Contract</div>
                <div className="text-gray-700">CDI</div>
                </div>
            </div>
          </div>
          {/* Right column: unified view with shared background and text sections */}
          <div className="flex-1">
            {/* Campaign Link and Access Code */}
            <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-2 sm:mb-0">
                <div className="text-xs text-blue-700 font-semibold mb-1">Campaign Link</div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={campaignLink}
                    readOnly
                    className="w-64 px-2 py-1 border border-blue-200 rounded text-blue-900 bg-white text-sm font-mono"
                    style={{ minWidth: '400px' }}
                  />
                  <button
                    id="copy-link-button"
                    onClick={handleCopyLink}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="mt-2 sm:mt-0">
                <div className="text-xs text-blue-700 font-semibold mb-1">Access Code</div>
                <span className="inline-block px-3 py-1 bg-white border border-blue-200 rounded text-blue-900 font-mono text-base tracking-widest">
                  {campaign?.access_code || 'N/A'}
                </span>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-8">
              {/* About the job section */}
              <h2 className="text-xl font-bold mb-4">About the job</h2>
              <div className="mb-6">
                <div className="font-bold text-gray-800 mb-2">MISSION</div>
                <div className="text-gray-700 mb-2">
                  {campaign?.job_description || 'No job description provided.'}
                </div>
              </div>
              <div className="mb-6">
                <div className="font-bold text-gray-800 mb-2">ACTIVITES PRINCIPALES</div>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Organise, prépare et anime les ateliers</li>
                  <li>Interagit avec les SPOC et les chefs de projets</li>
                  <li>Mène une veille technologique régulière et adhoc,</li>
                  <li>Fabrique les prototypes</li>
                  <li>Rédige les différents livrables, restitutions</li>
                  <li>Coordonne la production de supports de communication,</li>
                  <li>Construit et entretient les synergies avec les interlocuteurs partenaires.</li>
                </ul>
                    </div>
              <div className="mb-6">
                <div className="font-bold text-gray-800 mb-2">Autres informations</div>
                <ol className="list-decimal pl-6 text-gray-700 space-y-2">
                  <li>
                    Il/Elle travaille en amélioration continue, ce qui l'amène à évoluer en mode test and learn, en intégrant en permanence de nouvelles méthodes : agile, Lean, lean startup, corporate hacking... Par ailleurs, il/elle a pour mission d'identifier et de construire les assets mutualisables liés à son activité. (toolkit, templates, nouvelle méthode de travail)
                  </li>
                  <li>
                    Il/elle peut également acculturer toute entité de la BMCI ayant besoin de formation aux méthodes qu'il/elle maîtrise.
                  </li>
                </ol>
                </div>
              {/* Add more sections as needed, using campaign/job data */}
            </div>
          </div>
            </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CampaignSubmissionsPage />
        </div>
      )}
    </PageTemplate>
  );
};

export default CampaignDetailsPage;
