import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { INTERNAL_API_TOKEN } from '../../../utils/internalApiToken';
import "tabulator-tables/dist/css/tabulator.min.css";
import "../../../styles/tabulator.css"; // Import custom tabulator styles

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  completed_at: string | null;
  is_complete: boolean;
  total_points: number | null;
  email: string;
  campaign_name: string;
}

interface Campaign {
  id: string;
  title: string;
  max_user_submissions: number;
  max_points: number;
  is_public: boolean;
  campaign_context: string;
  job_description: string;
}

const CampaignSubmissionsPage = () => {
  const router = useRouter();
  const { campaignId } = router.query;
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Reference for the tabulator instance
  const tableRef = useRef<HTMLDivElement>(null);
  const tabulatorRef = useRef<Tabulator | null>(null);

  // Setup auth on component mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${INTERNAL_API_TOKEN}`;
    } else {
      router.push('/login');
    }
  }, [router]);

  // Fetch campaign data
  useEffect(() => {
    const fetchCampaignData = async () => {
      if (!campaignId) return;

      try {
        setIsLoading(true);
        setError('');
        
        // Get token from localStorage
        const token = localStorage.getItem('accessToken');
        const authHeader = {
          headers: {
            'Authorization': token ? `Bearer ${INTERNAL_API_TOKEN}` : 'Bearer dVCjV5QO8t'
          }
        };
        
        // Fetch campaign details
        const campaignResponse = await axios.get(
          `${API_BASE_URL}/api/campaigns/${campaignId}`, 
          authHeader
        );
        
        setCampaign(campaignResponse.data);
        
        // Fetch all submissions for this campaign
        const submissionsResponse = await axios.get(
          `${API_BASE_URL}/api/submissions?campaign_id=${campaignId}`, 
          authHeader
        );
        
        setSubmissions(submissionsResponse.data);
      } catch (err) {
        console.error('Error fetching campaign data:', err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            router.push('/login');
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
          } else {
            setError('Failed to load campaign data');
          }
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaignData();
  }, [campaignId, router]);

  // Initialize Tabulator when data is loaded
  useEffect(() => {
    if (isLoading || !tableRef.current || submissions.length === 0) return;
    
    // Format date for display in the table
    const formatDate = (date: string | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleString();
    };
    
    // Configure and initialize Tabulator
    tabulatorRef.current = new Tabulator(tableRef.current, {
      data: submissions,
      layout: "fitColumns",
      pagination: true,
      paginationSize: 10,
      paginationSizeSelector: [5, 10, 20, 50],
      movableColumns: true,
      resizableRows: true,
      columns: [
        { title: "Candidate", field: "email", headerFilter: true, widthGrow: 2 },
        { 
          title: "Created", 
          field: "created_at", 
          formatter: (cell) => formatDate(cell.getValue()),
          sorter: "datetime",
          widthGrow: 1
        },
        { 
          title: "Completed", 
          field: "completed_at", 
          formatter: (cell) => formatDate(cell.getValue()),
          sorter: "datetime",
          widthGrow: 1
        },
        { 
          title: "Status", 
          field: "is_complete", 
          formatter: (cell) => {
            const value = cell.getValue();
            return value ? 
              '<span class="px-2 py-1 bg-green-100 text-green-800 rounded">Completed</span>' : 
              '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">In Progress</span>';
          },
          headerFilter: true,
          headerFilterParams: {
            values: {"true": "Completed", "false": "In Progress"}
          },
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
          headerSort: false,
          formatter: function(_, cell) {
            const rowData = cell.getRow().getData();
            return `<button class="view-btn bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-700">View</button>`;
          },
          cellClick: function(e, cell) {
            const rowData = cell.getRow().getData() as Submission;
            if (e.target instanceof HTMLElement && e.target.classList.contains('view-btn')) {
              router.push(`/submission/${rowData.id}`);
            }
          },
          width: 100
        }
      ],
      initialSort: [
        { column: "created_at", dir: "desc" }
      ]
    });

    // Cleanup function
    return () => {
      if (tabulatorRef.current) {
        tabulatorRef.current.destroy();
      }
    };
  }, [submissions, isLoading, router]);

  return (
    <PageTemplate title={`${campaign?.title || 'Campaign'} Submissions`} maxWidth="lg">
      <div className="flex justify-between mb-4 items-center">
        <h1 className="text-2xl font-bold">{campaign?.title || 'Campaign'} Submissions</h1>
        <Link 
          href={`/campaigns/${campaignId}`}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Back to Campaign
        </Link>
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
        <>
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded">
                <h3 className="text-sm font-medium text-gray-500">Total Submissions</h3>
                <p className="text-2xl font-bold">{submissions.length}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <h3 className="text-sm font-medium text-gray-500">Completed</h3>
                <p className="text-2xl font-bold">{submissions.filter(s => s.is_complete).length}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
                <p className="text-2xl font-bold">{submissions.filter(s => !s.is_complete).length}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <h3 className="text-sm font-medium text-gray-500">Average Score</h3>
                <p className="text-2xl font-bold">
                  {submissions.length > 0 && submissions.some(s => s.total_points !== null)
                    ? (submissions.reduce((acc, s) => acc + (s.total_points || 0), 0) / 
                      submissions.filter(s => s.total_points !== null).length).toFixed(1)
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {submissions.length > 0 ? (
            <div className="bg-white shadow rounded-lg p-4">
              <div ref={tableRef} className="w-full"></div>
            </div>
          ) : (
            <div className="text-center py-8 bg-white shadow rounded-lg">
              <p className="text-gray-500">No submissions found for this campaign.</p>
              <p className="text-gray-400 mt-2">Submissions will appear here when candidates complete the interview.</p>
            </div>
          )}
        </>
      )}
    </PageTemplate>
  );
};

export default CampaignSubmissionsPage;
