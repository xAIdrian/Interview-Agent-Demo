import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { PageTemplate } from '../../components/PageTemplate';
import Link from 'next/link';
import { 
  BriefcaseIcon, 
  DocumentTextIcon, 
  UserCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { Toast } from '../../components/ui/Toast';

const CandidateIndexPage = () => {
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    router.push('/campaigns');
  }, [router]);

  return (
    <PageTemplate>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Candidate Dashboard</h1>
            <div className="flex items-center space-x-4">
              <Link 
                href="/profile" 
                className="text-gray-600 hover:text-gray-900 flex items-center"
              >
                <Cog6ToothIcon className="h-5 w-5 mr-1" />
                Settings
              </Link>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Available Positions Card */}
            <Link href="/campaigns" className="block">
              <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                      <BriefcaseIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Available Positions</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Browse and apply for open positions
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>

            {/* My Applications Card */}
            <Link 
              href="/submissions" 
              className="block"
            >
              <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-[1.02]">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
                      <DocumentTextIcon className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">My Applications</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        View and manage your applications
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
      {showToast && (
        <Toast 
          message="Coming Soon!" 
          onClose={() => setShowToast(false)}
        />
      )}
    </PageTemplate>
  );
};

export default CandidateIndexPage;
