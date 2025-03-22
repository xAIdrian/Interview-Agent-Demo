import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of paths that don't require authentication
const publicPaths = [
  '/login', 
  '/register', 
  '/', 
  '/api/login', 
  '/api/register', 
  '/api/refresh'
];

// List of API paths that should be protected but handle their own auth
const apiPaths = ['/api/'];

export function middleware(request: NextRequest) {
  // Check if the path is public
  const path = request.nextUrl.pathname;
  if (publicPaths.some(pp => path.startsWith(pp))) {
    return NextResponse.next();
  }

  // For API routes, let the backend handle authentication
  if (apiPaths.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for access token in cookies
  const accessToken = request.cookies.get('access_token');
  const rememberToken = request.cookies.get('remember_token');
  
  // Check for Authorization header (for client-side requests)
  const authHeader = request.headers.get('Authorization');
  const tokenFromHeader = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
  
  // If we have any valid token form, proceed
  if (accessToken?.value || rememberToken?.value || tokenFromHeader) {
    return NextResponse.next();
  }
  
  // No valid authentication found, redirect to login
  const baseUrl = request.nextUrl.origin || 'http://localhost:3000';
  const loginUrl = new URL('/login', baseUrl);
  
  // Add a redirect param to return to the current page after login
  loginUrl.searchParams.set('redirect', path);
  
  // Redirect to login if no access token is found
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
