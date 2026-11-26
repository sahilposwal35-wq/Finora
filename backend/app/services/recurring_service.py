import calendar
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.models import RecurringExpense, RecurrenceFrequency
from app.schemas.schemas import RecurringCreate, RecurringUpdate, RecurringResponse


def _calc_next_due(start_date: date, frequency: RecurrenceFrequency, after: Optional[date] = None) -> date:
    """Calculate the next due date from start_date based on frequency, optionally after a given date."""
    ref = after or start_date
    current = start_date

    if frequency == RecurrenceFrequency.WEEKLY:
        delta = timedelta(weeks=1)
        while current <= ref:
            current += delta
        return current
    elif frequency == RecurrenceFrequency.BIWEEKLY:
        delta = timedelta(weeks=2)
        while current <= ref:
            current += delta
        return current
    elif frequency == RecurrenceFrequency.MONTHLY:
        while current <= ref:
            current = _add_months(start_date, current, 1)
        return current
    elif frequency == RecurrenceFrequency.QUARTERLY:
        while current <= ref:
            current = _add_months(start_date, current, 3)
        return current
    elif frequency == RecurrenceFrequency.YEARLY:
        while current <= ref:
            current = _add_months(start_date, current, 12)
        return current
    return current


def _add_months(original: date, current: date, months: int) -> date:
    """Add months handling end-of-month dates."""
    month = current.month + months
    year = current.year + (month - 1) // 12
    month = ((month - 1) % 12) + 1
    max_day = calendar.monthrange(year, month)[1]
    day = min(original.day, max_day)
    return date(year, month, day)


def _recurring_to_response(r: RecurringExpense) -> RecurringResponse:
    return RecurringResponse(
        id=r.id,
        user_id=r.user_id,
        category_id=r.category_id,
        category_name=r.category.name if r.category else None,
        title=r.title,
        amount=r.amount,
        frequency=r.frequency.value if isinstance(r.frequency, RecurrenceFrequency) else r.frequency,
        start_date=r.start_date,
        end_date=r.end_date,
        next_due_date=r.next_due_date,
        reminder_days=r.reminder_days,
        is_active=r.is_active,
        created_at=r.created_at,
    )


def create_recurring(db: Session, user_id: int, data: RecurringCreate) -> RecurringResponse:
    freq = RecurrenceFrequency(data.frequency)
    next_due = data.start_date
    today = date.today()
    if next_due < today:
        next_due = _calc_next_due(data.start_date, freq, today - timedelta(days=1))

    expense = RecurringExpense(
        user_id=user_id,
        category_id=data.category_id,
        title=data.title,
        amount=data.amount,
        frequency=freq,
        start_date=data.start_date,
        end_date=data.end_date,
        next_due_date=next_due,
        reminder_days=data.reminder_days,
        is_active=True,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _recurring_to_response(expense)


def get_recurring_expenses(db: Session, user_id: int) -> List[RecurringResponse]:
    expenses = (
        db.query(RecurringExpense)
        .filter(RecurringExpense.user_id == user_id)
        .order_by(RecurringExpense.next_due_date.asc())
        .all()
    )
    return [_recurring_to_response(e) for e in expenses]


def get_recurring(db: Session, user_id: int, expense_id: int) -> RecurringResponse:
    expense = (
        db.query(RecurringExpense)
        .filter(RecurringExpense.id == expense_id, RecurringExpense.user_id == user_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring expense not found")
    return _recurring_to_response(expense)


def update_recurring(db: Session, user_id: int, expense_id: int, data: RecurringUpdate) -> RecurringResponse:
    expense = (
        db.query(RecurringExpense)
        .filter(RecurringExpense.id == expense_id, RecurringExpense.user_id == user_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring expense not found")

    update_data = data.model_dump(exclude_unset=True)
    if "frequency" in update_data and update_data["frequency"] is not None:
        update_data["frequency"] = RecurrenceFrequency(update_data["frequency"])
    for field, value in update_data.items():
        setattr(expense, field, value)

    # Recalculate next_due_date if frequency changed
    if "frequency" in update_data:
        today = date.today()
        expense.next_due_date = _calc_next_due(
            expense.start_date, expense.frequency, today - timedelta(days=1)
        )

    db.commit()
    db.refresh(expense)
    return _recurring_to_response(expense)


def delete_recurring(db: Session, user_id: int, expense_id: int) -> None:
    expense = (
        db.query(RecurringExpense)
        .filter(RecurringExpense.id == expense_id, RecurringExpense.user_id == user_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurring expense not found")
    db.delete(expense)
    db.commit()


def get_upcoming(db: Session, user_id: int, days: int = 30) -> List[RecurringResponse]:
    """Get recurring expenses due within the next N days."""
    today = date.today()
    cutoff = today + timedelta(days=days)
    expenses = (
        db.query(RecurringExpense)
        .filter(
            RecurringExpense.user_id == user_id,
            RecurringExpense.is_active == True,
            RecurringExpense.next_due_date >= today,
            RecurringExpense.next_due_date <= cutoff,
        )
        .order_by(RecurringExpense.next_due_date.asc())
        .all()
    )
    return [_recurring_to_response(e) for e in expenses]
