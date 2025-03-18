import React from 'react';

interface PageTemplateProps {
  children: React.ReactNode;
  title?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  centered?: boolean;
}

export const PageTemplate: React.FC<PageTemplateProps> = ({
  children,
  title,
  header,
  footer,
  className = '',
  maxWidth = 'xl',
  centered = false,
}) => {
  const maxWidthClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    'full': 'max-w-full',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {header || (
        <header className="bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4">
            {title && <h1 className="text-2xl font-bold text-gray-800">{title}</h1>}
          </div>
        </header>
      )}

      <main className="flex-grow flex flex-col">
        <div 
          className={`
            container mx-auto px-4 py-6 
            ${centered ? 'flex flex-col items-center justify-center flex-grow' : ''}
            ${maxWidthClasses[maxWidth]} ${className}
          `}
        >
          {children}
        </div>
      </main>

      {footer || (
        <footer className="bg-white border-t border-gray-200">
          <div className="container mx-auto px-4 py-4 text-center text-sm text-gray-600">
            © {new Date().getFullYear()} Gulpin AI Candidate Scoring
          </div>
        </footer>
      )}
    </div>
  );
};
