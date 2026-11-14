import os


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://bankhack:bankhack_secret@db:5432/bankhack",
    )
    # Намеренная уязвимость CTF #3: слабый секрет JWT из словаря (см. wordlist.txt).
    # Токен можно переподписать и выставить role="admin".
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecret123")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))


settings = Settings()
