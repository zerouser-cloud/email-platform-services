# Phase 22: S3 StorageModule - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

StorageModule in foundation with DI-injected S3 client that works identically with MinIO (local) and Garage (production) without code changes. Per-service bucket isolation. Shared ReportsStorageModule for cross-service file exchange.

</domain>

<decisions>
## Implementation Decisions

### Storage API Scope
- **D-01:** StoragePort interface: upload, download, delete, exists, getSignedUrl — bucket запечён при конфигурации, не передаётся в каждый вызов
- **D-02:** getSignedUrl с обязательным expiresInMs — временные ссылки, без бессрочных
- **D-03:** Presigned URLs нужны — notifier отправляет ссылку на файл в Telegram, файлы могут быть большими (гигабайты)
- **D-04:** Нет raw S3 client export — только StoragePort абстракция (как CacheModule)

### Per-service Isolation
- **D-05:** Каждый сервис конфигурирует свой storage module в `infrastructure/storage/` — берёт заготовку из foundation, настраивает bucket и token
- **D-06:** Root module импортирует готовый `ParserStorageModule`, не конфигурирует `StorageModule.forRootAsync()` напрямую
- **D-07:** Per-service bucket names определяются в самом сервисе (parser → 'parser', sender → 'sender')

### Shared Reports Bucket
- **D-08:** `ReportsStorageModule` — готовый модуль в foundation, bucket 'reports' запечён внутри. Сервис просто импортирует `ReportsStorageModule.forRootAsync()`
- **D-09:** REPORTS_STORAGE token определён в foundation, одинаковый для всех сервисов
- **D-10:** Flow: parser upload → publish event { storageKey } → notifier consume → getSignedUrl → send to Telegram
- **D-11:** Signed URL генерирует notifier (не parser) — parser не знает кто и когда будет скачивать

### Env Vars
- **D-12:** Env vars остаются STORAGE_* (STORAGE_ENDPOINT, STORAGE_PORT, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_BUCKET, STORAGE_REGION). S3-03 уже выполнен в v3.0
- **D-13:** MINIO_ROOT_USER/PASSWORD — внутренние переменные MinIO контейнера, не трогаем

### Garage Compatibility
- **D-14:** Один S3 client, одни настройки — forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED'. Работает одинаково с MinIO и Garage
- **D-15:** Код не знает что за ним MinIO или Garage — только endpoint, credentials, bucket. Никаких ветвлений по provider

### Module Structure
- **D-16:** По паттерну PersistenceModule/CacheModule — `packages/foundation/src/storage/`
- **D-17:** Файлы: storage.module.ts, storage.constants.ts, storage.providers.ts, storage.service.ts, storage.interfaces.ts, s3.health.ts, s3-shutdown.service.ts, index.ts
- **D-18:** `ReportsStorageModule` — отдельный модуль в `packages/foundation/src/reports-storage/` или в `storage/reports-storage.module.ts`
- **D-19:** `forRootAsync({ bucket, token })` — два параметра: bucket name и DI token

### Claude's Discretion
- AWS SDK v3 client configuration details (retries, timeout)
- S3 health check implementation (HEAD bucket vs list objects)
- Exact ReportsStorageModule placement (отдельная директория или файл в storage/)
- Multipart upload — не нужен сейчас, добавить позже если появится use case

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference implementations
- `packages/foundation/src/cache/cache.module.ts` — forRootAsync() с параметрами (ближайший аналог)
- `packages/foundation/src/cache/cache.interfaces.ts` — StoragePort pattern (CachePort reference)
- `packages/foundation/src/cache/cache.providers.ts` — Provider factory pattern
- `packages/foundation/src/cache/cache.service.ts` — Service implementation pattern
- `packages/foundation/src/persistence/persistence.module.ts` — Original forRootAsync() reference

### Existing config
- `packages/config/src/schemas/storage.ts` — StorageSchema (STORAGE_* env vars)
- `apps/parser/src/infrastructure/config/parser-env.schema.ts` — already includes StorageSchema
- `apps/notifier/src/infrastructure/config/notifier-env.schema.ts` — already includes StorageSchema

### Architecture constraints
- `.agents/skills/no-magic-values/SKILL.md` — Named constants
- `.agents/skills/branching-patterns/SKILL.md` — No if/else chains
- `.agents/skills/twelve-factor/SKILL.md` — No environment branching

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CacheModule — structural template (forRootAsync with params, providers factory, health, shutdown)
- StorageSchema — already exists in config package, parser and notifier env schemas include it
- No existing storage code in foundation — clean slate

### Established Patterns
- Symbol DI tokens (CACHE_SERVICE, REDIS_HEALTH, DRIZZLE, etc.)
- Provider arrays in separate `*.providers.ts` factory function
- Health indicators co-located with module
- Shutdown services implementing OnApplicationShutdown
- Per-service module config in `infrastructure/` layer

### Integration Points
- Parser and notifier already include StorageSchema in env config
- ReportsStorageModule will be imported by parser and notifier
- Health controllers will inject STORAGE_HEALTH for readiness checks

</code_context>

<specifics>
## Specific Ideas

- Legacy проект использовал local filesystem + Google Drive, не S3. S3 — новое решение
- Parser генерирует CSV отчёты → upload в S3 → событие с ключом → notifier скачивает signed URL → отправляет в Telegram
- Файлы могут быть большими (гигабайты), поэтому signed URL, а не прямое скачивание через notifier
- Если логика reports усложнится — можно вынести в отдельный сервис в будущем

</specifics>

<deferred>
## Deferred Ideas

- Multipart upload — добавить когда появится use case с большими файлами при upload
- S3 lifecycle rules (auto-delete через N дней) — настройка на уровне Garage/MinIO, не кода
- Отдельный reports сервис — если логика усложнится

</deferred>

---

*Phase: 22-s3-storagemodule*
*Context gathered: 2026-04-09*
