import { ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface AlertProps {
  variant: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

const variantStyles = {
  success: {
    container: 'bg-green-50 border-green-400',
    icon: 'text-green-400',
    title: 'text-green-800',
    message: 'text-green-700',
    Icon: CheckCircleIcon,
  },
  error: {
    container: 'bg-red-50 border-red-400',
    icon: 'text-red-400',
    title: 'text-red-800',
    message: 'text-red-700',
    Icon: ExclamationTriangleIcon,
  },
  info: {
    container: 'bg-blue-50 border-blue-400',
    icon: 'text-blue-400',
    title: 'text-blue-800',
    message: 'text-blue-700',
    Icon: InformationCircleIcon,
  },
};

export function Alert({ variant, title, message }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div className={`rounded-md border p-4 ${styles.container}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <styles.Icon className={`h-5 w-5 ${styles.icon}`} aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className={`text-sm font-medium ${styles.title}`}>{title}</h3>
          <div className={`mt-2 text-sm ${styles.message}`}>
            <p>{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 
