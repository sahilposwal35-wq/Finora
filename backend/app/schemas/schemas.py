from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator


# ==================== Auth Schemas ====================

class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    currency: str
    monthly_income: Optional[Decimal] = Decimal("0")
    monthly_savings_target: Optional[Decimal] = Decimal("0")
    budget_warning_threshold: int = 80
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    currency: Optional[str] = Field(None, max_length=10)
    monthly_income: Optional[Decimal] = Field(None, ge=0)
    monthly_savings_target: Optional[Decimal] = Field(None, ge=0)
    budget_warning_threshold: Optional[int] = Field(None, ge=0, le=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ==================== Category Schemas ====================

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default="expense")
    icon: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("income", "expense", "both"):
            raise ValueError("Type must be 'income', 'expense', or 'both'")
        return v


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[str] = None
    icon: Optional[str] = None


class CategoryResponse(BaseModel):
    id: int
    user_id: Optional[int]
    name: str
    type: str
    icon: Optional[str]
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== Financial Record Schemas ====================

class RecordCreate(BaseModel):
    type: str = Field(...)
    amount: Decimal = Field(..., gt=0)
    category_id: Optional[int] = None
    description: str = Field(..., min_length=1, max_length=255)
    transaction_date: date
    notes: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("income", "expense"):
            raise ValueError("Type must be 'income' or 'expense'")
        return v


class RecordUpdate(BaseModel):
    type: Optional[str] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    category_id: Optional[int] = None
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    transaction_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("income", "expense"):
            raise ValueError("Type must be 'income' or 'expense'")
        return v


class RecordResponse(BaseModel):
    id: int
    user_id: int
    category_id: Optional[int]
    category_name: Optional[str] = None
    type: str
    amount: Decimal
    description: str
    transaction_date: date
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedRecords(BaseModel):
    items: List[RecordResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==================== Budget Schemas ====================

class BudgetCreate(BaseModel):
    category_id: int
    budget_month: str = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    budget_amount: Decimal = Field(..., gt=0)


class BudgetUpdate(BaseModel):
    budget_amount: Optional[Decimal] = Field(None, gt=0)


class BudgetResponse(BaseModel):
    id: int
    user_id: int
    category_id: int
    category_name: Optional[str] = None
    budget_month: str
    budget_amount: Decimal
    spent: Optional[Decimal] = Decimal("0")
    remaining: Optional[Decimal] = Decimal("0")
    utilization_pct: Optional[float] = 0.0
    created_at: datetime

    model_config = {"from_attributes": True}


class BudgetDriftWarning(BaseModel):
    category_id: int
    category_name: str
    budget_amount: Decimal
    spent: Decimal
    remaining: Decimal
    utilization_pct: float
    days_elapsed: int
    days_in_month: int
    expected_utilization_pct: float
    daily_avg_spending: Decimal
    projected_month_end: Decimal
    is_drifting: bool
    message: str


# ==================== Recurring Expense Schemas ====================

class RecurringCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    amount: Decimal = Field(..., gt=0)
    category_id: Optional[int] = None
    frequency: str = Field(default="monthly")
    start_date: date
    end_date: Optional[date] = None
    reminder_days: int = Field(default=3, ge=0, le=30)

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        valid = ("weekly", "biweekly", "monthly", "quarterly", "yearly")
        if v not in valid:
            raise ValueError(f"Frequency must be one of: {', '.join(valid)}")
        return v


class RecurringUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    amount: Optional[Decimal] = Field(None, gt=0)
    category_id: Optional[int] = None
    frequency: Optional[str] = None
    end_date: Optional[date] = None
    reminder_days: Optional[int] = Field(None, ge=0, le=30)
    is_active: Optional[bool] = None


class RecurringResponse(BaseModel):
    id: int
    user_id: int
    category_id: Optional[int]
    category_name: Optional[str] = None
    title: str
    amount: Decimal
    frequency: str
    start_date: date
    end_date: Optional[date]
    next_due_date: date
    reminder_days: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== Goal Schemas ====================

class GoalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    target_amount: Decimal = Field(..., gt=0)
    current_saved_amount: Decimal = Field(default=Decimal("0"), ge=0)
    target_date: Optional[date] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    target_amount: Optional[Decimal] = Field(None, gt=0)
    current_saved_amount: Optional[Decimal] = Field(None, ge=0)
    target_date: Optional[date] = None


class GoalResponse(BaseModel):
    id: int
    user_id: int
    title: str
    target_amount: Decimal
    current_saved_amount: Decimal
    target_date: Optional[date]
    progress_pct: float = 0.0
    monthly_contribution_needed: Optional[Decimal] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== Dashboard Schemas ====================

class DashboardSummary(BaseModel):
    period: str
    opening_balance: Decimal
    total_income: Decimal
    total_expenses: Decimal
    current_balance: Decimal
    total_budget: Decimal
    budget_used: Decimal
    budget_remaining: Decimal
    budget_utilization_pct: float
    safe_to_spend_daily: Decimal
    safe_to_spend_remaining: Decimal
    days_remaining: int
    upcoming_recurring: List[RecurringResponse]
    budget_warnings: List[BudgetDriftWarning]
    category_spending: List[dict]
    income_vs_expenses: List[dict]
    monthly_trend: List[dict]


class SafeToSpendBreakdown(BaseModel):
    current_balance: Decimal
    upcoming_commitments: Decimal
    upcoming_commitments_detail: List[dict]
    savings_target: Decimal
    available_after_commitments: Decimal
    days_remaining: int
    daily_safe_to_spend: Decimal
    remaining_safe_to_spend: Decimal
    is_estimate: bool
    explanation: str


# ==================== What-If Simulator Schemas ====================

class WhatIfScenario(BaseModel):
    adjustments: List[dict] = Field(default_factory=list)
    # Each adjustment: {"type": "budget_change"|"expense_add"|"expense_remove"|"savings_change"|"income_change",
    #                    "category_id": optional, "amount": Decimal, "description": optional}


class WhatIfResult(BaseModel):
    original: dict
    simulated: dict
    changes: List[dict]
    impact_summary: str


# ==================== Monthly Report Schemas ====================

class MonthlyReport(BaseModel):
    month: str
    total_income: Decimal
    total_expenses: Decimal
    net_change: Decimal
    category_breakdown: List[dict]
    budget_performance: List[dict]
    vs_previous_month: Optional[dict]
    upcoming_commitments: List[dict]
    insights: List[str]


# ==================== Insights Schemas ====================

class SpendingInsight(BaseModel):
    type: str
    title: str
    message: str
    severity: str = "info"  # info, warning, success
    data: Optional[dict] = None


# ==================== CSV Schemas ====================

class CSVPreviewRow(BaseModel):
    row_number: int
    type: Optional[str]
    amount: Optional[Decimal]
    category: Optional[str]
    description: Optional[str]
    transaction_date: Optional[str]
    notes: Optional[str]
    is_valid: bool
    errors: List[str] = []
    is_duplicate: bool = False


class CSVPreview(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    rows: List[CSVPreviewRow]


class CSVImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[str]
