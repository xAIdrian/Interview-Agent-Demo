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

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

const CampaignsPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // Use client-side only rendering to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        // Always use the /api/campaigns endpoint
        const response = await axios.get(`${API_BASE_URL}/api/campaigns`);
        
        // Ensure all campaign IDs are strings
        const campaignsWithStringIds = response.data.map((campaign: any) => ({
          ...campaign,
          id: String(campaign.id)
        }));
        
        setCampaigns(campaignsWithStringIds);
        AuthLogger.info(`Loaded ${campaignsWithStringIds.length} campaigns successfully`);
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        setError('Failed to load campaigns. Please try again.');
        
        if (axios.isAxiosError(err)) {
          AuthLogger.error('Error fetching campaigns:', err.response?.status, err.response?.data);
        } else {
          AuthLogger.error('Unexpected error fetching campaigns:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [isClient]);

  const handleActionClick = (id: string) => {
    if (isAdmin) {
      router.push(`/campaigns/${id}/edit`);
    } else {
      router.push(`/campaigns/${id}`);
    }
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
      title: "Status", 
      field: "is_public", 
      hozAlign: "center" as "center", 
      widthGrow: 1,
      formatter: (cell: any) => {
        const isPublic = cell.getValue();
        return isPublic ? 
          '<div class="flex items-center justify-center text-green-600"><CheckCircleIcon class="h-5 w-5" /></div>' : 
          '<div class="flex items-center justify-center text-red-600"><XCircleIcon class="h-5 w-5" /></div>';
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
      <Head>
        <title>{isAdmin ? 'Campaigns' : 'Available Positions'} | Gulpin AI Interview</title>
      </Head>
      <PageTemplate title={isAdmin ? 'Campaigns' : 'Available Positions'} maxWidth="lg">
        <div className="w-full bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{isAdmin ? 'Campaigns' : 'Available Positions'}</h2>
            {isAdmin && (
              <div className="flex items-center">
                <Link 
                  href="/campaigns/create"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Create Campaign
                </Link>
                <Link 
                  href="/campaigns/create-from-doc"
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700 ml-2"
                >
                  Create from Doc
                </Link>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
            </div>
          ) : (
            <div ref={tableRef}>
              <ReactTabulator
                data={campaigns}
                columns={columns}
                options={options}
              />
            </div>
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
