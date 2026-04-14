# Runbook: Создание S3 Bucket'ов

> **Operational runbook** для подготовки S3 хранилища во всех окружениях email-платформы.
> Покрывает создание bucket'ов, access keys, key bindings (Garage), env vars и проверку работы.
> **С Phase 22.5 (April 2026) — Garage используется во всех 4 окружениях** (включая local), не только в hosting. Предыдущий local S3 backend больше не используется нигде в проекте.

**⚠ Синхронизация с кодом:** Если имена bucket'ов в коде изменятся, обнови этот runbook в том же PR.

Источники истины для имён bucket'ов (single source of truth — код, не этот документ):

- `apps/parser/src/parser.constants.ts:6` → `PARSER_STORAGE_BUCKET = 'parser'`
- `packages/foundation/src/external/storage/public/public.constants.ts:4` → `PUBLIC_BUCKET = 'public'`

Если эти константы меняются — runbook обязан быть обновлён в том же PR. Любое расхождение между кодом и runbook'ом ломает onboarding и debugging.

## Что покрывает этот runbook

Четыре окружения развёртывания в порядке возрастания критичности:

1. **Local-native** — `pnpm start:native`, инфра в Docker (Garage + postgres + redis + rabbitmq), сервисы на хосте
2. **Local-isolated** — `pnpm start:isolated`, всё в Docker (включая Garage)
3. **Dev Coolify/Garage** — `api.dev.email-platform.pp.ua` + Garage на `garage.dev.email-platform.pp.ua`
4. **Prod Coolify/Garage** — `api.email-platform.pp.ua` + Garage на `garage.email-platform.pp.ua`

Каждый раздел **self-contained** — его можно читать независимо от остальных. Если тебе нужен только prod — читай только prod, не нужно проходить local-native сначала.

Каждый раздел следует одной и той же 6-шаговой структуре (с под-шагом 4.5, введённым в Phase 22.4):

| Шаг | Что делаем                                                           |
| --- | -------------------------------------------------------------------- |
| 1   | Prerequisites                                                        |
| 2   | Open UI (открыть Garage WebUI)                                       |
| 3   | Create buckets (`parser`, `public`)                                  |
| 4   | Configure access (key + binding для Garage)                          |
| 4.5 | Apply anonymous read policy на `public` (`garage bucket website --allow`) |
| 5   | Set env vars (`STORAGE_*` в `.env` / Coolify)                        |
| 6   | Verify (`curl` / `wget` к `/health/ready` + smoke API + anonymous GET) |

<!-- Phase 22.4 anonymous-GET shorthand: curl${STORAGE_PUBLIC_URL}/<key> — see verify steps in each env section below. -->

> ⚠ **Garage virtual-host web endpoint (anonymous read) — Phase 22.4**
>
> Garage **НЕ поддерживает** anonymous GET на S3 API endpoint (в отличие от MinIO). Единственный способ публичной отдачи — **Garage native web endpoint** (отдельный порт, по умолчанию `3902`), который принимает **только** virtual-hosted-style URL: `Host: <bucket>.<root_domain>`. Это locked decision per OQ-1 RESOLVED — см. `.planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md` D-28/D-29/D-30.
>
> **Что это значит для `STORAGE_PUBLIC_URL`:**
> - Hostname всегда формата `public.<root_domain>` — bucket `public` переехал из path в host. Формула URL: `${STORAGE_PUBLIC_URL}/${key}` (**БЕЗ** `/public/` сегмента в path).
> - В local окружениях: `STORAGE_PUBLIC_URL=http://public.localhost:3902`, Garage `[s3_web]` секция с `root_domain=".localhost"`. `*.localhost` резолвится по RFC 6761 (macOS 10.6+, Windows 10+, glibc ≥ 2.34 — Arch/Ubuntu 22.04+/Fedora 35+, musl ≥ 1.2.4 — Alpine 3.19+). Проектный `node:20-alpine` на Alpine 3.20 (musl 1.2.5) — OK. Legacy Linux (glibc < 2.34, например Ubuntu 20.04) → одна строка в `/etc/hosts`:
>   ```bash
>   echo "127.0.0.1 public.localhost" | sudo tee -a /etc/hosts
>   ```
> - В dev/prod (Garage на Coolify): `STORAGE_PUBLIC_URL=https://public.garage[.dev].email-platform.pp.ua`, Garage `[s3_web]` секция с `root_domain=".garage[.dev].email-platform.pp.ua"`. Требуется (operator action):
>   - (a) DNS A-запись на `public.garage[.dev].email-platform.pp.ua` (на тот же IP, что и существующий `garage[.dev].email-platform.pp.ua`).
>   - (b) Coolify Traefik router с `Host:public.garage[.dev].email-platform.pp.ua` → garage container, port `3902` (НЕ 3900 — S3 API порт, там anonymous не работает).
>   - Существующий router на `garage[.dev].email-platform.pp.ua` (WebUI) остаётся неизменным — это отдельный route, отдельный Traefik labels блок.
> - Никакого Traefik path-rewrite. Никакого gateway proxy. Никакого presigned URL.
>
> **Пример `[s3_web]` секции в `garage.toml` per env:**
>
> | Env | `bind_addr`   | `root_domain`                          |
> | --- | ------------- | -------------------------------------- |
> | local-native / local-isolated | `[::]:3902` | `.localhost`                           |
> | dev (Coolify) | `[::]:3902`   | `.garage.dev.email-platform.pp.ua`     |
> | prod (Coolify) | `[::]:3902`  | `.garage.email-platform.pp.ua`         |
>
> **Forward note:** в будущей фазе планируется ребрендинг `garage` → `storage` в host names — сейчас не реализуется, но все ссылки в runbook используют env var `${STORAGE_PUBLIC_URL}` (а не хардкод доменов) чтобы переименование было one-line операцией.

> ⚠ **Private bucket'ы НЕ публичны — Phase 22.4**
>
> `parser` (и любой будущий per-service bucket) работает **только** через приложение (аутентификация на уровне app) — **никакого** `garage bucket website --allow` на них.
> Anonymous-read применяется **ровно к одному** bucket'у — `public`.
>
> **Проверка** (в каждом окружении, после Шага 4.5):
>
> ```bash
> garage bucket info parser
> # Ожидаемая строка: Website access: false
>
> garage bucket info public
> # Ожидаемая строка: Website access: true
> ```
>
> Если случайно включили website на private bucket'е — немедленно откатить:
>
> ```bash
> garage bucket website --deny parser
> ```

## Bucket'ы и env vars

**Два bucket'а** используются всеми окружениями одинаково:

| Bucket   | Имя        | Источник истины                                                            | Используется                                                                                  |
| -------- | ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `parser` | `'parser'` | `apps/parser/src/parser.constants.ts:6`                                    | parser service — промежуточные файлы парсинга                                                 |
| `public` | `'public'` | `packages/foundation/src/external/storage/public/public.constants.ts:4`    | parser (запись) + notifier (чтение) — shared файлы; в 22.4 расширится на anonymous-read для external download |

Имена bucket'ов case-sensitive. Не `Parser`, не `PUBLIC` — строго lowercase как в константах.

**Env vars** (полный список из `packages/config/src/schemas/storage.ts`):

| Переменная           | Тип               | Пример local                                                       | Пример prod                  |
| -------------------- | ----------------- | ------------------------------------------------------------------ | ---------------------------- |
| `STORAGE_PROTOCOL`   | `http` \| `https` | `http`                                                             | `https`                      |
| `STORAGE_ENDPOINT`   | hostname          | `localhost` (native) / `garage` (isolated)                         | `<garage-endpoint>`          |
| `STORAGE_PORT`       | number            | `3900`                                                             | `443`                        |
| `STORAGE_ACCESS_KEY` | string            | `GKTESTLOCAL0123456789ab`                                          | `<GARAGE_ACCESS_KEY>`        |
| `STORAGE_SECRET_KEY` | string            | `0000000000000000000000000000000000000000000000000000000000000000` | `<GARAGE_SECRET_KEY>`        |
| `STORAGE_REGION`     | string            | `garage`                                                           | `garage`                     |
| `STORAGE_PUBLIC_URL` | URL               | `http://public.localhost:3902`                                     | `https://public.garage.email-platform.pp.ua` (dev: `https://public.garage.dev.email-platform.pp.ua`) |
| `STORAGE_MAX_UPLOAD_BYTES` | number      | `104857600` (100 MiB)                                              | `104857600` (100 MiB)        |

`STORAGE_PUBLIC_URL` и `STORAGE_MAX_UPLOAD_BYTES` добавлены в Phase 22.4. Важно:

- **НЕ используй** S3 API port (3900) для `STORAGE_PUBLIC_URL` — Garage S3 API **не поддерживает** anonymous GET. Все 4 окружения идут через Garage web endpoint `3902` + virtual-host (bucket `public` в hostname). См. warning block "⚠ Garage virtual-host web endpoint" выше.
- Значение per env задаётся в `.env` / `.env.docker` / Coolify Environment Variables — хардкод доменов в коде не допускается (D-29 forward-compat).
- `STORAGE_MAX_UPLOAD_BYTES=104857600` (100 MiB) — hard ceiling для streaming upload через `@aws-sdk/lib-storage`; при превышении `NamespacedStoragePort.upload` бросает `StorageUploadTooLargeError` и multipart автоматически abort'ится (D-17/D-18).

Дополнительно (только compose, не используется кодом приложения):

| Переменная            | Тип    | Пример local                                          | Пример prod                  |
| --------------------- | ------ | ----------------------------------------------------- | ---------------------------- |
| `GARAGE_ADMIN_TOKEN`  | string | `local-dev-admin-token-static-value-for-local-only`   | `<prod-admin-token>`         |

`GARAGE_ADMIN_TOKEN` потребляется самим garage сервером и `garage-webui` сидекаром в `infra/docker-compose.infra.yml` — **оба** должны видеть одинаковое значение, иначе WebUI не сможет получить статус кластера (Pitfall 7). Это **не часть** Zod схемы `STORAGE_*` — приложение его не читает.

Reference для local значений: `.env.example:35-43`.

Все `STORAGE_*` переменные **обязательны** — Zod схема (`packages/config/src/schemas/storage.ts`) не содержит `.optional()` и `.default()`, любая отсутствующая переменная блокирует старт сервиса с validation error. **`STORAGE_BUCKET` отсутствует** — bucket name приходит из кода (`PARSER_STORAGE_BUCKET`, `PUBLIC_BUCKET`), не из env (D-27).

