// pages/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import Head from 'next/head';
import { PageTemplate } from '../components/PageTemplate';

// Define API base URL for consistent usage
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001';

const HomePage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('accessToken');
    const userIsAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (token) {
      setIsLoggedIn(true);
      setIsAdmin(userIsAdmin);
      
      // Redirect based on user type
      if (userIsAdmin) {
        router.push('/campaigns');
      } else {
        router.push('/candidate');
      }
    } else {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <>
        <Head>
          <title>Loading... | Gulpin AI Interview</title>
        </Head>
        <PageTemplate title="Loading...">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
          </div>
        </PageTemplate>
      </>
    );
  }
  return (
    <>
      <Head>
        <title>Welcome to Gulpin AI Interview</title>
        <meta name="description" content="AI-powered interviews that help you find the best candidates" />
      </Head>
      <PageTemplate title="Welcome to Gulpin AI Interview">
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
                Gulpin AI Interview
              </h1>
              <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
                AI-powered interviews that help you find the best candidates
              </p>
            </div>

            <div className="mt-12">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">For Candidates</h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500">
                      <p>
                        Showcase your skills in an interactive AI interview. Apply for open positions and get feedback on your performance.
                      </p>
                    </div>
                    <div className="mt-5">
                      <Link href="/login?type=candidate" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Login as Candidate
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">For Employers</h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500">
                      <p>
                        Create custom interview campaigns, review candidate submissions, and find the perfect match for your team.
                      </p>
                    </div>
                    <div className="mt-5">
                      <Link href="/login?type=admin" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Login as Employer
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageTemplate>
    </>
  );
};

export default HomePage;

