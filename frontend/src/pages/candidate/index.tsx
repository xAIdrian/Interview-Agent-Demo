import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { PageTemplate } from '../../components/PageTemplate';
import Link from 'next/link';

const CandidateIndexPage = () => {
  const router = useRouter();

  useEffect(() => {
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.is_admin) {
      router.push('/admin');
    }
  }, [router]);

  return (
    <PageTemplate title="Candidate Dashboard">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Candidate Dashboard</h1>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Available Positions Card */}
            <Link href="/campaigns" className="block">
              <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">Available Positions</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Browse and apply for open positions
                  </p>
                </div>
              </div>
            </Link>

            {/* My Applications Card */}
            <Link href="/candidate/applications" className="block">
              <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">My Applications</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    View and track your application status
                  </p>
                </div>
              </div>
            </Link>

            {/* Profile Card */}
            <Link href="/profile" className="block">
              <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900">My Profile</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Update your profile information
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

export default CandidateIndexPage;
