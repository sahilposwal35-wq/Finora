from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.schemas.schemas import MonthlyReport
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/monthly", response_model=MonthlyReport)
def get_monthly_report(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today().strftime("%Y-%m")
    return report_service.generate_monthly_report(db, current_user.id, target_month)
