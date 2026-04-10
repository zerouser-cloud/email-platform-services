# Phase 22: S3 StorageModule - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 22-s3-storagemodule
**Areas discussed:** Storage API scope, Per-service isolation, Env vars rename, Garage compatibility

---

## Storage API Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (upload/download/delete) | Без presigned URLs | |
| + exists + getSignedUrl | Presigned URLs для Telegram delivery | ✓ |
| + multipart upload | Для больших файлов при upload | deferred |

**User's choice:** upload/download/delete/exists/getSignedUrl — presigned URLs нужны для отправки ссылок в Telegram
**Notes:** Legacy проект не использовал S3 вообще (local filesystem + Google Drive). Файлы могут быть гигабайтами — прямое скачивание через notifier не вариант. Flow: parser upload → event { storageKey } → notifier getSignedUrl → Telegram. Parser не генерирует signed URL — это ответственность notifier (разделение ответственности).

---

## Per-service Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-prefix (как CacheModule) | namespace добавляется прозрачно | |
| Shared bucket, convention paths | Один bucket, сервис сам формирует пути | |
| Per-service bucket + shared buckets | Каждый сервис свой bucket + общие (reports) | ✓ |

**User's choice:** Per-service buckets + shared buckets
**Notes:** Долгое обсуждение. User предложил shared bucket 'reports' для cross-service файлов. Ключевой инсайт user'а: foundation даёт заготовку StorageModule, сервис конфигурирует в infrastructure/storage/ (как config в infrastructure/config/). Shared ReportsStorageModule — готовый модуль в foundation, сервис просто импортирует. Bucket запечён при конфигурации модуля, не передаётся в каждый вызов StoragePort.

---

## Env Vars Rename

**User's choice:** Оставить STORAGE_* — S3-03 уже выполнен в v3.0
**Notes:** Быстро согласовано.

---

## Garage Compatibility

**User's choice:** Один client, одни настройки, никаких ветвлений по provider
**Notes:** User подчеркнул: смысл S3-совместимого контракта в том что код не должен знать о конкретной реализации (MinIO vs Garage). forcePathStyle: true работает с обоими.

---

## Claude's Discretion

- AWS SDK v3 client configuration
- S3 health check implementation
- ReportsStorageModule placement
- Multipart upload (deferred)

## Deferred Ideas

- Multipart upload
- S3 lifecycle rules
- Отдельный reports сервис
