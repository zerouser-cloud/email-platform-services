# Runbook: Создание S3 Bucket'ов

> **Operational runbook** для ручной подготовки S3 хранилища во всех окружениях email-платформы.
> Покрывает создание bucket'ов, access keys, key bindings (Garage), env vars и проверку работы.

**⚠ Синхронизация с кодом:** Если имена bucket'ов в коде изменятся, обнови этот runbook в том же PR.

Источники истины для имён bucket'ов (single source of truth — код, не этот документ):

- `apps/parser/src/parser.constants.ts:6` → `PARSER_STORAGE_BUCKET = 'parser'`
- `packages/foundation/src/external/storage/reports/reports.constants.ts:4` → `REPORTS_BUCKET = 'reports'`

Если эти константы меняются — runbook обязан быть обновлён в том же PR. Любое расхождение между кодом и runbook'ом ломает onboarding и debugging.

## Что покрывает этот runbook

Четыре окружения развёртывания в порядке возрастания критичности:

1. **Local-native** — `pnpm start:native`, инфра в Docker, сервисы на хосте
2. **Local-isolated** — `pnpm start:isolated`, всё в Docker
3. **Dev Coolify/Garage** — `api.dev.email-platform.pp.ua` + Garage на `garage.dev.email-platform.pp.ua`
4. **Prod Coolify/Garage** — `api.email-platform.pp.ua` + Garage на `garage.email-platform.pp.ua`

Каждый раздел **self-contained** — его можно читать независимо от остальных. Если тебе нужен только prod — читай только prod, не нужно проходить local-native сначала.

Каждый раздел следует одной и той же 6-шаговой структуре:

| Шаг | Что делаем                                     |
| --- | ---------------------------------------------- |
| 1   | Prerequisites                                  |
| 2   | Open UI (открыть WebUI хранилища)              |
| 3   | Create buckets (`parser`, `reports`)           |
| 4   | Configure access (key + binding для Garage)    |
| 5   | Set env vars (`STORAGE_*` в `.env` / Coolify)  |
| 6   | Verify (`curl` / `wget` к `/health/ready`)     |

## Bucket'ы и env vars

**Два bucket'а** используются всеми окружениями одинаково:

| Bucket    | Имя        | Источник истины                                                            | Используется                                                                |
| --------- | ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `parser`  | `'parser'` | `apps/parser/src/parser.constants.ts:6`                                    | parser service — промежуточные файлы парсинга                                |
| `reports` | `'reports'`| `packages/foundation/src/external/storage/reports/reports.constants.ts:4` | parser (запись) + notifier (чтение) — shared отчёты для Telegram            |

Имена bucket'ов case-sensitive. Не `Parser`, не `REPORTS` — строго lowercase как в константах.

**Env vars** (полный список из `packages/config/src/schemas/storage.ts`):

| Переменная          | Тип               | Пример local                              | Пример prod                  |
| ------------------- | ----------------- | ----------------------------------------- | ---------------------------- |
| `STORAGE_PROTOCOL`  | `http` \| `https` | `http`                                    | `https`                      |
| `STORAGE_ENDPOINT`  | hostname          | `localhost` (native) / `minio` (isolated) | `<garage-endpoint>`          |
| `STORAGE_PORT`      | number            | `9000`                                    | `443`                        |
| `STORAGE_ACCESS_KEY`| string            | `minioadmin`                              | `<GARAGE_ACCESS_KEY>`        |
| `STORAGE_SECRET_KEY`| string            | `minioadmin`                              | `<GARAGE_SECRET_KEY>`        |
| `STORAGE_REGION`    | string            | `us-east-1`                               | `us-east-1`                  |

Reference для local значений: `.env.example:37-42`.

Все переменные **обязательны** — Zod схема (`packages/config/src/schemas/storage.ts`) не содержит `.optional()` и `.default()`, любая отсутствующая переменная блокирует старт сервиса с validation error.

## Что именно проверяется в readiness

Readiness endpoint (`/health/ready`) parser'а и notifier'а выполняет `HeadBucket` против каждого привязанного bucket'а:

```typescript
// packages/foundation/src/internal/storage/s3.health.ts:18
await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
```

- **Parser** проверяет `parser` + `reports` — health keys `s3:parser`, `s3:reports`
- **Notifier** проверяет `reports` — health key `s3:reports`
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

Fix этого gap — **отдельная задача, не в скоупе этого runbook'а**. Runbook документирует как обходить gap через прямой endpoint, не исправляет сам механизм. Если в будущем gRPC health начнёт реально опрашивать backing services (S3, postgres, redis, rabbitmq) — gateway `/health/ready` станет валидной точкой проверки и этот раздел будет удалён.

