from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="user")
    balance = Column(Numeric(12, 2), nullable=False, default=0)

    sent_transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.from_id",
        back_populates="sender",
    )
    received_transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.to_id",
        back_populates="recipient",
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    from_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    to_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    comment = Column(Text, nullable=False, default="")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    sender = relationship("User", foreign_keys=[from_id], back_populates="sent_transactions")
    recipient = relationship("User", foreign_keys=[to_id], back_populates="received_transactions")
