import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SpendingInsight } from '../types';
import { cn } from '../lib/utils';

interface InsightCardProps {
  insight: SpendingInsight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const config = {
    info: {
      icon: Info,
      bg: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-[#FEF3C7] border-amber-200',
      iconColor: 'text-amber-600',
    },
    success: {
      icon: CheckCircle2,
      bg: 'bg-[#D8F3DC] border-emerald-200',
      iconColor: 'text-[#2D6A4F]',
    },
  }[insight.type];

  const Icon = config.icon;

  return (
    <div className={cn('rounded-xl border p-4 flex items-start gap-3', config.bg)}>
      <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', config.iconColor)} />
      <div>
        <h4 className="text-sm font-semibold text-[#1A1A2E]">{insight.title}</h4>
        <p className="text-sm text-gray-700 mt-0.5">{insight.message}</p>
      </div>
    </div>
  );
}