## Что именно проверяется в readiness

Readiness endpoint (`/health/ready`) parser'а и notifier'а выполняет `HeadBucket` против каждого привязанного bucket'а:

```typescript
// packages/foundation/src/internal/storage/s3.health.ts:18
await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
```

- **Parser** проверяет `parser` + `public` — health keys `s3:parser`, `s3:public`
- **Notifier** проверяет `public` — health key `s3:public`
- Если bucket не существует, credentials невалидны, или permissions на bucket отсутствуют → `HeadBucket` падает → readiness возвращает HTTP 503 DOWN со структурированной причиной в `error` поле

Это **единственный** механизм верификации что setup выполнен правильно. Не полагайся на "сервис стартанул" — сервис стартует даже без bucket'ов, но readiness будет DOWN.

**Почему `HeadBucket`, а не `ListBuckets` или `GetBucketLocation`:** `HeadBucket` требует минимальных permissions (`s3:ListBucket` на конкретный bucket), возвращает `200 OK` при успехе и `404 NotFound` / `403 Forbidden` при провале — идеально для health check. `ListBuckets` требует global permission которого prod credentials не имеют.

## Known gap: gateway gRPC health не видит S3 state

**Важно понимать перед verification:**

Gateway `/health/ready` опрашивает backend-сервисы через **gRPC Health protocol**. Parser и notifier регистрируют статичный `SERVING` response при старте gRPC сервера:

```typescript
// packages/foundation/src/external/grpc/grpc-server.factory.ts:13-15
const healthImpl = new HealthImplementation({
  [HEALTH.GRPC_SERVICE_OVERALL]: HEALTH.GRPC_STATUS_SERVING,
});
// Static SERVING — не отражает реальное состояние S3/backing services
```

Это означает: даже если S3 недоступен, gRPC health вернёт `SERVING`, и gateway'овый `/health/ready` покажет `status: ok`. **Через gateway S3 проблемы не видны** — gateway health отвечает только на вопрос "gRPC сервер backend'а жив и отвечает", не "backend может реально работать с S3".

Для реальной S3 верификации нужен **прямой HTTP endpoint** parser'а/notifier'а:

- **Local-native:** `curl http://localhost:3003/health/ready` (parser), `curl http://localhost:3005/health/ready` (notifier)
- **Local-isolated:** `docker compose exec parser wget -qO- http://localhost:3003/health/ready` (HTTP порт не exposed на хост в isolated режиме)
- **Coolify (dev/prod):** SSH/Terminal в parser/notifier container (HTTP port не exposed наружу через Traefik)

Альтернативно — **smoke-эндпоинты** через gateway, которые **проксируют через gRPC** в parser/notifier и реально дёргают S3 (не статичный SERVING):

- `curl http://localhost:4000/test/parser/storage-service | jq` — exercises оба bucket'а через parser
- `curl http://localhost:4000/test/notifier/storage-service | jq` — exercises `public` через notifier

Эти эндпоинты считаются acceptance gate для ручной проверки (см. шаг 6 локальных секций).

Fix gRPC health gap — **отдельная задача, не в скоупе этого runbook'а**. Runbook документирует как обходить gap через прямой endpoint и smoke API, не исправляет сам механизм. Если в будущем gRPC health начнёт реально опрашивать backing services (S3, postgres, redis, rabbitmq) — gateway `/health/ready` станет валидной точкой проверки и этот раздел будет удалён.

---

## 1. Local-native

Режим `pnpm start:native`: инфраструктура в Docker (Garage + postgres + redis + rabbitmq + garage-webui), сервисы на хосте — TypeScript код запускается напрямую через `ts-node-dev`, подключается к Docker-контейнерам по `localhost`.

### Шаг 1: Prerequisites

- Docker и Docker Compose установлены
- pnpm ≥ 9.0.0 установлен на хосте
- Порты `3900` (Garage S3 API) и `3909` (Garage WebUI) свободны на хосте
- Порты backend-сервисов (3003 parser, 3005 notifier, 3000 gateway) свободны на хосте
- Репозиторий склонирован, `.env` создан из `.env.example`

Запустить инфру (Garage + остальные backing services):

```bash
pnpm infra:up
# или напрямую:
docker compose -f infra/docker-compose.infra.yml -f infra/docker-compose.dev-ports.yml -f infra/docker-compose.webui-ports.yml up -d
```

> **Garage v2.1.0** — pinned версия (не `:latest`) для production parity. Локальная инфра должна вести себя идентично hosting'у; downgrade/upgrade Garage версий — задача отдельной phase. Конфиг живёт в `infra/docker/garage.toml` (single-node, `replication_factor=1`, sqlite metadata, `[s3_api]:3900`, `[admin]:3903`; `[s3_web]` секция намеренно отсутствует — это scope Phase 22.4).

> **garage-webui** — community-maintained image (`khairul169/garage-webui:1.1.0`, не official Deuxfleurs). Поэтому он pinned версией: если апстрим сломается — fallback на CLI через `docker compose exec garage /garage -c /etc/garage.toml ...` (см. Шаг 2).

Убедиться что Garage контейнер запущен и healthy:

```bash
docker compose -f infra/docker-compose.infra.yml ps garage
# STATUS должен быть "Up X seconds (healthy)"
```

Healthcheck использует `/garage -c /etc/garage.toml status` (а не `curl`/`wget` — image минимальный, без HTTP клиентов).

### Шаг 2: Открыть UI

Garage WebUI: **http://localhost:3909**

Login: использовать значение `GARAGE_ADMIN_TOKEN` из `.env.docker` (по умолчанию для local: `local-dev-admin-token-static-value-for-local-only` — это **намеренно статичный** local-only token, не секрет).

> Если WebUI показывает "Unable to fetch cluster status" — значит `GARAGE_ADMIN_TOKEN` не совпадает между `garage` и `garage-webui` сервисами. Оба читают одно и то же значение из `.env.docker`; убедись что файл загружен и обоим сервисам видна та же переменная (Pitfall 7).

**CLI fallback** (если WebUI недоступен):

```bash
docker compose -f infra/docker-compose.infra.yml exec garage /garage -c /etc/garage.toml bucket list
docker compose -f infra/docker-compose.infra.yml exec garage /garage -c /etc/garage.toml key list
```

### Шаг 3: Создать bucket'ы

**Канонический способ — `pnpm storage:bootstrap`** (идемпотентный helper, делает всё за один шаг):

```bash
pnpm storage:bootstrap
```

Что делает скрипт (`infra/docker/storage-bootstrap.sh`, ~97 строк):

