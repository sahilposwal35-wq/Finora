import { formatCurrency, cn } from '../lib/utils';

interface CurrencyDisplayProps {
  amount: number;
  type?: 'income' | 'expense' | 'neutral';
  showSign?: boolean;
  className?: string;
}

export function CurrencyDisplay({
  amount,
  type = 'neutral',
  showSign = false,
  className,
}: CurrencyDisplayProps) {
  const formatted = formatCurrency(Math.abs(amount));
  const prefix =
    showSign && amount > 0
      ? '+'
      : showSign && amount < 0
      ? '-'
      : amount < 0
      ? '-'
      : '';

  const color =
    type === 'income'
      ? 'text-[#2D6A4F]'
      : type === 'expense'
      ? 'text-[#E63946]'
      : '';

  return (
    <span className={cn('tabular-nums font-medium', color, className)}>
      {prefix}
      {formatted}
    </span>
  );
}
