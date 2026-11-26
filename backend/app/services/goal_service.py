from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.models import FinancialGoal
from app.schemas.schemas import GoalCreate, GoalUpdate, GoalResponse


def _goal_to_response(goal: FinancialGoal) -> GoalResponse:
    progress = float(goal.current_saved_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0.0
    monthly_needed = None
    if goal.target_date:
        today = date.today()
        if goal.target_date > today:
            remaining = goal.target_amount - goal.current_saved_amount
            if remaining > 0:
                months_left = (
                    (goal.target_date.year - today.year) * 12
                    + (goal.target_date.month - today.month)
                )
                if months_left <= 0:
                    months_left = 1
                monthly_needed = (remaining / Decimal(str(months_left))).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                monthly_needed = Decimal("0")
        else:
            monthly_needed = Decimal("0")

    return GoalResponse(
        id=goal.id,
        user_id=goal.user_id,
        title=goal.title,
        target_amount=goal.target_amount,
        current_saved_amount=goal.current_saved_amount,
        target_date=goal.target_date,
        progress_pct=round(progress, 1),
        monthly_contribution_needed=monthly_needed,
        created_at=goal.created_at,
    )


def create_goal(db: Session, user_id: int, data: GoalCreate) -> GoalResponse:
    goal = FinancialGoal(
        user_id=user_id,
        title=data.title,
        target_amount=data.target_amount,
        current_saved_amount=data.current_saved_amount,
        target_date=data.target_date,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _goal_to_response(goal)


def get_goals(db: Session, user_id: int) -> List[GoalResponse]:
    goals = (
        db.query(FinancialGoal)
        .filter(FinancialGoal.user_id == user_id)
        .order_by(FinancialGoal.created_at.desc())
        .all()
    )
    return [_goal_to_response(g) for g in goals]


def get_goal(db: Session, user_id: int, goal_id: int) -> GoalResponse:
    goal = (
        db.query(FinancialGoal)
        .filter(FinancialGoal.id == goal_id, FinancialGoal.user_id == user_id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return _goal_to_response(goal)


def update_goal(db: Session, user_id: int, goal_id: int, data: GoalUpdate) -> GoalResponse:
    goal = (
        db.query(FinancialGoal)
        .filter(FinancialGoal.id == goal_id, FinancialGoal.user_id == user_id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return _goal_to_response(goal)


def delete_goal(db: Session, user_id: int, goal_id: int) -> None:
    goal = (
        db.query(FinancialGoal)
        .filter(FinancialGoal.id == goal_id, FinancialGoal.user_id == user_id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    db.delete(goal)
    db.commit()
