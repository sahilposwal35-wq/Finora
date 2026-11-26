from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.schemas.schemas import RecurringCreate, RecurringUpdate, RecurringResponse
from app.services import recurring_service

router = APIRouter(prefix="/recurring", tags=["Recurring Expenses"])


@router.get("/", response_model=List[RecurringResponse])
def list_recurring(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.get_recurring_expenses(db, current_user.id)


@router.post("/", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
def create_recurring(
    data: RecurringCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.create_recurring(db, current_user.id, data)


@router.get("/upcoming", response_model=List[RecurringResponse])
def get_upcoming(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.get_upcoming(db, current_user.id, days=days)


@router.get("/{expense_id}", response_model=RecurringResponse)
def get_recurring(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.get_recurring(db, current_user.id, expense_id)


@router.put("/{expense_id}", response_model=RecurringResponse)
def update_recurring(
    expense_id: int,
    data: RecurringUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.update_recurring(db, current_user.id, expense_id, data)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recurring_service.delete_recurring(db, current_user.id, expense_id)
