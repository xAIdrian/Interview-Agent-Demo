/**
 * Enhanced logging utility for auth debugging
 * Only logs to console in development mode
 */

const isDev = process.env.NODE_ENV === 'development';

// Helper to parse and decode a JWT token (without verification)
const decodeJWT = (token: string): any => {
  try {
    // Split the token and get the middle part (payload)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return { error: 'Invalid token format' };
  }
};

// Helper to get all cookies as an object
const getCookiesAsObject = (): Record<string, string> => {
  const cookies: Record<string, string> = {};
  document.cookie.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name) cookies[name] = value || '';
  });
  return cookies;
};

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
   * Log detailed auth state (tokens, cookies, expiration)
   */
  logAuthState: () => {
    if (!isDev) return;
    
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const user = localStorage.getItem('user');
    const cookies = getCookiesAsObject();
    
    console.group('🔐 Auth State');
    
    // Log localStorage state
    console.group('localStorage');
    console.log('Access Token:', accessToken ? `${accessToken.substring(0, 15)}...` : 'None');
    console.log('Refresh Token:', refreshToken ? `${refreshToken.substring(0, 15)}...` : 'None');
    console.log('User:', user ? JSON.parse(user) : 'None');
    console.log('User ID:', localStorage.getItem('userId'));
    console.log('User Name:', localStorage.getItem('userName'));
    console.log('Is Admin:', localStorage.getItem('isAdmin'));
    console.groupEnd();
    
    // Log cookies state
    console.group('Cookies');
    console.log('All cookies:', cookies);
    console.log('access_token:', cookies['access_token'] ? `${cookies['access_token'].substring(0, 15)}...` : 'None');
    console.log('refresh_token:', cookies['refresh_token'] ? `${cookies['refresh_token'].substring(0, 15)}...` : 'None');
    console.groupEnd();
    
    // Decode and log token information if available
    if (accessToken) {
      try {
        const decoded = decodeJWT(accessToken);
        console.group('Token Payload');
        console.log('User ID:', decoded.sub || decoded.id);
        console.log('Expiration:', new Date((decoded.exp || 0) * 1000).toLocaleString());
        console.log('Issued At:', new Date((decoded.iat || 0) * 1000).toLocaleString());
        console.log('Is Expired:', decoded.exp ? Date.now() >= decoded.exp * 1000 : 'Unknown');
        console.log('Full Payload:', decoded);
        console.groupEnd();
      } catch (e) {
        console.log('Could not decode token:', e);
      }
    }
    
    console.groupEnd();
  }
};

export default AuthLogger; 