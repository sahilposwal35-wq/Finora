import { clsx, type ClassValue } from 'clsx';

/** Combine class names (like clsx) */
export function cn(...classes: ClassValue[]): string {
  return clsx(...classes);
}

/** Format as ₹1,23,456.78 (Indian number system) */
export function formatCurrency(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const [intPart, decPart] = abs.toFixed(2).split('.');

  // Indian grouping: last 3 digits, then every 2 digits
  let result = '';
  const len = intPart.length;
  if (len <= 3) {
    result = intPart;
  } else {
    result = intPart.slice(len - 3);
    let remaining = intPart.slice(0, len - 3);
    while (remaining.length > 2) {
      result = remaining.slice(remaining.length - 2) + ',' + result;
      remaining = remaining.slice(0, remaining.length - 2);
    }
    if (remaining.length > 0) {
      result = remaining + ',' + result;
    }
  }

  return `${isNegative ? '-' : ''}₹${result}.${decPart}`;
}

/** Format date to "25 Nov 2026" */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Returns YYYY-MM from a Date */
export function getMonthStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns current month as YYYY-MM */
export function getCurrentMonth(): string {
  return getMonthStr(new Date());
}

/** Get display label for a month string like "November 2026" */
export function getMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Navigate month string forward or backward */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta);
  return getMonthStr(d);
}
