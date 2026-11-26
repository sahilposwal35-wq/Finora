import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { reports as reportsApi, insights as insightsApi, records as recordsApi } from '../lib/api';
import { formatCurrency, getCurrentMonth, cn } from '../lib/utils';
import type { MonthlyReport, SpendingInsight } from '../types';
import { MonthSelector } from '../components/MonthSelector';
import { StatCard } from '../components/StatCard';
import { InsightCard } from '../components/InsightCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export function ReportsPage() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [insightList, setInsightList] = useState<SpendingInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rep, ins] = await Promise.all([
        reportsApi.getMonthly(month),
        insightsApi.list(month),
      ]);
      setReport(rep);
      setInsightList(ins);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    try {
      const csv = await recordsApi.exportCSV(month);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finora-report-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const renderPctBadge = (pct: number, invert = false) => {
    const positive = invert ? pct <= 0 : pct >= 0;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full',
          positive ? 'bg-[#D8F3DC] text-[#2D6A4F]' : 'bg-[#FFE0E0] text-[#E63946]',
        )}
      >
        {pct >= 0 ? (
          <ArrowUpRight className="w-3 h-3" />
        ) : (
          <ArrowDownRight className="w-3 h-3" />
        )}
        {Math.abs(pct).toFixed(1)}% vs prev month
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">Reports & Insights</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monthly breakdown, budget variance, and personalized insights
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSelector month={month} onChange={setMonth} />
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : !report ? (
        <div className="card">
          <EmptyState
            icon={<BarChart3 className="w-6 h-6" />}
            title="No report data"
            description="Record transactions to generate monthly reports."
          />
        </div>
      ) : (
        <>
          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Income"
              value={formatCurrency(report.income)}
              variant="positive"
            >
              {report.previous_month_comparison &&
                renderPctBadge(report.previous_month_comparison.income_change_pct)}
            </StatCard>

            <StatCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Expenses"
              value={formatCurrency(report.expenses)}
              variant="negative"
            >
              {report.previous_month_comparison &&
                renderPctBadge(report.previous_month_comparison.expense_change_pct, true)}
            </StatCard>

            <StatCard
              icon={<BarChart3 className="w-5 h-5" />}
              label="Net Change"
              value={formatCurrency(report.net_change)}
              variant={report.net_change >= 0 ? 'positive' : 'negative'}
            >
              {report.previous_month_comparison &&
                renderPctBadge(report.previous_month_comparison.net_change_pct)}
            </StatCard>
          </div>

          {/* Insights */}
          {insightList.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1A1A2E]">Spending Insights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insightList.map((ins) => (
                  <InsightCard key={ins.id} insight={ins} />
                ))}
              </div>
            </div>
          )}

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E5E5]">
                <h3 className="text-base font-semibold text-[#1A1A2E]">Category Breakdown</h3>
              </div>
              {report.category_breakdown.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 text-center">No transactions this month.</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-5 py-2.5">Category</th>
                      <th className="px-5 py-2.5 text-right">Amount</th>
                      <th className="px-5 py-2.5 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {report.category_breakdown.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-5 py-3 font-medium text-[#1A1A2E]">{row.category}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-500 tabular-nums">
                          {row.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Budget Performance */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E5E5E5]">
                <h3 className="text-base font-semibold text-[#1A1A2E]">Budget Performance</h3>
              </div>
              {report.budget_performance.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 text-center">No budgets set this month.</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-5 py-2.5">Category</th>
                      <th className="px-5 py-2.5 text-right">Budget</th>
                      <th className="px-5 py-2.5 text-right">Actual</th>
                      <th className="px-5 py-2.5 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {report.budget_performance.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-5 py-3 font-medium text-[#1A1A2E]">{row.category}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatCurrency(row.budget)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatCurrency(row.actual)}
                        </td>
                        <td
                          className={cn(
                            'px-5 py-3 text-right font-medium tabular-nums',
                            row.variance >= 0 ? 'text-[#2D6A4F]' : 'text-[#E63946]',
                          )}
                        >
                          {row.variance >= 0 ? '+' : ''}
                          {formatCurrency(row.variance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
