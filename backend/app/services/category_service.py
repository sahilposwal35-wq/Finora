from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.models import Category, CategoryType
from app.schemas.schemas import CategoryCreate, CategoryUpdate, CategoryResponse


SYSTEM_CATEGORIES = [
    {"name": "Food", "type": CategoryType.EXPENSE, "icon": "🍔"},
    {"name": "Transport", "type": CategoryType.EXPENSE, "icon": "🚗"},
    {"name": "Housing", "type": CategoryType.EXPENSE, "icon": "🏠"},
    {"name": "Utilities", "type": CategoryType.EXPENSE, "icon": "💡"},
    {"name": "Entertainment", "type": CategoryType.EXPENSE, "icon": "🎬"},
    {"name": "Shopping", "type": CategoryType.EXPENSE, "icon": "🛒"},
    {"name": "Healthcare", "type": CategoryType.EXPENSE, "icon": "🏥"},
    {"name": "Education", "type": CategoryType.EXPENSE, "icon": "📚"},
    {"name": "Salary", "type": CategoryType.INCOME, "icon": "💰"},
    {"name": "Freelance", "type": CategoryType.INCOME, "icon": "💻"},
    {"name": "Investment", "type": CategoryType.INCOME, "icon": "📈"},
    {"name": "Other", "type": CategoryType.BOTH, "icon": "📦"},
]


def seed_system_categories(db: Session) -> None:
    existing = db.query(Category).filter(Category.is_system == True).count()
    if existing > 0:
        return
    for cat_data in SYSTEM_CATEGORIES:
        cat = Category(
            name=cat_data["name"],
            type=cat_data["type"],
            icon=cat_data["icon"],
            is_system=True,
            user_id=None,
        )
        db.add(cat)
    db.commit()


def get_categories(db: Session, user_id: int) -> List[CategoryResponse]:
    categories = (
        db.query(Category)
        .filter(
            (Category.user_id == user_id) | (Category.is_system == True)
        )
        .order_by(Category.is_system.desc(), Category.name)
        .all()
    )
    return [CategoryResponse.model_validate(c) for c in categories]


def create_category(db: Session, user_id: int, data: CategoryCreate) -> CategoryResponse:
    existing = (
        db.query(Category)
        .filter(Category.user_id == user_id, Category.name == data.name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{data.name}' already exists",
        )
    cat = Category(
        user_id=user_id,
        name=data.name,
        type=CategoryType(data.type),
        icon=data.icon,
        is_system=False,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryResponse.model_validate(cat)


def update_category(db: Session, user_id: int, category_id: int, data: CategoryUpdate) -> CategoryResponse:
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if cat.is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify system categories")
    if cat.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data = data.model_dump(exclude_unset=True)
    if "type" in update_data and update_data["type"] is not None:
        update_data["type"] = CategoryType(update_data["type"])
    for field, value in update_data.items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return CategoryResponse.model_validate(cat)


def delete_category(db: Session, user_id: int, category_id: int) -> None:
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if cat.is_system:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete system categories")
    if cat.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    db.delete(cat)
    db.commit()
