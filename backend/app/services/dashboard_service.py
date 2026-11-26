import calendar
from datetime import date
from decimal import Decimal
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy import extract

from app.models.models import User, FinancialRecord, TransactionType
from app.schemas.schemas import DashboardSummary
from app.services import budget_service, recurring_service, safe_to_spend_service


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    total = year * 12 + (month - 1) + delta
    return total // 12, (total % 12) + 1


def get_dashboard_summary(db: Session, user: User, month: str) -> DashboardSummary:
    year, mon = int(month[:4]), int(month[5:7])
    month_start = date(year, mon, 1)

    # Opening balance (all income - expenses before this month)
    prior_records = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.user_id == user.id,
            FinancialRecord.transaction_date < month_start,
        )
        .all()
    )
    prior_income = sum(
        (r.amount for r in prior_records if r.type == TransactionType.INCOME),
        Decimal("0"),
    )
    prior_expenses = sum(
        (r.amount for r in prior_records if r.type == TransactionType.EXPENSE),
        Decimal("0"),
    )
    opening_balance = prior_income - prior_expenses

    # Current month records
    month_records = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.user_id == user.id,
            extract("year", FinancialRecord.transaction_date) == year,
            extract("month", FinancialRecord.transaction_date) == mon,
        )
        .all()
    )
    total_income = sum(
        (r.amount for r in month_records if r.type == TransactionType.INCOME),
        Decimal("0"),
    )
    total_expenses = sum(
        (r.amount for r in month_records if r.type == TransactionType.EXPENSE),
        Decimal("0"),
    )
    current_balance = opening_balance + total_income - total_expenses

    # Budgets
    budgets = budget_service.get_budgets(db, user.id, month)
    total_budget = sum((b.budget_amount for b in budgets), Decimal("0"))
    budget_used = sum((b.spent or Decimal("0") for b in budgets), Decimal("0"))
    budget_remaining = total_budget - budget_used
    budget_utilization_pct = (
        round(float(budget_used / total_budget * 100), 1)
        if total_budget > 0
        else 0.0
    )

    # Safe to spend
    sts = safe_to_spend_service.calculate_safe_to_spend(db, user, month)

    # Upcoming recurring (next 30 days)
    upcoming_recurring = recurring_service.get_upcoming(db, user.id, days=30)

    # Budget warnings
    budget_warnings = budget_service.get_budget_drift(db, user.id, month)

    # Category spending breakdown
    cat_map: dict[int | None, dict] = {}
    for r in month_records:
        if r.type != TransactionType.EXPENSE:
            continue
        cid = r.category_id
        cname = r.category.name if r.category else "Uncategorized"
        if cid not in cat_map:
            cat_map[cid] = {
                "category_id": cid,
                "category_name": cname,
                "amount": Decimal("0"),
            }
        cat_map[cid]["amount"] += r.amount

    category_spending = sorted(
        [
            {
                "category_id": v["category_id"],
                "category_name": v["category_name"],
                "amount": float(v["amount"]),
                "percentage": round(float(v["amount"] / total_expenses * 100), 1)
                if total_expenses > 0
                else 0.0,
            }
            for v in cat_map.values()
        ],
        key=lambda x: x["amount"],
        reverse=True,
    )

    # Last 6 months trend & income vs expenses
    monthly_trend: List[dict] = []
    income_vs_expenses: List[dict] = []
    for offset in range(-5, 1):
        ty, tm = _shift_month(year, mon, offset)
        t_month_str = f"{ty:04d}-{tm:02d}"
        t_records = (
            db.query(FinancialRecord)
            .filter(
                FinancialRecord.user_id == user.id,
                extract("year", FinancialRecord.transaction_date) == ty,
                extract("month", FinancialRecord.transaction_date) == tm,
            )
            .all()
        )
        t_inc = sum(
            (r.amount for r in t_records if r.type == TransactionType.INCOME),
            Decimal("0"),
        )
        t_exp = sum(
            (r.amount for r in t_records if r.type == TransactionType.EXPENSE),
            Decimal("0"),
        )
        entry = {
            "month": t_month_str,
            "income": float(t_inc),
            "expenses": float(t_exp),
            "net": float(t_inc - t_exp),
        }
        monthly_trend.append(entry)
        income_vs_expenses.append({
            "month": t_month_str,
            "income": float(t_inc),
            "expenses": float(t_exp),
        })

    return DashboardSummary(
        period=month,
        opening_balance=opening_balance.quantize(Decimal("0.01")),
        total_income=total_income.quantize(Decimal("0.01")),
        total_expenses=total_expenses.quantize(Decimal("0.01")),
        current_balance=current_balance.quantize(Decimal("0.01")),
        total_budget=total_budget.quantize(Decimal("0.01")),
        budget_used=budget_used.quantize(Decimal("0.01")),
        budget_remaining=budget_remaining.quantize(Decimal("0.01")),
        budget_utilization_pct=budget_utilization_pct,
        safe_to_spend_daily=sts.daily_safe_to_spend,
        safe_to_spend_remaining=sts.remaining_safe_to_spend,
        days_remaining=sts.days_remaining,
        upcoming_recurring=upcoming_recurring,
        budget_warnings=budget_warnings,
        category_spending=category_spending,
        income_vs_expenses=income_vs_expenses,
        monthly_trend=monthly_trend,
    )
