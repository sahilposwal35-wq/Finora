import React from 'react';
import { cn } from '../lib/utils';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  trend?: string;
  variant?: 'default' | 'positive' | 'negative';
  children?: React.ReactNode;
}

export function StatCard({
  icon,
  label,
  value,
  trend,
  variant = 'default',
  children,
}: StatCardProps) {
  const iconBg =
    variant === 'positive'
      ? 'bg-[#D8F3DC] text-[#2D6A4F]'
      : variant === 'negative'
      ? 'bg-[#FFE0E0] text-[#E63946]'
      : 'bg-gray-100 text-[#1B4332]';

  const valueColor =
    variant === 'positive'
      ? 'text-[#2D6A4F]'
      : variant === 'negative'
      ? 'text-[#E63946]'
      : 'text-[#1A1A2E]';

  return (
    <div className="card p-5 flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconBg)}>
          {icon}
        </div>
      </div>
      <div>
        <div className={cn('text-2xl font-semibold tracking-tight', valueColor)}>{value}</div>
        {trend && <p className="text-xs text-gray-500 mt-1">{trend}</p>}
      </div>
      {children}
    </div>
  );
}
