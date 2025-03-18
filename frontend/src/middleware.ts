import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of paths that don't require authentication
const publicPaths = ['/login', '/register', '/', '/api/login', '/api/register'];

export function middleware(request: NextRequest) {
  // Check if the path is public
  const path = request.nextUrl.pathname;
  if (publicPaths.some(pp => path.startsWith(pp))) {
    return NextResponse.next();
  }

  // For API routes, let the backend handle authentication
  if (path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check for access token in cookies
  const accessToken = request.cookies.get('access_token');
  
  // Check for user data in localStorage (client-side only)
  // Next.js middleware runs on the edge, so we need to check cookies instead
  if (!accessToken) {
    // Safely create the URL for redirection
    const baseUrl = request.nextUrl.origin || 'http://localhost:3000';
    const loginUrl = new URL('/login', baseUrl);
    
    // Add a redirect param to return to the current page after login
    loginUrl.searchParams.set('redirect', path);
    
    // Redirect to login if no access token is found
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
