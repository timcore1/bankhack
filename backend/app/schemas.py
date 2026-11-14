from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class UserPublic(BaseModel):
    id: int
    username: str
    role: str
    balance: Decimal

    model_config = {"from_attributes": True}


class RecipientItem(BaseModel):
    id: int
    username: str
    role: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class TransferRequest(BaseModel):
    to_username: str = Field(..., min_length=1, max_length=64)
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    comment: Optional[str] = Field(default="", max_length=255)

    @field_validator("to_username")
    @classmethod
    def clean_username(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Имя получателя не может быть пустым")
        return cleaned

    @field_validator("comment")
    @classmethod
    def clean_comment(cls, value: Optional[str]) -> str:
        return (value or "").strip()


class TransactionOut(BaseModel):
    id: int
    from_id: int
    to_id: int
    from_username: str
    to_username: str
    direction: str
    amount: Decimal
    comment: str
    created_at: datetime


class BalancePoint(BaseModel):
    label: str
    balance: float


class DashboardResponse(BaseModel):
    user: UserPublic
    transactions: List[TransactionOut]
    recipients: List[RecipientItem]
    balance_history: List[BalancePoint]


class AdminExportRequest(BaseModel):
    search: str = Field(default="", max_length=512)
    template: Optional[str] = Field(default="", max_length=1024)


class AdminAccountRow(BaseModel):
    id: int
    username: str
    role: str
    balance: Decimal


class AdminExportResponse(BaseModel):
    query: str
    rows: List[AdminAccountRow]
    rendered_comment: str
    total: int
