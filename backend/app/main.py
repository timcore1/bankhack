import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from typing import List

import jinja2
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, or_, text, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.database import Base, engine, get_db
from app.models import Transaction, User
from app.schemas import (
    AdminAccountRow,
    AdminExportRequest,
    AdminExportResponse,
    BalancePoint,
    DashboardResponse,
    LoginRequest,
    RecipientItem,
    TokenResponse,
    TransactionOut,
    TransferRequest,
    UserPublic,
)
from app.security import create_access_token, get_current_user, require_admin, verify_password

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BankHack NeoBank API",
    description="Образовательная CTF-лаборатория: базовое безопасное ядро интернет-банка",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize_transactions(user: User, txs: List[Transaction]) -> List[TransactionOut]:
    result: List[TransactionOut] = []
    for tx in txs:
        direction = "outgoing" if tx.from_id == user.id else "incoming"
        result.append(
            TransactionOut(
                id=tx.id,
                from_id=tx.from_id,
                to_id=tx.to_id,
                from_username=tx.sender.username if tx.sender else f"user#{tx.from_id}",
                to_username=tx.recipient.username if tx.recipient else f"user#{tx.to_id}",
                direction=direction,
                amount=tx.amount,
                comment=tx.comment,
                created_at=tx.created_at,
            )
        )
    return result


def build_balance_history(user: User, txs_desc: List[Transaction]) -> List[BalancePoint]:
    current = Decimal(user.balance)
    if not txs_desc:
        return [
            BalancePoint(label="Старт", balance=float(current)),
            BalancePoint(label="Сейчас", balance=float(current)),
        ]

    points_reversed: List[BalancePoint] = [
        BalancePoint(label="Сейчас", balance=float(current))
    ]
    running = current

    for tx in txs_desc[:10]:
        delta = Decimal(tx.amount)
        if tx.to_id == user.id:
            running -= delta
        elif tx.from_id == user.id:
            running += delta
        label = tx.created_at.strftime("%d.%m %H:%M")
        points_reversed.append(
            BalancePoint(label=label, balance=float(max(running, Decimal("0.00"))))
        )

    points_reversed.reverse()
    if len(points_reversed) > 1:
        points_reversed[0] = BalancePoint(label="Начало", balance=points_reversed[0].balance)
    return points_reversed



@app.get("/api/health")
def healthcheck():
    return {"status": "ok", "service": "bankhack-backend"}


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    token = create_access_token(user)
    return TokenResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@app.get("/api/me", response_model=UserPublic)
def get_me(current_user: User = Depends(get_current_user)):
    return UserPublic.model_validate(current_user)


@app.get("/api/transactions", response_model=List[TransactionOut])
def get_my_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    txs = (
        db.query(Transaction)
        .options(joinedload(Transaction.sender), joinedload(Transaction.recipient))
        .filter(or_(Transaction.from_id == current_user.id, Transaction.to_id == current_user.id))
        .order_by(desc(Transaction.created_at), desc(Transaction.id))
        .all()
    )
    return serialize_transactions(current_user, txs)