1. Auto-discovers running garage container (поддерживает оба compose стека: infra-only и isolated).
2. Ждёт ~30s пока `garage status` не вернёт green.
3. Выполняет 7 команд по очереди: `node id -q` → `layout assign -z local -c 1G <NODE_ID>` → `layout apply --version 1` → `key import --yes ...` (флаг `--yes` обязателен — иначе CLI зависнет на интерактивном prompt'е, Pitfall 1) → `bucket create parser` → `bucket create public` → `bucket allow --key email-platform-local --read --write --owner` для обоих bucket'ов.
4. На успехе пишет marker файл `/var/lib/garage/meta/.bootstrapped` (внутри named volume `garage_meta`).

**Идемпотентность:** при повторных запусках скрипт видит marker и печатает `Already bootstrapped, skipping.` — exit 0. Безопасно дёргать в CI/recovery.

**Сброс bootstrap state** (только если volumes повредились или нужно начать с нуля):

```bash
pnpm infra:down
docker volume rm <project>_garage_meta <project>_garage_data
pnpm infra:up && pnpm storage:bootstrap
```

> ⚠ `docker volume rm` уничтожает **всё содержимое** local Garage (все bucket'ы, все объекты). На local машине это обычно неважно, но если ты хранишь там шарю или dev данные — забэкапь сначала.

После bootstrap'а проверить через WebUI или CLI: bucket'ы `parser` и `public` должны появиться в списке Buckets.

### Шаг 4: Конфигурация доступа

`pnpm storage:bootstrap` уже привязал key `email-platform-local` к **обоим** bucket'ам с правами Read+Write+Owner. Отдельный шаг не требуется — просто verify через WebUI (Buckets → выбрать bucket → Permissions tab) или CLI:

```bash
docker compose -f infra/docker-compose.infra.yml exec garage \
  /garage -c /etc/garage.toml bucket info parser
docker compose -f infra/docker-compose.infra.yml exec garage \
  /garage -c /etc/garage.toml bucket info public
# В output должен быть виден email-platform-local key с RW+Owner permissions
```

### Шаг 4.5: Применить anonymous read policy на `public` (Phase 22.4)

> ⚠ **Применяется ТОЛЬКО к bucket `public`.** Private bucket `parser` **НЕ** должен получать website access — см. warning "Private bucket'ы НЕ публичны" в начале runbook'а.

**Pre-req:** `[s3_web]` секция в `infra/docker/garage.toml`:

```toml
[s3_web]
bind_addr = "[::]:3902"
root_domain = ".localhost"
index = "index.html"
```

Если секции нет — добавить, затем `pnpm infra:down && pnpm infra:up` (перезапуск Garage контейнера чтобы применить конфиг). Порт `3902` должен быть exposed в `infra/docker-compose.dev-ports.yml` (если не exposed — добавить mapping `"3902:3902"` к garage сервису).

**Применить website mode:**

```bash
docker compose -f infra/docker-compose.infra.yml exec garage \
  /garage -c /etc/garage.toml bucket website --allow public
```

**Верификация (обязательная):**

```bash
docker compose -f infra/docker-compose.infra.yml exec garage \
  /garage -c /etc/garage.toml bucket info public
# Ожидаемая строка: Website access: true

docker compose -f infra/docker-compose.infra.yml exec garage \
  /garage -c /etc/garage.toml bucket info parser
# Ожидаемая строка: Website access: false
```

Если `parser` оказался с `Website access: true` — немедленно откатить:

```bash
docker compose -f infra/docker-compose.infra.yml exec garage \
  /garage -c /etc/garage.toml bucket website --deny parser
```

### Шаг 5: Set env vars

Для local-native режима `.env` уже содержит правильные значения если ты создал его из `.env.example`. Ключевые поля:

```bash
STORAGE_PROTOCOL=http
STORAGE_ENDPOINT=localhost
STORAGE_PORT=3900
STORAGE_ACCESS_KEY=GKTESTLOCAL0123456789ab
STORAGE_SECRET_KEY=0000000000000000000000000000000000000000000000000000000000000000
STORAGE_REGION=garage
STORAGE_PUBLIC_URL=http://public.localhost:3902
STORAGE_MAX_UPLOAD_BYTES=104857600
```

Reference для точных значений: `.env.example:35-43`.

`STORAGE_ENDPOINT=localhost` — потому что сервисы на хосте подключаются к Garage через exposed порт Docker-контейнера на `localhost:3900` (publishing настроен в `infra/docker-compose.dev-ports.yml`).

`STORAGE_REGION=garage` — Garage дефолтный region (не `us-east-1`). Mismatch региона между клиентом и сервером даст `SignatureDoesNotMatch` при подписи запросов — поэтому значение зафиксировано в коде через env, не угадывается (Pitfall 8).

`STORAGE_PUBLIC_URL=http://public.localhost:3902` — Garage web endpoint (порт 3902) + virtual-host (bucket `public` в hostname). `*.localhost` резолвится RFC 6761 (macOS 10.6+, Windows 10+, glibc ≥ 2.34, musl ≥ 1.2.4). Legacy Linux без RFC 6761 — одна строка в `/etc/hosts` (см. warning block в начале runbook'а).

`STORAGE_MAX_UPLOAD_BYTES=104857600` (100 MiB) — hard ceiling для streaming upload (D-06/D-18).

### Шаг 6: Verify

Запустить сервисы (`pnpm start:native`), затем выполнить **двойную проверку**:

**(а) Прямой readiness endpoint** (parser, в обход gateway gRPC gap):

```bash
curl -s http://localhost:3003/health/ready | jq
```

**Ожидаемый OK ответ (HTTP 200):**

```json
{
  "status": "ok",
  "info": {
    "postgres": { "status": "up" },
    "s3:parser": { "status": "up" },
    "s3:public": { "status": "up" }
  },
  "error": {},
  "details": {
    "postgres": { "status": "up" },
    "s3:parser": { "status": "up" },
    "s3:public": { "status": "up" }
  }
}
```

**Ожидаемый DOWN ответ (HTTP 503, например если bucket `parser` не создан / bootstrap не запущен):**

```json
{
  "status": "error",
  "info": {
    "postgres": { "status": "up" },
    "s3:public": { "status": "up" }
  },
  "error": {
    "s3:parser": { "status": "down", "message": "S3 bucket health check failed" }
  },
  "details": {
    "postgres": { "status": "up" },
    "s3:parser": { "status": "down", "message": "S3 bucket health check failed" },
    "s3:public": { "status": "up" }
  }
}
```

Если ответ `DOWN` — запусти `pnpm storage:bootstrap` (если ещё не запускал) и проверь через WebUI что **оба** bucket'а созданы с точными именами `parser` и `public` (case-sensitive).

Аналогично для notifier (проверяет только `s3:public`):

```bash
curl -s http://localhost:3005/health/ready | jq
```

Notifier не использует `parser` bucket, поэтому его readiness не упадёт если только `parser` bucket отсутствует — но упадёт если нет `public`.

**(б) Smoke endpoints** (через gateway → gRPC → реальный S3 round-trip):

```bash
curl -s http://localhost:4000/test/parser/storage-service | jq
```

Ожидаемая структура:

```json
{
  "buckets": [
    { "bucket": "parser", "testKey": "<random>", "steps": [ /* upload, exists, download, getSignedUrl */ ], "allPassed": true },
    { "bucket": "public", "testKey": "<random>", "steps": [ /* ... */ ], "allPassed": true }
  ]
}
```

```bash
curl -s http://localhost:4000/test/notifier/storage-service | jq
```

Ожидаемая структура:

```json
{
  "buckets": [
    { "bucket": "public", "testKey": "<random>", "steps": [ /* upload, exists, download, getSignedUrl */ ], "allPassed": true }
  ]
}
```

**(в) Anonymous-read verification** (Phase 22.4 — проверка что `public` bucket реально раздаёт файлы без аутентификации):

После того как smoke endpoint вернул `testKey` для `public` bucket'а (см. шаг (б) выше), выполни:

```bash
# Подставь testKey из smoke-ответа (buckets[?bucket==public].testKey)
curl -sS -o /dev/null -w "%{http_code}\n" "${STORAGE_PUBLIC_URL}/<testKey>"
# Expected: 200
```

**Важно:** bucket `public` находится в **hostname** (через Garage virtual-host, D-28/D-29), а **не в path** — формула URL = `${STORAGE_PUBLIC_URL}/${key}`, без `/public/` сегмента в path (D-14 amended after OQ-1 RESOLVED).

Failure modes:

- **`403`** → anonymous policy не применён. Вернуться к Шагу 4.5 → `garage bucket website --allow public`, снова `bucket info public` должно показать `Website access: true`.
- **`404`** → (a) `[s3_web]` секция в `garage.toml` отсутствует или `root_domain` не совпадает с hostname в `STORAGE_PUBLIC_URL`; (b) `*.localhost` не резолвится на этой машине (legacy glibc < 2.34) → добавить `127.0.0.1 public.localhost` в `/etc/hosts`. См. warning "⚠ Garage virtual-host web endpoint" в начале runbook'а.
- **`curl: Could not resolve host`** → DNS resolver не знает про `*.localhost`; fallback — `/etc/hosts` (см. выше).

После проверки можно почистить созданные тестовые объекты:

```bash
curl -s -X DELETE "http://localhost:4000/test/parser/storage-service?bucket=parser&key=<key-from-response>"
curl -s -X DELETE "http://localhost:4000/test/parser/storage-service?bucket=public&key=<key-from-response>"
curl -s -X DELETE "http://localhost:4000/test/notifier/storage-service?bucket=public&key=<key-from-response>"
```

### Сброс до чистого состояния (reset to clean state)

Когда нужно с нуля переиграть провижининг (например, изменилась layout Garage, разметка bucket'ов или schema Postgres):

```bash
pnpm reset:native
```

Это эквивалент `pnpm stop:native` + удаление ВСЕХ volume'ов, управляемых compose-стеком (Garage meta+data, Postgres, RabbitMQ, Redis). После сброса полная пересборка окружения:

```bash
pnpm start:native
pnpm storage:bootstrap
```

Шаг `storage:bootstrap` остаётся явным и ручным (Phase 22.5 D-05/D-06) — никогда не вызывается автоматически из `start:*`.

### Common Pitfalls (local-native)

- **Bootstrap не запущен → `/health/ready` DOWN с `HeadBucket 404`.** Решение: `pnpm storage:bootstrap`. Сервисы автоматически подхватят bucket'ы на следующей health-probe (~30s в зависимости от настроек), restart обычно не нужен. (Pitfall 6)
- **Layout version mismatch при частичном bootstrap'е.** Если `layout apply` упал на полпути (например, из-за прерывания) — повторный bootstrap может видеть marker отсутствующим, но layout уже частично записан. Решение: см. "Сброс bootstrap state" в шаге 3 — `docker volume rm garage_meta garage_data` и заново. (Pitfall 2)
- **`SignatureDoesNotMatch` при первом запросе.** Почти всегда — `STORAGE_REGION` в `.env` не равен `garage`. Проверь точное значение, перезапусти процесс. (Pitfall 8)
- **Если ручной `garage key import` выполнялся без `--yes`** — CLI зависает на интерактивном prompt'е и команда никогда не завершится. Bootstrap скрипт всегда использует `--yes`, но если ты копируешь команды вручную — добавляй флаг. (Pitfall 1)
- **WebUI показывает "Unable to fetch cluster status".** `GARAGE_ADMIN_TOKEN` mismatch между `garage` и `garage-webui` сервисами — проверь что обоим виден один и тот же `.env.docker`. (Pitfall 7)

---

## 2. Local-isolated

Режим `pnpm start:isolated`: все сервисы и инфра запускаются в Docker контейнерах, через networks `infra` + `services`. Сервисы **не exposed** на хост кроме gateway.

### Шаг 1: Prerequisites

- Docker и Docker Compose установлены
- Порт `3909` (Garage WebUI) свободен на хосте — webui-ports overlay exposes его наружу
- Порт `4000` (gateway) свободен на хосте (`infra/docker-compose.yml:12` — `ports: ["4000:3000"]`)
- `.env.docker` создан и содержит `STORAGE_*` значения для **docker network** (`STORAGE_ENDPOINT=garage`, не `localhost`)

Запустить:

```bash
pnpm start:isolated
# или напрямую:
docker compose -f infra/docker-compose.yml -f infra/docker-compose.webui-ports.yml up -d --build
```

Проверить что все контейнеры живы (включая `garage` со статусом `(healthy)`):

```bash
docker compose -f infra/docker-compose.yml ps
```

### Шаг 2: Открыть UI

Garage WebUI: **http://localhost:3909** (тот же URL что и в local-native — `webui-ports.yml` overlay экспонирует WebUI порт в обоих режимах).

Login: значение `GARAGE_ADMIN_TOKEN` из `.env.docker` (по умолчанию `local-dev-admin-token-static-value-for-local-only`).

> **Как это работает:** `pnpm start:isolated` запускает `docker compose -f infra/docker-compose.yml -f infra/docker-compose.webui-ports.yml up --build`. Overlay `webui-ports.yml` проброшивает WebUI порты (Garage WebUI 3909, RabbitMQ Management 15672) на хост, а технические порты (5432, 6379, 5672, 3900) остаются внутри Docker network — apps общаются с инфрой по docker DNS, не через хост.

**CLI fallback:**

```bash
docker compose -f infra/docker-compose.yml exec garage \
  /garage -c /etc/garage.toml bucket list
```

### Шаг 3: Создать bucket'ы

Идентично local-native — один шаг:

```bash
pnpm storage:bootstrap
```

Скрипт автоматически подхватит garage container из isolated стека (auto-discovery falls back from infra-only to isolated). На повторных запусках — печатает `Already bootstrapped, skipping.` и выходит с exit 0.

> **Volume персистентность:** Garage volumes `garage_meta` + `garage_data` (см. `infra/docker-compose.infra.yml`) персистентны между `up`/`down` циклами. Если bootstrap уже выполнялся в local-native режиме и volumes общие — bucket'ы уже существуют, повторный bootstrap безопасно вернёт `Already bootstrapped`.
>
> Чтобы сбросить state: `docker compose down -v` или selective `docker volume rm` (см. шаг 3 раздела Local-native). **Осторожно — удаляет все данные Garage.**

### Шаг 4: Конфигурация доступа

Как в local-native — `pnpm storage:bootstrap` уже создал key `email-platform-local` и привязал его к обоим bucket'ам с Read+Write+Owner. Отдельный шаг не нужен.

Verify через WebUI (Permissions tab каждого bucket'а должна показать `email-platform-local` с галочками R/W/Owner) или CLI:

```bash
docker compose -f infra/docker-compose.yml exec garage \
  /garage -c /etc/garage.toml bucket info parser
docker compose -f infra/docker-compose.yml exec garage \
  /garage -c /etc/garage.toml bucket info public
```

### Шаг 4.5: Применить anonymous read policy на `public` (Phase 22.4)

Идентично local-native — pre-req на `[s3_web]` секцию в `garage.toml` + одна команда + верификация:

```bash
docker compose -f infra/docker-compose.yml exec garage \
  /garage -c /etc/garage.toml bucket website --allow public

docker compose -f infra/docker-compose.yml exec garage \
  /garage -c /etc/garage.toml bucket info public
# Ожидаемая строка: Website access: true

docker compose -f infra/docker-compose.yml exec garage \
  /garage -c /etc/garage.toml bucket info parser
# Ожидаемая строка: Website access: false
```

Порт `3902` должен быть exposed в compose-стеке, чтобы host (откуда идёт smoke `curl`) мог достучаться до Garage web endpoint — см. warning "⚠ Garage virtual-host web endpoint" в начале runbook'а. Если secция `[s3_web]` ещё не добавлена в `infra/docker/garage.toml` (`bind_addr = "[::]:3902"`, `root_domain = ".localhost"`) — добавить и пересоздать контейнер (`pnpm stop:isolated && pnpm start:isolated`).

### Шаг 5: Set env vars

Отредактировать `.env.docker` в корне репо. **Ключевое отличие от native:** `STORAGE_ENDPOINT` — имя сервиса в docker network, не `localhost`:

```bash
STORAGE_PROTOCOL=http
STORAGE_ENDPOINT=garage
STORAGE_PORT=3900
STORAGE_ACCESS_KEY=GKTESTLOCAL0123456789ab
STORAGE_SECRET_KEY=0000000000000000000000000000000000000000000000000000000000000000
STORAGE_REGION=garage
STORAGE_PUBLIC_URL=http://public.localhost:3902
STORAGE_MAX_UPLOAD_BYTES=104857600
```

`garage` — имя сервиса из `infra/docker-compose.infra.yml`. Сервисы на network `infra` резолвят это имя через встроенный Docker DNS (для S3 API трафика — `STORAGE_ENDPOINT=garage:3900` internal).

`STORAGE_PUBLIC_URL=http://public.localhost:3902` — **host-based** значение. Smoke-контроллеры и любые клиенты, запускающиеся **с host-машины** (curl из терминала разработчика, браузер), ходят через published port `3902` на host. Для **контейнер-к-контейнер** anonymous GET (если когда-нибудь понадобится) используется отдельный endpoint через docker DNS (`http://public.garage:3902`) — не меняется в этой фазе, описан как deferred note в CONTEXT.md.

`STORAGE_MAX_UPLOAD_BYTES=104857600` — то же значение 100 MiB (D-06).

После редактирования `.env.docker` — пересобрать и перезапустить контейнеры:

```bash
pnpm stop:isolated
pnpm start:isolated
```

(Переменные окружения читаются при старте контейнера, простой `restart` достаточен только если уже была актуальная версия `.env.docker` на предыдущем старте.)

### Шаг 6: Verify

**(а) Прямой readiness** — parser HTTP port **не exposed** на хост в isolated режиме (`infra/docker-compose.yml:79-85` — `expose: ["3003", "50053"]`, не `ports`). Проверка через `docker compose exec`:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.webui-ports.yml exec parser \
  wget -qO- http://localhost:3003/health/ready
```

Здесь `localhost` уже внутри контейнера parser — ссылается на сам parser process, не на хост.

**Ожидаемый OK / DOWN ответ:** идентичен примерам из раздела Local-native (те же поля, те же ключи `s3:parser` / `s3:public`).

Аналогично для notifier:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.webui-ports.yml exec notifier \
  wget -qO- http://localhost:3005/health/ready
```

**(б) Smoke endpoints** (через gateway, который **exposed** на `localhost:4000`):

```bash
curl -s http://localhost:4000/test/parser/storage-service | jq
curl -s http://localhost:4000/test/notifier/storage-service | jq
```

Ожидаемая структура — см. local-native шаг 6 (б): `buckets: [{ bucket: "parser", allPassed: true, ... }, { bucket: "public", allPassed: true, ... }]` для parser; `buckets: [{ bucket: "public", allPassed: true, ... }]` для notifier.

**(в) Anonymous-read verification** (Phase 22.4) — те же команды что в local-native:

```bash
# Подставь testKey из smoke-ответа (buckets[?bucket==public].testKey)
curl -sS -o /dev/null -w "%{http_code}\n" "${STORAGE_PUBLIC_URL}/<testKey>"
# Expected: 200
# Note: bucket `public` в hostname (через virtual-host), НЕ в path — per D-14 amended after OQ-1 RESOLVED.
# Если 403 → вернуться к Шагу 4.5 → `garage bucket website --allow public`
# Если 404 → проверь что `[s3_web]` секция в garage.toml имеет root_domain=".localhost", Garage контейнер пересоздан после правки, порт 3902 exposed в compose, `*.localhost` резолвится (fallback — /etc/hosts).
# См. warning "⚠ Garage virtual-host web endpoint" в начале runbook.
```

> **Не полагайся на gateway `/health/ready`.** Gateway `http://localhost:4000/health/ready` **не показывает** S3 state (см. known gap в начале runbook'а). Он вернёт `status: ok` даже при упавших S3 bucket'ах. Всегда проверяй S3 через прямой readiness parser/notifier ИЛИ через smoke endpoints — они реально гоняют объекты в S3.

Если получаешь `DOWN` — проверь в первую очередь:

1. `.env.docker` содержит `STORAGE_ENDPOINT=garage` (не `localhost`) и `STORAGE_REGION=garage`
2. `pnpm storage:bootstrap` выполнен (ищи marker через `docker compose exec garage ls /var/lib/garage/meta/.bootstrapped`)
3. Bucket'ы `parser` и `public` существуют в Garage WebUI
4. Контейнеры parser и notifier пересобраны после изменения `.env.docker`

### Сброс до чистого состояния (reset to clean state)

Когда нужно с нуля переиграть провижининг (например, изменилась layout Garage, разметка bucket'ов или schema Postgres):

```bash
pnpm reset:isolated
```

Это эквивалент `pnpm stop:isolated` + удаление ВСЕХ volume'ов, управляемых compose-стеком (Garage meta+data, Postgres, RabbitMQ, Redis). После сброса полная пересборка окружения:

```bash
pnpm start:isolated
pnpm storage:bootstrap
```

Шаг `storage:bootstrap` остаётся явным и ручным (Phase 22.5 D-05/D-06) — никогда не вызывается автоматически из `start:*`.

### Common Pitfalls (local-isolated)

- **Bootstrap не запущен → `/health/ready` DOWN на старте.** Сервисы могут стартовать **раньше** того как bucket'ы созданы — `service_healthy` gate ловит только что Garage server жив, но не что bucket'ы провизионированы. Решение: после `pnpm start:isolated` всегда дёргать `pnpm storage:bootstrap`. Сервисы переподымутся к зелёному на следующей health-probe. (Pitfall 6)
- **Layout version mismatch.** Если bootstrap прерывался на середине — `docker volume rm garage_meta garage_data` и заново. (Pitfall 2)
- **`SignatureDoesNotMatch`.** `STORAGE_REGION` ≠ `garage`. Проверь `.env.docker`, **пересобери контейнеры** (`pnpm stop:isolated && pnpm start:isolated` — restart недостаточно, env читается при создании контейнера). (Pitfall 8)
- **WebUI "Unable to fetch cluster status".** `GARAGE_ADMIN_TOKEN` mismatch между `garage` и `garage-webui` — проверь что `.env.docker` содержит токен и обоим сервисам он передан через `env_file` или `environment`. (Pitfall 7)
- **Ручной `garage key import` без `--yes`** зависает. Bootstrap скрипт использует флаг по умолчанию; если копируешь команды вручную — всегда добавляй `--yes`. (Pitfall 1)

---

## 3. Dev Coolify/Garage

Dev окружение развёрнуто в Coolify на локальном сервере (см. memory `project_hosting_infra.md`). S3 backend — **Garage**, WebUI доступен на `http://garage.dev.email-platform.pp.ua`. Сервисы (gateway, parser, notifier, прочие) живут в dev environment Coolify проекта и подключаются к Garage по S3 API endpoint'у.

> ⚠ **Garage специфика.** Garage разделяет bucket и access key как **отдельные, независимые сущности**. Создание bucket через S3 API `CreateBucket` **не создаёт key binding** автоматически — получившийся bucket будет **недоступен** приложению. Поэтому этот раздел использует **Garage-native** подход (WebUI или `garage` CLI), а не generic S3 API (`aws s3api`, `mc mb`). Если пытаешься автоматизировать через S3 API — не работает, это проверено.

### Шаг 1: Prerequisites

- Доступ к Coolify dashboard (dev instance) — нужны permissions на редактирование environment variables и secrets dev окружения проекта email-platform
- Доступ к Garage WebUI `http://garage.dev.email-platform.pp.ua`
- Login credentials для Garage WebUI — в Coolify project secrets (путь: **Coolify → project → environment → Secrets → `GARAGE_WEBUI_*`** или аналогичный ключ, уточнить у Coolify admin)
- (Опционально для CLI alternative) SSH доступ на Coolify host машину (`192.168.1.25` согласно memory `project_hosting_infra.md`)

> **Важно:** для получения prod и dev Garage credentials используй Coolify secrets UI. **Не запрашивай в чате, не коммить в репо.** Реальные значения никогда не должны попадать в историю git.

### Шаг 2: Открыть UI

Открыть в браузере: **http://garage.dev.email-platform.pp.ua**

Login credentials брать из Coolify secrets — **не запрашивай в чате, не коммить в репо**.

### Шаг 3: Создать bucket'ы

В Garage WebUI → **Buckets** → **Create bucket**.

Создать два bucket'а с точными именами:

1. **`parser`** — для parser service (источник имени: `apps/parser/src/parser.constants.ts:6`)
2. **`public`** — shared для parser (запись) и notifier (чтение) (источник имени: `packages/foundation/src/external/storage/public/public.constants.ts:4`)

Имена case-sensitive. Проверить соответствие кодовым константам (см. header sync note в начале runbook). Если в Garage уже есть bucket'ы с другими именами (например `parser-dev` или `public-v2`) — не использовать их, создать новые с точными именами из констант.

### Шаг 4: Конфигурация доступа (КРИТИЧНЫЙ ШАГ)

> ⚠ **ОСТОРОЖНО: БЕЗ ЭТОГО ШАГА BUCKET НЕ БУДЕТ ДОСТУПЕН ПРИЛОЖЕНИЮ.**
>
> В Garage bucket и access key — **независимые сущности**. Созданный на шаге 3 bucket ещё **не привязан** ни к одному access key'у. Приложение получит `AccessDenied` / `403 Forbidden` на любую операцию с bucket'ом — включая `HeadBucket` в readiness — пока key binding не создан. Это **самая частая ошибка** при ручном setup Garage. Не пропускай этот шаг.

**4.1. Создать access key** (если ещё не существует для email-platform)

В Garage WebUI → **Keys** → **Create key**. Имя: `email-platform-dev` (или аналогичное описательное — важно чтобы было понятно кому принадлежит key).

**Сразу записать** куда-нибудь безопасное (например, напрямую в Coolify secrets из следующего шага):

- **Access key ID** — аналог `STORAGE_ACCESS_KEY`
- **Secret key** — аналог `STORAGE_SECRET_KEY`

Они **не будут показаны в plain text** после закрытия этого окна. Если потерял — придётся удалить key и создать новый.

**4.2. Привязать key к каждому bucket'у** (key binding — обязательный шаг)

Для **каждого** из двух bucket'ов (`parser`, `public`):

- Открыть bucket в Garage WebUI → **Permissions** tab (или **Access keys** tab — зависит от версии Garage WebUI)
- Найти в списке созданный `email-platform-dev` key
- Включить permissions: **Read**, **Write**, **Owner** (минимум Read+Write; Owner даёт полный контроль включая удаление bucket'а через API)
- Нажать **Save** / **Apply**

**Повторить для обоих bucket'ов.** Один и тот же access key привязывается к обоим `parser` и `public`.

**Проверка:** после сохранения на странице bucket'а в разделе permissions должен быть виден email-platform-dev key с галочками Read/Write. Если галочек нет — binding не сохранился, повторить.

**4.3. Сохранить credentials в Coolify secrets**

В Coolify → project → **dev** environment → Secrets добавить/обновить:

| Secret                  | Значение                                |
| ----------------------- | --------------------------------------- |
| `STORAGE_ACCESS_KEY`    | `<access key ID из шага 4.1>`           |
| `STORAGE_SECRET_KEY`    | `<secret key из шага 4.1>`              |

Secrets в Coolify шифруются at-rest и инжектируются в контейнеры сервисов как environment variables при deploy.

### Migration: rename `reports` → `public` (one-time during 22.5 deploy)

> ⚠ **Применимо только к окружениям, которые до Phase 22.5 уже использовали bucket `reports`.** Если ты разворачиваешь dev с нуля — пропусти этот раздел, используй сразу `public` в шаге 3.

Phase 22.5 переименовала foundation S3 bucket с `reports` на `public`. Существующий dev Garage уже содержит bucket `reports` с прибинженным `email-platform-dev` ключом. Чтобы deploy нового кода прошёл без downtime:

1. **Pre-deploy** (этот runbook, прямо сейчас, до того как CI выкатит новый код): в Garage WebUI создай bucket `public`, привяжи к нему `email-platform-dev` ключ с Read+Write+Owner (см. шаги 3 и 4.2 выше). **НЕ удаляй** bucket `reports`. На этом этапе старый код всё ещё работает с `reports`, новый bucket `public` пустой и неиспользуется — это нормально.
2. **Deploy кода через Coolify** (CI из мерженого 22.5 PR — push-based webhook на Coolify, см. memory `project_deploy_flow.md`). После deploy parser и notifier начнут писать/читать в bucket `public` вместо `reports`.
3. **Post-deploy verify**: SSH/Terminal в parser/notifier контейнер, выполни `wget -qO- http://localhost:3003/health/ready` (parser) и `wget -qO- http://localhost:3005/health/ready` (notifier). Ожидание: оба показывают `s3:parser` AND `s3:public` со статусом `up`. Если `s3:public` DOWN — key binding на `public` не сохранился, вернись в шаг 4.2.
4. **Defer orphan deletion**: подожди 1-2 недели стабильной работы (мониторинг, отчёты, runtime errors). Только после того как **уверен** что новый код стабильно работает с `public` и rollback не понадобится — иди в Garage WebUI → bucket `reports` → Delete (если bucket пустой — Delete напрямую; если есть остаточные объекты — Force Delete или сначала очистить). **WARNING block:** **никогда** не удаляй `reports` ДО успешной deploy-verify нового кода — это уничтожит fallback rollback path. Старый код, если придётся откатиться, ожидает что `reports` существует.

### Шаг 4.5: Применить anonymous read policy на `public` (Phase 22.4)

> ⚠ **Operator action (разовая настройка Garage + Coolify Traefik).** В отличие от local, требует несколько шагов вне Garage CLI: DNS-запись, Coolify Traefik router, секция `[s3_web]` в `garage.toml`.

**4.5.1. Обновить `garage.toml` на dev Garage instance** (если ещё не сделано):

```toml
[s3_web]
bind_addr = "[::]:3902"
root_domain = ".garage.dev.email-platform.pp.ua"
index = "index.html"
```

После правки — перезапустить Garage контейнер в Coolify (Redeploy Garage service).

**4.5.2. DNS:** создать A-запись `public.garage.dev.email-platform.pp.ua` → тот же IP, что и существующий `garage.dev.email-platform.pp.ua` (см. memory `project_hosting_infra.md` / `project_infra_topology.md` — обычно LAN IP `192.168.1.25` через Cloudflare). DNS propagation — до 5 минут.

**4.5.3. Coolify Traefik router:** в Coolify → Garage service → Configuration → Labels (или General → Domain) добавить **второй** router с правилом `Host(\`public.garage.dev.email-platform.pp.ua\`)` → target port `3902` (НЕ 3900). Существующий router на `garage.dev.email-platform.pp.ua` (WebUI, port 3903/admin или куда он указывает) **не трогать** — это отдельный route.

Пример Traefik labels (если конфигурируешь напрямую):

```yaml
- "traefik.http.routers.garage-public.rule=Host(`public.garage.dev.email-platform.pp.ua`)"
- "traefik.http.routers.garage-public.entrypoints=https"
- "traefik.http.routers.garage-public.tls=true"
- "traefik.http.routers.garage-public.tls.certresolver=letsencrypt"
- "traefik.http.services.garage-public.loadbalancer.server.port=3902"
```

**4.5.4. Применить website mode на bucket `public`** (через Garage WebUI Settings → Website, или CLI):

```bash
# SSH на Coolify host → docker exec в dev garage container:
docker exec -it <garage-dev-container> garage bucket website --allow public

docker exec -it <garage-dev-container> garage bucket info public
# Ожидаемая строка: Website access: true

docker exec -it <garage-dev-container> garage bucket info parser
# Ожидаемая строка: Website access: false
```

**4.5.5. Smoke-проверка** (перед тем как двигаться к Шагу 5):

```bash
# С любой машины с разрешающимся DNS:
curl -sS -o /dev/null -w "%{http_code}\n" "https://public.garage.dev.email-platform.pp.ua/"
# Ожидание: 404 (bucket пустой — путь к несуществующему ключу), НЕ 403 (website не включён) и НЕ "no such host" (DNS/Traefik не настроены).
```

### Шаг 5: Set env vars

В Coolify → project → dev environment → **Environment Variables** (не Secrets — кроме `STORAGE_ACCESS_KEY` и `STORAGE_SECRET_KEY` которые уже в Secrets с шага 4.3):

```bash
STORAGE_PROTOCOL=https
STORAGE_ENDPOINT=<garage-dev-endpoint>
STORAGE_PORT=443
STORAGE_ACCESS_KEY=<из Coolify secrets>
STORAGE_SECRET_KEY=<из Coolify secrets>
STORAGE_REGION=garage
STORAGE_PUBLIC_URL=https://public.garage.dev.email-platform.pp.ua
STORAGE_MAX_UPLOAD_BYTES=104857600
```

> **`STORAGE_BUCKET` отсутствует — это намеренно (D-27).** Если в Coolify environment ещё остался legacy `STORAGE_BUCKET` — можешь удалить, приложение его не читает (Coolify игнорирует extras без ошибки, но чисто — лучше).

`<garage-dev-endpoint>` — S3 API endpoint Garage instance (**не** WebUI URL `garage.dev.email-platform.pp.ua`; обычно `s3.dev.email-platform.pp.ua` или аналогичный subdomain — уточнить у Coolify admin или в Garage deployment config на хосте). WebUI URL и S3 API URL — разные endpoint'ы, не перепутай.

`STORAGE_REGION=garage` — фиксированное значение (Garage default region), **не** `us-east-1`. Если в существующем dev окружении был `STORAGE_REGION=us-east-1` — обнови на `garage`, иначе `SignatureDoesNotMatch` (Pitfall 8).

`STORAGE_PUBLIC_URL=https://public.garage.dev.email-platform.pp.ua` — Garage virtual-host web endpoint. Bucket `public` в hostname; формула URL `${STORAGE_PUBLIC_URL}/${key}` (без `/public/` сегмента в path). Pre-req — Шаг 4.5 выполнен полностью (DNS + Traefik + `[s3_web]` + `bucket website --allow public`). См. warning "⚠ Garage virtual-host web endpoint" в начале runbook'а.

`STORAGE_MAX_UPLOAD_BYTES=104857600` (100 MiB) — hard ceiling для streaming upload (D-06/D-18). Значение одинаковое во всех окружениях.

После сохранения — **Redeploy** сервисов parser и notifier в Coolify чтобы подхватить новые env vars. Gateway тоже желательно передеплоить для консистентности, но gateway напрямую в S3 не ходит, поэтому его deploy не критичен для S3 readiness.

### CLI alternative (через SSH на Coolify host)

Если предпочитаешь CLI или нет доступа к WebUI — SSH в Coolify host, затем `docker exec` в Garage container. Используй **только Garage-native** команды — generic `aws s3api create-bucket` создаст bucket без key binding и приложение увидит `AccessDenied`:

```bash
# Предположим container называется garage-dev
docker exec -it garage-dev bash

# Внутри container:
garage bucket create parser
garage bucket create public

garage key create email-platform-dev
# Запиши access key ID и secret key из output — они показываются только один раз

garage bucket allow --key email-platform-dev --read --write --owner parser
garage bucket allow --key email-platform-dev --read --write --owner public

# Проверить что binding сохранён:
garage bucket info parser
garage bucket info public
# В output должно быть видно email-platform-dev key с RW permissions
```

Каждый `garage bucket allow` — это **тот самый key binding** без которого bucket недоступен. Без этих команд `garage bucket create` создаёт **изолированный bucket** который никто не может читать/писать. Это **не ошибка** Garage — это by design: Garage разделяет ownership (создатель) и access (кто может использовать) как отдельные concerns.

Если в Garage уже существует ключ — импортируй его (важно — флаг `--yes` обязателен, иначе CLI зависнет на интерактивном prompt'е):

```bash
garage key import --yes \
  --key-id <ACCESS_KEY_ID> \
  --secret-key <SECRET_KEY> \
  --name email-platform-dev
```

### Шаг 6: Verify

**⚠ Gateway health через Traefik не покажет S3 state** (см. known gap в начале runbook):

```bash
# Это вернёт status: ok даже если S3 упал — НЕ использовать как единственную проверку
curl -s http://api.dev.email-platform.pp.ua/health/ready
```

Для реальной проверки S3 нужен **прямой HTTP endpoint parser'а**. HTTP порт parser'а (по умолчанию `PARSER_PORT=3003`) **не exposed** наружу через Traefik (Coolify конфигурация по умолчанию exposes только gateway HTTP port). Поэтому:

> **Важно:** убедись что ты exec'нулся именно в **parser** контейнер, не в gateway или другой сервис. Порт зависит от `PARSER_PORT` env var в Coolify — проверь значение в Coolify → project → parser → Environment Variables. По умолчанию `3003`.
> В контейнерах `node:20-alpine` нет `jq` — используй `wget -qO-` без `| jq`.

**Вариант А: Terminal через Coolify dashboard.**

```bash
# Coolify → project → dev environment → parser service → Terminal
wget -qO- http://localhost:3003/health/ready
```

Здесь `localhost` — внутри контейнера parser, это сам parser process.

**Вариант Б: `docker exec` через SSH на Coolify host.**

```bash
# Список запущенных parser containers (имя может отличаться в зависимости от Coolify deployment):
docker ps | grep parser
# Исполнить health check:
docker exec <parser-container-id> wget -qO- http://localhost:3003/health/ready
```

**Ожидаемый OK ответ** (HTTP 200): идентичен примеру из раздела Local-native — `status: ok`, `s3:parser` и `s3:public` оба `up`.

**Ожидаемый DOWN ответ** (HTTP 503): если key binding не создан (самая частая ошибка), получишь:

```json
{
  "status": "error",
  "info": {
    "postgres": { "status": "up" }
  },
  "error": {
    "s3:parser": { "status": "down", "message": "S3 bucket health check failed" },
    "s3:public": { "status": "down", "message": "S3 bucket health check failed" }
  },
  "details": {
    "postgres": { "status": "up" },
    "s3:parser": { "status": "down", "message": "S3 bucket health check failed" },
    "s3:public": { "status": "down", "message": "S3 bucket health check failed" }
  }
}
```

Аналогично для notifier (проверяет только `s3:public`):

```bash
docker exec <notifier-container-id> wget -qO- http://localhost:3005/health/ready
```

Если хоть один из `s3:parser` / `s3:public` в DOWN — вернись к шагу 4 и проверь:

1. Access key создан (шаг 4.1)
2. Key binding **сохранён** на оба bucket'а (шаг 4.2) — это самая частая ошибка
3. Credentials в Coolify secrets точно совпадают с созданными в Garage (шаг 4.3)
4. Env vars в Coolify указывают на правильный `STORAGE_ENDPOINT` (S3 API, не WebUI) и `STORAGE_REGION=garage` (шаг 5)
5. Сервисы передеплоены после изменения secrets/env vars

**Anonymous-read verification** (Phase 22.4) — выполнить после smoke upload (шаг (б) выше или через smoke-ответ parser'а):

```bash
# testKey — из smoke-ответа buckets[?bucket==public].testKey
curl -sS -o /dev/null -w "%{http_code}\n" "${STORAGE_PUBLIC_URL}/<testKey>"
# Expected: 200
# Note: bucket `public` в hostname (через virtual-host), НЕ в path — per D-14 amended after OQ-1 RESOLVED.
# Если 403 → `garage bucket website --allow public` не применён (Шаг 4.5.4)
# Если 404 → (a) bucket subdomain не маршрутизируется (проверь Coolify Traefik route на `public.garage.dev.email-platform.pp.ua` → port 3902 — Шаг 4.5.3);
#            (b) DNS A-запись отсутствует или не разошлась (Шаг 4.5.2);
#            (c) `[s3_web].root_domain` в `garage.toml` не совпадает с hostname в STORAGE_PUBLIC_URL (Шаг 4.5.1 + redeploy Garage).
# См. warning "⚠ Garage virtual-host web endpoint" в начале runbook.
```

---

## 4. Prod Coolify/Garage

Prod окружение — идентично dev по топологии (Coolify + Garage), отличается только URL'ами, credentials и scope risk. **Все шаги те же**, только на prod target.

> ⚠ **Prod = real data.** Перед применением любых изменений — убедись что ты работаешь в **prod environment**, не dev. Coolify dashboard разделяет environments по selector'у сверху, но CLI команды через SSH не различают — смотри внимательно на `docker ps` output и подтверждай target перед каждым действием.

### Шаг 1: Prerequisites

- Доступ к Coolify dashboard **prod instance** — отдельный permission level, dev доступ не даёт prod доступ автоматически
- Доступ к Garage WebUI `http://garage.email-platform.pp.ua` (**без** `dev.` prefix — это prod)
- Login credentials для prod Garage — в Coolify **prod** environment secrets (отдельные от dev)
- Подтверждение от владельца проекта что ты можешь делать изменения на prod

### Шаг 2: Открыть UI

Открыть в браузере: **http://garage.email-platform.pp.ua**

Login credentials брать из Coolify **prod** secrets. **Никогда не переиспользуй dev credentials для prod** — это требование минимальных привилегий и разделения blast radius компрометации. Если dev key утёк — prod должен быть невредим.

### Шаг 3: Создать bucket'ы

Идентично dev — два bucket'а `parser` и `public` через WebUI **Buckets → Create bucket**.

Имена те же (case-sensitive). Источники истины:

- `apps/parser/src/parser.constants.ts:6` → `PARSER_STORAGE_BUCKET = 'parser'`
- `packages/foundation/src/external/storage/public/public.constants.ts:4` → `PUBLIC_BUCKET = 'public'`

### Шаг 4: Конфигурация доступа (КРИТИЧНЫЙ ШАГ)

> ⚠ **ОСТОРОЖНО: БЕЗ KEY BINDING BUCKET БУДЕТ НЕДОСТУПЕН ПРИЛОЖЕНИЮ.**
>
> Та же проблема Garage key bindings что и в dev. Этот шаг обязательный. Prod bucket без binding молча сломает readiness сервисов после deploy — а debugging на prod всегда дороже чем в dev.

**4.1. Создать prod access key**

В Garage WebUI → **Keys** → **Create key**. Имя: `email-platform-prod`. **Отдельный key от dev** — никогда не переиспользуй dev credentials для prod.

Сразу записать access key ID и secret key — они показываются **только один раз**. После закрытия окна secret key невозможно восстановить.

**4.2. Привязать key к обоим bucket'ам**

Для `parser` и для `public` → **Permissions** tab → добавить `email-platform-prod` key с:

- **Read + Write** (обязательно)
- **Owner** — **опционально для prod**. Prod обычно **без Owner permission** для меньшего blast radius случайного удаления (см. Rationale §3 ниже). Read+Write достаточно для всех runtime операций приложения. Owner нужен только если приложение должно создавать/удалять bucket'ы — чего мы сознательно не делаем (вот весь смысл этого runbook'а).

Повторить для обоих bucket'ов.

**4.3. Сохранить credentials в Coolify prod secrets**

Coolify → project → **prod** environment → Secrets:

| Secret                 | Значение                               |
| ---------------------- | -------------------------------------- |
| `STORAGE_ACCESS_KEY`   | `<access key ID из шага 4.1>`          |
| `STORAGE_SECRET_KEY`   | `<secret key из шага 4.1>`             |

**Никогда не переиспользуй dev secrets в prod environment** — если случайно использовал dev credentials для prod, сразу ротируй обе пары и сделай post-incident note.

### Migration: rename `reports` → `public` (one-time during 22.5 deploy)

> ⚠ **Применимо только если prod до Phase 22.5 уже использовал bucket `reports`.** Если ты разворачиваешь prod с нуля — пропусти этот раздел.

Та же процедура что и в dev (см. секцию Migration в разделе 3), с двумя поправками:

- Используется ключ `email-platform-prod` (не `email-platform-dev`)
- Все действия выполняются в **prod** Coolify environment и на prod Garage instance — двойная проверка target перед каждым действием

Шаги:

1. **Pre-deploy:** в prod Garage WebUI создай bucket `public`, привяжи `email-platform-prod` ключ с Read+Write (Owner — опционально, см. §4.2 выше). НЕ удаляй `reports`.
2. **Deploy кода через Coolify** на prod (после успешного деплоя на dev и его проверки — canary period 1+ день минимум).
3. **Post-deploy verify:** Terminal в prod parser/notifier контейнере, `wget -qO- http://localhost:3003/health/ready` — ожидание `s3:parser` + `s3:public` `up`.
4. **Defer orphan `reports` deletion 1-2 недели.** На prod ставка выше — стабильность нового кода должна быть подтверждена дольше, чем на dev. Только после устойчивой работы — Garage WebUI → bucket `reports` → Delete. **WARNING:** ни при каких условиях не удалять `reports` ДО успешной prod deploy verify — это единственный rollback path.

### Шаг 4.5: Применить anonymous read policy на `public` (Phase 22.4)

> ⚠ **Prod operator action.** Идентично dev, но на **prod** target. Двойная проверка environment перед каждым шагом.

**4.5.1. Обновить `garage.toml` на prod Garage instance:**

```toml
[s3_web]
bind_addr = "[::]:3902"
root_domain = ".garage.email-platform.pp.ua"
index = "index.html"
```

Redeploy prod Garage service в Coolify чтобы применить конфиг.

**4.5.2. DNS:** создать A-запись `public.garage.email-platform.pp.ua` → тот же IP, что и `garage.email-platform.pp.ua` (prod Coolify host).

**4.5.3. Coolify Traefik router** на prod Garage service: второй router с правилом `Host(\`public.garage.email-platform.pp.ua\`)` → port `3902`. Существующий router на `garage.email-platform.pp.ua` (WebUI) не трогать.

Пример Traefik labels:

```yaml
- "traefik.http.routers.garage-public-prod.rule=Host(`public.garage.email-platform.pp.ua`)"
- "traefik.http.routers.garage-public-prod.entrypoints=https"
- "traefik.http.routers.garage-public-prod.tls=true"
- "traefik.http.routers.garage-public-prod.tls.certresolver=letsencrypt"
- "traefik.http.services.garage-public-prod.loadbalancer.server.port=3902"
```

**4.5.4. Применить website mode** на bucket `public` в prod (через prod Garage WebUI Settings → Website, или CLI):

```bash
# SSH на prod Coolify host → docker exec в PROD garage container (двойная проверка что это prod, не dev):
docker ps | grep garage  # убедись что контейнер принадлежит prod env
docker exec -it <garage-prod-container> garage bucket website --allow public

docker exec -it <garage-prod-container> garage bucket info public
# Ожидаемая строка: Website access: true

docker exec -it <garage-prod-container> garage bucket info parser
# Ожидаемая строка: Website access: false
```

**4.5.5. Smoke-проверка:**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "https://public.garage.email-platform.pp.ua/"
# Ожидание: 404 (bucket пустой, website включён) — НЕ 403 (website не включён), НЕ "no such host" (DNS/Traefik).
```

### Шаг 5: Set env vars

Coolify → project → **prod** environment → Environment Variables:

```bash
STORAGE_PROTOCOL=https
STORAGE_ENDPOINT=<garage-prod-endpoint>
STORAGE_PORT=443
STORAGE_ACCESS_KEY=<из Coolify prod secrets>
STORAGE_SECRET_KEY=<из Coolify prod secrets>
STORAGE_REGION=garage
STORAGE_PUBLIC_URL=https://public.garage.email-platform.pp.ua
STORAGE_MAX_UPLOAD_BYTES=104857600
```

> **`STORAGE_BUCKET` отсутствует — D-27.** Если в Coolify environment ещё остался legacy `STORAGE_BUCKET` — можешь удалить, приложение его не читает.

`STORAGE_PUBLIC_URL=https://public.garage.email-platform.pp.ua` — Garage virtual-host web endpoint на prod. **Pre-req — Шаг 4.5 выполнен полностью.** Любая переменная пути в URL не работает: bucket в hostname per D-28/D-29.

`STORAGE_MAX_UPLOAD_BYTES=104857600` (100 MiB) — hard ceiling для streaming upload. На prod значение критично как DoS-защита от runaway uploads (D-06).

`<garage-prod-endpoint>` — S3 API endpoint **prod** Garage instance (не WebUI URL `garage.email-platform.pp.ua`; уточнить у Coolify admin / в prod Garage deployment config). Обычно это что-то вроде `s3.email-platform.pp.ua`.

`STORAGE_REGION=garage` — фиксированное значение (Garage default region), **не** `us-east-1`. Если в существующем prod env был `STORAGE_REGION=us-east-1` — обнови на `garage` одновременно с deploy кода (иначе после deploy получишь `SignatureDoesNotMatch`).

**Redeploy** parser и notifier в **prod** environment через Coolify dashboard. Gateway можно не передеплоивать.

### CLI alternative

Идентично dev, только SSH в **prod** Coolify host и `docker exec` в **prod** Garage container:

```bash
docker exec -it garage-prod bash

garage bucket create parser
garage bucket create public

garage key create email-platform-prod
# Запиши credentials — показываются только один раз

garage bucket allow --key email-platform-prod --read --write parser
garage bucket allow --key email-platform-prod --read --write public
# Опускаем --owner для prod по причинам minimal permissions

garage bucket info parser
garage bucket info public
```

Перед каждым действием двойная проверка: ты точно на prod host, не на dev? Dev и prod могут иметь похожие container names.

### Шаг 6: Verify

Gateway health через Traefik — **не показывает S3 state** (known gap):

```bash
# status: ok не означает что S3 работает — использовать только как liveness check, не как S3 verification
curl -s http://api.email-platform.pp.ua/health/ready
```

Для реальной S3 проверки — Terminal в **prod** parser container:

> **Важно:** те же правила что в dev — exec в **parser** контейнер (не gateway), порт из `PARSER_PORT` env var (по умолчанию `3003`), `jq` недоступен в alpine образах.

```bash
# Coolify → project → prod environment → parser service → Terminal
wget -qO- http://localhost:3003/health/ready
```

Или через `docker exec` на prod Coolify host:

```bash
docker ps | grep parser  # на prod host — убедись что видишь prod containers, не dev
docker exec <prod-parser-container-id> wget -qO- http://localhost:3003/health/ready
```

**Ожидаемые OK и DOWN ответы** — идентичны примерам из раздела Local-native (`status: ok` + `s3:parser`/`s3:public` `up` для OK; `status: error` + DOWN details для неудачи).

Notifier prod:

```bash
docker exec <prod-notifier-container-id> wget -qO- http://localhost:3005/health/ready
```

**После подтверждения что всё `up`** — runbook для prod окружения завершён. Buckets готовы для использования, readiness проходит, приложение может писать/читать S3.

Если DOWN — причина почти всегда одна из:

1. Key binding не сохранён (шаг 4.2) — самая частая ошибка
2. Prod credentials случайно скопированы из dev или наоборот (шаг 4.3)
3. `STORAGE_ENDPOINT` указывает на WebUI URL вместо S3 API URL (шаг 5)
4. `STORAGE_REGION` не равен `garage` (Pitfall 8 — если шёл с pre-22.5 значением `us-east-1`)
5. Prod сервисы не передеплоены после изменения env vars (шаг 5)

**Anonymous-read verification** (Phase 22.4) — после первого smoke upload на prod:

```bash
# testKey — из smoke-ответа prod parser'а для bucket public
curl -sS -o /dev/null -w "%{http_code}\n" "${STORAGE_PUBLIC_URL}/<testKey>"
# Expected: 200
# Note: bucket `public` в hostname, формула URL = ${STORAGE_PUBLIC_URL}/${key} без /public/ сегмента (D-14 amended).
# Если 403 → bucket website mode не применён (Шаг 4.5.4 на prod)
# Если 404 → проверь Coolify Traefik route на `public.garage.email-platform.pp.ua` → port 3902 (Шаг 4.5.3); DNS A-запись (Шаг 4.5.2); `[s3_web].root_domain` в prod garage.toml (Шаг 4.5.1).
# См. warning "⚠ Garage virtual-host web endpoint" в начале runbook.
```

---

## Почему не автоматизируем (Rationale)

Этот runbook — **ручная процедура**. Code-based auto-provisioning (`BucketProvisioningService` или аналог который создаёт bucket'ы на boot сервиса через S3 API) был рассмотрен в ходе `/gsd:discuss-phase` и **отклонён**. Этот раздел — **архив решения** для будущего maintainer'а чтобы через 6-12 месяцев никто не начал заново обсуждать автоматизацию без контекста.

**Пять причин:**

### 1. 12-factor separation (приложение vs инфраструктура)

Приложение не должно управлять infrastructure state. Создание bucket'ов — это **infrastructure concern** (уровень оператора / IaC / DevOps), не **application concern** (уровень business logic). Код приложения должен **потреблять** уже настроенные ресурсы через env vars, не **создавать** их.

Это прямое следствие [12-Factor App Factor IV — Backing services](https://12factor.net/backing-services): "The code for a twelve-factor app makes no distinction between local and third party services. To the app, both are attached resources". Приложение получает connection details через config, оно не управляет жизненным циклом самих services.

См. `.agents/skills/twelve-factor/SKILL.md` — Factor IV (backing services as attached resources).

Смешивание infrastructure provisioning в application code нарушает разделение ответственностей: одна и та же кодовая база теперь отвечает и за runtime behavior (handle request), и за setup (create bucket). Это два разных lifecycle'а, два разных типа failure, два разных audit trail'а — они должны быть разделены.

### 2. Garage key bindings несовместимы с S3 API `CreateBucket`

Garage разделяет bucket и access key как **независимые сущности**. Создание bucket через S3 API `CreateBucket` **не создаёт key binding** автоматически — bucket получается изолированным и **недоступным** для приложения. Любая последующая операция (включая `HeadBucket` в readiness) упадёт с `AccessDenied`.

Даже если бы мы написали код провизии — на Garage (prod И local после Phase 22.5) он создал бы **broken bucket** без key binding, и сервис всё равно упал бы на первой операции. Key binding в Garage создаётся только через **Garage-native admin API** (`garage bucket allow --read --write`), который **не часть S3 API** и не покрывается generic S3 клиентом (AWS SDK, mc, awscli).

Единственный путь обойти это — интеграция Garage admin API напрямую в код приложения. Это:

- Добавляет ещё одну зависимость (Garage admin client)
- Нарушает причину (1) ещё сильнее (теперь приложение управляет key bindings, ещё более infrastructure-level concern)
- Даёт код, специфичный для одного backend'а — нарушает причину (5)

### 3. Minimal permissions на prod

Prod credentials сервиса должны быть **минимальными**: read/write на конкретные objects в конкретных bucket'ах. Выдача `s3:CreateBucket` (или даже `s3:HeadBucket` на global level) prod сервису — избыточный privilege escalation который:

- Усложняет audit (кто и когда создавал bucket'ы — приложение или оператор?)
- Увеличивает blast radius компрометации (утечка prod key → атакующий может создавать bucket'ы)
- Нарушает principle of least privilege

Код провизии на prod в такой security posture либо:

- Требует admin credentials для application service (**плохо** — эскалация привилегий)
- Падает на `AccessDenied` при попытке `HeadBucket`/`CreateBucket` с write-only credentials — т.е. сервис boot'ится в **broken state** и бесполезен

В prod обычно prod service key имеет Read/Write на конкретные bucket'ы (даже без Owner, см. раздел 4 prod). `s3:CreateBucket` не выдаётся и не должен выдаваться.

### 4. Safety против silent misconfig

При кодовом provisioning'е **опечатка в bucket name constant** (например `publi` вместо `public` в коде) **молча создаёт wrong bucket** в prod storage backend. Сервис счастливо работает с неправильным хранилищем — readiness проходит (bucket существует, права есть), функциональность работает (файлы пишутся и читаются), но данные оказываются в "левом" bucket'е которого никто не ожидает.

Обнаружение такой ошибки — **спустя часы или дни** через "куда делись мои отчёты?" / "почему parser не может прочитать файлы которые notifier должен обрабатывать?".

При **manual approach + HeadBucket в readiness** — любая опечатка моментально ловится через readiness `DOWN` на старте сервиса. Bucket с именем `publi` не существует в Garage → `HeadBucket` возвращает 404 → readiness DOWN → `docker compose` / Coolify deploy не проходит → ошибка ловится на CI/deploy stage, **до** production traffic. Blast radius: 0.

Этот trade-off особенно важен для `public` bucket который shared между parser и notifier — опечатка в одном месте ломает cross-service flow, но не роняет сам сервис, т.е. не видна мониторингу сразу.

### 5. Unified approach во всех окружениях

Код который работает только в одном окружении (`provisioningEnabled=true` для local, `false` для dev/prod) — **code smell**. Каждая ветка `if (provisionEnabled) { ... }` — это:

- Два разных поведения приложения, каждое со своими багами
- Каждое требует своего тестирования
- Dead code в prod builds (provisioning logic лежит в binary но никогда не выполняется)
- Confusion для onboarding: "а что этот `provisionEnabled` делает? почему он false на prod?"

Философская позиция: **"если код работает только в одном окружении — это не автоматизация, это local dev convenience которая зря попала в shared codebase"**.

Лучше **ноль кода провизии во всех окружениях** (unified manual) чем код который живёт только для local dev convenience. Local dev setup — это onboarding task делается раз, а runbook работает одинаково для всех 4 окружений одинаково детерминированно.

> *Phase 22.5 (April 2026) расширил этот rationale на local окружения — `pnpm storage:bootstrap` это local-эквивалент кликов оператора в Garage WebUI; та же separation of concerns. Скрипт живёт в `infra/`, не в `apps/`, и не загружается ни в один сервис runtime'ом. Это **operator tooling**, не **application code**.*

### Когда это решение стоит пересмотреть

Критерии при которых runbook стоит пересмотреть в пользу автоматизации:

1. **Garage S3 API compatibility подтверждена** — если в будущем Garage начнёт автоматически создавать key binding при `CreateBucket` от owner key (или появится альтернативный S3-compatible backend для prod с таким поведением), причина (2) отпадает. Нужна явная проверка на живом Garage instance, не документация.

2. **Deployment переезжает на IaC** — если мы переходим на Terraform / Pulumi / Crossplane, provisioning переносится в **IaC layer** (не в код приложения) и причины (1), (3), (5) не применимы — IaC это **правильный** слой для infrastructure state management. В такой модели runbook превращается в IaC модуль, а не в code path приложения. Это принципиально другое решение — и оно совместимо с (2) если Garage provider для Terraform существует.

3. **Количество bucket'ов перестаёт помещаться в runbook** — если по какой-то причине у нас появится 20+ bucket'ов которые часто добавляются/удаляются (маловероятно для email-platform, но теоретически возможно), ручной процесс становится bottleneck'ом и стоит рассмотреть IaC module (не code-based provisioning в app).

4. **Minimal permissions переосмысливаются** — если в будущем security model изменится и prod сервисы смогут иметь CreateBucket permissions без audit concerns (очень маловероятно), причина (3) отпадает.

До тех пор — runbook остаётся **единственным источником истины** для bucket setup. Любая попытка "а давайте добавим маленький скрипт для local" должна быть остановлена на этом разделе: читаем rationale, понимаем trade-off, не добавляем. Local equivalent уже есть — `pnpm storage:bootstrap`, и он живёт в `infra/`, а не в коде сервисов.

### Phase 22.4 (April 2026) — anonymous-read `public` bucket вместо presigned URLs

Per-service private bucket'ы (`parser`, и любые per-service в будущем) обслуживают **internal-only** доступ через S3 API с ключом (текущий контракт не меняется). Отдельный `public` bucket открыт **anonymous-read** через Garage native web endpoint (port 3902) + UUID v4 obscurity (122 бита энтропии в каждом key path) — см. D-19..D-21 в `.planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md`.

Это осознанный trade-off против TTL+signature сложности **presigned URL** механизма (который был удалён из `StoragePort` и `@aws-sdk/s3-request-presigner` — удалён из deps). Для текущего класса файлов (отчёты уже отправленные пользователям через Telegram, файлы доступные по ссылке один раз) UUID obscurity достаточно. Чувствительные данные (PII, финансы, внутренние документы) — **будущая фаза** с третьим классом bucket'ов + presigning; когда появится — вернём `@aws-sdk/s3-request-presigner` обратно в deps и добавим `SignedNamespaceModule` как parallel к `SharedNamespaceModule`.

**Почему Garage native virtual-host web endpoint, а не Traefik path-rewrite или gateway proxy:**

Первоначальный план 22.4 (до Wave 0 research) исходил из предпосылки что Garage умеет path-style anonymous GET как MinIO (`mc anonymous set download`). Research OQ-1 выявил: Garage S3 API **не поддерживает** anonymous GET вообще — только отдельный web endpoint (port 3902) в virtual-hosted style. Альтернативы рассмотрены и отклонены:

- **Traefik path-rewrite** (`/public/<key>` → `Host: public.<web-root>`) — сильная завязка на Traefik конфиг в дуальной инфраструктуре, hard-to-debug failure modes.
- **Gateway proxy streaming** — over-engineering для текущих потребностей; gateway-only принцип для файлов сознательно ослаблен (CONTEXT.md specifics).
- **Presigned URL** — отложено как отдельный class (см. выше).

Итоговое решение — Garage native web endpoint + virtual-host (D-28) — простейший путь: одна Garage config секция `[s3_web]` per env, одна DNS A-запись per hosting env, один Coolify Traefik router per hosting env, одна команда `garage bucket website --allow public`. Zero application code для URL generation — формула `${STORAGE_PUBLIC_URL}/${key}` (D-14 amended).

---

## Приложение: быстрая матрица окружений

| Окружение        | S3 backend         | Endpoint S3 API             | Public URL (Garage web endpoint, Phase 22.4)          | WebUI                                      | Verify command                                                                 |
| ---------------- | ------------------ | --------------------------- | ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| Local-native     | Garage v2.1.0      | `localhost:3900`            | `http://public.localhost:3902`                        | `http://localhost:3909`                    | `curl http://localhost:3003/health/ready`                                      |
| Local-isolated   | Garage v2.1.0      | `garage:3900` (docker DNS)  | `http://public.localhost:3902` (host-side)            | `http://localhost:3909`                    | `docker compose exec parser wget -qO- http://localhost:3003/health/ready`      |
| Dev Coolify      | Garage             | `<garage-dev-endpoint>:443` | `https://public.garage.dev.email-platform.pp.ua`      | `http://garage.dev.email-platform.pp.ua`   | SSH в parser container → `wget -qO- http://localhost:3003/health/ready`         |
| Prod Coolify     | Garage             | `<garage-prod-endpoint>:443`| `https://public.garage.email-platform.pp.ua`          | `http://garage.email-platform.pp.ua`       | SSH в prod parser container → `wget -qO- http://localhost:3003/health/ready`    |

**Bucket names везде одинаковые:** `parser`, `public`. **Case-sensitive.**

**Env vars везде одинаковые** (8 `STORAGE_*` переменных из `packages/config/src/schemas/storage.ts` после Phase 22.4): `STORAGE_PROTOCOL`, `STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION`, `STORAGE_PUBLIC_URL`, `STORAGE_MAX_UPLOAD_BYTES`. **`STORAGE_REGION=garage`** (не `us-east-1`) — Garage default region. **`STORAGE_BUCKET` отсутствует** — bucket name приходит из кода (D-27). **`STORAGE_PUBLIC_URL`** per-env через Garage virtual-host web endpoint (D-28/D-29); **`STORAGE_MAX_UPLOAD_BYTES=104857600`** одинаково во всех окружениях (D-06).

**Local credentials** (одинаковые в `.env.example` и `.env.docker`): access key `GKTESTLOCAL0123456789ab`, secret = 64 нуля, key name `email-platform-local`. **Это намеренно статичные local-only значения**, безопасны для коммита, никогда не используются в hosting.

**Hosting credentials**: dev key `email-platform-dev`, prod key `email-platform-prod` — отдельные, в Coolify secrets, никогда в репо.

**Gateway health ни в одном окружении не показывает реальный S3 state** — всегда проверяй напрямую parser/notifier через HTTP endpoint (см. known gap выше). Альтернатива через gateway — **smoke endpoints** `/test/parser/storage-service` и `/test/notifier/storage-service` (доступны в local через `localhost:4000`; в hosting — поведение зависит от exposed endpoints, см. конфигурацию своего deployment).

---

*Runbook создан: 2026-04-09 (Phase 22.2-bucket-provisioning-automation)*
*Обновлён: 2026-04-14 (Phase 22.5-local-garage-unification — Garage везде, bucket `public` вместо `reports`, `pnpm storage:bootstrap`)*
*Обновлён: 2026-04-14 (Phase 22.4-public-bucket-abstraction — anonymous-read на `public` через Garage native virtual-host web endpoint :3902, `STORAGE_PUBLIC_URL` + `STORAGE_MAX_UPLOAD_BYTES` env vars, warning blocks для virtual-host + private-bucket exclusion, Шаг 4.5 на каждое окружение, verify curl `${STORAGE_PUBLIC_URL}/<key>`)*
*Источники истины для констант: см. header sync note*
