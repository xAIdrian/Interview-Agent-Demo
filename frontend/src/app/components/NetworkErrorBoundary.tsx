'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthLogger } from '@/utils/logging';

interface NetworkErrorBoundaryProps {
  children: React.ReactNode;
}

export function NetworkErrorBoundary({ children }: NetworkErrorBoundaryProps) {
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const router = useRouter();
  
  // Listen for global network errors
  useEffect(() => {
    const handleNetworkChange = () => {
      if (!navigator.onLine) {
        setHasNetworkError(true);
        AuthLogger.warn('Browser reports offline status');
      } else {
        setHasNetworkError(false);
        AuthLogger.info('Network connectivity restored');
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

  if (hasNetworkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Network Error</h2>
            <p className="text-gray-600 mb-6">
              Please check your internet connection and try again.
            </p>
            <button
              onClick={() => router.refresh()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 
