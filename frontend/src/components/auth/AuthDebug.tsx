'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../app/components/AuthProvider';
import { AuthLogger } from '../../utils/logging';

/**
 * AuthDebug component
 * 
 * A development-only component to display authentication debugging information
 * and provide tools to interact with the auth state
 */
export const AuthDebug = () => {
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [cookies, setCookies] = useState<Record<string, string>>({});
  
  // Only show in development mode
  const isDev = process.env.NODE_ENV === 'development';
  
  useEffect(() => {
    if (!isDev) return;
    
    const checkTokens = () => {
      // Get tokens from localStorage
      const accessTokenValue = localStorage.getItem('access_token');
      const refreshTokenValue = localStorage.getItem('refresh_token');
      
      // Parse cookies
      const cookiesObj: Record<string, string> = {};
      document.cookie.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name) cookiesObj[name] = value || '';
      });
      
      setAccessToken(accessTokenValue);
      setRefreshToken(refreshTokenValue);
      setCookies(cookiesObj);
    };
    
    // Check on mount and every 5 seconds
    checkTokens();
    const interval = setInterval(checkTokens, 5000);
    
    return () => clearInterval(interval);
  }, [isDev]);
  
  // Don't render in production or if hidden
  if (!isDev || (!isVisible && !process.env.NEXT_PUBLIC_DEBUG_AUTH)) {
    return null;
  }
  
  // Helper to display token summary
  const formatToken = (token: string | null) => {
    if (!token) return 'None';
    return `${token.substring(0, 15)}...`;
  };
  
  // Log all auth info to console
  const logAuthState = () => {
    AuthLogger.logAuthState();
  };
  
  return (
    <div className="fixed bottom-0 right-0 bg-gray-900 text-white p-4 rounded-tl-lg shadow-lg z-50 max-w-md opacity-90 text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-sm">Auth Debug</h3>
        <button 
          onClick={() => setIsVisible(false)}
          className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
        >
          Hide
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>Status:</div>
        <div className="font-mono">
          {loading ? '🔄' : isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated'}
        </div>
        
        <div>Admin:</div>
        <div className="font-mono">{isAdmin ? '✅ Yes' : '❌ No'}</div>
        
        <div>Access Token:</div>
        <div className="font-mono">{formatToken(accessToken)}</div>
        
        <div>Refresh Token:</div>
        <div className="font-mono">{formatToken(refreshToken)}</div>
        
        <div>User ID:</div>
        <div className="font-mono">{user?.id || 'None'}</div>
      </div>
      
      <div className="mt-3 border-t border-gray-700 pt-2">
        <div className="font-bold mb-1">Cookies:</div>
        <div className="max-h-24 overflow-y-auto font-mono">
          {Object.keys(cookies).length === 0 ? (
            <span className="text-gray-400">No cookies found</span>
          ) : (
            Object.entries(cookies).map(([name, value]) => (
              <div key={name} className="mb-1">
                <span className="text-green-400">{name}</span>: {value.substring(0, 15)}...
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-3 border-t border-gray-700 pt-2 flex justify-between">
        <button 
          onClick={logAuthState}
          className="bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded text-xs"
        >
          Log details to console
        </button>
        
        <button
          onClick={() => {
            // Force refresh token sync between localStorage and cookies
            const token = localStorage.getItem('access_token');
            if (token) {
              document.cookie = `access_token=${token}; path=/; max-age=86400`;
              alert('Token synchronized!');
              window.location.reload();
            } else {
              alert('No token in localStorage to sync');
            }
          }}
          className="bg-orange-700 hover:bg-orange-600 px-2 py-1 rounded text-xs"
        >
          Sync token to cookie
        </button>
      </div>
    </div>
  );
};

// Component that shows a button to toggle the debug panel
export const AuthDebugToggle = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <>
      {isVisible && <AuthDebug />}
      <button 
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-0 right-0 bg-gray-800 text-white p-2 rounded-tl-lg text-xs z-50"
      >
        {isVisible ? 'Hide Auth Debug' : 'Auth Debug'}
      </button>
    </>
  );
};

export default AuthDebugToggle; 