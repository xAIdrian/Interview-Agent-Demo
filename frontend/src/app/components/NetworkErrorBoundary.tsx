'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLogger } from '../../utils/logging';

interface NetworkErrorBoundaryProps {
  children: ReactNode;
}

export function NetworkErrorBoundary({ children }: NetworkErrorBoundaryProps) {
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();
  
  // Function to check API connectivity
  const checkConnection = async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000' || 'http://127.0.0.1:5000';
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'HEAD',
        cache: 'no-cache',
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if the response is OK (status in the range 200-299)
      if (response.ok) {
        AuthLogger.info('API health check succeeded');
        return true;
      } else {
        AuthLogger.warn(`API health check failed with status: ${response.status}`);
        return false;
      }
    } catch (error) {
      AuthLogger.error('API connection check failed:', error);
      return false;
    }
  };
  
  // Periodically check for network connectivity when in error state
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (hasNetworkError) {
      intervalId = setInterval(async () => {
        const isConnected = await checkConnection();
        if (isConnected) {
          setHasNetworkError(false);
          AuthLogger.info('Network connectivity restored');
        }
      }, 5000); // Check every 5 seconds
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [hasNetworkError]);
  
  // Listen for global network errors
  useEffect(() => {
    const handleNetworkChange = () => {
      if (!navigator.onLine) {
        setHasNetworkError(true);
        AuthLogger.warn('Browser reports offline status');
      } else {
        // Verify real connectivity to backend
        checkConnection().then(isConnected => {
          if (isConnected) {
            setHasNetworkError(false);
            AuthLogger.info('Network connectivity confirmed');
          } else {
            setHasNetworkError(true);
            AuthLogger.warn('Network appears online but API is unreachable');
          }
        });
      }
    };
    
    // Initial check
    handleNetworkChange();
    
    // Listen for online/offline events
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    
    // Global error handler for network errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        return response;
      } catch (error) {
        if (error instanceof TypeError && (error.message === 'Failed to fetch' || error.message.includes('network'))) {
          setHasNetworkError(true);
          AuthLogger.warn('Network error detected in fetch:', error);
        }
        throw error;
      }
    };
    
    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      window.fetch = originalFetch;
    };
  }, []);
  
  const handleRetry = async () => {
    setRetryCount(retryCount + 1);
    AuthLogger.info(`Retrying connection (attempt ${retryCount + 1})`);
    
    const isConnected = await checkConnection();
    if (isConnected) {
      setHasNetworkError(false);
      AuthLogger.info('Connection restored after retry');
      // Refresh the page to reload data
      window.location.reload();
    } else {
      AuthLogger.warn('Retry failed, still no connection');
    }
  };
  
  const handleGoHome = () => {
    router.push('/');
  };
  
  if (!hasNetworkError) {
    return <>{children}</>;
  }
  
  // Network error UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4">Network Connection Lost</h2>
        
        <div className="text-gray-700 mb-6">
          <p className="mb-4">
            Unable to connect to the server. This could be due to:
          </p>
          <ul className="text-left list-disc pl-5 mb-4">
            <li>Your internet connection is offline</li>
            <li>The server is temporarily unavailable</li>
            <li>A network firewall is blocking the connection</li>
          </ul>
          <p>
            You can continue browsing with limited functionality using cached data.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
          <button
            onClick={handleGoHome}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
} 