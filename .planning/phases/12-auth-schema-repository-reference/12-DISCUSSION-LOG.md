# Phase 12: Auth Schema & Repository (Reference) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-04
**Phase:** 12-auth-schema-repository-reference
**Mode:** discuss
**Areas analyzed:** Schema design, Migration workflow, Mapper pattern

## User Decisions

### Schema Design
- **Question:** Password hash — domain entity or schema only?
- **User said:** "Делай как считаешь нужным. Это не финальная форма юзера — делаем заготовку, далее будем внедрять настоящие сущности. Нужна хорошая основа для проверки."
- **Decision:** password_hash in schema only, not in entity. Minimal schema to prove the pattern.

### Migration Workflow
- **Decision:** generate + migrate (not push). drizzle.config.ts per service. drizzle-kit as devDep in apps/auth.
- **No user input needed** — deterministic from research.

### Mapper Pattern
- **Decision:** toDomain/toPersistence in infrastructure/persistence/. Drizzle types don't leak.
- **No user input needed** — follows Clean/Hexagonal constraint.

## Key Context
User explicitly stated this is a pattern proof / foundation, not final business model. Entity and schema will evolve when real business logic is implemented.