# Намеренная уязвимость CTF #1: IDOR — отсутствует проверка current_user.id == user_id
@app.get("/api/v1/transactions/{user_id}", response_model=List[TransactionOut])
def get_user_transactions_idor(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    txs = (
        db.query(Transaction)
        .options(joinedload(Transaction.sender), joinedload(Transaction.recipient))
        .filter(or_(Transaction.from_id == target_user.id, Transaction.to_id == target_user.id))
        .order_by(desc(Transaction.created_at), desc(Transaction.id))
        .all()
    )
    return serialize_transactions(target_user, txs)


@app.get("/api/dashboard", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    txs = (
        db.query(Transaction)
        .options(joinedload(Transaction.sender), joinedload(Transaction.recipient))
        .filter(or_(Transaction.from_id == current_user.id, Transaction.to_id == current_user.id))
        .order_by(desc(Transaction.created_at), desc(Transaction.id))
        .all()
    )

    recipients = (
        db.query(User)
        .filter(User.id != current_user.id)
        .order_by(User.id.asc())
        .all()
    )

    return DashboardResponse(
        user=UserPublic.model_validate(current_user),
        transactions=serialize_transactions(current_user, txs),
        recipients=[RecipientItem.model_validate(r) for r in recipients],
        balance_history=build_balance_history(current_user, txs),
    )


# Намеренная уязвимость CTF #2: Race Condition (TOCTOU)
# Чтение и проверка баланса выполняются отдельным запросом без SELECT ... FOR UPDATE,
# затем следует искусственная задержка asyncio.sleep(0.2), и только потом UPDATE счёта.
@app.post("/api/v1/transfer", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
@app.post("/api/transfer", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def transfer_funds(
    payload: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.to_username == current_user.username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя выполнить перевод самому себе",
        )

    recipient = db.query(User).filter(User.username == payload.to_username).first()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Получатель не найден",
        )

    amount = payload.amount.quantize(Decimal("0.01"))
    if amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма перевода должна быть положительной",
        )

    # Шаг 1: отдельный запрос на чтение и проверку баланса (без блокировки строки)
    sender_balance = (
        db.query(User.balance)
        .filter(User.id == current_user.id)
        .scalar()
    )
    if sender_balance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Отправитель не найден",
        )

    sender_balance = Decimal(sender_balance)
    if sender_balance < amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недостаточно средств на счёте",
        )

    # Искусственное окно гонки между проверкой и списанием
    await asyncio.sleep(0.2)

    # Шаг 2: отдельный запрос на обновление балансов
    new_sender_balance = sender_balance - amount
    db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(balance=new_sender_balance)
    )
    db.execute(
        update(User)
        .where(User.id == recipient.id)
        .values(balance=User.balance + amount)
    )

    tx = Transaction(
        from_id=current_user.id,
        to_id=recipient.id,
        amount=amount,
        comment=payload.comment or "Перевод средств",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return TransactionOut(
        id=tx.id,
        from_id=tx.from_id,
        to_id=tx.to_id,
        from_username=current_user.username,
        to_username=recipient.username,
        direction="outgoing",
        amount=tx.amount,
        comment=tx.comment,
        created_at=tx.created_at,
    )


# Намеренная уязвимость CTF #3a: SQL Injection.
# Параметр поиска подставляется в сырой SQL через f-string (конкатенация строк),
# без параметризации и без экранирования.
#
# Намеренная уязвимость CTF #3b: SSTI.
# Пользовательский "шаблон" рендерится через Jinja2 с автоэкранированием по умолчанию
# выключенным (autoescape=False) и с полным доступом к встроенным глобалам Jinja2.
SQL_INJECTION_QUERY = (
    "SELECT id, username, role, balance FROM users "
    "WHERE username ILIKE '%{search}%' OR role ILIKE '%{search}%' "
    "ORDER BY id"
)

_DEFAULT_COMMENT_TEMPLATE = "Выписка сформирована для запроса: {{ search }}"


def _safe_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _safe_str(value) -> str:
    return "" if value is None else str(value)


def _safe_decimal(value) -> Decimal:
    try:
        return Decimal(str(value))
    except (TypeError, ValueError, ArithmeticError):
        return Decimal("0.00")


def _render_admin_comment(template_source: str, search: str) -> str:
    # Jinja2 без песочницы и без экранирования — намеренно небезопасный рендер.
    env = jinja2.Environment(autoescape=False)
    return env.from_string(template_source or _DEFAULT_COMMENT_TEMPLATE).render(
        search=search,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def _run_admin_export(payload: AdminExportRequest, db: Session) -> AdminExportResponse:
    search = payload.search or ""
    query = SQL_INJECTION_QUERY.format(search=search)

    try:
        result = db.execute(text(query))
        raw_rows = result.mappings().all()
    except SQLAlchemyError as exc:
        # Возвращаем текст ошибки и сам запрос — это упрощает эксплуатацию лаборатории.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Ошибка выполнения запроса выписки",
                "error": str(exc.__cause__ or exc).strip(),
                "query": query,
            },
        )

    rows: List[AdminAccountRow] = []
    for raw in raw_rows:
        rows.append(
            AdminAccountRow(
                id=_safe_int(raw.get("id")),
                username=_safe_str(raw.get("username")),
                role=_safe_str(raw.get("role")),
                balance=_safe_decimal(raw.get("balance")),
            )
        )

    try:
        rendered = _render_admin_comment(payload.template or "", search)
    except jinja2.TemplateError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Ошибка рендеринга комментария к выписке",
                "error": str(exc),
                "template": payload.template,
            },
        )

    return AdminExportResponse(
        query=query,
        rows=rows,
        rendered_comment=rendered,
        total=len(rows),
    )


@app.post("/api/admin/export", response_model=AdminExportResponse)
@app.post("/admin/export", response_model=AdminExportResponse)
def admin_export(
    payload: AdminExportRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _run_admin_export(payload, db)


@app.get("/api/admin/export", response_model=AdminExportResponse)
@app.get("/admin/export", response_model=AdminExportResponse)
def admin_export_get(
    search: str = "",
    template: str = "",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _run_admin_export(AdminExportRequest(search=search, template=template), db)
