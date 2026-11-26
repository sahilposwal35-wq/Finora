import { cn } from '../lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  const dims = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-4',
  }[size];

  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <div
        className={cn(
          'border-[#1B4332] border-t-transparent rounded-full animate-spin',
          dims,
        )}
      />
    </div>
  );
}
