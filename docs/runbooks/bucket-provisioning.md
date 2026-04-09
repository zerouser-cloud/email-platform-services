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

## 3. Dev Coolify/Garage

Dev окружение развёрнуто в Coolify на локальном сервере (см. memory `project_hosting_infra.md`). S3 backend — **Garage** (не MinIO), WebUI доступен на `https://garage.dev.email-platform.pp.ua`. Сервисы (gateway, parser, notifier, прочие) живут в dev environment Coolify проекта и подключаются к Garage по S3 API endpoint'у.

> ⚠ **Garage ≠ MinIO.** Garage разделяет bucket и access key как **отдельные, независимые сущности**. Создание bucket через S3 API `CreateBucket` **не создаёт key binding** автоматически — получившийся bucket будет **недоступен** приложению. Поэтому этот раздел использует **Garage-native** подход (WebUI или `garage` CLI), а не generic S3 API (`aws s3api`, `mc mb`). Если пытаешься автоматизировать через S3 API — не работает, это проверено.

### Шаг 1: Prerequisites

- Доступ к Coolify dashboard (dev instance) — нужны permissions на редактирование environment variables и secrets dev окружения проекта email-platform
- Доступ к Garage WebUI `https://garage.dev.email-platform.pp.ua`
- Login credentials для Garage WebUI — в Coolify project secrets (путь: **Coolify → project → environment → Secrets → `GARAGE_WEBUI_*`** или аналогичный ключ, уточнить у Coolify admin)
- (Опционально для CLI alternative) SSH доступ на Coolify host машину (`192.168.1.25` согласно memory `project_hosting_infra.md`)

> **Важно:** для получения prod и dev Garage credentials используй Coolify secrets UI. **Не запрашивай в чате, не коммить в репо.** Реальные значения никогда не должны попадать в историю git.

### Шаг 2: Открыть UI

Открыть в браузере: **https://garage.dev.email-platform.pp.ua**

Login credentials брать из Coolify secrets — **не запрашивай в чате, не коммить в репо**.

### Шаг 3: Создать bucket'ы

В Garage WebUI → **Buckets** → **Create bucket**.

Создать два bucket'а с точными именами:

1. **`parser`** — для parser service (источник имени: `apps/parser/src/parser.constants.ts:6`)
2. **`reports`** — shared для parser (запись) и notifier (чтение) (источник имени: `packages/foundation/src/external/storage/reports/reports.constants.ts:4`)

Имена case-sensitive. Проверить соответствие кодовым константам (см. header sync note в начале runbook). Если в Garage уже есть bucket'ы с другими именами (например `parser-dev` или `reports-v2`) — не использовать их, создать новые с точными именами из констант.

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

Для **каждого** из двух bucket'ов (`parser`, `reports`):

