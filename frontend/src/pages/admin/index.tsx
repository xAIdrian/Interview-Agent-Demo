import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { PageTemplate } from '../../components/PageTemplate';
import Link from 'next/link';

const AdminIndexPage = () => {
  const router = useRouter();

  useEffect(() => {
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.is_admin) {
      router.push('/candidate');
    }
  }, [router]);

  return (
    <PageTemplate title="Admin Dashboard">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Users Management Card */}
            <Link href="/admin/users" className="block">
              <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">Users Management</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage user accounts, permissions, and access
                  </p>
                </div>
              </div>
            </Link>

            {/* Campaigns Management Card */}
            <Link href="/admin/campaigns" className="block">
              <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">Campaigns</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Create and manage interview campaigns
                  </p>
                </div>
              </div>
            </Link>

            {/* Submissions Management Card */}
            <Link href="/admin/submissions" className="block">
              <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">Submissions</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Review and manage candidate submissions
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
};

export default AdminIndexPage; 
