import '../utils/axios'; // Import the axios configuration first
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AuthProvider } from '../app/components/AuthProvider';
import { NetworkErrorBoundary } from '../app/components/NetworkErrorBoundary';
import dynamic from 'next/dynamic';

// Import AuthDebugToggle only on client-side and only in development
const AuthDebugToggle = dynamic(
  () => process.env.NODE_ENV === 'development' 
    ? import('../components/auth/AuthDebug').then(mod => mod.AuthDebugToggle) 
    : Promise.resolve(() => null),
  { ssr: false }
);

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NetworkErrorBoundary>
      <Head>
        <title>Gulpin AI Interview Platform</title>
        <meta name="description" content="AI-powered interview platform for candidates and employers" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AuthProvider>
        <Component {...pageProps} />
        <AuthDebugToggle />
      </AuthProvider>
    </NetworkErrorBoundary>
  );
}

export default MyApp;
