import React from 'react';
import { CloseIcon } from '../CloseIcon';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href: string;
  active?: boolean;
}

interface SidebarProps {
  collapsed: boolean;
  toggleCollapse: () => void;
  items?: SidebarItem[];
  activeItemId?: string;
  onItemClick?: (item: SidebarItem) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  toggleCollapse,
  items = [],
  activeItemId,
  onItemClick,
}) => {
  // Default navigation items if none provided
  const defaultItems: SidebarItem[] = items.length > 0 ? items : [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard', active: true },
    { id: 'candidates', label: 'Candidates', href: '/candidates' },
    { id: 'assessments', label: 'Assessments', href: '/assessments' },
    { id: 'settings', label: 'Settings', href: '/settings' },
  ];

  const handleItemClick = (item: SidebarItem) => {
    if (onItemClick) {
      onItemClick(item);
    }
  };

  return (
    <div 
      className={`
        bg-gray-800 text-white transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      <div className="flex items-center justify-between h-16 px-4">
        {!collapsed && (
          <h1 className="font-bold text-xl">Noor</h1>
        )}
        <button 
          onClick={toggleCollapse}
          className="p-2 rounded-md hover:bg-gray-700 focus:outline-none"
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          ) : (
            <CloseIcon />
          )}
        </button>
      </div>

      <nav className="mt-4">
        <ul>
          {defaultItems.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                className={`
                  flex items-center px-4 py-3 text-sm
                  ${(activeItemId === item.id || item.active) ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700'}
                  transition-colors duration-200
                `}
                onClick={() => handleItemClick(item)}
              >
                {item.icon && (
                  <span className="mr-3">{item.icon}</span>
                )}
                {!collapsed && (
                  <span>{item.label}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
