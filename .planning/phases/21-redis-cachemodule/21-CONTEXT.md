# Phase 21: Redis CacheModule - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

CacheModule in foundation with DI-injected Redis client, health monitoring, per-service namespace isolation, and graceful shutdown. Follows PersistenceModule pattern.

</domain>

<decisions>
## Implementation Decisions

### Redis Usage Scope
- **D-01:** Redis только для кэша в текущем milestone. Get/set/del + TTL — весь API
- **D-02:** Сессии, rate-limiting, pub/sub — не в scope. Если появится конкретный use case (например token revocation), добавим отдельную абстракцию (не расширяем CachePort)
- **D-03:** Legacy проект подтверждает: Redis используется только для task tracking (set/get/del с TTL). Auth на JWT stateless, refresh tokens в БД

### Redis API Scope
- **D-04:** CacheModule экспортирует только абстракцию `CachePort` через `CACHE_SERVICE` token. Никакого raw client export (REDIS_CLIENT не экспортируется)
- **D-05:** CachePort интерфейс: `get<T>(key): Promise<T | null>`, `set(key, value, ttlMs): Promise<void>`, `del(key): Promise<void>`
- **D-06:** TTL обязательный параметр в set() (не optional) — кэш без TTL это утечка памяти
- **D-07:** Если понадобится специфическая операция (incr, exists, expire) — создаётся отдельная абстракция/порт, а не даётся доступ к raw client. Принцип: экспортировать абстракцию, не raw client

### Namespace Strategy
- **D-08:** Auto-prefix через `forRootAsync({ namespace: 'sender' })`. CacheService прозрачно добавляет `{namespace}:` к каждому ключу
- **D-09:** Аналогия с pgSchema в PersistenceModule — изоляция на уровне модуля, не convention
- **D-10:** Сервис пишет `campaign:123`, в Redis лежит `sender:campaign:123`

### Module Structure
- **D-11:** Всё в одной директории `packages/foundation/src/cache/` по паттерну PersistenceModule
- **D-12:** Файлы: cache.module.ts, cache.constants.ts, cache.providers.ts, cache.service.ts, cache.interfaces.ts, redis.health.ts, redis-shutdown.service.ts, index.ts
- **D-13:** Старый `health/indicators/redis.health.ts` (stub) удаляется — заменяется реальным redis.health.ts внутри cache/
- **D-14:** `forRootAsync({ namespace: string })` — единственный параметр. REDIS_URL из ConfigService
- **D-15:** Tokens: CACHE_SERVICE (Symbol), REDIS_HEALTH (Symbol). Без REDIS_CLIENT

### Claude's Discretion
- Внутренняя реализация namespace prefix (в RedisCacheService constructor vs в каждом методе)
- ioredis connection options (keepAlive, retryStrategy)
- Serialization format (JSON.stringify/parse)
- Redis health check implementation (PING vs INFO)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference implementation (PersistenceModule pattern)
- `packages/foundation/src/persistence/persistence.module.ts` — forRootAsync() pattern
- `packages/foundation/src/persistence/persistence.constants.ts` — Symbol DI tokens pattern
- `packages/foundation/src/persistence/persistence.providers.ts` — Provider array pattern
- `packages/foundation/src/persistence/drizzle-shutdown.service.ts` — Graceful shutdown pattern
- `packages/foundation/src/persistence/postgres.health.ts` — Real health indicator pattern

### Existing Redis code (to replace)
- `packages/foundation/src/health/indicators/redis.health.ts` — Stub to delete
- `packages/config/src/schemas/redis.ts` — RedisSchema (REDIS_URL)

### Architecture constraints
- `.agents/skills/env-schema/SKILL.md` — No defaults in env schemas
- `.agents/skills/no-magic-values/SKILL.md` — Named constants
- `.agents/skills/branching-patterns/SKILL.md` — No if/else chains

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- PersistenceModule — exact structural pattern to follow (module, constants, providers, health, shutdown)
- RedisSchema in `packages/config/src/schemas/redis.ts` — already exists, validates REDIS_URL
- Per-service config in `infrastructure/config/` — sender and audience already include RedisSchema

### Established Patterns
- Symbol-based DI tokens (DRIZZLE, PG_POOL, DATABASE_HEALTH)
- Provider arrays in separate `*.providers.ts` file
- Health indicators co-located with their module (not in separate health/ directory)
- Shutdown services implement OnApplicationShutdown

### Integration Points
- Services import CacheModule.forRootAsync({ namespace }) in their root module
- Services add RedisSchema to their composed env schema (sender already has it)
- Health controllers inject REDIS_HEALTH for readiness checks
- Foundation index.ts exports CacheModule and related types

</code_context>

<specifics>
## Specific Ideas

- TTL обязательный — нет set без TTL, предотвращает утечку памяти
- Namespace прозрачный — сервис не думает о prefix, модуль делает сам
- Принцип из обсуждения: "экспортировать абстракцию, не raw client" — применить ко всем infrastructure modules

</specifics>

<deferred>
## Deferred Ideas

- Token revocation / session storage — отдельная абстракция когда появится use case
- PG_POOL export из PersistenceModule — backlog 999.3
- Rate limiting через Redis — отдельный ThrottlerStorage adapter если понадобится

</deferred>

---

*Phase: 21-redis-cachemodule*
*Context gathered: 2026-04-08*
