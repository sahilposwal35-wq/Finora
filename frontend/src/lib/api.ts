import type {
  TokenResponse,
  User,
  UserUpdate,
  Category,
  FinancialRecord,
  PaginatedRecords,
  RecordCreate,
  RecordUpdate,
  Budget,
  BudgetCreate,
  BudgetUpdate,
  BudgetDriftWarning,
  RecurringExpense,
  RecurringCreate,
  RecurringUpdate,
  FinancialGoal,
  GoalCreate,
  GoalUpdate,
  DashboardSummary,
  SafeToSpendBreakdown,
  WhatIfScenario,
  WhatIfResult,
  MonthlyReport,
  SpendingInsight,
  CSVPreview,
  CSVImportResult,
  RecordFilters,
} from '../types';

const BASE = '/api';

// ─── Core fetch wrapper ──────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.message ?? `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return res.json();
  return (await res.text()) as unknown as T;
}

function get<T>(path: string) {
  return request<T>(path);
}
function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
function put<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
function patch<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

// ─── Query string helper ────────────────────────────────────
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ─── Auth ────────────────────────────────────────────────────
export const auth = {
  register: (data: { email: string; password: string; name: string }) =>
    post<User>('/auth/register', data),

  login: async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.set('username', email);
    form.set('password', password);
    return request<TokenResponse>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  },

  getProfile: () => get<User>('/auth/me'),
  updateProfile: (data: UserUpdate) => patch<User>('/auth/me', data),
};

// ─── Categories ──────────────────────────────────────────────
export const categories = {
  list: (type?: string) => get<Category[]>(`/categories${qs({ type })}`),
  create: (data: { name: string; type: string }) => post<Category>('/categories', data),
  update: (id: number, data: { name: string }) => put<Category>(`/categories/${id}`, data),
  delete: (id: number) => del<void>(`/categories/${id}`),
};

// ─── Records ─────────────────────────────────────────────────
export const records = {
  list: (filters: RecordFilters = {}) =>
    get<PaginatedRecords>(`/records${qs(filters as Record<string, unknown>)}`),

  create: (data: RecordCreate) => post<FinancialRecord>('/records', data),
  get: (id: number) => get<FinancialRecord>(`/records/${id}`),
  update: (id: number, data: RecordUpdate) => put<FinancialRecord>(`/records/${id}`, data),
  delete: (id: number) => del<void>(`/records/${id}`),

  monthlySum: (month: string) =>
    get<{ income: number; expenses: number }>(`/records/summary/monthly${qs({ month })}`),
  categorySum: (month: string) =>
    get<Array<{ category: string; amount: number }>>(`/records/summary/category${qs({ month })}`),

  exportCSV: (month?: string) =>
    request<string>(`/records/export/csv${qs({ month })}`, { method: 'GET' }),

  importPreview: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<CSVPreview>('/records/import/preview', { method: 'POST', body: fd });
  },

  importCSV: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<CSVImportResult>('/records/import', { method: 'POST', body: fd });
  },
};

// ─── Budgets ─────────────────────────────────────────────────
export const budgets = {
  list: (month: string) => get<Budget[]>(`/budgets${qs({ month })}`),
  create: (data: BudgetCreate) => post<Budget>('/budgets', data),
  update: (id: number, data: BudgetUpdate) => put<Budget>(`/budgets/${id}`, data),
  delete: (id: number) => del<void>(`/budgets/${id}`),
  getDrift: (month: string) =>
    get<BudgetDriftWarning[]>(`/budgets/drift${qs({ month })}`),
};

// ─── Recurring ───────────────────────────────────────────────
export const recurring = {
  list: () => get<RecurringExpense[]>('/recurring'),
  create: (data: RecurringCreate) => post<RecurringExpense>('/recurring', data),
  get: (id: number) => get<RecurringExpense>(`/recurring/${id}`),
  update: (id: number, data: RecurringUpdate) =>
    put<RecurringExpense>(`/recurring/${id}`, data),
  delete: (id: number) => del<void>(`/recurring/${id}`),
  getUpcoming: (days: number = 30) =>
    get<Array<{ title: string; amount: number; due_date: string; category: string; frequency: string }>>(
      `/recurring/upcoming${qs({ days })}`,
    ),
};

// ─── Goals ───────────────────────────────────────────────────
export const goals = {
  list: () => get<FinancialGoal[]>('/goals'),
  create: (data: GoalCreate) => post<FinancialGoal>('/goals', data),
  get: (id: number) => get<FinancialGoal>(`/goals/${id}`),
  update: (id: number, data: GoalUpdate) => put<FinancialGoal>(`/goals/${id}`, data),
  delete: (id: number) => del<void>(`/goals/${id}`),
};

// ─── Dashboard ───────────────────────────────────────────────
export const dashboard = {
  getSummary: (month: string) =>
    get<DashboardSummary>(`/dashboard/summary${qs({ month })}`),
  getSafeToSpend: (month: string) =>
    get<SafeToSpendBreakdown>(`/dashboard/safe-to-spend${qs({ month })}`),
};

// ─── What-If ─────────────────────────────────────────────────
export const whatif = {
  simulate: (scenario: WhatIfScenario) =>
    post<WhatIfResult>('/whatif/simulate', scenario),
};

// ─── Reports ─────────────────────────────────────────────────
export const reports = {
  getMonthly: (month: string) =>
    get<MonthlyReport>(`/reports/monthly${qs({ month })}`),
};

// ─── Insights ────────────────────────────────────────────────
export const insights = {
  list: (month?: string) =>
    get<SpendingInsight[]>(`/insights${qs({ month })}`),
};
