# Phase 21: Redis CacheModule - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 21-redis-cachemodule
**Areas discussed:** Redis usage scope, Redis API scope, Namespace strategy, Module structure

---

## Redis Usage Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only cache | get/set/del + TTL | ✓ |
| + sessions | + exists/expire for token blacklist | |
| + rate-limiting | + incr/ttl + ThrottlerStorage adapter | |
| + pub/sub | Separate module, separate connection | |

**User's choice:** Only cache — сессии, rate-limiting, pub/sub не в scope
**Notes:** Legacy проект исследован (/home/mr/Hellkitchen/workspace/projects/tba-tech/api/legacy-claude). Redis используется только для BullMQ task tracking (set/get/del). Auth на JWT stateless, refresh tokens в MongoDB (у нас в PostgreSQL). Подтверждает что кэш достаточно. User предложил разделить кэш и сессии в отдельные абстракции если понадобится.

---

## Redis API Scope

| Option | Description | Selected |
|--------|-------------|----------|
| CachePort only | Абстракция get/set/del, без raw client export | ✓ |
| CachePort + raw client | CachePort + REDIS_CLIENT token как escape hatch | |

**User's choice:** CachePort only — raw client не экспортировать
**Notes:** User указал что raw client export — протечка инфраструктуры, кто-то начнёт использовать напрямую. Если нужна специфическая операция — создать отдельную абстракцию. Тот же принцип применить к PersistenceModule (PG_POOL export — backlog 999.3). TTL сделан обязательным по предложению Claude — user согласился. Ветвление if/else в set() убрано.

---

## Namespace Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Manual prefix | Сервис сам пишет `sender:key` — convention-based | |
| Auto-prefix | forRootAsync({ namespace }) — CacheService добавляет прозрачно | ✓ |
| Separate DB index | Redis DB 0-15 per service — жёсткая изоляция | |

**User's choice:** Auto-prefix — аналогия с pgSchema в PersistenceModule
**Notes:** User попросил наглядные примеры всех вариантов, после объяснения выбрал auto-prefix.

---

## Module Structure

**User's choice:** Одна директория `packages/foundation/src/cache/` по паттерну PersistenceModule
**Notes:** Быстро согласовано — паттерн уже установлен.

---

## Claude's Discretion

- ioredis connection options
- Serialization format
- Health check implementation
- Namespace prefix mechanics

## Deferred Ideas

- Token revocation — отдельная абстракция при появлении use case
- PG_POOL export leak — backlog 999.3
- Rate limiting через Redis — отдельный adapter
