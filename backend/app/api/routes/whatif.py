from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.schemas.schemas import WhatIfScenario, WhatIfResult
from app.services import whatif_service

router = APIRouter(prefix="/whatif", tags=["What-If Simulator"])


@router.post("/simulate", response_model=WhatIfResult)
def simulate(
    scenario: WhatIfScenario,
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today().strftime("%Y-%m")
    return whatif_service.simulate_whatif(db, current_user, target_month, scenario)
