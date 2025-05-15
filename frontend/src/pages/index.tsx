// pages/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { PageTemplate } from '../components/PageTemplate';

const HomePage = () => {
  const router = useRouter();

  useEffect(() => {
    // Unconditionally redirect to /campaigns
    router.push('/campaigns');
  }, [router]);

  // Show loading spinner while redirecting
  return (
    <>
      <Head>
        <title>Redirecting...</title>
      </Head>
      <PageTemplate title="Redirecting...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
      </PageTemplate>
    </>
  );
};

export default HomePage;

