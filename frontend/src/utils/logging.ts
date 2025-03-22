/**
 * Simple logging utility for auth debugging
 * Only logs to console in development mode
 */

const isDev = process.env.NODE_ENV === 'development';

export const AuthLogger = {
  info: (message: string, ...data: any[]) => {
    if (isDev) {
      console.info(`[AUTH] ${message}`, ...data);
    }
  },
  
  error: (message: string, ...data: any[]) => {
    if (isDev) {
      console.error(`[AUTH ERROR] ${message}`, ...data);
    }
  },
  
  warn: (message: string, ...data: any[]) => {
    if (isDev) {
      console.warn(`[AUTH WARNING] ${message}`, ...data);
    }
  },
  
  debug: (message: string, ...data: any[]) => {
    if (isDev) {
      console.debug(`[AUTH DEBUG] ${message}`, ...data);
    }
  },
  
  /**
   * Log auth state (tokens, cookies)
   */
  logAuthState: () => {
    if (!isDev) return;
    
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    console.group('Current Auth State');
    console.log('Access Token:', accessToken ? `${accessToken.substring(0, 15)}...` : 'None');
    console.log('Refresh Token:', refreshToken ? `${refreshToken.substring(0, 15)}...` : 'None');
    console.log('Cookies:', document.cookie);
    console.groupEnd();
  }
};

export default AuthLogger; 