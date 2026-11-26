from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.schemas.schemas import (
    BudgetCreate, BudgetUpdate, BudgetResponse, BudgetDriftWarning,
)
from app.services import budget_service

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get("/", response_model=List[BudgetResponse])
def list_budgets(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today().strftime("%Y-%m")
    return budget_service.get_budgets(db, current_user.id, target_month)


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_budget(
    data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return budget_service.create_budget(db, current_user.id, data)


@router.get("/drift", response_model=List[BudgetDriftWarning])
def get_budget_drift(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    threshold: float = Query(15.0, ge=0.0, le=100.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today().strftime("%Y-%m")
    return budget_service.get_budget_drift(db, current_user.id, target_month, threshold=threshold)


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: int,
    data: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return budget_service.update_budget(db, current_user.id, budget_id, data)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget_service.delete_budget(db, current_user.id, budget_id)
