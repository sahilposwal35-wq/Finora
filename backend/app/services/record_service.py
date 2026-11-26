import csv
import hashlib
import io
import math
from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_
from fastapi import HTTPException, status

from app.models.models import FinancialRecord, TransactionType, Category
from app.schemas.schemas import (
    RecordCreate, RecordUpdate, RecordResponse,
    PaginatedRecords, CSVPreviewRow, CSVPreview, CSVImportResult,
)


def _record_to_response(record: FinancialRecord) -> RecordResponse:
    return RecordResponse(
        id=record.id,
        user_id=record.user_id,
        category_id=record.category_id,
        category_name=record.category.name if record.category else None,
        type=record.type.value if isinstance(record.type, TransactionType) else record.type,
        amount=record.amount,
        description=record.description,
        transaction_date=record.transaction_date,
        notes=record.notes,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _compute_fingerprint(txn_date: date, amount: Decimal, description: str, txn_type: str) -> str:
    raw = f"{txn_date.isoformat()}|{amount}|{description.strip().lower()}|{txn_type}"
    return hashlib.sha256(raw.encode()).hexdigest()


def create_record(db: Session, user_id: int, data: RecordCreate) -> RecordResponse:
    record = FinancialRecord(
        user_id=user_id,
        category_id=data.category_id,
        type=TransactionType(data.type),
        amount=data.amount,
        description=data.description,
        transaction_date=data.transaction_date,
        notes=data.notes,
        import_fingerprint=_compute_fingerprint(
            data.transaction_date, data.amount, data.description, data.type
        ),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _record_to_response(record)


def get_record(db: Session, user_id: int, record_id: int) -> RecordResponse:
    record = (
        db.query(FinancialRecord)
        .filter(FinancialRecord.id == record_id, FinancialRecord.user_id == user_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return _record_to_response(record)


def list_records(
    db: Session,
    user_id: int,
    type_filter: Optional[str] = None,
    category_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    sort_by: str = "transaction_date",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> PaginatedRecords:
    query = db.query(FinancialRecord).filter(FinancialRecord.user_id == user_id)

    if type_filter:
        query = query.filter(FinancialRecord.type == TransactionType(type_filter))
    if category_id:
        query = query.filter(FinancialRecord.category_id == category_id)
    if date_from:
        query = query.filter(FinancialRecord.transaction_date >= date_from)
    if date_to:
        query = query.filter(FinancialRecord.transaction_date <= date_to)
    if search:
        query = query.filter(
            or_(
                FinancialRecord.description.ilike(f"%{search}%"),
                FinancialRecord.notes.ilike(f"%{search}%"),
            )
        )

    total = query.count()

    # Sorting
    sort_column = getattr(FinancialRecord, sort_by, FinancialRecord.transaction_date)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    total_pages = max(1, math.ceil(total / page_size))
    offset = (page - 1) * page_size
    records = query.offset(offset).limit(page_size).all()

    return PaginatedRecords(
        items=[_record_to_response(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


def update_record(db: Session, user_id: int, record_id: int, data: RecordUpdate) -> RecordResponse:
    record = (
        db.query(FinancialRecord)
        .filter(FinancialRecord.id == record_id, FinancialRecord.user_id == user_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")

    update_data = data.model_dump(exclude_unset=True)
    if "type" in update_data and update_data["type"] is not None:
        update_data["type"] = TransactionType(update_data["type"])
    for field, value in update_data.items():
        setattr(record, field, value)
    # Recompute fingerprint
    record.import_fingerprint = _compute_fingerprint(
        record.transaction_date, record.amount, record.description,
        record.type.value if isinstance(record.type, TransactionType) else record.type,
    )
    db.commit()
    db.refresh(record)
    return _record_to_response(record)


def delete_record(db: Session, user_id: int, record_id: int) -> None:
    record = (
        db.query(FinancialRecord)
        .filter(FinancialRecord.id == record_id, FinancialRecord.user_id == user_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    db.delete(record)
    db.commit()


def monthly_summary(db: Session, user_id: int, month: str) -> dict:
    """Get income/expense totals for a YYYY-MM month."""
    year, mon = int(month[:4]), int(month[5:7])
    records = (
        db.query(FinancialRecord)
        .filter(
            FinancialRecord.user_id == user_id,
            extract("year", FinancialRecord.transaction_date) == year,
            extract("month", FinancialRecord.transaction_date) == mon,
        )
        .all()
    )
    income = sum((r.amount for r in records if r.type == TransactionType.INCOME), Decimal("0"))
    expenses = sum((r.amount for r in records if r.type == TransactionType.EXPENSE), Decimal("0"))
    return {
        "month": month,
        "total_income": income,
        "total_expenses": expenses,
        "net": income - expenses,
    }


def category_summary(db: Session, user_id: int, month: str) -> List[dict]:
    """Get spending by category for a YYYY-MM month."""
    year, mon = int(month[:4]), int(month[5:7])
    results = (
        db.query(
            Category.id,
            Category.name,
            FinancialRecord.type,
            func.sum(FinancialRecord.amount).label("total"),
        )
        .join(Category, FinancialRecord.category_id == Category.id)
        .filter(
            FinancialRecord.user_id == user_id,
            extract("year", FinancialRecord.transaction_date) == year,
            extract("month", FinancialRecord.transaction_date) == mon,
        )
        .group_by(Category.id, Category.name, FinancialRecord.type)
        .all()
    )
    return [
        {
            "category_id": r.id,
            "category_name": r.name,
            "type": r.type.value if isinstance(r.type, TransactionType) else r.type,
            "total": r.total or Decimal("0"),
        }
        for r in results
    ]


def export_csv(db: Session, user_id: int, month: Optional[str] = None) -> str:
    """Generate CSV string of records."""
    query = db.query(FinancialRecord).filter(FinancialRecord.user_id == user_id)
    if month:
        year, mon = int(month[:4]), int(month[5:7])
        query = query.filter(
            extract("year", FinancialRecord.transaction_date) == year,
            extract("month", FinancialRecord.transaction_date) == mon,
        )
    query = query.order_by(FinancialRecord.transaction_date.desc())
    records = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "type", "amount", "category", "description", "notes"])
    for r in records:
        writer.writerow([
            r.transaction_date.isoformat(),
            r.type.value if isinstance(r.type, TransactionType) else r.type,
            str(r.amount),
            r.category.name if r.category else "",
            r.description,
            r.notes or "",
        ])
    return output.getvalue()


def preview_csv(db: Session, user_id: int, csv_content: str) -> CSVPreview:
    """Preview CSV import with validation and duplicate detection."""
    reader = csv.DictReader(io.StringIO(csv_content))
    rows: List[CSVPreviewRow] = []
    valid_count = 0
    invalid_count = 0
    duplicate_count = 0

    existing_fingerprints = set(
        fp[0] for fp in
        db.query(FinancialRecord.import_fingerprint)
        .filter(FinancialRecord.user_id == user_id, FinancialRecord.import_fingerprint.isnot(None))
        .all()
    )

    for idx, row in enumerate(reader, start=1):
        errors: List[str] = []
        txn_type = (row.get("type") or "").strip().lower()
        amount_str = (row.get("amount") or "").strip()
        description = (row.get("description") or "").strip()
        date_str = (row.get("date") or row.get("transaction_date") or "").strip()
        category = (row.get("category") or "").strip()
        notes = (row.get("notes") or "").strip()

        if txn_type not in ("income", "expense"):
            errors.append(f"Invalid type '{txn_type}': must be 'income' or 'expense'")

        parsed_amount: Optional[Decimal] = None
        try:
            parsed_amount = Decimal(amount_str)
            if parsed_amount <= 0:
                errors.append("Amount must be greater than 0")
        except Exception:
            errors.append(f"Invalid amount '{amount_str}'")

        if not description:
            errors.append("Description is required")

        parsed_date: Optional[str] = None
        try:
            from datetime import date as dt_date
            d = dt_date.fromisoformat(date_str)
            parsed_date = date_str
        except Exception:
            errors.append(f"Invalid date '{date_str}'")

        is_valid = len(errors) == 0
        is_duplicate = False
        if is_valid and parsed_amount is not None:
            fp = _compute_fingerprint(d, parsed_amount, description, txn_type)
            if fp in existing_fingerprints:
                is_duplicate = True
                duplicate_count += 1

        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1

        rows.append(CSVPreviewRow(
            row_number=idx,
            type=txn_type if txn_type else None,
            amount=parsed_amount,
            category=category or None,
            description=description or None,
            transaction_date=parsed_date,
            notes=notes or None,
            is_valid=is_valid,
            errors=errors,
            is_duplicate=is_duplicate,
        ))

    return CSVPreview(
        total_rows=len(rows),
        valid_rows=valid_count,
        invalid_rows=invalid_count,
        duplicate_rows=duplicate_count,
        rows=rows,
    )


def import_csv(db: Session, user_id: int, csv_content: str, skip_duplicates: bool = True) -> CSVImportResult:
    """Import records from CSV."""
    preview = preview_csv(db, user_id, csv_content)
    imported = 0
    skipped = 0
    errors: List[str] = []

    # Resolve categories
    categories = {
        c.name.lower(): c.id
        for c in db.query(Category)
        .filter((Category.user_id == user_id) | (Category.is_system == True))
        .all()
    }

    for row in preview.rows:
        if not row.is_valid:
            errors.append(f"Row {row.row_number}: {'; '.join(row.errors)}")
            skipped += 1
            continue
        if row.is_duplicate and skip_duplicates:
            skipped += 1
            continue

        category_id = None
        if row.category:
            category_id = categories.get(row.category.lower())

        from datetime import date as dt_date
        record = FinancialRecord(
            user_id=user_id,
            category_id=category_id,
            type=TransactionType(row.type),
            amount=row.amount,
            description=row.description or "",
            transaction_date=dt_date.fromisoformat(row.transaction_date),
            notes=row.notes,
            import_fingerprint=_compute_fingerprint(
                dt_date.fromisoformat(row.transaction_date),
                row.amount,
                row.description or "",
                row.type,
            ),
        )
        db.add(record)
        imported += 1

    if imported > 0:
        db.commit()

    return CSVImportResult(imported=imported, skipped=skipped, errors=errors)
