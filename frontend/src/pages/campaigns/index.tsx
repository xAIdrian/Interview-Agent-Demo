import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../components/PageTemplate';
// Import Tabulator styles
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
// Import custom tabulator styles
import '../../styles/tabulator.css';
import { AuthLogger } from '../../utils/logging';

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
  job_description: string; // Added job description
}

const CampaignsPage = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);

  // Use client-side only rendering to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/campaigns');
        setCampaigns(response.data);
        AuthLogger.info(`Loaded ${response.data.length} campaigns successfully`);
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

  const columns: ColumnDefinition[] = [
    { title: "Title", field: "title", widthGrow: 3 },
    // Add job description column with shortened display
    { 
      title: "Job Description", 
      field: "job_description", 
      widthGrow: 4,
      formatter: (cell: any) => {
        const text = cell.getValue() || '';
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
      }
    },
    { title: "Max User Submissions", field: "max_user_submissions", hozAlign: "center" as "center", widthGrow: 2 },
    { title: "Max Points", field: "max_points", hozAlign: "center" as "center", widthGrow: 1 },
    { 
      title: "Is Public", 
      field: "is_public", 
      hozAlign: "center" as "center", 
      widthGrow: 1,
      formatter: (cell: any) => cell.getValue() ? "Yes" : "No" 
    },
    { 
      title: "Actions", 
      field: "id", 
      hozAlign: "center" as "center",
      widthGrow: 1,
      formatter: function(cell: any) {
        return `<a href="/campaigns/${cell.getValue()}" class="text-blue-500 hover:text-blue-700">View</a>`;
      },
      cellClick: function(e: any, cell: any) {
        const id = cell.getValue();
        window.location.href = `/campaigns/${id}`;
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
    height: "auto", // Use auto height instead of fixed
    renderVerticalBuffer: 0, // Minimize extra space at bottom
    layoutColumnsOnNewData: true, // Ensures columns resize when data changes
  };

  if (!isClient) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <PageTemplate title="Campaigns" maxWidth="lg">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Campaigns</h2>

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
            {campaigns.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No campaigns found. Create a new campaign to get started.
              </div>
            ) : (
              <div className="overflow-x-auto tabulator-container">
                <ReactTabulator
                  data={campaigns}
                  columns={columns}
                  options={options}
                  className="campaigns-table"
                />
              </div>
            )}
          </>
        )}

        <div className="flex space-x-4 mt-6">
          <Link href="/campaigns/create" 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
            Create Campaign from Scratch
          </Link>
          <Link href="/campaigns/create-from-doc" 
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700">
            Create Campaign from Document
          </Link>
        </div>
      </div>
      {/* Remove the inline styles since they're now in the external CSS file */}
    </PageTemplate>
  );
};

export default CampaignsPage;