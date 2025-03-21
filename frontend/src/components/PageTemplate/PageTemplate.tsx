import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface PageTemplateProps {
  children: React.ReactNode;
  title?: string;
  centered?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const PageTemplate: React.FC<PageTemplateProps> = ({
  children,
  title,
  centered = false,
  maxWidth = 'lg',
}) => {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Check authentication status on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userIsAdmin = localStorage.getItem('isAdmin') === 'true';
    const name = localStorage.getItem('userName');
    
    setIsLoggedIn(!!token);
    setIsAdmin(userIsAdmin);
    if (name) setUserName(name);
  }, []);
  
  // Function to handle logout
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('isAdmin');
    setIsLoggedIn(false);
    setIsAdmin(false);
    setUserName('');
    router.push('/login');
  };
  
  // Function to generate breadcrumbs from path
  const generateBreadcrumbs = () => {
    const pathWithoutQuery = router.asPath.split("?")[0];
    const pathArray = pathWithoutQuery.split("/").filter(path => path !== "");
    
    const breadcrumbs = pathArray.map((path, index) => {
      const href = "/" + pathArray.slice(0, index + 1).join("/");
      return {
        href,
        label: path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ")
      };
    });
    
    return [{ href: "/", label: "Home" }, ...breadcrumbs];
  };
  
  const breadcrumbs = generateBreadcrumbs();

  // Hide breadcrumbs on home, login, and register pages
  const showBreadcrumbs = !['/', '/login', '/register'].includes(router.pathname);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link href="/" className="flex items-center">
                  <span className="font-bold text-xl text-blue-600">Gulpin</span>
                </Link>
              </div>
              
              {/* Desktop Navigation Links */}
              <div className="hidden md:ml-6 md:flex md:space-x-8">
                {isLoggedIn && !isAdmin && (
                  <Link href="/candidate/positions" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                    Positions
                  </Link>
                )}
                
                {isLoggedIn && isAdmin && (
                  <>
                    <Link href="/admin/dashboard" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                      Dashboard
                    </Link>
                    <Link href="/campaigns" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                      Campaigns
                    </Link>
                    <Link href="/users" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700">
                      Users
                    </Link>
                  </>
                )}
              </div>
            </div>
            
            {/* Desktop Right Navigation Items */}
            <div className="hidden md:flex md:items-center md:space-x-3">
              {isLoggedIn ? (
                <div className="relative ml-3">
                  <div className="flex items-center space-x-3">
                    <Link href="/profile" className="text-sm font-medium text-gray-700 hover:text-gray-800">
                      {userName || 'Profile'}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none"
                  >
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
            {isLoggedIn && !isAdmin && (
              <Link href="/candidate/positions" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                Positions
              </Link>
            )}
            
            {isLoggedIn && isAdmin && (
              <>
                <Link href="/admin/dashboard" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                  Dashboard
                </Link>
                <Link href="/campaigns" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                  Campaigns
                </Link>
                <Link href="/users" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                  Users
                </Link>
              </>
            )}
          </div>
          
          {/* Mobile Authentication Buttons */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            {isLoggedIn ? (
              <div className="mt-3 space-y-1">
                <div className="px-4 py-2 text-sm text-gray-500">
                  Signed in as <span className="font-medium text-gray-800">{userName}</span>
                </div>
                <Link href="/profile" className="block px-4 py-2 text-base font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800">
                  Your Profile
                </Link>
                <button
                  onClick={handleLogout}
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
                <Link href="/register" className="block px-4 py-2 text-base font-medium text-blue-600 hover:bg-gray-100 hover:text-blue-800">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      {showBreadcrumbs && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-1 md:space-x-3">
              {breadcrumbs.map((breadcrumb, index) => (
                <li key={breadcrumb.href} className="flex items-center">
                  {index > 0 && (
                    <span className="mx-2 text-gray-400">/</span>
                  )}
                  <Link href={breadcrumb.href} className={`text-sm font-medium ${
                    index === breadcrumbs.length - 1
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}>
                    {breadcrumb.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6`}>
        {title && <h1 className="text-3xl font-bold mb-6">{title}</h1>}
        <div className={`${centered ? 'flex justify-center items-center' : ''}`}>
          <div className={`${maxWidth !== 'full' ? `max-w-${maxWidth}` : 'w-full'} ${centered ? 'w-full' : ''}`}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};