import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart as PieChartIcon,
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { dashboard } from '../lib/api';
import { formatCurrency, formatDate, getCurrentMonth, cn } from '../lib/utils';
import type { DashboardSummary, SafeToSpendBreakdown } from '../types';
import { MonthSelector } from '../components/MonthSelector';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

const CHART_COLORS = [
  '#1B4332',
  '#2D6A4F',
  '#40916C',
  '#52B788',
  '#74C69D',
  '#E63946',
  '#F59E0B',
  '#6366F1',
];

export function DashboardPage() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [safeToSpend, setSafeToSpend] = useState<SafeToSpendBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sumRes, stsRes] = await Promise.all([
        dashboard.getSummary(month),
        dashboard.getSafeToSpend(month),
      ]);
      setSummary(sumRes);
      setSafeToSpend(stsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stsColor = !safeToSpend
    ? 'border-[#E5E5E5] bg-white'
    : safeToSpend.remaining_safe_to_spend <= 0
    ? 'border-[#E63946]/30 bg-[#FFE0E0]/40'
    : safeToSpend.daily_safe_to_spend < 500
    ? 'border-amber-300 bg-[#FEF3C7]/40'
    : 'border-[#2D6A4F]/30 bg-[#D8F3DC]/40';

  const stsTextColor = !safeToSpend
    ? 'text-[#1A1A2E]'
    : safeToSpend.remaining_safe_to_spend <= 0
    ? 'text-[#E63946]'
    : safeToSpend.daily_safe_to_spend < 500
    ? 'text-amber-700'
    : 'text-[#1B4332]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your monthly financial snapshot</p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="card p-6 text-center text-[#E63946]">{error}</div>
      ) : (
        summary && (
          <>
            {/* Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Total Income"
                value={formatCurrency(summary.total_income)}
                variant="positive"
              />
              <StatCard
                icon={<TrendingDown className="w-5 h-5" />}
                label="Total Expenses"
                value={formatCurrency(summary.total_expenses)}
                variant="negative"
              />
              <StatCard
                icon={<Wallet className="w-5 h-5" />}
                label="Balance"
                value={formatCurrency(summary.current_balance)}
                variant={summary.current_balance >= 0 ? 'positive' : 'negative'}
                trend={`Opening: ${formatCurrency(summary.opening_balance)}`}
              />
              <StatCard
                icon={<PieChartIcon className="w-5 h-5" />}
                label="Budget Used"
                value={`${Math.round(summary.budget_utilization_pct)}%`}
                trend={`${formatCurrency(summary.budget_used)} of ${formatCurrency(summary.budget_total)}`}
              >
                <ProgressBar
                  percentage={summary.budget_utilization_pct}
                  showLabel={false}
                  height="sm"
                />
              </StatCard>
            </div>

            {/* Safe-to-Spend Card */}
            {safeToSpend && (
              <div className={cn('rounded-xl border p-6 transition-colors', stsColor)}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-white/80 text-[#1B4332]">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium text-gray-600">
                          Safe-to-Spend Daily Allowance
                        </h2>
                        {safeToSpend.is_estimate && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 text-gray-600">
                            Estimate
                          </span>
                        )}
                      </div>
                      <p className={cn('text-3xl font-bold tracking-tight mt-1', stsTextColor)}>
                        {formatCurrency(safeToSpend.daily_safe_to_spend)}
                        <span className="text-sm font-normal text-gray-600"> / day</span>
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatCurrency(safeToSpend.remaining_safe_to_spend)} remaining across{' '}
                        {safeToSpend.days_remaining} days left this month
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowBreakdown((v) => !v)}
                    className="btn-secondary bg-white/80 flex items-center gap-1.5 self-start sm:self-center"
                  >
                    <span>See breakdown</span>
                    {showBreakdown ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {showBreakdown && (
                  <div className="mt-4 pt-4 border-t border-black/10 grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Current Balance</span>
                      <p className="font-semibold text-[#1A1A2E]">
                        {formatCurrency(safeToSpend.current_balance)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Upcoming Commitments</span>
                      <p className="font-semibold text-[#E63946]">
                        -{formatCurrency(safeToSpend.upcoming_commitments)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Savings Target</span>
                      <p className="font-semibold text-[#1B4332]">
                        -{formatCurrency(safeToSpend.savings_target)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Available</span>
                      <p className="font-semibold text-[#1A1A2E]">
                        {formatCurrency(safeToSpend.available)}
                      </p>
                    </div>
                    {safeToSpend.explanation && (
                      <p className="sm:col-span-4 text-xs text-gray-600">
                        {safeToSpend.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Budget Warnings */}
            {summary.budget_warnings.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-[#1A1A2E]">Budget Warnings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {summary.budget_warnings.map((w) => (
                    <div
                      key={w.category_id}
                      className={cn(
                        'card p-4 border-l-4',
                        w.severity === 'danger' ? 'border-l-[#E63946]' : 'border-l-amber-500',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                          className={cn(
                            'w-5 h-5 shrink-0 mt-0.5',
                            w.severity === 'danger' ? 'text-[#E63946]' : 'text-amber-500',
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm text-[#1A1A2E]">
                              {w.category}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatCurrency(w.spent)} / {formatCurrency(w.budget_amount)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1 mb-2">{w.message}</p>
                          <ProgressBar percentage={w.utilization_pct} height="sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income vs Expenses */}
              <div className="card p-5">
                <h3 className="text-base font-semibold text-[#1A1A2E] mb-4">
                  Income vs Expenses
                </h3>
                {summary.income_vs_expenses.length === 0 ? (
                  <EmptyState
                    icon={<TrendingUp className="w-6 h-6" />}
                    title="No transaction data"
                    description="Add income or expense records to see this chart."
                  />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary.income_vs_expenses}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Legend />
                        <Bar dataKey="income" name="Income" fill="#2D6A4F" radius={[4, 4, 0, 0]} />
                        <Bar
                          dataKey="expenses"
                          name="Expenses"
                          fill="#E63946"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Spending by Category */}
              <div className="card p-5">
                <h3 className="text-base font-semibold text-[#1A1A2E] mb-4">
                  Spending by Category
                </h3>
                {summary.category_spending.length === 0 ? (
                  <EmptyState
                    icon={<PieChartIcon className="w-6 h-6" />}
                    title="No category spending"
                    description="Record expenses this month to visualize spending by category."
                  />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summary.category_spending}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {summary.category_spending.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={CHART_COLORS[idx % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Monthly Trend (Last 6 Months) */}
              <div className="card p-5 lg:col-span-2">
                <h3 className="text-base font-semibold text-[#1A1A2E] mb-4">
                  Monthly Trend (Last 6 Months)
                </h3>
                {summary.monthly_trend.length === 0 ? (
                  <EmptyState
                    icon={<TrendingUp className="w-6 h-6" />}
                    title="No trend data yet"
                    description="Trends will appear as you track multiple months."
                  />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={summary.monthly_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="income"
                          name="Income"
                          stroke="#2D6A4F"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="expenses"
                          name="Expenses"
                          stroke="#E63946"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Recurring */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[#1A1A2E]">
                  Upcoming Recurring Expenses
                </h3>
                <span className="text-xs text-gray-500">Next 30 days</span>
              </div>
              {summary.upcoming_recurring.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="w-6 h-6" />}
                  title="No upcoming recurring expenses"
                  description="You have no scheduled bills due in the next 30 days."
                />
              ) : (
                <div className="divide-y divide-[#E5E5E5]">
                  {summary.upcoming_recurring.slice(0, 5).map((item, idx) => (
                    <div
                      key={idx}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#1A1A2E]">{item.title}</p>
                        <p className="text-xs text-gray-500">
                          {item.category} • Due {formatDate(item.due_date)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[#E63946] tabular-nums">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
