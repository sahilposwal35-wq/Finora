import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Repeat,
  Calendar,
  Pencil,
  Trash2,
  Pause,
  Play,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { recurring as recurringApi, categories as categoriesApi } from '../lib/api';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import type { RecurringExpense, Category } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CategoryBadge } from '../components/CategoryBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export function RecurringPage() {
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [upcoming, setUpcoming] = useState<
    Array<{ title: string; amount: number; due_date: string; category: string; frequency: string }>
  >([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [reminderDays, setReminderDays] = useState('3');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RecurringExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, up, cList] = await Promise.all([
        recurringApi.list(),
        recurringApi.getUpcoming(30),
        categoriesApi.list('expense'),
      ]);
      setItems(list);
      setUpcoming(up);
      setCats(cList);
      if (cList.length > 0 && categoryId === 0) {
        setCategoryId(cList[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load recurring expenses');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setAmount('');
    setCategoryId(cats[0]?.id ?? 0);
    setFrequency('monthly');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setReminderDays('3');
    setFormOpen(true);
  };

  const openEdit = (item: RecurringExpense) => {
    setEditing(item);
    setTitle(item.title);
    setAmount(String(item.amount));
    setCategoryId(item.category_id);
    setFrequency(item.frequency);
    setStartDate(item.start_date.slice(0, 10));
    setEndDate(item.end_date ? item.end_date.slice(0, 10) : '');
    setReminderDays(String(item.reminder_days));
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!title.trim() || !num || num <= 0) {
      toast.error('Please enter a valid title and positive amount');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        amount: num,
        category_id: categoryId,
        frequency,
        start_date: startDate,
        end_date: endDate || null,
        reminder_days: Number(reminderDays) || 3,
      };
      if (editing) {
        await recurringApi.update(editing.id, payload);
        toast.success('Recurring expense updated');
      } else {
        await recurringApi.create(payload);
        toast.success('Recurring expense added');
      }
      setFormOpen(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: RecurringExpense) => {
    try {
      await recurringApi.update(item.id, { is_active: !item.is_active });
      toast.success(item.is_active ? 'Paused' : 'Resumed');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await recurringApi.delete(deleteTarget.id);
      toast.success('Recurring expense deleted');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">Recurring Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage subscriptions, rent, and scheduled bills
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 self-start">
          <Plus className="w-4 h-4" />
          Add Recurring
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main List */}
          <div className="lg:col-span-2 card overflow-hidden">
            {items.length === 0 ? (
              <EmptyState
                icon={<Repeat className="w-6 h-6" />}
                title="No recurring expenses"
                description="Add subscriptions or monthly bills to track upcoming commitments."
                action={
                  <button onClick={openCreate} className="btn-primary">
                    Add Recurring Expense
                  </button>
                }
              />
            ) : (
              <div className="divide-y divide-[#E5E5E5]">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'p-4 sm:p-5 flex items-center justify-between gap-4',
                      !item.is_active && 'opacity-60 bg-gray-50/60',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[#1A1A2E] truncate">{item.title}</h3>
                        <CategoryBadge name={item.category?.name ?? 'Other'} type="expense" />
                        {!item.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                            Paused
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 capitalize">
                        {item.frequency} • Next due {formatDate(item.next_due_date)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-[#E63946] tabular-nums">
                        {formatCurrency(item.amount)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-gray-100 cursor-pointer"
                          title={item.is_active ? 'Pause' : 'Resume'}
                        >
                          {item.is_active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-gray-100 cursor-pointer"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#E63946] hover:bg-[#FFE0E0]/50 cursor-pointer"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming 30-day Timeline */}
          <div className="card p-5 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-[#1B4332]" />
              <h2 className="text-base font-semibold text-[#1A1A2E]">Upcoming 30 Days</h2>
            </div>

            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No bills due in the next 30 days.
              </p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((u, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5E5E5] last:border-none last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E]">{u.title}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(u.due_date)} • {u.category}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#1A1A2E] tabular-nums">
                      {formatCurrency(u.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Recurring Expense' : 'Add Recurring Expense'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Apartment Rent"
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="input-field"
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')
                }
                className="input-field"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reminder (days before)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
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
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Recurring'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Recurring Expense"
        message={`Delete "${deleteTarget?.title}"?`}
        loading={deleting}
      />
    </div>
  );
}