---

## 1. Local-native

Режим `pnpm start:native`: инфраструктура в Docker (MinIO + postgres + redis + rabbitmq), сервисы на хосте — TypeScript код запускается напрямую через `ts-node-dev`, подключается к Docker-контейнерам по `localhost`.

### Шаг 1: Prerequisites

- Docker и Docker Compose установлены
- pnpm ≥ 9.0.0 установлен на хосте
- Порты `9000` (MinIO API) и `9001` (MinIO WebUI) свободны на хосте
- Порты backend-сервисов (3003 parser, 3005 notifier, 3000 gateway) свободны на хосте
- Репозиторий склонирован, `.env` создан из `.env.example`

Запустить инфру (MinIO + остальные backing services):

```bash
pnpm start:native
# или напрямую:
docker compose -f infra/docker-compose.infra.yml -f infra/docker-compose.dev-ports.yml up -d
```

Убедиться что MinIO контейнер запущен:

```bash
docker compose -f infra/docker-compose.infra.yml ps minio
```

### Шаг 2: Открыть UI

MinIO WebUI: **http://localhost:9001**

Логин:

- Username: `minioadmin`
- Password: `minioadmin`

> Это **публичные defaults** для local dev (определены в `infra/docker-compose.infra.yml:48-49` через fallback `${MINIO_ROOT_USER:-minioadmin}`). Не секреты — коммитятся в репо сознательно для простоты onboarding. В prod используется Garage, не MinIO, поэтому эти defaults никогда не попадают в production.

### Шаг 3: Создать bucket'ы

В левом меню MinIO WebUI → **Buckets** → **Create Bucket**.

Создать **два** bucket'а:

1. **`parser`** — источник имени `apps/parser/src/parser.constants.ts:6` (`PARSER_STORAGE_BUCKET = 'parser'`)
2. **`reports`** — источник имени `packages/foundation/src/external/storage/reports/reports.constants.ts:4` (`REPORTS_BUCKET = 'reports'`)

Опции оставить по умолчанию (versioning off, object locking off, quota off). Никаких специальных настроек для local не требуется.

Проверить что оба bucket'а появились в списке **Buckets**.

### Шаг 4: Конфигурация доступа

В MinIO WebUI root user (`minioadmin`) имеет **полный доступ** ко всем bucket'ам автоматически. Отдельный шаг создания access key и его привязки к bucket'у **не требуется** — это специфика Garage, не MinIO.

Никаких дополнительных действий для local-native. Root credentials из шага 2 используются приложением как `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`.

### Шаг 5: Set env vars

Отредактировать `.env` в корне репо (создать из `.env.example` если ещё нет):

```bash
STORAGE_PROTOCOL=http
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_REGION=us-east-1
```

Reference для точных значений: `.env.example:37-42`.

`STORAGE_ENDPOINT=localhost` потому что сервисы на хосте подключаются к MinIO через exposed порт Docker-контейнера на `localhost:9000`.

### Шаг 6: Verify

