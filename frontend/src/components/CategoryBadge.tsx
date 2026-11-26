import { cn } from '../lib/utils';

interface CategoryBadgeProps {
  name: string;
  type?: 'income' | 'expense';
  className?: string;
}

export function CategoryBadge({ name, type, className }: CategoryBadgeProps) {
  const style =
    type === 'income'
      ? 'bg-[#D8F3DC] text-[#2D6A4F]'
      : type === 'expense'
      ? 'bg-gray-100 text-[#1A1A2E]'
      : 'bg-gray-100 text-[#1A1A2E]';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        style,
        className,
      )}
    >
      {name}
    </span>
  );
}
