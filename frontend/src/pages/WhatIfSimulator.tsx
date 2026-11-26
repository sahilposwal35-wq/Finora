import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RotateCcw, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { whatif, budgets as budgetsApi } from '../lib/api';
import { formatCurrency, cn } from '../lib/utils';
import type { Budget, Category, WhatIfAdjustment, WhatIfResult } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface WhatIfSimulatorProps {
  month: string;
  categories: Category[];
  budgets: Budget[];
  onApplied: () => void;
}

const ADJUSTMENT_LABELS: Record<WhatIfAdjustment['type'], string> = {
  budget_change: 'Change budget',
  expense_add: 'Add expense',
  expense_remove: 'Remove expense',
  savings_change: 'Change savings target',
  income_change: 'Change income',
};

export function WhatIfSimulator({
  month,
  categories,
  budgets,
  onApplied,
}: WhatIfSimulatorProps) {
  const [adjType, setAdjType] = useState<WhatIfAdjustment['type']>('budget_change');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id ?? 0);
  const [description, setDescription] = useState('');
  const [adjustments, setAdjustments] = useState<WhatIfAdjustment[]>([]);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const runSimulation = useCallback(
    async (list: WhatIfAdjustment[]) => {
      setLoading(true);
      try {
        const res = await whatif.simulate({ month, adjustments: list });
        setResult(res);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Simulation failed');
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    runSimulation(adjustments);
  }, [adjustments, runSimulation]);

  const needsCategory =
    adjType === 'budget_change' || adjType === 'expense_add' || adjType === 'expense_remove';

  const handleAdd = () => {
    const num = Number(amount);
    if (!num) {
      toast.error('Enter an amount');
      return;
    }
    const next: WhatIfAdjustment = {
      type: adjType,
      amount: num,
      category_id: needsCategory ? categoryId : undefined,
      description: description.trim() || ADJUSTMENT_LABELS[adjType],
    };
    setAdjustments((prev) => [...prev, next]);
    setAmount('');
    setDescription('');
  };

  const handleRemove = (idx: number) => {
    setAdjustments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleReset = () => {
    setAdjustments([]);
  };

  const handleApplyBudgets = async () => {
    const budgetChanges = adjustments.filter((a) => a.type === 'budget_change' && a.category_id);
    if (budgetChanges.length === 0) {
      toast.error('No budget changes to apply');
      return;
    }
    setApplying(true);
    try {
      for (const adj of budgetChanges) {
        const existing = budgets.find((b) => b.category_id === adj.category_id);
        if (existing) {
          await budgetsApi.update(existing.id, {
            amount: Math.max(0, existing.amount + adj.amount),
          });
        } else if (adj.category_id && adj.amount > 0) {
          await budgetsApi.create({
            category_id: adj.category_id,
            amount: adj.amount,
            month,
          });
        }
      }
      toast.success('Budget changes applied');
      onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply budget changes');
    } finally {
      setApplying(false);
    }
  };

  const renderDiffRow = (label: string, orig: number, sim: number) => {
    const diff = sim - orig;
    return (
      <div className="p-3 rounded-lg bg-gray-50 border border-[#E5E5E5] space-y-1">
        <span className="text-xs text-gray-500">{label}</span>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-gray-500 line-through">{formatCurrency(orig)}</span>
          <span className="text-base font-semibold text-[#1A1A2E]">{formatCurrency(sim)}</span>
        </div>
        {diff !== 0 && (
          <span
            className={cn(
              'text-xs font-medium inline-block',
              diff > 0 ? 'text-[#2D6A4F]' : 'text-[#E63946]',
            )}
          >
            {diff > 0 ? '+' : ''}
            {formatCurrency(diff)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Controls & Adjustments */}
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-[#E5E5E5] bg-gray-50/50 space-y-3">
          <h4 className="text-sm font-semibold text-[#1A1A2E]">Add Adjustment</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={adjType}
              onChange={(e) => setAdjType(e.target.value as WhatIfAdjustment['type'])}
              className="input-field"
            >
              {Object.entries(ADJUSTMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (₹, +/-)"
              className="input-field"
            />
          </div>

          {needsCategory && (
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="input-field"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="btn-primary flex items-center gap-1 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Pending Adjustments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#1A1A2E]">
              Pending Adjustments ({adjustments.length})
            </h4>
            {adjustments.length > 0 && (
              <button
                onClick={handleReset}
                className="text-xs text-gray-500 hover:text-[#1A1A2E] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          {adjustments.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center border border-dashed border-[#E5E5E5] rounded-lg">
              No adjustments added yet. Add one above to see the impact.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {adjustments.map((adj, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-[#E5E5E5] bg-white text-sm"
                >
                  <div>
                    <p className="font-medium text-[#1A1A2E]">{adj.description}</p>
                    <p className="text-xs text-gray-500">
                      {ADJUSTMENT_LABELS[adj.type]} • {formatCurrency(adj.amount)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(idx)}
                    className="p-1 text-gray-400 hover:text-[#E63946] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Simulation Result */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-[#1A1A2E]">Simulated Impact</h4>

        {loading && !result ? (
          <LoadingSpinner />
        ) : result ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {renderDiffRow(
              'Remaining Budget',
              result.original.remaining_budget,
              result.simulated.remaining_budget,
            )}
            {renderDiffRow(
              'Safe-to-Spend',
              result.original.safe_to_spend,
              result.simulated.safe_to_spend,
            )}
            {renderDiffRow(
              'Savings Progress',
              result.original.savings_progress,
              result.simulated.savings_progress,
            )}
            {renderDiffRow(
              'Projected Month-End',
              result.original.projected_month_end,
              result.simulated.projected_month_end,
            )}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleApplyBudgets}
            disabled={
              applying || !adjustments.some((a) => a.type === 'budget_change')
            }
            className="btn-primary flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {applying ? 'Applying...' : 'Apply Budget Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
