import { cn } from '../lib/utils';

interface ProgressBarProps {
  percentage: number;
  showLabel?: boolean;
  height?: 'sm' | 'md';
  className?: string;
}

export function ProgressBar({
  percentage,
  showLabel = true,
  height = 'md',
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percentage));

  const barColor =
    percentage >= 100
      ? 'bg-[#E63946]'
      : percentage >= 75
      ? 'bg-amber-500'
      : 'bg-[#2D6A4F]';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'flex-1 bg-gray-100 rounded-full overflow-hidden',
          height === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-gray-600 tabular-nums w-10 text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}