- Открыть bucket в Garage WebUI → **Permissions** tab (или **Access keys** tab — зависит от версии Garage WebUI)
- Найти в списке созданный `email-platform-dev` key
- Включить permissions: **Read**, **Write**, **Owner** (минимум Read+Write; Owner даёт полный контроль включая удаление bucket'а через API)
- Нажать **Save** / **Apply**

**Повторить для обоих bucket'ов.** Один и тот же access key привязывается к обоим `parser` и `reports`.

**Проверка:** после сохранения на странице bucket'а в разделе permissions должен быть виден email-platform-dev key с галочками Read/Write. Если галочек нет — binding не сохранился, повторить.

**4.3. Сохранить credentials в Coolify secrets**

В Coolify → project → **dev** environment → Secrets добавить/обновить:

| Secret                  | Значение                                |
| ----------------------- | --------------------------------------- |
| `STORAGE_ACCESS_KEY`    | `<access key ID из шага 4.1>`           |
| `STORAGE_SECRET_KEY`    | `<secret key из шага 4.1>`              |

Secrets в Coolify шифруются at-rest и инжектируются в контейнеры сервисов как environment variables при deploy.

### CLI alternative (через SSH на Coolify host)

Если предпочитаешь CLI или нет доступа к WebUI — SSH в Coolify host, затем `docker exec` в Garage container:

```bash
# Предположим container называется garage-dev
docker exec -it garage-dev bash

# Внутри container:
garage bucket create parser
garage bucket create reports

garage key create email-platform-dev
# Запиши access key ID и secret key из output — они показываются только один раз

garage key allow --read --write --owner email-platform-dev parser
garage key allow --read --write --owner email-platform-dev reports

# Проверить что binding сохранён:
garage bucket info parser
garage bucket info reports
# В output должно быть видно email-platform-dev key с RW permissions
```

Каждый `garage key allow` — это **тот самый key binding** без которого bucket недоступен. Без этих команд `garage bucket create` создаёт **изолированный bucket** который никто не может читать/писать. Это **не ошибка** Garage — это by design: Garage разделяет ownership (создатель) и access (кто может использовать) как отдельные concerns.

### Шаг 5: Set env vars

В Coolify → project → dev environment → **Environment Variables** (не Secrets — кроме `STORAGE_ACCESS_KEY` и `STORAGE_SECRET_KEY` которые уже в Secrets с шага 4.3):

```bash
STORAGE_PROTOCOL=https
STORAGE_ENDPOINT=<garage-dev-endpoint>
STORAGE_PORT=443
STORAGE_ACCESS_KEY=<из Coolify secrets>
STORAGE_SECRET_KEY=<из Coolify secrets>
STORAGE_REGION=us-east-1
```

`<garage-dev-endpoint>` — S3 API endpoint Garage instance (**не** WebUI URL `garage.dev.email-platform.pp.ua`; обычно `s3.dev.email-platform.pp.ua` или аналогичный subdomain — уточнить у Coolify admin или в Garage deployment config на хосте). WebUI URL и S3 API URL — разные endpoint'ы, не перепутай.

После сохранения — **Redeploy** сервисов parser и notifier в Coolify чтобы подхватить новые env vars. Gateway тоже желательно передеплоить для консистентности, но gateway напрямую в S3 не ходит, поэтому его deploy не критичен для S3 readiness.

### Шаг 6: Verify

**⚠ Gateway health через Traefik не покажет S3 state** (см. known gap в начале runbook):

```bash
# Это вернёт status: ok даже если S3 упал — НЕ использовать как единственную проверку
curl -s https://api.dev.email-platform.pp.ua/health/ready | jq
```

Для реальной проверки S3 нужен **прямой HTTP endpoint parser'а**. HTTP порт parser'а (3003) **не exposed** наружу через Traefik (Coolify конфигурация по умолчанию exposes только gateway HTTP port). Поэтому:

**Вариант А: SSH/Terminal через Coolify dashboard.**

```bash
# Coolify → project → parser service → Terminal
wget -qO- http://localhost:3003/health/ready | jq
```

Здесь `localhost` — внутри контейнера parser, это сам parser process.

**Вариант Б: `docker exec` через SSH на Coolify host.**

```bash
# Список запущенных parser containers (имя может отличаться в зависимости от Coolify deployment):
docker ps | grep parser
# Исполнить health check:
docker exec <parser-container-id> wget -qO- http://localhost:3003/health/ready
```

**Ожидаемый OK ответ** (HTTP 200): идентичен примеру из раздела Local-native — `status: ok`, `s3:parser` и `s3:reports` оба `up`.

**Ожидаемый DOWN ответ** (HTTP 503): если key binding не создан (самая частая ошибка), получишь:

```json
{
  "status": "error",
  "info": {
    "postgres": { "status": "up" }
  },
  "error": {
    "s3:parser": { "status": "down", "message": "S3 bucket health check failed" },
    "s3:reports": { "status": "down", "message": "S3 bucket health check failed" }
  },
  "details": {
    "postgres": { "status": "up" },
    "s3:parser": { "status": "down", "message": "S3 bucket health check failed" },
    "s3:reports": { "status": "down", "message": "S3 bucket health check failed" }
  }
}
```

Аналогично для notifier (проверяет только `s3:reports`):

```bash
docker exec <notifier-container-id> wget -qO- http://localhost:3005/health/ready
```

Если хоть один из `s3:parser` / `s3:reports` в DOWN — вернись к шагу 4 и проверь:

1. Access key создан (шаг 4.1)
2. Key binding **сохранён** на оба bucket'а (шаг 4.2) — это самая частая ошибка
3. Credentials в Coolify secrets точно совпадают с созданными в Garage (шаг 4.3)
4. Env vars в Coolify указывают на правильный `STORAGE_ENDPOINT` (S3 API, не WebUI) (шаг 5)
5. Сервисы передеплоены после изменения secrets/env vars

---

## 4. Prod Coolify/Garage

Prod окружение — идентично dev по топологии (Coolify + Garage), отличается только URL'ами, credentials и scope risk. **Все шаги те же**, только на prod target.

> ⚠ **Prod = real data.** Перед применением любых изменений — убедись что ты работаешь в **prod environment**, не dev. Coolify dashboard разделяет environments по selector'у сверху, но CLI команды через SSH не различают — смотри внимательно на `docker ps` output и подтверждай target перед каждым действием.

### Шаг 1: Prerequisites

- Доступ к Coolify dashboard **prod instance** — отдельный permission level, dev доступ не даёт prod доступ автоматически
- Доступ к Garage WebUI `https://garage.email-platform.pp.ua` (**без** `dev.` prefix — это prod)
- Login credentials для prod Garage — в Coolify **prod** environment secrets (отдельные от dev)
- Подтверждение от владельца проекта что ты можешь делать изменения на prod

### Шаг 2: Открыть UI

Открыть в браузере: **https://garage.email-platform.pp.ua**

Login credentials брать из Coolify **prod** secrets. **Никогда не переиспользуй dev credentials для prod** — это требование минимальных привилегий и разделения blast radius компрометации. Если dev key утёк — prod должен быть невредим.

### Шаг 3: Создать bucket'ы

Идентично dev — два bucket'а `parser` и `reports` через WebUI **Buckets → Create bucket**.

Имена те же (case-sensitive). Источники истины:

- `apps/parser/src/parser.constants.ts:6` → `PARSER_STORAGE_BUCKET = 'parser'`
- `packages/foundation/src/external/storage/reports/reports.constants.ts:4` → `REPORTS_BUCKET = 'reports'`

### Шаг 4: Конфигурация доступа (КРИТИЧНЫЙ ШАГ)

> ⚠ **ОСТОРОЖНО: БЕЗ KEY BINDING BUCKET БУДЕТ НЕДОСТУПЕН ПРИЛОЖЕНИЮ.**
>
> Та же проблема Garage key bindings что и в dev. Этот шаг обязательный. Prod bucket без binding молча сломает readiness сервисов после deploy — а debugging на prod всегда дороже чем в dev.

**4.1. Создать prod access key**

В Garage WebUI → **Keys** → **Create key**. Имя: `email-platform-prod`. **Отдельный key от dev** — никогда не переиспользуй dev credentials для prod.

Сразу записать access key ID и secret key — они показываются **только один раз**. После закрытия окна secret key невозможно восстановить.

**4.2. Привязать key к обоим bucket'ам**

Для `parser` и для `reports` → **Permissions** tab → добавить `email-platform-prod` key с:

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

### CLI alternative

Идентично dev, только SSH в **prod** Coolify host и `docker exec` в **prod** Garage container:

```bash
docker exec -it garage-prod bash

garage bucket create parser
garage bucket create reports

garage key create email-platform-prod
# Запиши credentials — показываются только один раз

garage key allow --read --write email-platform-prod parser
garage key allow --read --write email-platform-prod reports
# Опускаем --owner для prod по причинам minimal permissions

garage bucket info parser
garage bucket info reports
```

Перед каждым действием двойная проверка: ты точно на prod host, не на dev? Dev и prod могут иметь похожие container names.

### Шаг 5: Set env vars

Coolify → project → **prod** environment → Environment Variables:

```bash
STORAGE_PROTOCOL=https
STORAGE_ENDPOINT=<garage-prod-endpoint>
STORAGE_PORT=443
STORAGE_ACCESS_KEY=<из Coolify prod secrets>
STORAGE_SECRET_KEY=<из Coolify prod secrets>
STORAGE_REGION=us-east-1
```

`<garage-prod-endpoint>` — S3 API endpoint **prod** Garage instance (не WebUI URL `garage.email-platform.pp.ua`; уточнить у Coolify admin / в prod Garage deployment config). Обычно это что-то вроде `s3.email-platform.pp.ua`.

**Redeploy** parser и notifier в **prod** environment через Coolify dashboard. Gateway можно не передеплоивать.

### Шаг 6: Verify

Gateway health через Traefik — **не показывает S3 state** (known gap):

```bash
# status: ok не означает что S3 работает — использовать только как liveness check, не как S3 verification
curl -s https://api.email-platform.pp.ua/health/ready | jq
```

Для реальной S3 проверки — SSH/Terminal в **prod** parser container:

```bash
# Coolify → project → parser service (prod environment) → Terminal
wget -qO- http://localhost:3003/health/ready | jq
```

Или через `docker exec` на prod Coolify host:

```bash
docker ps | grep parser  # на prod host — убедись что видишь prod containers, не dev
docker exec <prod-parser-container-id> wget -qO- http://localhost:3003/health/ready
```

**Ожидаемые OK и DOWN ответы** — идентичны примерам из раздела Local-native (`status: ok` + `s3:parser`/`s3:reports` `up` для OK; `status: error` + DOWN details для неудачи).

Notifier prod:

```bash
docker exec <prod-notifier-container-id> wget -qO- http://localhost:3005/health/ready
```

**После подтверждения что всё `up`** — runbook для prod окружения завершён. Buckets готовы для использования, readiness проходит, приложение может писать/читать S3.

Если DOWN — причина почти всегда одна из:

1. Key binding не сохранён (шаг 4.2) — самая частая ошибка
2. Prod credentials случайно скопированы из dev или наоборот (шаг 4.3)
3. `STORAGE_ENDPOINT` указывает на WebUI URL вместо S3 API URL (шаг 5)
4. Prod сервисы не передеплоены после изменения env vars (шаг 5)

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

Даже если бы мы написали код провизии — на Garage (prod) он создал бы **broken bucket** без key binding, и сервис всё равно упал бы на первой операции. Key binding в Garage создаётся только через **Garage-native admin API** (`garage key allow --read --write`), который **не часть S3 API** и не покрывается generic S3 клиентом (AWS SDK, mc, awscli).

Единственный путь обойти это — интеграция Garage admin API напрямую в код приложения. Это:

- Добавляет ещё одну зависимость (Garage admin client)
- Нарушает причину (1) ещё сильнее (теперь приложение управляет key bindings, ещё более infrastructure-level concern)
- Работает только с Garage, не с MinIO (разные admin API) — нужен conditional код, нарушает причину (5)

Альтернативный путь — документировать что на Garage шаг provisioning'а всё равно ручной. Но тогда "автоматизация" работает только для MinIO (local), а для prod по-прежнему ручной — это уже не автоматизация, а "код который работает только в одном окружении", причина (5).

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

При кодовом provisioning'е **опечатка в bucket name constant** (например `repots` вместо `reports` в коде или env var `STORAGE_BUCKET`) **молча создаёт wrong bucket** в prod storage backend. Сервис счастливо работает с неправильным хранилищем — readiness проходит (bucket существует, права есть), функциональность работает (файлы пишутся и читаются), но данные оказываются в "левом" bucket'е которого никто не ожидает.

Обнаружение такой ошибки — **спустя часы или дни** через "куда делись мои отчёты?" / "почему parser не может прочитать файлы которые notifier должен обрабатывать?".

При **manual approach + HeadBucket в readiness** — любая опечатка моментально ловится через readiness `DOWN` на старте сервиса. Bucket с именем `repots` не существует в Garage/MinIO → `HeadBucket` возвращает 404 → readiness DOWN → `docker compose` / Coolify deploy не проходит → ошибка ловится на CI/deploy stage, **до** production traffic. Blast radius: 0.

Этот trade-off особенно важен для `reports` bucket который shared между parser и notifier — опечатка в одном месте ломает cross-service flow, но не роняет сам сервис, т.е. не видна мониторингу сразу.

### 5. Unified approach во всех окружениях

Код который работает только в одном окружении (`provisioningEnabled=true` для local, `false` для dev/prod) — **code smell**. Каждая ветка `if (provisionEnabled) { ... }` — это:

- Два разных поведения приложения, каждое со своими багами
- Каждое требует своего тестирования
- Dead code в prod builds (provisioning logic лежит в binary но никогда не выполняется)
- Confusion для onboarding: "а что этот `provisionEnabled` делает? почему он false на prod?"

Философская позиция: **"если код работает только в одном окружении — это не автоматизация, это local dev convenience которая зря попала в shared codebase"**.

Лучше **ноль кода провизии во всех окружениях** (unified manual) чем код который живёт только для local dev convenience. Local dev setup — это onboarding task делается раз, а runbook работает одинаково для всех 4 окружений одинаково детерминированно.

### Когда это решение стоит пересмотреть

Критерии при которых runbook стоит пересмотреть в пользу автоматизации:

1. **Garage S3 API compatibility подтверждена** — если в будущем Garage начнёт автоматически создавать key binding при `CreateBucket` от owner key (или появится альтернативный S3-compatible backend для prod с таким поведением), причина (2) отпадает. Нужна явная проверка на живом Garage instance, не документация.

2. **Deployment переезжает на IaC** — если мы переходим на Terraform / Pulumi / Crossplane, provisioning переносится в **IaC layer** (не в код приложения) и причины (1), (3), (5) не применимы — IaC это **правильный** слой для infrastructure state management. В такой модели runbook превращается в IaC модуль, а не в code path приложения. Это принципиально другое решение — и оно совместимо с (2) если Garage provider для Terraform существует.

3. **Количество bucket'ов перестаёт помещаться в runbook** — если по какой-то причине у нас появится 20+ bucket'ов которые часто добавляются/удаляются (маловероятно для email-platform, но теоретически возможно), ручной процесс становится bottleneck'ом и стоит рассмотреть IaC module (не code-based provisioning в app).

4. **Minimal permissions переосмысливаются** — если в будущем security model изменится и prod сервисы смогут иметь CreateBucket permissions без audit concerns (очень маловероятно), причина (3) отпадает.

До тех пор — runbook остаётся **единственным источником истины** для bucket setup. Любая попытка "а давайте добавим маленький скрипт для local" должна быть остановлена на этом разделе: читаем rationale, понимаем trade-off, не добавляем.

---

## Приложение: быстрая матрица окружений

| Окружение        | S3 backend | Endpoint                   | WebUI                                      | Verify command                                                                 |
| ---------------- | ---------- | -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| Local-native     | MinIO      | `localhost:9000`           | `http://localhost:9001`                    | `curl http://localhost:3003/health/ready`                                      |
| Local-isolated   | MinIO      | `minio:9000` (docker DNS)  | `http://localhost:9001`                    | `docker compose exec parser wget -qO- http://localhost:3003/health/ready`      |
| Dev Coolify      | Garage     | `<garage-dev-endpoint>:443`| `https://garage.dev.email-platform.pp.ua`  | SSH в parser container → `wget -qO- http://localhost:3003/health/ready`         |
| Prod Coolify     | Garage     | `<garage-prod-endpoint>:443`| `https://garage.email-platform.pp.ua`     | SSH в prod parser container → `wget -qO- http://localhost:3003/health/ready`    |

**Bucket names везде одинаковые:** `parser`, `reports`. **Case-sensitive.**

**Env vars везде одинаковые** (6 переменных из `packages/config/src/schemas/storage.ts`): `STORAGE_PROTOCOL`, `STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION`.

**Gateway health ни в одном окружении не показывает реальный S3 state** — всегда проверяй напрямую parser/notifier через HTTP endpoint (см. known gap выше).

---

*Runbook создан: 2026-04-09*
*Phase: 22.2-bucket-provisioning-automation*
*Источники истины для констант: см. header sync note*
