from decimal import Decimal, ROUND_HALF_UP
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy import extract

from app.models.models import User, FinancialRecord, TransactionType
from app.schemas.schemas import WhatIfScenario, WhatIfResult
from app.services import budget_service, safe_to_spend_service


def simulate_whatif(
    db: Session,
    user: User,
    month: str,
    scenario: WhatIfScenario,
) -> WhatIfResult:
    """Clone current month state and apply what-if adjustments without modifying DB."""
    year, mon = int(month[:4]), int(month[5:7])

    month_records = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.user_id == user.id,
            extract("year", FinancialRecord.transaction_date) == year,
            extract("month", FinancialRecord.transaction_date) == mon,
        )
        .all()
    )
    orig_income = sum(
        (r.amount for r in month_records if r.type == TransactionType.INCOME),
        Decimal("0"),
    )
    orig_expenses = sum(
        (r.amount for r in month_records if r.type == TransactionType.EXPENSE),
        Decimal("0"),
    )

    budgets = budget_service.get_budgets(db, user.id, month)
    orig_total_budget = sum((b.budget_amount for b in budgets), Decimal("0"))
    orig_budget_used = sum((b.spent or Decimal("0") for b in budgets), Decimal("0"))

    sts = safe_to_spend_service.calculate_safe_to_spend(db, user, month)

    # Cloned mutable state
    sim_income = orig_income
    sim_expenses = orig_expenses
    sim_total_budget = orig_total_budget
    sim_budget_used = orig_budget_used
    sim_savings_target = sts.savings_target
    sim_balance = sts.current_balance
    changes: List[dict] = []

    budget_by_cat = {b.category_id: b.budget_amount for b in budgets}

    for adj in scenario.adjustments:
        adj_type = adj.get("type")
        amt = Decimal(str(adj.get("amount", 0)))
        cat_id = adj.get("category_id")
        desc = adj.get("description", "")

        if adj_type == "income_change":
            sim_income += amt
            sim_balance += amt
            changes.append({"type": adj_type, "amount": float(amt), "description": desc or f"Income adjusted by ₹{amt}"})
        elif adj_type == "expense_add":
            sim_expenses += amt
            sim_balance -= amt
            if cat_id and cat_id in budget_by_cat:
                sim_budget_used += amt
            changes.append({"type": adj_type, "amount": float(amt), "description": desc or f"Added expense ₹{amt}"})
        elif adj_type == "expense_remove":
            delta = min(amt, sim_expenses)
            sim_expenses -= delta
            sim_balance += delta
            if cat_id and cat_id in budget_by_cat:
                sim_budget_used = max(Decimal("0"), sim_budget_used - delta)
            changes.append({"type": adj_type, "amount": float(amt), "description": desc or f"Removed expense ₹{amt}"})
        elif adj_type == "budget_change":
            sim_total_budget = max(Decimal("0"), sim_total_budget + amt)
            changes.append({"type": adj_type, "amount": float(amt), "description": desc or f"Budget adjusted by ₹{amt}"})
        elif adj_type == "savings_change":
            sim_savings_target = max(Decimal("0"), sim_savings_target + amt)
            changes.append({"type": adj_type, "amount": float(amt), "description": desc or f"Savings target adjusted by ₹{amt}"})

    orig_util = round(float(orig_budget_used / orig_total_budget * 100), 1) if orig_total_budget > 0 else 0.0
    sim_util = round(float(sim_budget_used / sim_total_budget * 100), 1) if sim_total_budget > 0 else 0.0

    sim_available = sim_balance - sts.upcoming_commitments - sim_savings_target
    sim_remaining_safe = max(Decimal("0"), sim_available)
    sim_daily_safe = (sim_remaining_safe / Decimal(str(sts.days_remaining))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    original_state = {
        "total_income": float(orig_income),
        "total_expenses": float(orig_expenses),
        "current_balance": float(sts.current_balance),
        "total_budget": float(orig_total_budget),
        "budget_used": float(orig_budget_used),
        "budget_utilization_pct": orig_util,
        "savings_target": float(sts.savings_target),
        "remaining_safe_to_spend": float(sts.remaining_safe_to_spend),
        "daily_safe_to_spend": float(sts.daily_safe_to_spend),
    }

    simulated_state = {
        "total_income": float(sim_income),
        "total_expenses": float(sim_expenses),
        "current_balance": float(sim_balance),
        "total_budget": float(sim_total_budget),
        "budget_used": float(sim_budget_used),
        "budget_utilization_pct": sim_util,
        "savings_target": float(sim_savings_target),
        "remaining_safe_to_spend": float(sim_remaining_safe),
        "daily_safe_to_spend": float(sim_daily_safe),
    }

    safe_diff = sim_remaining_safe - sts.remaining_safe_to_spend
    direction = "increases" if safe_diff >= 0 else "decreases"
    impact_summary = (
        f"This scenario {direction} your remaining safe-to-spend by ₹{abs(safe_diff):,.2f} "
        f"(from ₹{sts.remaining_safe_to_spend:,.2f} to ₹{sim_remaining_safe:,.2f}, "
        f"or ₹{sim_daily_safe:,.2f}/day)."
    )

    return WhatIfResult(
        original=original_state,
        simulated=simulated_state,
        changes=changes,
        impact_summary=impact_summary,
    )
