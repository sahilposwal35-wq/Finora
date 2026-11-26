import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthLabel, shiftMonth } from '../lib/utils';

interface MonthSelectorProps {
  month: string; // YYYY-MM
  onChange: (month: string) => void;
}

export function MonthSelector({ month, onChange }: MonthSelectorProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-white border border-[#E5E5E5] rounded-lg px-2 py-1">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        className="p-1.5 rounded-md hover:bg-gray-100 text-[#1A1A2E] transition-colors cursor-pointer"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium text-[#1A1A2E] min-w-[130px] text-center select-none">
        {getMonthLabel(month)}
      </span>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        className="p-1.5 rounded-md hover:bg-gray-100 text-[#1A1A2E] transition-colors cursor-pointer"
        aria-label="Next month"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
