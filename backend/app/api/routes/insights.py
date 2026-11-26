from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.schemas.schemas import SpendingInsight
from app.services import insights_service

router = APIRouter(prefix="/insights", tags=["Insights"])


@router.get("/", response_model=List[SpendingInsight])
def get_insights(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today().strftime("%Y-%m")
    return insights_service.generate_insights(db, current_user.id, target_month)
