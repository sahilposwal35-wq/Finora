from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.schemas.schemas import DashboardSummary, SafeToSpendBreakdown
from app.services import dashboard_service, safe_to_spend_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today().strftime("%Y-%m")
    return dashboard_service.get_dashboard_summary(db, current_user, target_month)


@router.get("/safe-to-spend", response_model=SafeToSpendBreakdown)
def get_safe_to_spend(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today().strftime("%Y-%m")
    return safe_to_spend_service.calculate_safe_to_spend(db, current_user, target_month)
