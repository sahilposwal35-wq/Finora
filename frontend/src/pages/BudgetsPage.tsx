import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  PieChart as PieChartIcon,
  AlertTriangle,
  Pencil,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { budgets as budgetsApi, categories as categoriesApi } from '../lib/api';
import { formatCurrency, getCurrentMonth, cn } from '../lib/utils';
import type { Budget, BudgetDriftWarning, Category } from '../types';
import { MonthSelector } from '../components/MonthSelector';
import { ProgressBar } from '../components/ProgressBar';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { WhatIfSimulator } from './WhatIfSimulator';

export function BudgetsPage() {
  const [month, setMonth] = useState(getCurrentMonth);
  const [items, setItems] = useState<Budget[]>([]);
  const [drifts, setDrifts] = useState<BudgetDriftWarning[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState(false);

  // What-If Simulator
  const [simOpen, setSimOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bList, dList, cList] = await Promise.all([
        budgetsApi.list(month),
        budgetsApi.getDrift(month),
        categoriesApi.list('expense'),
      ]);
      setItems(bList);
      setDrifts(dList);
      setCats(cList);
      if (cList.length > 0 && categoryId === 0) {
        setCategoryId(cList[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, [month, categoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    const unused = cats.find((c) => !items.some((b) => b.category_id === c.id));
    setCategoryId(unused?.id ?? cats[0]?.id ?? 0);
    setAmount('');
    setFormOpen(true);
  };

  const openEdit = (b: Budget) => {
    setEditing(b);
    setCategoryId(b.category_id);
    setAmount(String(b.amount));
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      toast.error('Please enter a valid positive budget amount');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await budgetsApi.update(editing.id, { amount: num });
        toast.success('Budget updated');
      } else {
        await budgetsApi.create({ category_id: categoryId, amount: num, month });
        toast.success('Budget created');
      }
      setFormOpen(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await budgetsApi.delete(deleteTarget.id);
      toast.success('Budget deleted');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete budget');
    } finally {
      setDeleting(false);
    }
  };

  const driftMap = new Map(drifts.map((d) => [d.category_id, d]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">Budgets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Set category limits and monitor spending pace
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSelector month={month} onChange={setMonth} />
          <button
            onClick={() => setSimOpen(true)}
            className="btn-secondary flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-4 h-4" />
            What-If Simulator
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add Budget
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Budgets Grid */}
          {items.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<PieChartIcon className="w-6 h-6" />}
                title="No budgets for this month"
                description="Create category budgets to keep your spending on track."
                action={
                  <button onClick={openCreate} className="btn-primary">
                    Add Budget
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((b) => {
                const drift = driftMap.get(b.category_id);
                return (
                  <div key={b.id} className="card p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-[#1A1A2E]">
                          {b.category?.name ?? 'Category'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Budget: {formatCurrency(b.amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {drift && (
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                              drift.severity === 'danger'
                                ? 'bg-[#FFE0E0] text-[#E63946]'
                                : 'bg-[#FEF3C7] text-amber-700',
                            )}
                            title={drift.message}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Drift
                          </span>
                        )}
                        <button
                          onClick={() => openEdit(b)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-gray-100 cursor-pointer"
                          aria-label="Edit budget"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#E63946] hover:bg-[#FFE0E0]/50 cursor-pointer"
                          aria-label="Delete budget"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <ProgressBar percentage={b.utilization_pct} />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          Spent: <strong className="text-[#1A1A2E]">{formatCurrency(b.spent)}</strong>
                        </span>
                        <span
                          className={cn(
                            'font-medium',
                            b.remaining >= 0 ? 'text-[#2D6A4F]' : 'text-[#E63946]',
                          )}
                        >
                          {b.remaining >= 0
                            ? `${formatCurrency(b.remaining)} left`
                            : `${formatCurrency(Math.abs(b.remaining))} over`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Budget Drift Section */}
          {drifts.length > 0 && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-semibold text-[#1A1A2E]">
                  Budget Drift Warnings
                </h2>
              </div>
              <div className="divide-y divide-[#E5E5E5]">
                {drifts.map((d) => (
                  <div key={d.category_id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E]">{d.category}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{d.message}</p>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full shrink-0',
                        d.severity === 'danger'
                          ? 'bg-[#FFE0E0] text-[#E63946]'
                          : 'bg-[#FEF3C7] text-amber-700',
                      )}
                    >
                      +{Math.round(d.drift_pct)}% pace
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Budget Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Budget' : 'Add Budget'}
        maxWidth="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              disabled={!!editing}
              className="input-field disabled:bg-gray-50"
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Limit (₹)
            </label>
            <input
              type="number"
              min="1"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10000"
              className="input-field"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update Budget' : 'Create Budget'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Budget"
        message={`Remove the budget for ${deleteTarget?.category?.name}?`}
        loading={deleting}
      />

      {/* What-If Simulator Modal */}
      <Modal
        open={simOpen}
        onClose={() => setSimOpen(false)}
        title="What-If Financial Simulator"
        maxWidth="xl"
      >
        <WhatIfSimulator
          month={month}
          categories={cats}
          budgets={items}
          onApplied={() => {
            setSimOpen(false);
            loadData();
          }}
        />
      </Modal>
    </div>
  );
}
