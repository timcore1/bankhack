from datetime import datetime, timedelta, timezone
from decimal import Decimal
import time

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.database import Base, SessionLocal, engine
from app.models import Transaction, User
from app.security import hash_password


def wait_for_db(max_attempts: int = 20, delay_seconds: float = 1.5) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError:
            if attempt == max_attempts:
                raise
            time.sleep(delay_seconds)


def seed_database() -> None:
    wait_for_db()
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing_users = db.query(User).count()
        if existing_users > 0:
            print("BankHack DB: данные уже инициализированы, пропускаем seed.")
            return

        now = datetime.now(timezone.utc)

        user1 = User(
            username="user1",
            password_hash=hash_password("user1pass"),
            role="user",
            balance=Decimal("100.00"),
        )
        vip_client = User(
            username="vip_client",
            password_hash=hash_password("vippass123"),
            role="vip",
            balance=Decimal("50000.00"),
        )
        admin = User(
            username="admin",
            password_hash=hash_password("adminpass123"),
            role="admin",
            balance=Decimal("100000.00"),
        )

        db.add_all([user1, vip_client, admin])
        db.flush()

        # Пара тестовых транзакций для наглядной истории и графика баланса
        tx1 = Transaction(
            from_id=admin.id,
            to_id=user1.id,
            amount=Decimal("150.00"),
            comment="Приветственный бонус новым клиентам NeoBank",
            created_at=now - timedelta(days=3, hours=4),
        )
        tx2 = Transaction(
            from_id=user1.id,
            to_id=vip_client.id,
            amount=Decimal("50.00"),
            comment="Оплата подписки Premium Lounge",
            created_at=now - timedelta(days=1, hours=6),
        )
        tx3 = Transaction(
            from_id=admin.id,
            to_id=vip_client.id,
            amount=Decimal("5000.00"),
            comment="Кэшбэк VIP Private · Код сброса пароля: VIP-RESET-7392 | BANKHACK{idor_vip_tx_leak}",
            created_at=now - timedelta(hours=12),
        )

        db.add_all([tx1, tx2, tx3])
        db.commit()
        print("BankHack DB: пользователи и тестовые транзакции успешно созданы.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
