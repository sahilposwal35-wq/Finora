# Finora

**Know your money. Shape your future.**

Finora is a personal finance management and budgeting intelligence web application designed for students and young professionals. Beyond simple expense tracking, it provides an explainable **Safe-to-Spend** calculator, **Budget Drift Detection**, **Recurring Expense Planning**, a **What-If Budget Simulator**, **Deterministic Spending Insights**, **Financial Goals**, and **Monthly Financial Reviews**.

---

## Key Features

- **Authentication & User Isolation:** JWT-based authentication with bcrypt password hashing, protected API routes, and strict user-level ownership checks on every resource.
- **Financial Record Management:** Full CRUD for income and expenses, search, category/type/date-range filters, sorting, pagination, CSV import with validation/preview and SHA-256 duplicate fingerprinting, and CSV export.
- **Dashboard (Overview):** Period selector, opening balance, total income, total expenses, current balance, budget utilization, Safe-to-Spend card, budget drift warnings, upcoming recurring commitments, and Recharts visualizations (Income vs. Expenses, Spending by Category, 6-Month Trend).
- **Safe-to-Spend Calculator:** Computes daily and remaining-month spending allowance from current balance, upcoming unrecorded recurring commitments, monthly savings target, and remaining days in the period, with a transparent step-by-step breakdown.
- **Budget Drift Detection:** Tracks category spending utilization against elapsed days in the month and flags categories spending faster than expected, with projected month-end totals.
- **Recurring Expense Planner:** Manages weekly, biweekly, monthly, quarterly, and yearly commitments (handling month-end dates such as 29th/30th/31st and February) with a 30-day upcoming timeline and active/paused toggles without silently creating duplicate actual expenses.
- **What-If Budget Simulator:** Models hypothetical budget, expense, income, and savings changes side-by-side against actuals without mutating database records, with optional explicit apply for budget changes.
- **Deterministic Spending Insights & Monthly Reports:** Rule-based comparisons across equivalent day-of-month periods and monthly performance summaries.
- **Financial Goals:** Track target amounts, saved amounts, progress percentage, and required monthly contributions.

---

## Technology Stack

- **Frontend:** React 19, TypeScript (strict), Vite, Tailwind CSS v4, Recharts, React Router, Lucide Icons, `react-hot-toast`
- **Backend:** Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, Pytest
- **Database:** MySQL 8.0+ (production) / SQLite (local development fallback via `DATABASE_URL`)
- **Currency:** Indian Rupees (`₹`, `INR`) by default

---

## Project Structure

```text
Finora/
├── backend/
│   ├── alembic/                 # Database migrations
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py          # Auth & DB dependencies
│   │   │   └── routes/          # auth, categories, records, budgets, recurring, goals, dashboard, whatif, reports, insights
│   │   ├── core/                # config.py, security.py
│   │   ├── db/                  # base.py, session.py
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # Business logic & financial calculations
│   │   ├── tests/               # Pytest automated tests
│   │   ├── main.py              # FastAPI app entrypoint
│   │   └── seed.py              # Sample data seeder
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/          # Layout, Modal, StatCard, ProgressBar, RecordForm, etc.
    │   ├── context/             # AuthContext
    │   ├── lib/                 # api.ts, utils.ts
    │   ├── pages/               # Dashboard, Activity, Budgets, WhatIfSimulator, Recurring, Goals, Reports, Settings, Login, Register
    │   ├── types/               # TypeScript interfaces
    │   ├── App.tsx              # Router configuration
    │   └── index.css            # Tailwind v4 & Finora theme tokens
    ├── package.json
    └── vite.config.ts
```

---

## Database Schema

- **`users`**: `id`, `name`, `email` (unique), `password_hash`, `currency`, `monthly_income`, `monthly_savings_target`, `budget_warning_threshold`, `created_at`, `updated_at`
- **`categories`**: `id`, `user_id` (nullable for system categories), `name`, `type`, `icon`, `is_system`, `created_at` (unique `(user_id, name)`)
- **`financial_records`**: `id`, `user_id`, `category_id`, `type` (`income`/`expense`), `amount` (`NUMERIC(12,2)` > 0), `description`, `transaction_date`, `notes`, `import_fingerprint`, `created_at`, `updated_at`
- **`monthly_budgets`**: `id`, `user_id`, `category_id`, `budget_month` (`YYYY-MM`), `budget_amount` (`NUMERIC(12,2)` > 0), `created_at`, `updated_at` (unique `(user_id, category_id, budget_month)`)
- **`recurring_expenses`**: `id`, `user_id`, `category_id`, `title`, `amount` (`NUMERIC(12,2)` > 0), `frequency`, `start_date`, `end_date`, `next_due_date`, `reminder_days`, `is_active`, `created_at`, `updated_at`
- **`financial_goals`**: `id`, `user_id`, `title`, `target_amount`, `current_saved_amount`, `target_date`, `created_at`, `updated_at`

---

## Setup & Running Locally

### 1. Backend Setup

```bash
cd backend
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` if using MySQL:
```env
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/finora
```
Or keep the default SQLite development database:
```env
DATABASE_URL=sqlite:///./finora.db
```

Run migrations and seed demo data:
```bash
alembic upgrade head
python -m app.seed
```

Demo account created by `app.seed`:
- **Email:** `demo@finora.app`
- **Password:** `demo1234`

Start the API server:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` requests to `http://localhost:8000`.

---

## Testing & Verification Commands

### Backend Tests
```bash
cd backend
source venv/bin/activate
pytest -v
```

### Frontend Type-Check & Production Build
```bash
cd frontend
npx tsc --noEmit
npm run build
```

---

## Financial Calculation Rules & Assumptions

