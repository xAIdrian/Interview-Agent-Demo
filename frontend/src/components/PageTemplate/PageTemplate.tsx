import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../app/components/AuthProvider';
import { AuthLogger } from '../../utils/logging';
import Image from 'next/image';
interface PageTemplateProps {
  children: React.ReactNode;
  title?: string;
  centered?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}
import noorLogo from '../../../public/noor.png';

export const PageTemplate: React.FC<PageTemplateProps> = ({
  children,
  title,
  centered = false,
  maxWidth = 'full',
}) => {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Function to generate breadcrumbs from path
  const generateBreadcrumbs = () => {
    const pathWithoutQuery = router.asPath.split("?")[0];
    const pathArray = pathWithoutQuery.split("/").filter(path => path !== "");
    
    // Get the home route based on user role
    const homeRoute = isAdmin ? "/admin" : "/candidate";
    
    // If we're at the root path, return just the home breadcrumb
    if (pathArray.length === 0) {
      return [{ href: homeRoute, label: "Home" }];
    }
    
    const breadcrumbs = pathArray.map((path, index) => {
      const href = "/" + pathArray.slice(0, index + 1).join("/");
      return {
        href,
        label: path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ")
      };
    });
    
    return [{ href: homeRoute, label: "Home" }, ...breadcrumbs];
  };
  
  const breadcrumbs = generateBreadcrumbs();

  // Hide breadcrumbs on home, login, and register pages
  const showBreadcrumbs = !['/', '/login', '/registration'].includes(router.pathname);

  const onLogout = async () => {
    AuthLogger.info('User logging out from PageTemplate');
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link href={isAdmin ? "/admin" : "/candidate"} className="flex items-center">
                  <Image 
                    src={noorLogo} 
                    alt="Noor Logo" 
                    width={200} 
                    height={200} 
                    className="h-8 w-auto"
                  />
                </Link>
              </div>
              
              {/* Desktop Navigation Links */}
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                {isAuthenticated && !isAdmin && (
                  <Link href="/campaigns" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                    Positions
                  </Link>
                )}
              </div>
            </div>
            
            {/* Desktop Right Navigation Items */}
            <div className="hidden md:flex md:items-center md:space-x-4">
              {isAuthenticated ? (
                <>
                  <Link 
                    href="/profile" 
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={onLogout}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-gray-600 hover:text-gray-900">
                    Log in
                  </Link>
                  <Link href="/registration" className="text-blue-600 hover:text-blue-800">
                    Sign up
                  </Link>
                </>
              )}
            </div>
            
            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
                aria-controls="mobile-menu"
                aria-expanded="false"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <span className="sr-only">Open main menu</span>
                {/* Icon when menu is closed */}
                <svg
                  className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                {/* Icon when menu is open */}
                <svg
                  className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden`}
          id="mobile-menu"
        >
          <div className="pt-2 pb-3 space-y-1">
            {isAuthenticated && !isAdmin && (
              <Link href="/campaigns" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                Positions
              </Link>
            )}
            
            {isAuthenticated && isAdmin && (
              <>
                <Link href="/campaigns" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                  Campaigns
                </Link>
              </>
            )}
          </div>
          
          {/* Mobile Authentication Buttons */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            {isAuthenticated ? (
              <div className="mt-3 space-y-1">
                <div className="px-4 py-2 text-sm text-gray-500">
                  Signed in as <span className="font-medium text-gray-800">{user?.name}</span>
                </div>
                <Link href="/profile" className="block px-4 py-2 text-base font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800">
                  Your Profile
                </Link>
                <button
                  onClick={onLogout}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-1">
                <Link href="/login" className="block px-4 py-2 text-base font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800">
                  Log in
                </Link>
                <Link href="/registration" className="block px-4 py-2 text-base font-medium text-blue-600 hover:bg-gray-100 hover:text-blue-800">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Page title */}
      {title && (
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          </div>
        </header>
      )}

      {/* Page content */}
      <main className={`max-w-${maxWidth} mx-auto ${centered ? 'flex items-center justify-center' : ''}`}>
        {children}
      </main>
    </div>
  );
};
