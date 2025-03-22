import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of paths that don't require authentication
const publicPaths = [
  '/login', 
  '/register', 
  '/', 
  '/api/login', 
  '/api/register', 
  '/api/refresh',
  '/api/health',
  '/health'
];

// List of API paths that should be protected but handle their own auth
const apiPaths = ['/api/'];

// List of admin paths that require admin privileges
const adminPaths = ['/admin'];

// Helper to extract token from authorization header
const extractTokenFromHeader = (authHeader: string | null): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

// Helper to check if path is under a specific prefix
const isPathUnderPrefix = (path: string, prefix: string): boolean => {
  return path === prefix || path.startsWith(`${prefix}/`);
};

export function middleware(request: NextRequest) {
  // Get the path and store for use in responses
  const path = request.nextUrl.pathname;
  
  // Check if the path is public
  if (publicPaths.some(pp => path.startsWith(pp))) {
    return NextResponse.next();
  }

  // For API routes, let the backend handle authentication
  if (apiPaths.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for tokens in various locations
  const accessTokenCookie = request.cookies.get('access_token')?.value;
  const refreshTokenCookie = request.cookies.get('refresh_token')?.value;
  const rememberTokenCookie = request.cookies.get('remember_token')?.value;
  
  // Check for Authorization header
  const authHeader = request.headers.get('Authorization');
  const tokenFromHeader = extractTokenFromHeader(authHeader);
  
  // Check if path is an admin path
  const isAdminRoute = adminPaths.some(p => isPathUnderPrefix(path, p));
  
  // If we have any valid token form, proceed with basic auth check
  if (accessTokenCookie || refreshTokenCookie || rememberTokenCookie || tokenFromHeader) {
    // For admin routes, we need to check the is_admin flag in the token claim
    // This is handled by the AdminGuard component, so we proceed
    
    // Clone the request to add authorization header if not present but cookie exists
    if (!tokenFromHeader && accessTokenCookie) {
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${accessTokenCookie}`);
      
      // Create a new request with the modified headers
      const modifiedRequest = new Request(request.url, {
        method: request.method,
        headers: headers,
        body: request.body,
        cache: request.cache,
        credentials: request.credentials,
        integrity: request.integrity,
        keepalive: request.keepalive,
        mode: request.mode,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
      });
      
      // Pass the modified request through
      return NextResponse.next({
        request: modifiedRequest,
      });
    }
    
    return NextResponse.next();
  }
  
  // No valid authentication found, redirect to login
  const baseUrl = request.nextUrl.origin;
  const loginUrl = new URL('/login', baseUrl);
  
  // Add a redirect param to return to the current page after login
  loginUrl.searchParams.set('redirect', path);
  
  // Redirect to login if no access token is found
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.css|.*\\.js).*)'],
};
