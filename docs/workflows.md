# Рабочие процессы

Руководство по запуску, проверке и деплою платформы.

## Локальная разработка

### Режим Native (инфра в Docker, сервисы на хосте)

Инфраструктура (PostgreSQL, Redis, RabbitMQ, MinIO) запускается в Docker, а 6 сервисов — нативно на хосте с hot-reload.

```bash
# Запуск
pnpm start:native

# Остановка сервисов — Ctrl+C в терминале, потом:
pnpm stop:native
```

**Проверка:**

```bash
# Liveness — gateway отвечает
curl http://127.0.0.1:3000/health/live

# Readiness — все gRPC сервисы доступны
curl http://127.0.0.1:3000/health/ready
```

Ожидаемый ответ liveness:
```json
{
  "status": "ok",
  "info": {},
  "error": {},
  "details": {},
  "code_env": "local"
}
```

Ожидаемый ответ readiness:
```json
{
  "status": "ok",
  "info": {
    "auth": { "servingStatus": "SERVING", "status": "up" },
    "sender": { "servingStatus": "SERVING", "status": "up" },
    "parser": { "servingStatus": "SERVING", "status": "up" },
    "audience": { "servingStatus": "SERVING", "status": "up" }
  }
}
```

### Режим Isolated (всё в Docker)

Все сервисы и инфраструктура запускаются в Docker контейнерах. Образы собираются локально.

```bash
# Запуск (с пересборкой образов)
pnpm start:isolated

# Остановка
pnpm stop:isolated
```

**Проверка:**

Gateway маппится на порт **4000** (не 3000):

```bash
curl http://127.0.0.1:4000/health/live
curl http://127.0.0.1:4000/health/ready
```

Ответы аналогичны режиму Native.

## Деплой

### Процесс

```
feature branch → PR в dev → CI → auto-deploy dev
                              ↓
                PR в main → CI → auto-deploy prod
```

1. Создай ветку от `dev`
2. Сделай изменения, запуш
3. Создай PR в `dev`
4. После мержа: GitHub Actions собирает образы → вызывает Coolify API → dev обновляется
5. Когда dev проверен: создай PR из `dev` в `main`
6. После мержа: аналогично обновляется prod

### Что происходит автоматически

- **CI (GitHub Actions):** lint → typecheck → build → Docker Build & Push (6 образов) → Deploy to Coolify
- **Coolify:** получает вызов API → `docker compose up -d` → пересоздаёт только контейнеры с изменёнными образами
- **Теги образов:** ветка `dev` → `dev-latest`, ветка `main` → `latest`

### Проверка Dev окружения

После мержа PR в `dev` и завершения CI (~2-3 мин):

```bash
# Liveness
curl http://api.dev.email-platform.pp.ua/health/live

# Readiness
curl http://api.dev.email-platform.pp.ua/health/ready
```

Ожидаемый ответ liveness:
```json
{
  "status": "ok",
  "code_env": "\"dev\""
}
```

### Проверка Prod окружения

После мержа PR из `dev` в `main` и завершения CI:

```bash
# Liveness
curl http://api.email-platform.pp.ua/health/live

# Readiness
curl http://api.email-platform.pp.ua/health/ready
```

Ожидаемый ответ liveness:
```json
{
  "status": "ok",
  "code_env": "\"main\""
}
```

### Порты и URL

| Режим | Gateway | Протокол |
|-------|---------|----------|
| Native | `127.0.0.1:3000` | HTTP |
| Isolated | `127.0.0.1:4000` | HTTP |
| Dev (Coolify) | `api.dev.email-platform.pp.ua` | HTTP |
| Prod (Coolify) | `api.email-platform.pp.ua` | HTTP |

### Endpoints

| Endpoint | Назначение |
|----------|-----------|
| `/health/live` | Liveness — gateway жив |
| `/health/ready` | Readiness — все backend-сервисы доступны через gRPC |

## Быстрая проверка всех режимов

```bash
# Native
curl -s http://127.0.0.1:3000/health/ready | jq .status

# Isolated
curl -s http://127.0.0.1:4000/health/ready | jq .status

# Dev
curl -s http://api.dev.email-platform.pp.ua/health/ready | jq .status

# Prod
curl -s http://api.email-platform.pp.ua/health/ready | jq .status
```

Все должны вернуть `"ok"`.
