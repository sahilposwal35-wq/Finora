import hashlib
from datetime import date
from decimal import Decimal

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.models import (
    User,
    Category,
    FinancialRecord,
    TransactionType,
    MonthlyBudget,
    RecurringExpense,
    RecurrenceFrequency,
    FinancialGoal,
)
from app.services.category_service import seed_system_categories


def _fp(d: date, amt: Decimal, desc: str, t: str) -> str:
    raw = f"{d.isoformat()}|{amt}|{desc.strip().lower()}|{t}"
    return hashlib.sha256(raw.encode()).hexdigest()


def seed_database() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_system_categories(db)

        user = db.query(User).filter(User.email == "demo@finora.app").first()
        if user:
            print("Demo user already exists; skipping seed.")
            return

        user = User(
            name="Aarav Sharma",
            email="demo@finora.app",
            password_hash=hash_password("demo1234"),
            currency="INR",
            monthly_income=Decimal("55000.00"),
            monthly_savings_target=Decimal("10000.00"),
            budget_warning_threshold=80,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        cats = {c.name: c.id for c in db.query(Category).all()}

        # 3 months of realistic sample records: Sep 2026, Oct 2026, Nov 2026
        sample_records = [
            # September 2026
            (TransactionType.INCOME, Decimal("55000.00"), "Salary", "Monthly Salary - September", date(2026, 9, 1)),
            (TransactionType.INCOME, Decimal("4500.00"), "Freelance", "UI Design Project", date(2026, 9, 14)),
            (TransactionType.EXPENSE, Decimal("12000.00"), "Housing", "Monthly Rent - Sep", date(2026, 9, 2)),
            (TransactionType.EXPENSE, Decimal("999.00"), "Utilities", "Fiber Internet", date(2026, 9, 5)),
            (TransactionType.EXPENSE, Decimal("1450.00"), "Utilities", "Electricity Bill", date(2026, 9, 8)),
            (TransactionType.EXPENSE, Decimal("649.00"), "Entertainment", "Netflix Subscription", date(2026, 9, 10)),
            (TransactionType.EXPENSE, Decimal("1500.00"), "Healthcare", "Gym Membership", date(2026, 9, 3)),
            (TransactionType.EXPENSE, Decimal("3200.00"), "Food", "Groceries & Vegetables", date(2026, 9, 6)),
            (TransactionType.EXPENSE, Decimal("1850.00"), "Food", "Dining Out & Coffee", date(2026, 9, 18)),
            (TransactionType.EXPENSE, Decimal("1600.00"), "Transport", "Metro Pass & Auto", date(2026, 9, 4)),
            (TransactionType.EXPENSE, Decimal("2400.00"), "Shopping", "Casual Sneakers", date(2026, 9, 21)),

            # October 2026
            (TransactionType.INCOME, Decimal("55000.00"), "Salary", "Monthly Salary - October", date(2026, 10, 1)),
            (TransactionType.INCOME, Decimal("6000.00"), "Freelance", "API Integration Gig", date(2026, 10, 19)),
            (TransactionType.EXPENSE, Decimal("12000.00"), "Housing", "Monthly Rent - Oct", date(2026, 10, 2)),
            (TransactionType.EXPENSE, Decimal("999.00"), "Utilities", "Fiber Internet", date(2026, 10, 5)),
            (TransactionType.EXPENSE, Decimal("1320.00"), "Utilities", "Electricity Bill", date(2026, 10, 9)),
            (TransactionType.EXPENSE, Decimal("649.00"), "Entertainment", "Netflix Subscription", date(2026, 10, 10)),
            (TransactionType.EXPENSE, Decimal("1500.00"), "Healthcare", "Gym Membership", date(2026, 10, 3)),
            (TransactionType.EXPENSE, Decimal("3600.00"), "Food", "Monthly Groceries", date(2026, 10, 7)),
            (TransactionType.EXPENSE, Decimal("2200.00"), "Food", "Festive Dinner with Friends", date(2026, 10, 22)),
            (TransactionType.EXPENSE, Decimal("1750.00"), "Transport", "Metro & Cab Rides", date(2026, 10, 11)),
            (TransactionType.EXPENSE, Decimal("4500.00"), "Shopping", "Diwali Gifts & Clothes", date(2026, 10, 24)),
            (TransactionType.EXPENSE, Decimal("1200.00"), "Education", "Online Python Course", date(2026, 10, 15)),

            # November 2026
            (TransactionType.INCOME, Decimal("55000.00"), "Salary", "Monthly Salary - November", date(2026, 11, 1)),
            (TransactionType.INCOME, Decimal("2500.00"), "Investment", "Mutual Fund Dividend", date(2026, 11, 12)),
            (TransactionType.EXPENSE, Decimal("12000.00"), "Housing", "Monthly Rent - Nov", date(2026, 11, 2)),
            (TransactionType.EXPENSE, Decimal("999.00"), "Utilities", "Fiber Internet", date(2026, 11, 5)),
            (TransactionType.EXPENSE, Decimal("1180.00"), "Utilities", "Electricity Bill", date(2026, 11, 8)),
            (TransactionType.EXPENSE, Decimal("649.00"), "Entertainment", "Netflix Subscription", date(2026, 11, 10)),
            (TransactionType.EXPENSE, Decimal("1500.00"), "Healthcare", "Gym Membership", date(2026, 11, 3)),
            (TransactionType.EXPENSE, Decimal("3400.00"), "Food", "Groceries & Pantry", date(2026, 11, 6)),
            (TransactionType.EXPENSE, Decimal("1950.00"), "Food", "Team Lunch & Snacks", date(2026, 11, 16)),
            (TransactionType.EXPENSE, Decimal("1500.00"), "Transport", "Metro Pass & Fuel", date(2026, 11, 4)),
            (TransactionType.EXPENSE, Decimal("2100.00"), "Shopping", "Winter Jacket", date(2026, 11, 18)),
        ]

        for txn_type, amt, cat_name, desc, txn_date in sample_records:
            db.add(FinancialRecord(
                user_id=user.id,
                category_id=cats.get(cat_name),
                type=txn_type,
                amount=amt,
                description=desc,
                transaction_date=txn_date,
                import_fingerprint=_fp(txn_date, amt, desc, txn_type.value),
            ))

        # Monthly budgets for Sep, Oct, Nov 2026
        budget_plan = {
            "Housing": Decimal("12500.00"),
            "Food": Decimal("6000.00"),
            "Transport": Decimal("2500.00"),
            "Utilities": Decimal("3000.00"),
            "Entertainment": Decimal("2000.00"),
            "Shopping": Decimal("4000.00"),
            "Healthcare": Decimal("2000.00"),
        }
        for month_str in ("2026-09", "2026-10", "2026-11"):
            for cat_name, amt in budget_plan.items():
                if cat_name in cats:
                    db.add(MonthlyBudget(
                        user_id=user.id,
                        category_id=cats[cat_name],
                        budget_month=month_str,
                        budget_amount=amt,
                    ))

        # Recurring expenses
        recurring_items = [
            ("Rent", Decimal("12000.00"), "Housing", RecurrenceFrequency.MONTHLY, date(2026, 9, 2), date(2026, 12, 2)),
            ("Netflix", Decimal("649.00"), "Entertainment", RecurrenceFrequency.MONTHLY, date(2026, 9, 10), date(2026, 12, 10)),
            ("Internet", Decimal("999.00"), "Utilities", RecurrenceFrequency.MONTHLY, date(2026, 9, 5), date(2026, 12, 5)),
            ("Gym", Decimal("1500.00"), "Healthcare", RecurrenceFrequency.MONTHLY, date(2026, 9, 3), date(2026, 12, 3)),
        ]
        for title, amt, cat_name, freq, start_d, next_d in recurring_items:
            db.add(RecurringExpense(
                user_id=user.id,
                category_id=cats.get(cat_name),
                title=title,
                amount=amt,
                frequency=freq,
                start_date=start_d,
                next_due_date=next_d,
                reminder_days=3,
                is_active=True,
            ))

        # 2 Financial goals
        db.add(FinancialGoal(
            user_id=user.id,
            title="Emergency Fund",
            target_amount=Decimal("150000.00"),
            current_saved_amount=Decimal("65000.00"),
            target_date=date(2027, 8, 1),
        ))
        db.add(FinancialGoal(
            user_id=user.id,
            title="MacBook Pro Upgrade",
            target_amount=Decimal("120000.00"),
            current_saved_amount=Decimal("42000.00"),
            target_date=date(2027, 5, 1),
        ))

        db.commit()
        print("Seeded demo user (demo@finora.app / demo1234) and sample data successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
