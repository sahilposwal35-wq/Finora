// ─── Auth ────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  name: string;
  monthly_income: number | null;
  savings_target: number | null;
  budget_warning_threshold: number;
  currency: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserUpdate {
  name?: string;
  monthly_income?: number | null;
  savings_target?: number | null;
  budget_warning_threshold?: number;
  currency?: string;
}

// ─── Categories ──────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  is_system: boolean;
  user_id: number | null;
}

// ─── Financial Records ──────────────────────────────────────
export interface FinancialRecord {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  notes: string | null;
  date: string;
  category_id: number;
  category: Category;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedRecords {
  items: FinancialRecord[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface RecordCreate {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  notes?: string;
  date: string;
  category_id: number;
}

export interface RecordUpdate {
  type?: 'income' | 'expense';
  amount?: number;
  description?: string;
  notes?: string;
  date?: string;
  category_id?: number;
}

// ─── Budgets ─────────────────────────────────────────────────
export interface Budget {
  id: number;
  category_id: number;
  category: Category;
  amount: number;
  month: string; // YYYY-MM
  spent: number;
  remaining: number;
  utilization_pct: number;
  user_id: number;
}

export interface BudgetCreate {
  category_id: number;
  amount: number;
  month: string;
}

export interface BudgetUpdate {
  amount?: number;
}

export interface BudgetDriftWarning {
  category: string;
  category_id: number;
  budget_amount: number;
  spent: number;
  utilization_pct: number;
  expected_pct: number;
  drift_pct: number;
  message: string;
  severity: 'warning' | 'danger';
}

// ─── Recurring Expenses ─────────────────────────────────────
export interface RecurringExpense {
  id: number;
  title: string;
  amount: number;
  category_id: number;
  category: Category;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  is_active: boolean;
  reminder_days: number;
  user_id: number;
  created_at: string;
}

export interface RecurringCreate {
  title: string;
  amount: number;
  category_id: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date?: string | null;
  reminder_days?: number;
}

export interface RecurringUpdate {
  title?: string;
  amount?: number;
  category_id?: number;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date?: string;
  end_date?: string | null;
  is_active?: boolean;
  reminder_days?: number;
}

// ─── Goals ───────────────────────────────────────────────────
export interface FinancialGoal {
  id: number;
  title: string;
  target_amount: number;
  current_saved: number;
  target_date: string | null;
  progress_pct: number;
  monthly_contribution_needed: number | null;
  user_id: number;
  created_at: string;
}

export interface GoalCreate {
  title: string;
  target_amount: number;
  current_saved?: number;
  target_date?: string | null;
}

export interface GoalUpdate {
  title?: string;
  target_amount?: number;
  current_saved?: number;
  target_date?: string | null;
}

// ─── Dashboard ───────────────────────────────────────────────
export interface DashboardSummary {
  month: string;
  opening_balance: number;
  total_income: number;
  total_expenses: number;
  current_balance: number;
  budget_total: number;
  budget_used: number;
  budget_remaining: number;
  budget_utilization_pct: number;
  category_spending: Array<{ category: string; amount: number; percentage: number }>;
  monthly_trend: Array<{ month: string; income: number; expenses: number }>;
  income_vs_expenses: Array<{ label: string; income: number; expenses: number }>;
  budget_warnings: BudgetDriftWarning[];
  upcoming_recurring: Array<{
    title: string;
    amount: number;
    due_date: string;
    category: string;
    frequency: string;
  }>;
}

export interface SafeToSpendBreakdown {
  current_balance: number;
  upcoming_commitments: number;
  savings_target: number;
  available: number;
  days_remaining: number;
  daily_safe_to_spend: number;
  remaining_safe_to_spend: number;
  explanation: string;
  is_estimate: boolean;
}

// ─── What-If ─────────────────────────────────────────────────
export interface WhatIfAdjustment {
  type: 'budget_change' | 'expense_add' | 'expense_remove' | 'savings_change' | 'income_change';
  amount: number;
  category_id?: number;
  description?: string;
}

export interface WhatIfScenario {
  month: string;
  adjustments: WhatIfAdjustment[];
}

export interface WhatIfResult {
  original: {
    remaining_budget: number;
    safe_to_spend: number;
    savings_progress: number;
    projected_month_end: number;
  };
  simulated: {
    remaining_budget: number;
    safe_to_spend: number;
    savings_progress: number;
    projected_month_end: number;
  };
  adjustments_applied: WhatIfAdjustment[];
}

// ─── Reports ─────────────────────────────────────────────────
export interface MonthlyReport {
  month: string;
  income: number;
  expenses: number;
  net_change: number;
  category_breakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    type: 'income' | 'expense';
  }>;
  budget_performance: Array<{
    category: string;
    budget: number;
    actual: number;
    variance: number;
  }>;
  previous_month_comparison: {
    income_change_pct: number;
    expense_change_pct: number;
    net_change_pct: number;
  } | null;
}

export interface SpendingInsight {
  id: number;
  type: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  month: string;
  created_at: string;
}

// ─── CSV ─────────────────────────────────────────────────────
export interface CSVPreview {
  headers: string[];
  rows: Array<Record<string, string>>;
  total_rows: number;
  valid_rows: number;
  errors: string[];
}

export interface CSVImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ─── Filters ─────────────────────────────────────────────────
export interface RecordFilters {
  type?: 'income' | 'expense';
  category_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