1. **Decimal Arithmetic:** All monetary values use `NUMERIC(12, 2)` in the database and Python `Decimal` in services.
2. **Cash-Flow Balance:**
   - `opening_balance = sum(income before month start) - sum(expenses before month start)`
   - `current_balance = opening_balance + recorded_month_income - recorded_month_expenses`
3. **Safe-to-Spend:**
   - Identifies active recurring expenses due between today and the end of the selected month.
   - Excludes commitments that already match a recorded expense in the same category and approximate amount/date window so commitments are never subtracted twice.
   - `available_after_commitments = current_balance - upcoming_commitments - monthly_savings_target`
   - `remaining_safe_to_spend = max(0, available_after_commitments)`
   - `daily_safe_to_spend = remaining_safe_to_spend / days_remaining`
   - Marked as an estimate (`is_estimate = true`) when data is incomplete (e.g., no recorded income/activity).
4. **Budget Drift Detection:**
   - `utilization_pct = (spent / budget_amount) * 100`
   - `expected_utilization_pct = (days_elapsed / days_in_month) * 100`
   - `projected_month_end = (spent / days_elapsed) * days_in_month` (when sufficient days/data exist).
   - Flags drift when utilization exceeds expected pace or crosses the user's configured warning threshold.
5. **What-If Simulator:**
   - Operates purely on an in-memory copy of the current month's state and never modifies `financial_records` or `monthly_budgets` unless the user explicitly applies a budget change.
6. **CSV Duplicate Detection:**
   - Computes a deterministic fingerprint from `transaction_date`, `amount`, `description`, and `type` so identical amounts with different descriptions or dates are preserved.

---

## SQL Demonstration & `EXPLAIN` Inspection

Below are representative analytical queries used to inspect Finora's schema and indexes (verified on the seeded `finora.db` dataset):

### 1. Monthly Spending by Category (Joins + Aggregation)
```sql
SELECT c.name AS category, SUM(fr.amount) AS total_spent, COUNT(*) AS tx_count
FROM financial_records fr
JOIN categories c ON c.id = fr.category_id
WHERE fr.user_id = 1
  AND fr.type = 'EXPENSE'
  AND fr.transaction_date >= '2026-11-01'
  AND fr.transaction_date < '2026-12-01'
GROUP BY c.id, c.name
ORDER BY total_spent DESC;
```
**Observed `EXPLAIN QUERY PLAN`:**
- `SEARCH fr USING INDEX ix_records_user_date (user_id=? AND transaction_date>? AND transaction_date<?)`
- `SEARCH c USING INTEGER PRIMARY KEY (rowid=?)`
- `USE TEMP B-TREE FOR GROUP BY` / `USE TEMP B-TREE FOR ORDER BY`

### 2. Rank Spending Categories Using a Window Function
```sql
SELECT category, total_spent,
       RANK() OVER (ORDER BY total_spent DESC) AS spend_rank
FROM (
  SELECT c.name AS category, SUM(fr.amount) AS total_spent
  FROM financial_records fr
  JOIN categories c ON c.id = fr.category_id
  WHERE fr.user_id = 1 AND fr.type = 'EXPENSE'
    AND fr.transaction_date >= '2026-11-01' AND fr.transaction_date < '2026-12-01'
  GROUP BY c.id, c.name
);
```

### 3. Monthly Budget Utilization
```sql
SELECT c.name AS category, mb.budget_amount,
       COALESCE(SUM(fr.amount), 0) AS spent,
       ROUND(COALESCE(SUM(fr.amount), 0) * 100.0 / mb.budget_amount, 2) AS utilization_pct
FROM monthly_budgets mb
JOIN categories c ON c.id = mb.category_id
LEFT JOIN financial_records fr
  ON fr.user_id = mb.user_id
 AND fr.category_id = mb.category_id
 AND fr.type = 'EXPENSE'
 AND strftime('%Y-%m', fr.transaction_date) = mb.budget_month
WHERE mb.user_id = 1 AND mb.budget_month = '2026-11'
GROUP BY mb.id, c.name, mb.budget_amount;
```
**Observed `EXPLAIN QUERY PLAN`:**
- `SEARCH mb USING INDEX ix_budgets_user_month (user_id=? AND budget_month=?)`
- `SEARCH c USING INTEGER PRIMARY KEY (rowid=?)`
- `SEARCH fr USING INDEX ix_records_user_type (user_id=? AND type=?) LEFT-JOIN`

### 4. Month-over-Month Category Spending Comparison
```sql
SELECT c.name AS category,
       SUM(CASE WHEN fr.transaction_date >= '2026-11-01' THEN fr.amount ELSE 0 END) AS current_month,
       SUM(CASE WHEN fr.transaction_date < '2026-11-01' THEN fr.amount ELSE 0 END) AS previous_month
FROM financial_records fr
JOIN categories c ON c.id = fr.category_id
WHERE fr.user_id = 1
  AND fr.type = 'EXPENSE'
  AND fr.transaction_date >= '2026-10-01'
  AND fr.transaction_date < '2026-12-01'
GROUP BY c.id, c.name;
```

### 5. Upcoming Active Recurring Expenses Within 30 Days
```sql
SELECT title, amount, frequency, next_due_date
FROM recurring_expenses
WHERE user_id = 1
  AND is_active = 1
  AND next_due_date >= CURRENT_DATE
  AND next_due_date <= DATE(CURRENT_DATE, '+30 days')
ORDER BY next_due_date ASC;
```

---

## Security & Token Storage Note

- Passwords are hashed using `bcrypt` via `passlib`.
- JWT tokens expire according to `ACCESS_TOKEN_EXPIRE_MINUTES` (default `1440` minutes / 24 hours).
- The frontend stores the JWT in `localStorage` for simplicity in local development; for production deployments, `HttpOnly` `SameSite=Lax` cookies with CSRF protection are recommended.