Запустить сервисы (`pnpm start:native`), затем проверить **прямой HTTP endpoint** parser'а (в обход gateway gRPC gap):

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
    "s3:reports": { "status": "up" }
  },
  "error": {},
  "details": {
    "postgres": { "status": "up" },
    "s3:parser": { "status": "up" },
    "s3:reports": { "status": "up" }
  }
}
```

**Ожидаемый DOWN ответ (HTTP 503, например если bucket `parser` не создан):**

```json
{
  "status": "error",
  "info": {
    "postgres": { "status": "up" },
    "s3:reports": { "status": "up" }
  },
  "error": {
    "s3:parser": { "status": "down", "message": "S3 bucket health check failed" }
  },
  "details": {
    "postgres": { "status": "up" },
    "s3:parser": { "status": "down", "message": "S3 bucket health check failed" },
    "s3:reports": { "status": "up" }
  }
}
```

Если ответ `DOWN` — вернись к шагу 3 и проверь что **оба** bucket'а созданы с точными именами `parser` и `reports` (case-sensitive — `Parser` или `REPORTS` не сработают).

Аналогично проверить notifier (проверяет только `s3:reports`):

```bash
curl -s http://localhost:3005/health/ready | jq
```

Notifier не использует `parser` bucket, поэтому его readiness не упадёт если только `parser` bucket отсутствует — но упадёт если нет `reports`.

---

## 2. Local-isolated

Режим `pnpm start:isolated`: все сервисы и инфра запускаются в Docker контейнерах, через networks `infra` + `services`. Сервисы **не exposed** на хост кроме gateway.

### Шаг 1: Prerequisites

- Docker и Docker Compose установлены
- Порт `9001` (MinIO WebUI) свободен на хосте — dev-ports override exposes его наружу
- Порт `4000` (gateway) свободен на хосте (`infra/docker-compose.yml:12` — `ports: ["4000:3000"]`)
- `.env.docker` создан и содержит `STORAGE_*` значения для **docker network** (не `localhost`)

Запустить:

```bash
pnpm start:isolated
# или напрямую:
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev-ports.yml up -d --build
```

Проверить что все контейнеры живы:

```bash
docker compose -f infra/docker-compose.yml ps
```

### Шаг 2: Открыть UI

MinIO WebUI: **http://localhost:9001** (тот же URL что и в local-native — dev-ports override exposes 9001 на хост).

Логин: `minioadmin` / `minioadmin` (те же defaults).

> **Важно:** WebUI доступен **только** благодаря `dev-ports.yml` override. Если запустить isolated без этого override (`docker compose -f infra/docker-compose.yml up -d`), порт `9001` не будет exposed и WebUI окажется недоступен с хоста — придётся заходить через `docker exec` в minio container. Для простоты onboarding всегда запускай через `pnpm start:isolated` — команда включает override.

### Шаг 3: Создать bucket'ы

Идентично local-native: в WebUI создать **`parser`** и **`reports`** через **Buckets → Create Bucket**.

Опции по умолчанию.

> **Volume персистентность:** MinIO volume `minio_data` (см. `infra/docker-compose.infra.yml:51`) персистентен между `up/down` циклами. Если bucket'ы были созданы в local-native режиме и volume не удалён — они уже существуют, шаг 3 можно пропустить. Проверить наличие через WebUI → Buckets.
>
> Чтобы сбросить volume: `docker compose down -v` — **осторожно**, удалит все данные MinIO.

### Шаг 4: Конфигурация доступа

Как в local-native — root user MinIO имеет полный доступ ко всем bucket'ам автоматически, отдельный шаг key binding не требуется. Это специфика MinIO (и общее поведение S3-compatible storages кроме Garage).

### Шаг 5: Set env vars

Отредактировать `.env.docker` в корне репо. **Ключевое отличие от native:** `STORAGE_ENDPOINT` — имя сервиса в docker network, не `localhost`:

```bash
STORAGE_PROTOCOL=http
STORAGE_ENDPOINT=minio
STORAGE_PORT=9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_REGION=us-east-1
```

`minio` — имя сервиса из `infra/docker-compose.infra.yml:44`. Сервисы на network `infra` резолвят это имя через встроенный Docker DNS.

После редактирования `.env.docker` — пересобрать и перезапустить контейнеры:

```bash
pnpm stop:isolated
pnpm start:isolated
```

(Переменные окружения читаются при старте контейнера, простой `restart` достаточен только если уже была актуальная версия `.env.docker` на предыдущем старте.)

### Шаг 6: Verify

Parser HTTP port **не exposed** на хост в isolated режиме (см. `infra/docker-compose.yml:79-85` — `expose: ["3003", "50053"]`, не `ports`). Проверка через `docker compose exec` в запущенный контейнер:

```bash
docker compose -f infra/docker-compose.yml exec parser wget -qO- http://localhost:3003/health/ready
```

Здесь `localhost` уже внутри контейнера parser — ссылается на сам parser process, не на хост.

**Ожидаемый OK / DOWN ответ:** идентичен примерам из раздела Local-native (те же поля, те же ключи `s3:parser` / `s3:reports`).

Аналогично для notifier:

```bash
docker compose -f infra/docker-compose.yml exec notifier wget -qO- http://localhost:3005/health/ready
```

> **Не полагайся на gateway.** Gateway `http://localhost:4000/health/ready` **не показывает** S3 state (см. known gap в начале runbook'а). Он вернёт `status: ok` даже при упавших S3 bucket'ах. Всегда проверяй S3 напрямую через `docker compose exec` на parser/notifier.

Если получаешь `DOWN` — проверь в первую очередь:

1. `.env.docker` содержит `STORAGE_ENDPOINT=minio` (не `localhost`)
2. Bucket'ы `parser` и `reports` существуют в MinIO WebUI
3. Контейнеры parser и notifier пересобраны после изменения `.env.docker`

---

<!-- TASK1_END_MARKER -->
