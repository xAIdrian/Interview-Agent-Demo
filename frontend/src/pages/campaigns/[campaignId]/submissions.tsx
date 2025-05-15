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
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com';

interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  created_at: string;
  is_complete: boolean;
  total_points: number | null;
  email: string;
  campaign_name: string;
  candidate_name?: string;
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

interface ResumeAnalysis {
  strengths: string[];
  weaknesses: string[];
  overall_fit: string;
  percent_match: number;
  percent_match_reason: string;
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

  const [resumeAnalyses, setResumeAnalyses] = useState<{ [submissionId: string]: ResumeAnalysis } >({});

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

  useEffect(() => {
    const fetchResumeAnalyses = async (subs: Submission[]) => {
      const analyses: { [submissionId: string]: ResumeAnalysis } = {};
      await Promise.all(
        subs.map(async (submission: any) => {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/resume_analysis/${submission.id}`);
            analyses[submission.id] = res.data;
          } catch (err) {
            // If not found or error, skip
          }
        })
      );
      setResumeAnalyses(analyses);
    };
    if (submissions.length > 0) {
      fetchResumeAnalyses(submissions);
    }
  }, [submissions]);

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
        data: submissions.filter(submission => submission.total_points !== null),
        layout: "fitColumns",
        pagination: true,
        paginationSize: 10,
        paginationSizeSelector: [5, 10, 20, 50],
        movableColumns: true,
        resizableRows: true,
        columns: [
          { 
            title: "Candidate", 
            field: "email", 
            widthGrow: 2,
            formatter: function(cell: any) {
              const data = cell.getRow().getData();
              const name = data.candidate_name || 'No name';
              return `<div>
                <div class="font-medium">${name}</div>
              </div>`;
            }
          },
          { 
            title: "Created", 
            field: "created_at", 
            formatter: (cell) => formatDate(cell.getValue()),
            sorter: "datetime",
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
              // Ensure campaignId is a string and properly encoded
              const returnToCampaign = String(campaignId);
              console.log('🚀 ~ Creating view button with returnToCampaign:', returnToCampaign);
              const data = cell.getRow().getData() as Submission;
              viewButton.href = `/submissions/${submissionId}?returnToCampaign=${encodeURIComponent(returnToCampaign)}&userId=${encodeURIComponent(data.user_id)}&campaignId=${encodeURIComponent(data.campaign_id)}`;
              viewButton.className = "px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm";
              container.appendChild(viewButton);
              
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
              const data = cell.getRow().getData() as Submission;
              const safeReturnToCampaign = typeof campaignId === 'string' ? campaignId : Array.isArray(campaignId) ? campaignId[0] : '';
              router.push(`/submissions/${submissionId}/answers?returnToCampaign=${encodeURIComponent(safeReturnToCampaign)}&userId=${encodeURIComponent(data.user_id)}&campaignId=${encodeURIComponent(data.campaign_id)}`);
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
          const safeReturnToCampaign = typeof campaignId === 'string' ? campaignId : Array.isArray(campaignId) ? campaignId[0] : '';
          router.push(`/submissions/${rowData.id}/answers?returnToCampaign=${encodeURIComponent(safeReturnToCampaign)}&userId=${encodeURIComponent(rowData.user_id)}&campaignId=${encodeURIComponent(rowData.campaign_id)}`);
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
    <div>
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
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
          {submissions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {submissions.filter(sub => sub.total_points !== null).map((submission) => {
                // Safe handling for missing or malformed email
                const email = typeof submission.email === 'string' ? submission.email : '';
                const name = submission.candidate_name || (email.includes('@') ? email.split('@')[0].replace(/\./g, ' ') : 'Unknown');
                const initials = name.split(' ').map(n => n[0]?.toUpperCase() || '').join('').slice(0,2) || '??';
                const qualified = submission.total_points && submission.total_points > 70; // Example logic
                const analysis = resumeAnalyses[submission.id];
                const summary = analysis?.overall_fit || `${name} has a strong background in banking and project management, making them a solid candidate for the Product Owner position. However, gaps in specific international banking product knowledge and Agile experience might limit their effectiveness in the role.`;
                const matching = analysis?.percent_match !== undefined ? Math.round(analysis.percent_match) : 'N/A';
                const isQualified = typeof matching === 'number' && matching >= 75;
                return (
                  <div
                    key={submission.id}
                    className="bg-white rounded-xl shadow p-6 flex flex-col justify-between min-h-[260px] cursor-pointer hover:shadow-lg transition"
                    onClick={() => router.push(`/submissions/${submission.id}?userId=${encodeURIComponent(submission.user_id)}&campaignId=${encodeURIComponent(submission.campaign_id)}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full bg-gray-700 text-white flex items-center justify-center text-xl font-bold mr-4">
                          {initials}
                        </div>
                        <span className="text-lg font-semibold text-gray-900">{name}</span>
                      </div>
                      {isQualified && (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-green-50 text-green-700">Qualified</span>
                      )}
                    </div>
                    <div className="text-gray-700 mb-6 mt-2 flex-1">
                      {summary}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t mt-2">
                      <span className="text-gray-500 font-medium">Matching</span>
                      <span className="text-blue-600 font-bold text-lg">{matching}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-white shadow rounded-lg">
              <p className="text-gray-500">No submissions found for this campaign.</p>
              <p className="text-gray-400 mt-2">Submissions will appear here when candidates complete the interview.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CampaignSubmissionsPage;
