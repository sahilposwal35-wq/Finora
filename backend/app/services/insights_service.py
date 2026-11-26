import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy import extract, func

from app.models.models import (
    FinancialRecord, TransactionType, MonthlyBudget, RecurringExpense, Category
)
from app.schemas.schemas import SpendingInsight


def _prev_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def generate_insights(db: Session, user_id: int, month: str) -> List[SpendingInsight]:
    year, mon = int(month[:4]), int(month[5:7])
    days_in_month = calendar.monthrange(year, mon)[1]
    today = date.today()

    if today.year == year and today.month == mon:
        days_elapsed = today.day
    elif date(year, mon, 1) < today:
        days_elapsed = days_in_month
    else:
        days_elapsed = 0

    prev_year, prev_mon = _prev_month(year, mon)
    prev_days_in_month = calendar.monthrange(prev_year, prev_mon)[1]
    comparable_day = min(days_elapsed if days_elapsed > 0 else days_in_month, prev_days_in_month)

    insights: List[SpendingInsight] = []

    # Current month expenses
    curr_expenses = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.user_id == user_id,
            FinancialRecord.type == TransactionType.EXPENSE,
            extract("year", FinancialRecord.transaction_date) == year,
            extract("month", FinancialRecord.transaction_date) == mon,
        )
        .all()
    )

    # Rule 7: No expenses recorded this month
    if not curr_expenses:
        insights.append(SpendingInsight(
            type="no_expenses",
            title="No Expenses Recorded",
            message=f"No expenses have been recorded for {month} yet.",
            severity="info",
        ))
        return insights

    total_expenses = sum((r.amount for r in curr_expenses), Decimal("0"))

    # Group current expenses by category (for comparable period and full month)
    curr_cat_totals: dict[int | None, Decimal] = {}
    curr_cat_period_totals: dict[int | None, Decimal] = {}
    cat_names: dict[int | None, str] = {None: "Uncategorized"}

    for r in curr_expenses:
        cid = r.category_id
        if cid and r.category:
            cat_names[cid] = r.category.name
        curr_cat_totals[cid] = curr_cat_totals.get(cid, Decimal("0")) + r.amount
        if days_elapsed == 0 or r.transaction_date.day <= comparable_day:
            curr_cat_period_totals[cid] = curr_cat_period_totals.get(cid, Decimal("0")) + r.amount

    # Previous month comparable period expenses
    prev_expenses = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.user_id == user_id,
            FinancialRecord.type == TransactionType.EXPENSE,
            extract("year", FinancialRecord.transaction_date) == prev_year,
            extract("month", FinancialRecord.transaction_date) == prev_mon,
        )
        .all()
    )
    prev_cat_period_totals: dict[int | None, Decimal] = {}
    for r in prev_expenses:
        if r.transaction_date.day <= comparable_day:
            cid = r.category_id
            if cid and r.category:
                cat_names[cid] = r.category.name
            prev_cat_period_totals[cid] = prev_cat_period_totals.get(cid, Decimal("0")) + r.amount

    # Rules 1 & 2: Category spending >20% increase or decrease vs same period last month
    for cid, curr_amt in curr_cat_period_totals.items():
        prev_amt = prev_cat_period_totals.get(cid, Decimal("0"))
        if prev_amt > Decimal("0"):
            pct_change = float((curr_amt - prev_amt) / prev_amt * 100)
            cname = cat_names.get(cid, "Uncategorized")
            if pct_change > 20.0:
                insights.append(SpendingInsight(
                    type="category_increase",
                    title=f"{cname} Spending Up",
                    message=f"{cname} spending increased by {pct_change:.0f}% (₹{curr_amt:,.0f} vs ₹{prev_amt:,.0f}) compared to the same period last month.",
                    severity="warning",
                    data={"category_id": cid, "category_name": cname, "pct_change": round(pct_change, 1)},
                ))
            elif pct_change < -20.0:
                insights.append(SpendingInsight(
                    type="category_decrease",
                    title=f"{cname} Spending Down",
                    message=f"{cname} spending decreased by {abs(pct_change):.0f}% (₹{curr_amt:,.0f} vs ₹{prev_amt:,.0f}) compared to the same period last month.",
                    severity="success",
                    data={"category_id": cid, "category_name": cname, "pct_change": round(pct_change, 1)},
                ))

    # Rule 3: Category accounts for >40% of total expenses
    if total_expenses > Decimal("0"):
        for cid, amt in curr_cat_totals.items():
            share = float(amt / total_expenses * 100)
            if share > 40.0:
                cname = cat_names.get(cid, "Uncategorized")
                insights.append(SpendingInsight(
                    type="category_concentration",
                    title=f"High {cname} Share",
                    message=f"{cname} accounts for {share:.0f}% (₹{amt:,.0f}) of your total expenses in {month}.",
                    severity="info",
                    data={"category_id": cid, "category_name": cname, "share_pct": round(share, 1)},
                ))

    # Rules 4, 5, 8: Budget utilization checks
    budgets = (
        db.query(MonthlyBudget)
        .filter(MonthlyBudget.user_id == user_id, MonthlyBudget.budget_month == month)
        .all()
    )
    expected_pct = (days_elapsed / days_in_month * 100) if days_in_month > 0 else 0.0
    total_budget = Decimal("0")
    total_budget_spent = Decimal("0")

    for b in budgets:
        spent = curr_cat_totals.get(b.category_id, Decimal("0"))
        total_budget += b.budget_amount
        total_budget_spent += spent
        util = float(spent / b.budget_amount * 100) if b.budget_amount > 0 else 0.0
        cname = b.category.name if b.category else cat_names.get(b.category_id, "Category")

        if util > 100.0:
            insights.append(SpendingInsight(
                type="budget_exceeded",
                title=f"{cname} Over Budget",
                message=f"{cname} has exceeded its budget at {util:.0f}% (₹{spent:,.0f} of ₹{b.budget_amount:,.0f}).",
                severity="warning",
                data={"category_id": b.category_id, "utilization_pct": round(util, 1)},
            ))
        elif util > 80.0:
            insights.append(SpendingInsight(
                type="budget_high",
                title=f"{cname} Budget High",
                message=f"{cname} has used {util:.0f}% of its monthly budget (₹{spent:,.0f} of ₹{b.budget_amount:,.0f}).",
                severity="warning",
                data={"category_id": b.category_id, "utilization_pct": round(util, 1)},
            ))

    # Rule 8: Spending on track overall
    if total_budget > Decimal("0") and days_elapsed > 0:
        overall_util = float(total_budget_spent / total_budget * 100)
        if overall_util <= 100.0 and abs(overall_util - expected_pct) <= 15.0:
            insights.append(SpendingInsight(
                type="spending_on_track",
                title="Spending On Track",
                message=f"Overall budget utilization is {overall_util:.0f}%, closely matching the {expected_pct:.0f}% of the month elapsed.",
                severity="success",
                data={"utilization_pct": round(overall_util, 1), "expected_pct": round(expected_pct, 1)},
            ))

    # Rule 6: Recurring expense due within 3 days
    upcoming_cutoff = today + timedelta(days=3)
    due_soon = (
        db.query(RecurringExpense)
        .filter(
            RecurringExpense.user_id == user_id,
            RecurringExpense.is_active == True,
            RecurringExpense.next_due_date >= today,
            RecurringExpense.next_due_date <= upcoming_cutoff,
        )
        .all()
    )
    for rec in due_soon:
        days_until = (rec.next_due_date - today).days
        when = "today" if days_until == 0 else f"in {days_until} day(s)"
        insights.append(SpendingInsight(
            type="recurring_due_soon",
            title=f"Upcoming: {rec.title}",
            message=f"{rec.title} (₹{rec.amount:,.0f}) is due {when} on {rec.next_due_date.isoformat()}.",
            severity="info",
            data={"recurring_id": rec.id, "amount": float(rec.amount), "due_date": rec.next_due_date.isoformat()},
        ))

    return insights
