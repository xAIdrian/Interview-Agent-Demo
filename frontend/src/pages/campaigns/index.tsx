import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { PageTemplate } from '../../components/PageTemplate';
import { useAuth } from '../../app/components/AuthProvider';
import { 
  DocumentPlusIcon, 
  DocumentTextIcon, 
  EyeIcon, 
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
// Import Tabulator config
import configureTabulatorDependencies from '../../utils/tabulator-config';
// Import Tabulator styles
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
// Import custom tabulator styles
import '../../styles/tabulator.css';
import { AuthLogger } from '../../utils/logging';
import { Toast } from '../../components/ui/Toast';

// Initialize Tabulator with required dependencies
configureTabulatorDependencies();

// Need to conditionally import for SSR compatibility
import dynamic from 'next/dynamic';
import { ColumnDefinition } from 'react-tabulator';

const ReactTabulator = dynamic(() => import('react-tabulator').then(mod => mod.ReactTabulator), {
  ssr: false,
});

// Update Campaign interface
interface Campaign {
  id: string;
  title: string;
  max_user_submissions: number;
  max_points: number;
  is_public: boolean;
  job_description: string;
}

interface CampaignAssignment {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  name: string;
  email: string;
}

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

const CampaignsPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignAssignments, setCampaignAssignments] = useState<Record<string, CampaignAssignment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // Calculate stats from campaign data and assignments
  const calculateStats = () => {
    const ongoingCampaigns = campaigns.length;
    
    // Calculate total profiles interviewed (total assignments across all campaigns)
    const profilesInterviewed = Object.values(campaignAssignments).reduce(
      (total, assignments) => total + assignments.length,
      0
    );

    // Calculate qualified profiles (campaigns that have reached max submissions)
    const qualifiedProfiles = campaigns.reduce((total, campaign) => {
      const assignments = campaignAssignments[campaign.id] || [];
      return total + (assignments.length >= campaign.max_user_submissions ? 1 : 0);
    }, 0);

    // Calculate remaining credits (assuming each campaign costs 10 credits)
    const creditsUsed = campaigns.length * 10;
    const credits = Math.max(0, 120 - creditsUsed); // Starting with 120 credits

    return {
      ongoingCampaigns,
      profilesInterviewed,
      qualifiedProfiles,
      credits
    };
  };

  // Get stats
  const stats = calculateStats();

  // Use client-side only rendering to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !isAuthenticated || !user?.id) {
      setIsLoading(false);
      return;
    }

    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        const response = await axios.get(`${API_BASE_URL}/api/campaigns`, {
          params: {
            user_id: user.id
          },
          withCredentials: true // Add this to include cookies
        });
        
        // Ensure all campaign IDs are strings
        const campaignsWithStringIds = response.data.map((campaign: any) => ({
          ...campaign,
          id: String(campaign.id)
        }));
        
        // Fetch assignments for each campaign
        const assignments: Record<string, CampaignAssignment[]> = {};
        for (const campaign of campaignsWithStringIds) {
          try {
            const assignmentsResponse = await axios.get(
              `${API_BASE_URL}/api/campaigns/${campaign.id}/assignments`,
              { withCredentials: true } // Add this to include cookies
            );
            assignments[campaign.id] = assignmentsResponse.data;
          } catch (err) {
            console.error(`Error fetching assignments for campaign ${campaign.id}:`, err);
            assignments[campaign.id] = [];
          }
        }
        setCampaignAssignments(assignments);

        // Only filter campaigns for non-admin users
        const filteredCampaigns = isAdmin 
          ? campaignsWithStringIds  // Admins see all campaigns
          : campaignsWithStringIds.filter((campaign: Campaign) => {
              const campaignAssignments = assignments[campaign.id] || [];
              return campaignAssignments.some(assignment => assignment.email === user?.email);
            });
        
        setCampaigns(filteredCampaigns);
        AuthLogger.info(`Loaded ${filteredCampaigns.length} campaigns successfully`);
        
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'Failed to load campaigns. Please try again.');
          AuthLogger.error('Error fetching campaigns:', err.response?.status, err.response?.data);
        } else {
          setError('Failed to load campaigns. Please try again.');
          AuthLogger.error('Unexpected error fetching campaigns:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [isClient, isAuthenticated, user?.id, isAdmin]);

  const handleActionClick = (id: string) => {
    router.push(`/campaigns/${id}`);

  };

  const columns: ColumnDefinition[] = [
    { title: "Title", field: "title", widthGrow: 3 },
    { 
      title: "Description", 
      field: "job_description", 
      widthGrow: 4,
      formatter: (cell: any) => {
        const text = cell.getValue() || '';
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
      }
    },
    { 
      title: "Actions", 
      field: "id", 
      hozAlign: "center" as "center",
      widthGrow: 1,
      formatter: function(cell: any) {
        const id = String(cell.getValue());
        
        if (isAdmin) {
          return `<div class="flex items-center justify-center">
            <button class="text-blue-500 hover:text-blue-700 flex items-center">
              <EyeIcon class="h-5 w-5 mr-1" />
              View
            </button>
          </div>`;
        } else {
          return `<div class="flex items-center justify-center">
            <button class="text-green-500 hover:text-green-700 flex items-center">
              <UserPlusIcon class="h-5 w-5 mr-1" />
              Apply
            </button>
          </div>`;
        }
      },
      cellClick: function(e: any, cell: any) {
        const id = String(cell.getValue());
        handleActionClick(id);
      }
    }
  ];

  const options = {
    layout: "fitColumns",
    responsiveLayout: "collapse",
    pagination: "local",
    paginationSize: 10,
    paginationSizeSelector: [5, 10, 20, 50],
    movableColumns: true,
    resizableRows: true,
    height: "auto",
    renderVerticalBuffer: 0,
    layoutColumnsOnNewData: true,
  };

  if (!isClient) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      <PageTemplate>
        {/* Header Section */}
        <div className="w-full bg-black p-6">
          <div className="flex flex-col items-center justify-center flex-1">
            <p className="text-white">Welcome {user?.name || 'User'}</p>
            <h2 className="text-2xl font-bold text-white mb-1 pb-10">Glad to see you again</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 -mt-8 mx-16">
          <div className="bg-gray-50 rounded-lg flex shadow-md">
            <div className="flex items-center px-2">
              <span className="text-xl font-bold text-gray-400 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                <DocumentTextIcon className="h-5 w-5" />
              </span>
              <div className="p-4 flex flex-col">
                <span className="text-xs text-gray-500 mt-1">ON GOING CAMPAIGNS</span>
                <span className="text-lg font-bold">{stats.ongoingCampaigns}</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg flex shadow-md">
            <div className="flex items-center px-2">
              <span className="text-xl font-bold text-gray-400 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                <UserPlusIcon className="h-5 w-5" />
              </span>
              <div className="p-4 flex flex-col">
                <span className="text-xs text-gray-500 mt-1">PROFILES INTERVIEWED</span>
                <span className="text-lg font-bold">{stats.profilesInterviewed}</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg flex shadow-md">
            <div className="flex items-center px-2">
              <span className="text-xl font-bold text-gray-400 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                <CheckCircleIcon className="h-5 w-5" />
              </span>
              <div className="p-4 flex flex-col">
                <span className="text-xs text-gray-500 mt-1">QUALIFIED PROFILES</span>
                <span className="text-lg font-bold">{stats.qualifiedProfiles}</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg flex shadow-md">
            <div className="flex items-center px-2">
              <span className="text-xl font-bold text-gray-400 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                <DocumentPlusIcon className="h-5 w-5" />
              </span>
              <div className="p-4 flex flex-col">
                <span className="text-xs text-gray-500 mt-1">CREDITS</span>
                <span className="text-lg font-bold">{stats.credits}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Campaigns Section */}
        <div className="mb-6 m-16">
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] p-10">
              {/* Illustration placeholder */}
              <div className="text-6xl mb-6">📂✨</div>
              <div className="text-xl font-semibold mb-2">Start your first campaign</div>
              <div className="text-gray-500 mb-6 text-center max-w-md">
                Click "create a campaign" button to get started and list your job offer in our market.
              </div>
              <button
                className="bg-blue-500 text-white px-6 py-3 rounded-lg text-lg font-semibold flex items-center gap-2 hover:bg-blue-600 transition"
                onClick={() => router.push('/campaigns/create')}
              >
                <span className="text-2xl">+</span> Create a Campaign
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-xl font-bold mb-4">Campaigns</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Add new campaign card */}
                {isAdmin && (
                  <div
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => router.push('/campaigns/create')}
                  >
                    <span className="text-4xl text-gray-400 mb-2">+</span>
                    <span className="font-semibold text-gray-600">Add a new campaign</span>
                  </div>
                )}
                {/* Campaign cards */}
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="bg-white rounded-lg shadow p-6 flex flex-col">
                    {/* Placeholder for logo */}
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                        {/* Use first letter of title as logo placeholder */}
                        <span className="text-xl font-bold text-gray-400">{campaign.title[0]}</span>
                      </div>
                      <div>
                        <div className="font-bold text-lg">{campaign.title}</div>
                        <div className="text-xs text-gray-400">Société générale</div> {/* Placeholder company */}
                      </div>
                    </div>
                    <div className="flex-1 text-gray-600 mb-4">
                      {campaign.job_description.length > 120
                        ? campaign.job_description.substring(0, 120) + '...'
                        : campaign.job_description}
                    </div>
                    <button
                      className="mt-auto bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                      onClick={() => router.push(`/campaigns/${campaign.id}`)}
                    >
                      Campaign details
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </PageTemplate>
      {showToast && (
        <Toast 
          message="Coming Soon!" 
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
};

export default CampaignsPage;
