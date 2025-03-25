import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../../components/PageTemplate';
import { AuthLogger } from '../../../utils/logging';
// Import Tabulator config
import configureTabulatorDependencies from '../../../utils/tabulator-config';
// Import Tabulator styles
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
// Import custom tabulator styles
import '../../../styles/tabulator.css';

// Initialize Tabulator with required dependencies
configureTabulatorDependencies();

// Need to conditionally import for SSR compatibility
import dynamic from 'next/dynamic';
import { ColumnDefinition } from 'react-tabulator';

const ReactTabulator = dynamic(() => import('react-tabulator').then(mod => mod.ReactTabulator), {
  ssr: false,
});

// User interface
interface User {
  id: number;
  email: string;
  name?: string;
  is_admin: boolean;
}

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);

  // Use client-side only rendering to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/users');
        setUsers(response.data);
        AuthLogger.info(`Loaded ${response.data.length} users successfully`);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
        
        if (axios.isAxiosError(err)) {
          AuthLogger.error('Error fetching users:', err.response?.status, err.response?.data);
        } else {
          AuthLogger.error('Unexpected error fetching users:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [isClient]);

  const columns: ColumnDefinition[] = [
    { title: "ID", field: "id", widthGrow: 1 },
    { title: "Email", field: "email", widthGrow: 3 },
    { title: "Name", field: "name", widthGrow: 2 },
    { 
      title: "Role", 
      field: "is_admin", 
      widthGrow: 1.5, 
      formatter: (cell: any) => cell.getValue() ? "Admin" : "Candidate" 
    },
    { 
      title: "Actions", 
      field: "id", 
      hozAlign: "center" as const,
      widthGrow: 1.5,
      formatter: function(cell: any) {
        const id = cell.getValue();
        return `
          <div class="flex space-x-2 justify-center">
            <a href="/admin/users/${id}" class="text-blue-500 hover:text-blue-700">View</a>
            <a href="/admin/users/${id}/edit" class="text-indigo-500 hover:text-indigo-700">Edit</a>
          </div>
        `;
      },
      cellClick: function(e: any, cell: any) {
        // Get the element that was clicked on
        const element = e.target;
        if (element.tagName === 'A') {
          // Let the browser handle the link click
          return;
        }
        
        // If not clicked directly on a link, navigate to the view page
        const id = cell.getValue();
        window.location.href = `/admin/users/${id}`;
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
    height: "auto",
    renderVerticalBuffer: 10,
  };

  if (!isClient) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <PageTemplate title="User Management">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">User Management</h1>
          <Link 
            href="/admin/users/create" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Add New User
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
          </div>
        ) : (
          <>
            {users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No users found. Create a new user to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <ReactTabulator
                  data={users}
                  columns={columns}
                  options={options}
                  className="users-table"
                />
              </div>
            )}
          </>
        )}
      </div>
    </PageTemplate>
  );
};

export default UsersPage;
