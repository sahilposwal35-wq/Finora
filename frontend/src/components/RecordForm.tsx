import React, { useState, useEffect } from 'react';
import type { Category, FinancialRecord, RecordCreate } from '../types';
import { cn } from '../lib/utils';

interface RecordFormProps {
  categories: Category[];
  initial?: FinancialRecord | null;
  onSubmit: (data: RecordCreate) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export function RecordForm({
  categories,
  initial,
  onSubmit,
  onCancel,
  submitting = false,
}: RecordFormProps) {
  const [type, setType] = useState<'income' | 'expense'>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState<number>(initial?.category_id ?? 0);
  const [date, setDate] = useState(
    initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState(initial?.description ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');

  const filteredCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (
      filteredCategories.length > 0 &&
      !filteredCategories.some((c) => c.id === categoryId)
    ) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [type, filteredCategories, categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a description.');
      return;
    }

    await onSubmit({
      type,
      amount: numAmount,
      category_id: categoryId,
      date,
      description: description.trim(),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-[#FFE0E0] text-[#E63946] text-sm">{error}</div>
      )}

      {/* Type Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'py-2 rounded-md text-sm font-medium capitalize transition-colors cursor-pointer',
                type === t
                  ? t === 'income'
                    ? 'bg-[#2D6A4F] text-white'
                    : 'bg-[#E63946] text-white'
                  : 'text-gray-600 hover:text-[#1A1A2E]',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            ₹
          </span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="input-field pl-7"
            required
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          className="input-field"
          required
        >
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input-field"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Grocery shopping at BigBasket"
          className="input-field"
          required
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any extra details..."
          className="input-field resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : initial ? 'Update Record' : 'Add Record'}
        </button>
      </div>
    </form>
  );
}
