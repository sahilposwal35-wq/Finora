import enum
from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import (
    Column, Integer, String, DateTime, Date, Numeric,
    ForeignKey, Enum, Text, Boolean, UniqueConstraint, Index, CheckConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"


class CategoryType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    BOTH = "both"


class RecurrenceFrequency(str, enum.Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    monthly_income = Column(Numeric(12, 2), nullable=True, default=0)
    monthly_savings_target = Column(Numeric(12, 2), nullable=True, default=0)
    budget_warning_threshold = Column(Integer, nullable=False, default=80)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    financial_records = relationship("FinancialRecord", back_populates="user", cascade="all, delete-orphan")
    monthly_budgets = relationship("MonthlyBudget", back_populates="user", cascade="all, delete-orphan")
    recurring_expenses = relationship("RecurringExpense", back_populates="user", cascade="all, delete-orphan")
    financial_goals = relationship("FinancialGoal", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(100), nullable=False)
    type = Column(Enum(CategoryType), nullable=False, default=CategoryType.EXPENSE)
    icon = Column(String(50), nullable=True)
    is_system = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="categories")
    financial_records = relationship("FinancialRecord", back_populates="category")
    monthly_budgets = relationship("MonthlyBudget", back_populates="category")
    recurring_expenses = relationship("RecurringExpense", back_populates="category")

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_category_name"),
        Index("ix_categories_user_id", "user_id"),
    )


class FinancialRecord(Base):
    __tablename__ = "financial_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String(255), nullable=False)
    transaction_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    import_fingerprint = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="financial_records")
    category = relationship("Category", back_populates="financial_records")

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_positive_amount"),
        Index("ix_records_user_date", "user_id", "transaction_date"),
        Index("ix_records_user_type", "user_id", "type"),
        Index("ix_records_user_category", "user_id", "category_id"),
        Index("ix_records_fingerprint", "import_fingerprint"),
    )


class MonthlyBudget(Base):
    __tablename__ = "monthly_budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    budget_month = Column(String(7), nullable=False)  # Format: YYYY-MM
    budget_amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="monthly_budgets")
    category = relationship("Category", back_populates="monthly_budgets")

    __table_args__ = (
        UniqueConstraint("user_id", "category_id", "budget_month", name="uq_user_category_month"),
        CheckConstraint("budget_amount > 0", name="ck_positive_budget"),
        Index("ix_budgets_user_month", "user_id", "budget_month"),
    )


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    frequency = Column(Enum(RecurrenceFrequency), nullable=False, default=RecurrenceFrequency.MONTHLY)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    next_due_date = Column(Date, nullable=False)
    reminder_days = Column(Integer, nullable=False, default=3)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="recurring_expenses")
    category = relationship("Category", back_populates="recurring_expenses")

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_positive_recurring_amount"),
        Index("ix_recurring_user_active", "user_id", "is_active"),
        Index("ix_recurring_next_due", "next_due_date"),
    )


class FinancialGoal(Base):
    __tablename__ = "financial_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    target_amount = Column(Numeric(12, 2), nullable=False)
    current_saved_amount = Column(Numeric(12, 2), nullable=False, default=0)
    target_date = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="financial_goals")

    __table_args__ = (
        CheckConstraint("target_amount > 0", name="ck_positive_goal_target"),
        CheckConstraint("current_saved_amount >= 0", name="ck_non_negative_saved"),
        Index("ix_goals_user_id", "user_id"),
    )
