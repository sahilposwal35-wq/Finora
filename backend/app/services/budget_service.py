import calendar
from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from fastapi import HTTPException, status

from app.models.models import MonthlyBudget, FinancialRecord, TransactionType, Category
from app.schemas.schemas import BudgetCreate, BudgetUpdate, BudgetResponse, BudgetDriftWarning


def _budget_to_response(budget: MonthlyBudget, spent: Decimal = Decimal("0")) -> BudgetResponse:
    remaining = budget.budget_amount - spent
    utilization = float(spent / budget.budget_amount * 100) if budget.budget_amount > 0 else 0.0
    return BudgetResponse(
        id=budget.id,
        user_id=budget.user_id,
        category_id=budget.category_id,
        category_name=budget.category.name if budget.category else None,
        budget_month=budget.budget_month,
        budget_amount=budget.budget_amount,
        spent=spent,
        remaining=remaining,
        utilization_pct=round(utilization, 1),
        created_at=budget.created_at,
    )


def _get_spent_for_budget(db: Session, user_id: int, category_id: int, month: str) -> Decimal:
    year, mon = int(month[:4]), int(month[5:7])
    result = (
        db.query(func.sum(FinancialRecord.amount))
        .filter(
            FinancialRecord.user_id == user_id,
            FinancialRecord.category_id == category_id,
            FinancialRecord.type == TransactionType.EXPENSE,
            extract("year", FinancialRecord.transaction_date) == year,
            extract("month", FinancialRecord.transaction_date) == mon,
        )
        .scalar()
    )
    return Decimal(str(result)) if result else Decimal("0")


def create_budget(db: Session, user_id: int, data: BudgetCreate) -> BudgetResponse:
    existing = (
        db.query(MonthlyBudget)
        .filter(
            MonthlyBudget.user_id == user_id,
            MonthlyBudget.category_id == data.category_id,
            MonthlyBudget.budget_month == data.budget_month,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Budget already exists for this category and month",
        )
    budget = MonthlyBudget(
        user_id=user_id,
        category_id=data.category_id,
        budget_month=data.budget_month,
        budget_amount=data.budget_amount,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    spent = _get_spent_for_budget(db, user_id, data.category_id, data.budget_month)
    return _budget_to_response(budget, spent)


def get_budgets(db: Session, user_id: int, month: str) -> List[BudgetResponse]:
    budgets = (
        db.query(MonthlyBudget)
        .filter(MonthlyBudget.user_id == user_id, MonthlyBudget.budget_month == month)
        .all()
    )
    result = []
    for b in budgets:
        spent = _get_spent_for_budget(db, user_id, b.category_id, month)
        result.append(_budget_to_response(b, spent))
    return result


def update_budget(db: Session, user_id: int, budget_id: int, data: BudgetUpdate) -> BudgetResponse:
    budget = db.query(MonthlyBudget).filter(MonthlyBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    if budget.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    spent = _get_spent_for_budget(db, user_id, budget.category_id, budget.budget_month)
    return _budget_to_response(budget, spent)


def delete_budget(db: Session, user_id: int, budget_id: int) -> None:
    budget = db.query(MonthlyBudget).filter(MonthlyBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    if budget.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    db.delete(budget)
    db.commit()


def get_budget_drift(db: Session, user_id: int, month: str, threshold: float = 15.0) -> List[BudgetDriftWarning]:
    """Detect budget drift: compare utilization % vs expected % based on days elapsed."""
    year, mon = int(month[:4]), int(month[5:7])
    days_in_month = calendar.monthrange(year, mon)[1]
    today = date.today()

    if today.year == year and today.month == mon:
        days_elapsed = today.day
    elif date(year, mon, 1) < today:
        days_elapsed = days_in_month
    else:
        days_elapsed = 0

    expected_pct = (days_elapsed / days_in_month) * 100 if days_in_month > 0 else 0

    budgets = get_budgets(db, user_id, month)
    warnings = []

    for b in budgets:
        utilization = b.utilization_pct or 0.0
        spent = b.spent or Decimal("0")
        remaining = b.remaining or Decimal("0")
        daily_avg = Decimal(str(spent / days_elapsed)) if days_elapsed > 0 else Decimal("0")
        projected = daily_avg * days_in_month

        is_drifting = (utilization - expected_pct) > threshold

        if is_drifting or utilization > 80:
            if utilization > 100:
                message = f"Over budget! {b.category_name}: spent ₹{spent} of ₹{b.budget_amount} ({utilization:.0f}%)"
            elif is_drifting:
                message = (
                    f"{b.category_name}: spending at {utilization:.0f}% but only {expected_pct:.0f}% of month elapsed. "
                    f"Projected month-end: ₹{projected:.0f}"
                )
            else:
                message = f"{b.category_name}: {utilization:.0f}% of budget used ({days_elapsed}/{days_in_month} days)"

            warnings.append(BudgetDriftWarning(
                category_id=b.category_id,
                category_name=b.category_name or "Unknown",
                budget_amount=b.budget_amount,
                spent=spent,
                remaining=remaining,
                utilization_pct=utilization,
                days_elapsed=days_elapsed,
                days_in_month=days_in_month,
                expected_utilization_pct=round(expected_pct, 1),
                daily_avg_spending=round(daily_avg, 2),
                projected_month_end=round(projected, 2),
                is_drifting=is_drifting,
                message=message,
            ))

    return warnings
