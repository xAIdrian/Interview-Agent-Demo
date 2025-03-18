import React from 'react';

interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  fullWidth = false,
  size = 'medium',
}) => {
  const sizeClasses = {
    small: 'px-3 py-1 text-sm',
    medium: 'px-4 py-2',
    large: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-transparent border border-gray-300 text-gray-700 font-medium rounded-md 
        hover:bg-gray-100 transition duration-200 ease-in-out focus:outline-none 
        focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${fullWidth ? 'w-full' : ''}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </button>
  );
};
