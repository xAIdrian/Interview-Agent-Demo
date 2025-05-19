import { useRouter } from 'next/router';
import Link from 'next/link';
import { PageTemplate } from '../components/PageTemplate';
import { useAuth } from '../app/components/AuthProvider';
import Head from 'next/head';

const UnauthorizedPage = () => {
  const router = useRouter();
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <>
      <Head>
        <title>Unauthorized Access</title>
      </Head>
      <PageTemplate>
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="text-center">
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                Unauthorized Access
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                {isAuthenticated 
                  ? "You don't have permission to access this page." 
                  : "You need to be logged in to access this page."}
              </p>
            </div>
            
            <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="space-y-6">
                {isAuthenticated ? (
                  <div>
                    <p className="text-sm text-gray-700 mb-6">
                      {isAdmin 
                        ? "There was an issue with your permissions." 
                        : "This page requires admin privileges."}
                    </p>
                    <div className="flex flex-col space-y-4">
                      <button
                        onClick={() => router.back()}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Go Back
                      </button>
                      <Link
                        href={isAdmin ? '/campaigns' : '/campaigns'}
                        className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Go to {isAdmin ? 'Campaigns' : 'Positions'}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-700 mb-6">
                      Please sign in to continue:
                    </p>
                    <div className="flex flex-col space-y-4">
                      <Link
                        href="/login"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/"
                        className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Back to Home
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageTemplate>
    </>
  );
};

export default UnauthorizedPage; 
