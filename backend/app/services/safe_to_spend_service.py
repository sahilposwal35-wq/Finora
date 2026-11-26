import calendar
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy import extract

from app.models.models import (
    User, FinancialRecord, TransactionType, RecurringExpense
)
from app.schemas.schemas import SafeToSpendBreakdown


def calculate_safe_to_spend(
    db: Session,
    user: User,
    month: str,
    include_opening_balance: bool = True,
) -> SafeToSpendBreakdown:
    year, mon = int(month[:4]), int(month[5:7])
    days_in_month = calendar.monthrange(year, mon)[1]
    month_start = date(year, mon, 1)
    month_end = date(year, mon, days_in_month)
    today = date.today()

    if today.year == year and today.month == mon:
        days_remaining = max(1, days_in_month - today.day + 1)
        ref_date = today
    elif month_end < today:
        days_remaining = 1
        ref_date = month_end
    else:
        days_remaining = days_in_month
        ref_date = month_start

    # Opening balance (all records before month_start)
    opening_balance = Decimal("0")
    if include_opening_balance:
        prior_records = (
            db.query(FinancialRecord)
            .filter(
                FinancialRecord.user_id == user.id,
                FinancialRecord.transaction_date < month_start,
            )
            .all()
        )
        prior_inc = sum(
            (r.amount for r in prior_records if r.type == TransactionType.INCOME),
            Decimal("0"),
        )
        prior_exp = sum(
            (r.amount for r in prior_records if r.type == TransactionType.EXPENSE),
            Decimal("0"),
        )
        opening_balance = prior_inc - prior_exp

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
    month_income = sum(
        (r.amount for r in month_records if r.type == TransactionType.INCOME),
        Decimal("0"),
    )
    month_expenses = sum(
        (r.amount for r in month_records if r.type == TransactionType.EXPENSE),
        Decimal("0"),
    )

    is_estimate = False
    # If no income recorded yet this month, fall back to user's configured monthly_income if available
    effective_income = month_income
    if month_income == Decimal("0") and user.monthly_income and user.monthly_income > Decimal("0"):
        effective_income = Decimal(str(user.monthly_income))
        is_estimate = True

    if not month_records:
        is_estimate = True

    current_balance = opening_balance + effective_income - month_expenses

    # Upcoming commitments: active recurring expenses due between ref_date and month_end
    # that haven't already been recorded as actual expenses in this month
    active_recurring = (
        db.query(RecurringExpense)
        .filter(
            RecurringExpense.user_id == user.id,
            RecurringExpense.is_active == True,
            RecurringExpense.next_due_date >= ref_date,
            RecurringExpense.next_due_date <= month_end,
        )
        .all()
    )

    expense_records = [r for r in month_records if r.type == TransactionType.EXPENSE]
    upcoming_commitments = Decimal("0")
    upcoming_detail: List[dict] = []

    for rec in active_recurring:
        if rec.end_date and rec.next_due_date > rec.end_date:
            continue

        # Check if already recorded: match by category + approximate amount (within 10%) + date proximity (within 5 days)
        already_paid = False
        for exp in expense_records:
            same_category = (rec.category_id is None and exp.category_id is None) or (
                rec.category_id == exp.category_id
            )
            diff = abs(exp.amount - rec.amount)
            approx_amount = diff <= (rec.amount * Decimal("0.10"))
            date_close = abs((exp.transaction_date - rec.next_due_date).days) <= 5
            if same_category and approx_amount and date_close:
                already_paid = True
                break

        if not already_paid:
            upcoming_commitments += rec.amount
            upcoming_detail.append({
                "id": rec.id,
                "title": rec.title,
                "amount": float(rec.amount),
                "due_date": rec.next_due_date.isoformat(),
                "category_name": rec.category.name if rec.category else None,
            })

    savings_target = Decimal(str(user.monthly_savings_target or 0))
    available = current_balance - upcoming_commitments - savings_target
    remaining_safe = max(Decimal("0"), available)
    daily_safe = (remaining_safe / Decimal(str(days_remaining))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    explanation = (
        f"Based on a balance of ₹{current_balance:,.2f}, subtracting ₹{upcoming_commitments:,.2f} "
        f"in upcoming commitments and ₹{savings_target:,.2f} savings target leaves "
        f"₹{remaining_safe:,.2f} for the remaining {days_remaining} day(s) "
        f"(₹{daily_safe:,.2f}/day)."
    )
    if is_estimate:
        explanation += " (Estimate: limited transaction data recorded for this month.)"

    return SafeToSpendBreakdown(
        current_balance=current_balance.quantize(Decimal("0.01")),
        upcoming_commitments=upcoming_commitments.quantize(Decimal("0.01")),
        upcoming_commitments_detail=upcoming_detail,
        savings_target=savings_target.quantize(Decimal("0.01")),
        available_after_commitments=available.quantize(Decimal("0.01")),
        days_remaining=days_remaining,
        daily_safe_to_spend=daily_safe,
        remaining_safe_to_spend=remaining_safe.quantize(Decimal("0.01")),
        is_estimate=is_estimate,
        explanation=explanation,
    )
