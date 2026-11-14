from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user: User, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(raw_token: str) -> Dict[str, Any]:
    """Декодирует и верифицирует JWT, возвращая payload целиком."""
    return jwt.decode(
        raw_token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )


def get_token_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется авторизация",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or not credentials.credentials:
        raise credentials_exception

    try:
        return decode_access_token(credentials.credentials)
    except (jwt.InvalidTokenError, ValueError):
        raise credentials_exception


def _load_user_from_subject(payload: Dict[str, Any], db: Session) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется авторизация",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id_raw = payload.get("sub")
    if user_id_raw is None:
        raise credentials_exception

    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_user(
    payload: Dict[str, Any] = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> User:
    return _load_user_from_subject(payload, db)


def require_admin(
    payload: Dict[str, Any] = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> User:
    # Намеренная уязвимость CTF #3: роль берётся из клейма JWT, а не из БД.
    # Достаточно переподписать токен известным секретом и выставить role="admin".
    token_role = payload.get("role")
    if not isinstance(token_role, str) or token_role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ только для администраторов",
        )

    return _load_user_from_subject(payload, db)
