import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { PageTemplate } from '../../components/PageTemplate';
import { useAuth } from '../../app/components/AuthProvider';
import { 
  DocumentTextIcon, 
  EyeIcon, 
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

// Update Submission interface
interface Submission {
  id: string;
  campaign_id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  campaign_title: string;
  user_name: string;
  user_email: string;
  is_complete: boolean;
  total_points: number | null;
}

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kwiks.io';

const SubmissionsPage = () => {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
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

    const fetchSubmissions = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`${API_BASE_URL}/api/submissions`, {
          withCredentials: true // Add this to send cookies with the request
        });
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        console.log('Raw response data:', response.data);
        
        // Ensure all submission IDs are strings and handle potential null values
        const submissionsWithStringIds = response.data.map((submission: any) => {
          console.log('Processing submission:', submission);
          return {
            ...submission,
            id: String(submission.id || ''),
            campaign_id: String(submission.campaign_id || ''),
            user_id: String(submission.user_id || ''),
            is_complete: Boolean(submission.is_complete),
            total_points: submission.total_points !== null ? Number(submission.total_points) : null
          };
        });
        
        console.log('Processed submissions:', submissionsWithStringIds);
        setSubmissions(submissionsWithStringIds);
        AuthLogger.info(`Loaded ${submissionsWithStringIds.length} submissions successfully`);
      } catch (err) {
        console.error('Error fetching submissions:', err);
        
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            setError('Please log in to view your submissions.');
          } else if (err.response?.status === 403) {
            setError('You do not have permission to view these submissions.');
          } else {
            setError('Failed to load submissions. Please try again.');
          }
          AuthLogger.error('Error fetching submissions:', err.response?.status, err.response?.data);
        } else {
          setError('An unexpected error occurred. Please try again.');
          AuthLogger.error('Unexpected error fetching submissions:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchSubmissions();
    } else {
      setError('Please log in to view your submissions.');
      setIsLoading(false);
    }
  }, [isClient, isAuthenticated]);

  const handleActionClick = (id: string) => {
    router.push(`/submissions/${id}`);
  };

  const columns: ColumnDefinition[] = [
    { title: "Campaign", field: "campaign_title", widthGrow: 2 },
    ...(isAdmin ? [{
      title: "Candidate", 
      field: "user_name",
      widthGrow: 2,
      formatter: (cell: any) => {
        const row = cell.getRow().getData();
        return `${row.user_name}<br><span class="text-sm text-gray-500">${row.user_email}</span>`;
      }
    }] : []),
    { 
      title: "Status", 
      field: "is_complete", 
      hozAlign: "center" as "center", 
      widthGrow: 1,
      formatter: (cell: any) => {
        const isCompleted = cell.getValue();
        return isCompleted ? 
          '<div class="flex items-center justify-center text-green-600"><CheckCircleIcon class="h-5 w-5" /></div>' : 
          '<div class="flex items-center justify-center text-yellow-600"><XCircleIcon class="h-5 w-5" /></div>';
      }
    },
    { 
      title: "Score", 
      field: "total_points", 
      widthGrow: 1,
      formatter: (cell: any) => {
        const score = cell.getValue();
        return score !== null ? score : 'Not scored';
      }
    },
    { 
      title: "Submitted", 
      field: "created_at", 
      widthGrow: 2,
      formatter: (cell: any) => {
        const date = new Date(cell.getValue());
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      }
    },
    { 
      title: "Actions", 
      field: "id", 
      hozAlign: "center" as "center",
      widthGrow: 1,
      formatter: function() {
        return `<div class="flex items-center justify-center">
          <button class="text-blue-500 hover:text-blue-700 flex items-center">
            <EyeIcon class="h-5 w-5 mr-1" />
            View
          </button>
        </div>`;
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
        <title>{isAdmin ? 'All Submissions' : 'My Submissions'}</title>
      </Head>
      <PageTemplate title={isAdmin ? 'All Submissions' : 'My Submissions'} maxWidth="lg">
        <div className="w-full bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{isAdmin ? 'All Submissions' : 'My Submissions'}</h2>
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
                data={submissions}
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

export default SubmissionsPage;
