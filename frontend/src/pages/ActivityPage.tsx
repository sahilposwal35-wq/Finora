import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  Download,
  Upload,
  Pencil,
  Trash2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { records as recordsApi, categories as categoriesApi } from '../lib/api';
import { formatDate } from '../lib/utils';
import type {
  FinancialRecord,
  Category,
  RecordCreate,
  RecordFilters,
  CSVPreview,
} from '../types';
import { Modal } from '../components/Modal';
import { RecordForm } from '../components/RecordForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { CategoryBadge } from '../components/CategoryBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

export function ActivityPage() {
  const [items, setItems] = useState<FinancialRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryId, setCategoryId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinancialRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // CSV Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const [importing, setImporting] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const list = await categoriesApi.list();
      setCats(list);
    } catch {
      // ignore
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const filters: RecordFilters = {
        page,
        per_page: 15,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (typeFilter !== 'all') filters.type = typeFilter;
      if (categoryId) filters.category_id = Number(categoryId);
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo) filters.date_to = dateTo;
      if (search.trim()) filters.search = search.trim();

      const res = await recordsApi.list(filters);
      setItems(res.items);
      setTotal(res.total);
      setPages(res.pages || 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, typeFilter, categoryId, dateFrom, dateTo, search]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleSave = async (data: RecordCreate) => {
    setSubmitting(true);
    try {
      if (editing) {
        await recordsApi.update(editing.id, data);
        toast.success('Record updated');
      } else {
        await recordsApi.create(data);
        toast.success('Record added');
      }
      setFormOpen(false);
      setEditing(null);
      loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await recordsApi.delete(deleteTarget.id);
      toast.success('Record deleted');
      setDeleteTarget(null);
      loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    try {
      const csv = await recordsApi.exportCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finora-records-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported CSV');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const preview = await recordsApi.importPreview(file);
      setCsvFile(file);
      setCsvPreview(preview);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to preview CSV');
    }
  };

  const handleConfirmImport = async () => {
    if (!csvFile) return;
    setImporting(true);
    try {
      const res = await recordsApi.importCSV(csvFile);
      toast.success(`Imported ${res.imported} records (${res.skipped} skipped)`);
      setCsvPreview(null);
      setCsvFile(null);
      loadRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A2E]">Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track, filter, and manage your income & expenses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Record
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search description..."
            className="input-field pl-9"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as 'all' | 'income' | 'expense');
            setPage(1);
          }}
          className="input-field"
        >
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>

        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="input-field"
        >
          <option value="">All Categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="input-field"
          title="From date"
        />

        <div className="flex gap-2">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="input-field flex-1"
            title="To date"
          />
          <button
            onClick={() => {
              if (sortBy === 'date') {
                setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
              } else {
                setSortBy('date');
                setSortDir('desc');
              }
            }}
            className="btn-secondary px-2.5 shrink-0"
            title={`Sorted by ${sortBy} (${sortDir})`}
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Records List */}
      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ArrowUpDown className="w-6 h-6" />}
            title="No records found"
            description="Try adjusting your filters or add your first transaction."
            action={
              <button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="btn-primary"
              >
                Add Record
              </button>
            }
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E5E5] bg-gray-50/70 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5] text-sm">
                  {items.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                        {formatDate(rec.date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#1A1A2E]">{rec.description}</p>
                        {rec.notes && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{rec.notes}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <CategoryBadge name={rec.category?.name ?? 'Other'} type={rec.type} />
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <CurrencyDisplay
                          amount={rec.amount}
                          type={rec.type}
                          showSign
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditing(rec);
                            setFormOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1B4332] hover:bg-gray-100 cursor-pointer"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(rec)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#E63946] hover:bg-[#FFE0E0]/50 ml-1 cursor-pointer"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[#E5E5E5]">
              {items.map((rec) => (
                <div key={rec.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[#1A1A2E] truncate">
                      {rec.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{formatDate(rec.date)}</span>
                      <CategoryBadge name={rec.category?.name ?? 'Other'} type={rec.type} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CurrencyDisplay amount={rec.amount} type={rec.type} showSign />
                    <button
                      onClick={() => {
                        setEditing(rec);
                        setFormOpen(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-[#1B4332]"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(rec)}
                      className="p-1.5 text-gray-400 hover:text-[#E63946]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-[#E5E5E5] flex items-center justify-between text-sm text-gray-500">
              <span>
                Showing {items.length} of {total} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary p-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium">
                  Page {page} of {pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="btn-secondary p-1.5 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Record' : 'Add Record'}
      >
        <RecordForm
          categories={cats}
          initial={editing}
          onSubmit={handleSave}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          submitting={submitting}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Record"
        message={`Are you sure you want to delete "${deleteTarget?.description}"? This cannot be undone.`}
        loading={deleting}
      />

      {/* CSV Preview Modal */}
      <Modal
        open={!!csvPreview}
        onClose={() => {
          setCsvPreview(null);
          setCsvFile(null);
        }}
        title="Preview CSV Import"
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => {
                setCsvPreview(null);
                setCsvFile(null);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={importing || !csvPreview?.valid_rows}
              className="btn-primary"
            >
              {importing
                ? 'Importing...'
                : `Import ${csvPreview?.valid_rows ?? 0} Valid Rows`}
            </button>
          </>
        }
      >
        {csvPreview && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span>
                Total rows: <strong>{csvPreview.total_rows}</strong>
              </span>
              <span className="text-[#2D6A4F]">
                Valid: <strong>{csvPreview.valid_rows}</strong>
              </span>
            </div>

            {csvPreview.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-[#FFE0E0] text-[#E63946] text-xs space-y-1 max-h-28 overflow-y-auto">
                {csvPreview.errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}

            <div className="overflow-x-auto border border-[#E5E5E5] rounded-lg max-h-64">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-[#E5E5E5]">
                  <tr>
                    {csvPreview.headers.map((h) => (
                      <th key={h} className="px-3 py-2 font-medium text-gray-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {csvPreview.rows.slice(0, 10).map((row, idx) => (
                    <tr key={idx}>
                      {csvPreview.headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-gray-700">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
