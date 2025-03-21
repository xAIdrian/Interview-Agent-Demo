import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { PageTemplate } from '../../components/PageTemplate';
import { INTERNAL_API_TOKEN } from '../../utils/internalApiToken';
// Import Tabulator styles
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.min.css';
// Import custom tabulator styles
import '../../styles/tabulator.css';

// Need to conditionally import for SSR compatibility
import dynamic from 'next/dynamic';
const ReactTabulator = dynamic(() => import('react-tabulator').then(mod => mod.ReactTabulator), {
  ssr: false,
});

// User interface
interface User {
  id: number;
  email: string;
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
        const response = await axios.get('http://127.0.0.1:5000/api/users', {
          headers: {
            'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
          }
        });
        setUsers(response.data);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [isClient]);

  const columns = [
    { title: "ID", field: "id", widthGrow: 1 },
    { title: "Email", field: "email", widthGrow: 3 },
    { 
      title: "Type", 
      field: "is_admin", 
      widthGrow: 2, 
      formatter: (cell: any) => cell.getValue() ? "Admin" : "Candidate" 
    },
    { 
      title: "Actions", 
      field: "id", 
      hozAlign: "center",
      widthGrow: 1,
      formatter: function(cell: any) {
        return `<a href="/users/${cell.getValue()}" class="text-blue-500 hover:text-blue-700">View</a>`;
      },
      cellClick: function(e: any, cell: any) {
        const id = cell.getValue();
        window.location.href = `/users/${id}`;
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
    <PageTemplate title="User Manager" maxWidth="lg">
      <div className="w-full bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-6">User Manager</h1>

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
            {users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No users found. Create a new user to get started.
              </div>
            ) : (
              <div className="overflow-x-auto tabulator-container">
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

        <div className="mt-6">
          <Link href="/users/create" 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700">
            Create a New User
          </Link>
        </div>
      </div>
    </PageTemplate>
  );
};

export default UsersPage;
