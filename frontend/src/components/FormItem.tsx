import React from 'react';

interface FormItemProps {
  label: string;
  id: string;
  type?: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  [x: string]: any; // For any additional props
}

export const FormItem: React.FC<FormItemProps> = ({
  label,
  id,
  type = 'text',
  name,
  value,
  onChange,
  required = false,
  ...rest
}) => {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        required={required}
        {...rest}
      />
    </div>
  );
};
