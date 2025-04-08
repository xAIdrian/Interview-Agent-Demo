import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { PageTemplate } from '../../../components/PageTemplate';
import Link from 'next/link';
// Import tabulator config before Tabulator
import configureTabulatorDependencies from '../../../utils/tabulator-config';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { AuthLogger } from '../../../utils/logging';
import "tabulator-tables/dist/css/tabulator.min.css";
import "../../../styles/tabulator.css"; // Import custom tabulator styles

// Initialize Tabulator with required dependencies
configureTabulatorDependencies();

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
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
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Reference for the tabulator instance
  const tableRef = useRef<HTMLDivElement>(null);
  const tabulatorRef = useRef<Tabulator | null>(null);

  // Setup auth on component mount
  //useEffect(() => {
    //const token = localStorage.getItem('accessToken');
    //const isAdminUser = localStorage.getItem('isAdmin') === 'true';
    //setIsAdmin(isAdminUser);
    
    //if (token) {
      //// Don't set default axios headers here
    //} else {
      //router.push('/login');
    //}
  //}, [router]);

  // Fetch campaign data
  useEffect(() => {
    const fetchCampaignData = async () => {
      if (!campaignId) return;

      // Ensure campaignId is treated as string
      const campaignIdString = String(campaignId);

      try {
        setIsLoading(true);
        setError('');
        
        AuthLogger.info(`Fetching data for campaign: ${campaignIdString}`);
        
        // Fetch campaign details
        const campaignResponse = await axios.get(
          `${API_BASE_URL}/api/campaigns/${campaignIdString}`
        );
        
        setCampaign(campaignResponse.data);
        AuthLogger.info('Campaign details loaded successfully');
        
        // Fetch all submissions for this campaign
        const submissionsResponse = await axios.get(
          `${API_BASE_URL}/api/submissions?campaign_id=${campaignIdString}`
        );
        
        // Ensure all IDs in the submissions are strings
        const submissionsWithStringIds = submissionsResponse.data.map((submission: any) => ({
          ...submission,
          id: String(submission.id),
          campaign_id: String(submission.campaign_id),
          user_id: String(submission.user_id)
        }));
        
        setSubmissions(submissionsWithStringIds);
        AuthLogger.info(`Loaded ${submissionsWithStringIds.length} submissions for campaign`);
        
      } catch (err) {
        console.error('Error fetching submissions data:', err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            router.push('/login');
            AuthLogger.error('Authentication error fetching submissions', err.response?.status, err.response?.data);
          } else if (err.response?.status === 403) {
            setError('Admin access required to view submissions');
            AuthLogger.error('Permission error fetching submissions', err.response?.status, err.response?.data);
          } else if (err.response?.data?.error) {
            setError(err.response.data.error);
            AuthLogger.error('API error fetching submissions', err.response?.status, err.response?.data);
          } else {
            setError('Failed to load submissions data');
            AuthLogger.error('Unknown error fetching submissions', err.response?.status);
          }
        } else {
          setError('An unexpected error occurred');
          AuthLogger.error('Unexpected error fetching submissions data', err);
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
    
    try {
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
            field: "id",
            hozAlign: "center",
            formatter: (cell: any) => {
              const submissionId = String(cell.getValue());
              
              // Create a container div for the buttons
              const container = document.createElement("div");
              container.className = "flex space-x-2";
              
              // Create View button
              const viewButton = document.createElement("a");
              viewButton.innerHTML = "View Answers";
              viewButton.className = "px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm";
              viewButton.href = `/submissions/${submissionId}`;
              container.appendChild(viewButton);
              
              //// Create Interview button
              //const interviewButton = document.createElement("a");
              //interviewButton.innerHTML = "Interview";
              //interviewButton.className = "px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm";
              //interviewButton.href = `/interview/${submissionId}`;
              //container.appendChild(interviewButton);
              
              return container;
            },
            cellClick: function(e: any, cell: any) {
              const target = e.target as HTMLElement;
              if (target.tagName.toLowerCase() === 'a') {
                // Let the native link behavior work
                return;
              }
              
              // If not clicking on a link, navigate to view submission
              const submissionId = String(cell.getValue());
              window.location.href = `/submissions/${submissionId}`;
            }
          }
        ],
        initialSort: [
          { column: "created_at", dir: "desc" }
        ],
        // Add explicit type casting to help with data handling
        dataLoaded: function(data) {
          console.log("Tabulator data loaded:", data.length, "records");
        },
        rowClick: function(e, row) {
          // Alternative navigation method - click anywhere on the row
          const rowData = row.getData() as Submission;
          router.push(`/submission/${rowData.id}`);
        }
      });

      console.log("Tabulator initialized successfully");
      
    } catch (err) {
      console.error("Error initializing tabulator:", err);
      setError("Failed to initialize submission table. Please refresh the page.");
    }
    
    // Cleanup function
    return () => {
      try {
        if (tabulatorRef.current) {
          tabulatorRef.current.destroy();
          tabulatorRef.current = null;
        }
      } catch (err) {
        console.error("Error destroying tabulator:", err);
      }
    };
  }, [submissions, isLoading, router]);

  return (
    <PageTemplate title={`${campaign?.title || 'Campaign'} Submissions`} maxWidth="lg">
      <div className="flex justify-end mb-4 items-center">
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
      
      {!isAdmin && (
        <div className="mb-4 p-2 bg-yellow-100 text-yellow-700 rounded">
          This page requires admin privileges.
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
        </div>
      ) : error === 'Admin access required' ? (
        <div className="text-center py-8 bg-white shadow rounded-lg">
          <p className="text-red-500 font-bold">Admin access required</p>
          <p className="text-gray-500 mt-2">You need admin privileges to view submissions.</p>
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
              {/* Add a fallback in case Tabulator fails to load */}
              {error.includes("initialize submission table") ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {submissions.map((submission) => (
                        <tr key={submission.id}>
                          <td className="px-6 py-4 whitespace-nowrap">{submission.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{new Date(submission.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded ${submission.is_complete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {submission.is_complete ? 'Completed' : 'In Progress'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{submission.total_points !== null ? submission.total_points : 'Not scored'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex justify-center space-x-2">
                              <a 
                                href={`/submissions/${submission.id}`}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                View
                              </a>
                              <a 
                                href={`/interview/${submission.id}`}
                                className="text-green-500 hover:text-green-700"
                              >
                                Interview
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div ref={tableRef} className="w-full"></div>
              )}
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
