import React from 'react';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
}

const sizeClasses = {
  small: 'h-4 w-4',
  medium: 'h-6 w-6',
  large: 'h-8 w-8',
};

export function Spinner({ size = 'medium' }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-blue-600`}
      />
    </div>
  );
} 
