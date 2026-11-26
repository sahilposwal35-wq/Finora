from datetime import date
from decimal import Decimal
import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.models import RecurrenceFrequency
from app.services.category_service import seed_system_categories
from app.services.recurring_service import _add_months

SQLALCHEMY_TEST_URL = "sqlite:///./test_finora.db"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        seed_system_categories(db)
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def register_and_login(email: str, password: str = "password123", name: str = "Test User") -> dict:
    res = client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_register_login_and_unauthorized():
    # Unauthorized without token
    assert client.get("/api/records/").status_code == 401

    headers = register_and_login("alice@example.com")
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"

    # Login with OAuth2 form
    login_res = client.post(
        "/api/auth/login",
        data={"username": "alice@example.com", "password": "password123"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


def test_cross_user_isolation_and_record_crud():
    alice = register_and_login("alice@example.com", name="Alice")
    bob = register_and_login("bob@example.com", name="Bob")

    cats = client.get("/api/categories/", headers=alice).json()
    food_id = next(c["id"] for c in cats if c["name"] == "Food")

    # Validation: negative amount rejected
    bad = client.post(
        "/api/records/",
        headers=alice,
        json={
            "type": "expense",
            "amount": "-50.00",
            "category_id": food_id,
            "description": "Invalid",
            "transaction_date": "2026-11-10",
        },
    )
    assert bad.status_code == 422

    # Create record as Alice
    created = client.post(
        "/api/records/",
        headers=alice,
        json={
            "type": "expense",
            "amount": "450.50",
            "category_id": food_id,
            "description": "Lunch",
            "transaction_date": "2026-11-10",
        },
    )
    assert created.status_code == 201
    rec_id = created.json()["id"]

    # Bob cannot access, update, or delete Alice's record
    assert client.get(f"/api/records/{rec_id}", headers=bob).status_code == 404
    assert client.put(f"/api/records/{rec_id}", headers=bob, json={"description": "Hacked"}).status_code == 404
    assert client.delete(f"/api/records/{rec_id}", headers=bob).status_code == 404

    # Alice can update and delete
    updated = client.put(f"/api/records/{rec_id}", headers=alice, json={"amount": "500.00"})
    assert updated.status_code == 200
    assert Decimal(updated.json()["amount"]) == Decimal("500.00")

    assert client.delete(f"/api/records/{rec_id}", headers=alice).status_code == 204
    assert client.get(f"/api/records/{rec_id}", headers=alice).status_code == 404


def test_budgets_and_drift():
    headers = register_and_login("budget@example.com")
    cats = client.get("/api/categories/", headers=headers).json()
    food_id = next(c["id"] for c in cats if c["name"] == "Food")

    b_res = client.post(
        "/api/budgets/",
        headers=headers,
        json={"category_id": food_id, "budget_month": "2026-11", "budget_amount": "5000.00"},
    )
    assert b_res.status_code == 201

    client.post(
        "/api/records/",
        headers=headers,
        json={
            "type": "expense",
            "amount": "4500.00",
            "category_id": food_id,
            "description": "Big grocery haul",
            "transaction_date": "2026-11-05",
        },
    )

    budgets = client.get("/api/budgets/?month=2026-11", headers=headers).json()
    assert len(budgets) == 1
    assert Decimal(budgets[0]["spent"]) == Decimal("4500.00")
    assert Decimal(budgets[0]["remaining"]) == Decimal("500.00")
    assert budgets[0]["utilization_pct"] == 90.0

    drift = client.get("/api/budgets/drift?month=2026-11", headers=headers).json()
    assert len(drift) == 1
    assert drift[0]["category_name"] == "Food"


def test_recurring_month_end_dates():
    # Jan 31 -> Feb 28 (non-leap 2026) -> Mar 31
    orig = date(2026, 1, 31)
    feb = _add_months(orig, orig, 1)
    assert feb == date(2026, 2, 28)
    mar = _add_months(orig, feb, 1)
    assert mar == date(2026, 3, 31)

    # Leap year 2024: Jan 31 -> Feb 29
    orig_leap = date(2024, 1, 31)
    feb_leap = _add_months(orig_leap, orig_leap, 1)
    assert feb_leap == date(2024, 2, 29)

    # Jan 30 -> Feb 28 (2026)
    orig_30 = date(2026, 1, 30)
    assert _add_months(orig_30, orig_30, 1) == date(2026, 2, 28)


def test_duplicate_csv_import():
    headers = register_and_login("csv@example.com")
    csv_data = (
        "date,type,amount,category,description,notes\n"
        "2026-11-01,income,50000,Salary,Monthly Salary,Nov\n"
        "2026-11-02,expense,1200,Food,Groceries,Weekly\n"
    )

    # First import
    res1 = client.post(
        "/api/records/import",
        headers=headers,
        files={"file": ("records.csv", io.BytesIO(csv_data.encode()), "text/csv")},
    )
    assert res1.status_code == 200
    assert res1.json()["imported"] == 2
    assert res1.json()["skipped"] == 0

    # Preview second import -> detects duplicates
    prev = client.post(
        "/api/records/import/preview",
        headers=headers,
        files={"file": ("records.csv", io.BytesIO(csv_data.encode()), "text/csv")},
    )
    assert prev.status_code == 200
    assert prev.json()["duplicate_rows"] == 2

    # Second import skips duplicates
    res2 = client.post(
        "/api/records/import",
        headers=headers,
        files={"file": ("records.csv", io.BytesIO(csv_data.encode()), "text/csv")},
    )
    assert res2.status_code == 200
    assert res2.json()["imported"] == 0
    assert res2.json()["skipped"] == 2


def test_safe_to_spend_reports_and_whatif_no_mutation():
    headers = register_and_login("sim@example.com")
    client.put(
        "/api/auth/me",
        headers=headers,
        json={"monthly_savings_target": "5000.00"},
    )
    cats = client.get("/api/categories/", headers=headers).json()
    food_id = next(c["id"] for c in cats if c["name"] == "Food")
    sal_id = next(c["id"] for c in cats if c["name"] == "Salary")

    client.post(
        "/api/records/",
        headers=headers,
        json={
            "type": "income",
            "amount": "30000.00",
            "category_id": sal_id,
            "description": "Salary",
            "transaction_date": "2026-11-01",
        },
    )
    client.post(
        "/api/records/",
        headers=headers,
        json={
            "type": "expense",
            "amount": "5000.00",
            "category_id": food_id,
            "description": "Food",
            "transaction_date": "2026-11-05",
        },
    )

    sts = client.get("/api/dashboard/safe-to-spend?month=2026-11", headers=headers)
    assert sts.status_code == 200
    assert Decimal(sts.json()["remaining_safe_to_spend"]) == Decimal("20000.00")

    report = client.get("/api/reports/monthly?month=2026-11", headers=headers)
    assert report.status_code == 200
    assert Decimal(report.json()["net_change"]) == Decimal("25000.00")

    sim = client.post(
        "/api/whatif/simulate?month=2026-11",
        headers=headers,
        json={
            "adjustments": [
                {"type": "expense_add", "amount": 3000, "description": "Trip"},
                {"type": "income_change", "amount": 5000, "description": "Bonus"},
            ]
        },
    )
    assert sim.status_code == 200
    sim_data = sim.json()
    assert sim_data["simulated"]["remaining_safe_to_spend"] == 22000.0

    # Ensure DB was NOT mutated
    records_after = client.get("/api/records/", headers=headers).json()
    assert records_after["total"] == 2
