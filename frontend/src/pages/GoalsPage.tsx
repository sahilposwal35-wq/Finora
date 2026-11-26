import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Target, Pencil, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { goals as goalsApi } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import type { FinancialGoal } from '../types';
import { ProgressBar } from '../components/ProgressBar';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export function GoalsPage() {
  const [items, setItems] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | null>(null);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentSaved, setCurrentSaved] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FinancialGoal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await goalsApi.list();
      setItems(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setTargetAmount('');
    setCurrentSaved('0');
    setTargetDate('');
    setFormOpen(true);
  };

  const openEdit = (g: FinancialGoal) => {
    setEditing(g);
    setTitle(g.title);
    setTargetAmount(String(g.target_amount));
    setCurrentSaved(String(g.current_saved));
    setTargetDate(g.target_date ? g.target_date.slice(0, 10) : '');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(targetAmount);
    const saved = Number(currentSaved) || 0;
    if (!title.trim() || !target || target <= 0) {
      toast.error('Please enter a valid title and target amount');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        target_amount: target,
        current_saved: saved,
        target_date: targetDate || null,
      };
      if (editing) {
        await goalsApi.update(editing.id, payload);
        toast.success('Goal updated');
      } else {
        await goalsApi.create(payload);
        toast.success('Goal created');
      }
      setFormOpen(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await goalsApi.delete(deleteTarget.id);
      toast.success('Goal deleted');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete goal');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">Financial Goals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track milestones and stay motivated toward your savings targets
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 self-start">
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Target className="w-6 h-6" />}
            title="No financial goals yet"
            description="Every big milestone starts with a single step. Set your first savings goal today!"
            action={
              <button onClick={openCreate} className="btn-primary">
                Create Your First Goal
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((g) => (
            <div key={g.id} className="card p-5 flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-[#1A1A2E]">{g.title}</h3>
                  {g.target_date && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Target: {formatDate(g.target_date)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(g)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-gray-100 cursor-pointer"
                    aria-label="Edit goal"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(g)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#E63946] hover:bg-[#FFE0E0]/50 cursor-pointer"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-[#1B4332]">
                    {formatCurrency(g.current_saved)}
                  </span>
                  <span className="text-gray-500">of {formatCurrency(g.target_amount)}</span>
                </div>
                <ProgressBar percentage={g.progress_pct} />
              </div>

              {g.monthly_contribution_needed != null && g.monthly_contribution_needed > 0 && (
                <div className="pt-2 border-t border-[#E5E5E5]">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#D8F3DC] text-[#2D6A4F]">
                    {formatCurrency(g.monthly_contribution_needed)} / month needed
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Goal' : 'Add Goal'}
        maxWidth="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Emergency Fund"
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Amount (₹)
              </label>
              <input
                type="number"
                min="1"
                step="100"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Saved (₹)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={currentSaved}
                onChange={(e) => setCurrentSaved(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="input-field"
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
              {saving ? 'Saving...' : editing ? 'Update Goal' : 'Create Goal'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Goal"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        loading={deleting}
      />
    </div>
  );
}
