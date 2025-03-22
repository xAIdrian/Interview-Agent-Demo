'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../app/components/AuthProvider';
import { AuthLogger } from '../utils/logging';

interface AdminGuardProps {
  children: ReactNode;
}

export const AdminGuard = ({ children }: AdminGuardProps) => {
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAdminStatus = () => {
      // Wait for auth to finish loading
      if (loading) {
        return;
      }
      
      setIsChecking(false);
      
      // If user is not authenticated, redirect to login
      if (!isAuthenticated) {
        AuthLogger.warn('Unauthorized access attempt to admin area. Redirecting to login.');
        router.push('/login?redirect=/admin/dashboard');
        return;
      }
      
      // If user is authenticated but not admin, redirect to home
      if (isAuthenticated && !isAdmin) {
        AuthLogger.warn('Non-admin user attempted to access admin area:', user?.email);
        router.push('/');
        return;
      }
      
      // Log successful admin access
      AuthLogger.info('Admin access granted to:', user?.email);
    };

    checkAdminStatus();
  }, [isAuthenticated, isAdmin, loading, router, user]);

  // Show loading state while checking
  if (loading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying admin privileges...</p>
        </div>
      </div>
    );
  }

  // If the user is an admin, render the children
  if (isAuthenticated && isAdmin) {
    return <>{children}</>;
  }

  // This should not be visible as the user should be redirected
  return null;
}; 