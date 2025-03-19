
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface PageTemplateProps {
  children: React.ReactNode;
  title?: string;
  centered?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  isAdmin?: boolean; // New prop to check if user is admin
}

export const PageTemplate: React.FC<PageTemplateProps> = ({
  children,
  title,
  centered = false,
  maxWidth = 'lg',
  isAdmin = false, // Default not admin
}) => {
  const router = useRouter();
  
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/">
                  <span className="font-bold text-xl text-blue-600">Gulpin</span>
                </Link>
              </div>
              
              {/* Navigation Links - only shown if admin */}
              {isAdmin && (
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link href="/campaigns">
                    <span className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      Campaigns
                    </span>
                  </Link>
                  <Link href="/users">
                    <span className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      Users
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-1 md:space-x-3">
            {breadcrumbs.map((breadcrumb, index) => (
              <li key={breadcrumb.href} className="flex items-center">
                {index > 0 && (
                  <span className="mx-2 text-gray-400">/</span>
                )}
                <Link href={breadcrumb.href}>
                  <span className={`text-sm font-medium ${
                    index === breadcrumbs.length - 1
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}>
                    {breadcrumb.label}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>

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