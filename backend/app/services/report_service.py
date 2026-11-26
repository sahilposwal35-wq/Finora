from decimal import Decimal
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy import extract

from app.models.models import FinancialRecord, TransactionType
from app.schemas.schemas import MonthlyReport
from app.services import budget_service, recurring_service, insights_service


def _prev_month_str(month: str) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    if mon == 1:
        return f"{year - 1:04d}-12"
    return f"{year:04d}-{mon - 1:02d}"


def generate_monthly_report(db: Session, user_id: int, month: str) -> MonthlyReport:
    year, mon = int(month[:4]), int(month[5:7])

    records = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.user_id == user_id,
            extract("year", FinancialRecord.transaction_date) == year,
            extract("month", FinancialRecord.transaction_date) == mon,
        )
        .all()
    )

    total_income = sum(
        (r.amount for r in records if r.type == TransactionType.INCOME),
        Decimal("0"),
    )
    total_expenses = sum(
        (r.amount for r in records if r.type == TransactionType.EXPENSE),
        Decimal("0"),
    )
    net_change = total_income - total_expenses

    # Category breakdown
    cat_totals: dict[str, Decimal] = {}
    for r in records:
        if r.type != TransactionType.EXPENSE:
            continue
        cname = r.category.name if r.category else "Uncategorized"
        cat_totals[cname] = cat_totals.get(cname, Decimal("0")) + r.amount

    category_breakdown = sorted(
        [
            {
                "category": cname,
                "amount": float(amt),
                "percentage": round(float(amt / total_expenses * 100), 1)
                if total_expenses > 0
                else 0.0,
            }
            for cname, amt in cat_totals.items()
        ],
        key=lambda x: x["amount"],
        reverse=True,
    )

    # Budget performance
    budgets = budget_service.get_budgets(db, user_id, month)
    budget_performance = [
        {
            "category_id": b.category_id,
            "category_name": b.category_name,
            "budget_amount": float(b.budget_amount),
            "spent": float(b.spent or Decimal("0")),
            "remaining": float(b.remaining or Decimal("0")),
            "utilization_pct": b.utilization_pct,
        }
        for b in budgets
    ]

    # Compare vs previous month
    prev_m = _prev_month_str(month)
    py, pm = int(prev_m[:4]), int(prev_m[5:7])
    prev_records = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.user_id == user_id,
            extract("year", FinancialRecord.transaction_date) == py,
            extract("month", FinancialRecord.transaction_date) == pm,
        )
        .all()
    )

    vs_previous_month = None
    if prev_records:
        prev_expenses = sum(
            (r.amount for r in prev_records if r.type == TransactionType.EXPENSE),
            Decimal("0"),
        )
        prev_cat_totals: dict[str, Decimal] = {}
        for r in prev_records:
            if r.type != TransactionType.EXPENSE:
                continue
            cname = r.category.name if r.category else "Uncategorized"
            prev_cat_totals[cname] = prev_cat_totals.get(cname, Decimal("0")) + r.amount

        total_change_pct = (
            round(float((total_expenses - prev_expenses) / prev_expenses * 100), 1)
            if prev_expenses > 0
            else None
        )
        all_cats = set(cat_totals.keys()) | set(prev_cat_totals.keys())
        cat_changes = []
        for cname in sorted(all_cats):
            curr_val = cat_totals.get(cname, Decimal("0"))
            prev_val = prev_cat_totals.get(cname, Decimal("0"))
            pct = (
                round(float((curr_val - prev_val) / prev_val * 100), 1)
                if prev_val > 0
                else None
            )
            cat_changes.append({
                "category": cname,
                "current": float(curr_val),
                "previous": float(prev_val),
                "change_pct": pct,
            })

        vs_previous_month = {
            "previous_month": prev_m,
            "previous_expenses": float(prev_expenses),
            "current_expenses": float(total_expenses),
            "total_change_pct": total_change_pct,
            "category_changes": cat_changes,
        }

    # Upcoming commitments
    upcoming = recurring_service.get_upcoming(db, user_id, days=30)
    upcoming_commitments = [
        {
            "id": u.id,
            "title": u.title,
            "amount": float(u.amount),
            "next_due_date": u.next_due_date.isoformat(),
            "frequency": u.frequency,
            "category_name": u.category_name,
        }
        for u in upcoming
    ]

    # Deterministic insights
    insight_objs = insights_service.generate_insights(db, user_id, month)
    insights_text: List[str] = [ins.message for ins in insight_objs]

    return MonthlyReport(
        month=month,
        total_income=total_income.quantize(Decimal("0.01")),
        total_expenses=total_expenses.quantize(Decimal("0.01")),
        net_change=net_change.quantize(Decimal("0.01")),
        category_breakdown=category_breakdown,
        budget_performance=budget_performance,
        vs_previous_month=vs_previous_month,
        upcoming_commitments=upcoming_commitments,
        insights=insights_text,
    )
