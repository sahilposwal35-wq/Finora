from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.models import User
from app.schemas.schemas import (
    RecordCreate, RecordUpdate, RecordResponse,
    PaginatedRecords, CSVPreview, CSVImportResult,
)
from app.services import record_service

router = APIRouter(prefix="/records", tags=["Records"])


@router.get("/", response_model=PaginatedRecords)
def list_records(
    type: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("transaction_date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return record_service.list_records(
        db=db,
        user_id=current_user.id,
        type_filter=type,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=RecordResponse, status_code=status.HTTP_201_CREATED)
def create_record(
    data: RecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return record_service.create_record(db, current_user.id, data)


@router.get("/summary/monthly")
def get_monthly_summary(
    month: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return record_service.monthly_summary(db, current_user.id, month)


@router.get("/summary/category")
def get_category_summary(
    month: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return record_service.category_summary(db, current_user.id, month)


@router.post("/import/preview", response_model=CSVPreview)
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = (await file.read()).decode("utf-8")
    return record_service.preview_csv(db, current_user.id, content)


@router.post("/import", response_model=CSVImportResult)
async def import_records(
    file: UploadFile = File(...),
    skip_duplicates: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = (await file.read()).decode("utf-8")
    return record_service.import_csv(db, current_user.id, content, skip_duplicates=skip_duplicates)


@router.get("/export", response_class=PlainTextResponse)
def export_records(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv_data = record_service.export_csv(db, current_user.id, month)
    return PlainTextResponse(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=finora_records.csv"},
    )


@router.get("/{record_id}", response_model=RecordResponse)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return record_service.get_record(db, current_user.id, record_id)


@router.put("/{record_id}", response_model=RecordResponse)
def update_record(
    record_id: int,
    data: RecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return record_service.update_record(db, current_user.id, record_id, data)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record_service.delete_record(db, current_user.id, record_id)
