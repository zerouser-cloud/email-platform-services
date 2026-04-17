---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Infrastructure Abstractions & Cross-Cutting
status: verifying
stopped_at: Completed 999.7-04-PLAN.md
last_updated: "2026-04-17T06:54:36.892Z"
last_activity: 2026-04-17
progress:
  total_phases: 22
  completed_phases: 12
  total_plans: 40
  completed_plans: 40
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Each service isolated with clear boundaries, single source of truth, and correct contracts -- reliable foundation for business logic
**Current focus:** Phase 999.7 — grpc-client-modules-foundation-infrastructure-layer-backlog

## Current Position

Phase: 999.8
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-17

Progress: [██████████] 100% phase, [==============================] 100% overall

## Performance Metrics

**Velocity:**

- Total plans completed: 63 (v1.0: 18, v2.0: 6, v3.0: 11)
- Average duration: ~2min
- Total execution time: --

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0 (1-8) | 18 | -- | -- |
| v2.0 (9-14) | 6 | -- | -- |
| v3.0 (15-19) | 11 | -- | -- |
| 20 | 2 | - | - |
| 21 | 2 | - | - |
| 22 | 3 | - | - |
| 22.1 | 5 | - | - |
| 22.2 | 2 | - | - |
| 22.3 | 4 | - | - |
| 24.1 | 4 | - | - |
| 999.7 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: 1-3min each
- Trend: Stable

| Phase 20 P01 | 4min | 2 tasks | 15 files |
| Phase 20 P02 | 10min | 2 tasks | 32 files |
| Phase 21 P01 | 2min | 2 tasks | 11 files |
| Phase 21 P02 | 1min | 2 tasks | 2 files |
| Phase 22.1 P01 | 6min | 2 tasks | 13 files |
| Phase 22.1 P02 | 6min | 2 tasks | 47 files |
| Phase 22.1 P03 | 2min | 2 tasks | 2 files |
| Phase 22.1 P04 | 4min | 1 tasks | 2 files |
| Phase 22.1 P05 | 70min | 3 tasks | 4 files |
| Phase 23 P01 | 2min | 2 tasks | 3 files |
| Phase 23 P02 | 2min | 2 tasks | 4 files |
| Phase 23 P03 | 8 | 2 tasks | 17 files |
| Phase 24 P01 | 358s | 2 tasks | 10 files |
| Phase 24 P02 | 108s | 2 tasks | 14 files |
| Phase 999.7 P01 | 198s | 2 tasks | 2 files |
| Phase 999.7 P02 | 184 | 2 tasks | 25 files |
| Phase 999.7 P03 | 147 | 2 tasks | 15 files |
| Phase 999.7 P04 | 99 | 2 tasks | 17 files |

## Accumulated Context

### Decisions

- [v3.0]: PersistenceModule is the reference pattern for all new infrastructure modules (forRootAsync, Symbol DI tokens, health indicator, shutdown)
- [v3.0]: No-magic-values skill enforced across codebase
- [v3.0]: 12-Factor compliance -- no env branching, no NODE_ENV reads
- [v4.0]: Config decomposition first -- modular sub-schemas unblock all infrastructure modules
- [v4.0]: Build order: Config -> CacheModule -> StorageModule -> gRPC -> HTTP+CB -> EventModule -> Shutdown -> Tracing
- [Phase 20]: Kept loadGlobalConfig() and default AppConfigModule for backward compat -- apps migrate in Plan 02
- [Phase 20]: Manual GlobalEnv type due to TopologySchema dynamic shape -- z.infer cannot resolve
- [Phase 20]: Added zod as direct dep to all 6 apps -- fixes TS2742 cross-package type resolution for per-service schemas
- [Phase 20]: Manual XxxEnv types with type assertions on loadConfig() -- same pattern as GlobalEnv for dynamic TopologySchema
- [Phase 21]: Export RedisHealthIndicator from cache barrel for downstream backward compatibility
- [Phase 22.1]: [Phase 22.1-01]: Foundation internal/external partition established; S3 storage primitives relocated to packages/foundation/src/internal/storage/; @Global() removed from S3CoreModule atomically with ReportsStorageModule explicit S3CoreModule import; temporary compat shim in storage/index.ts re-exports both new internal path and reports facade until Plan 02 barrel flip
- [Phase 22.1]: [Phase 22.1-02]: Foundation src/ reduced to {external/, internal/, index.ts}; top-level barrel is one line 'export * from ./external'; 22-line external aggregator mirrors original public surface 1:1; parser and notifier root modules no longer import S3CoreModule; Plan 04 BucketStorageModule compat shim and type-only StorageHealthIndicator re-export documented in external/storage/index.ts (Rule 3 auto-fix for StorageHealthIndicator type surfacing)
- [Phase 22.1]: [Phase 22.1-03]: Foundation package-boundary sealed at TypeScript resolution level; packages/foundation/package.json declares exports field with two subpaths (. and ./internal, types+default conditions, no wildcards, no import/require conditions); tsconfig.base.json upgraded from module:commonjs/moduleResolution:node to module:node16/moduleResolution:node16 workspace-wide; Turbo cache force-refreshed to invalidate stale dist/; CJS emission preserved (zero type:module in workspace); @email-platform/foundation/internal is now a resolvable subpath for Plan 04 consumers
- [Phase 22.1]: [Phase 22.1-04]: ParserStorageModule now imports { BucketStorageModule, S3CoreModule } from @email-platform/foundation/internal (first real consumer of Plan 03 subpath); S3CoreModule listed as first entry in imports array before BucketStorageModule.forBucket(); Plan 02 BucketStorageModule compat shim removed from packages/foundation/src/external/storage/index.ts atomically in the same commit; type-only StorageHealthIndicator re-export preserved (Rule 3 carry-forward — removing it would break parser+notifier health controllers that import it as a type annotation); grep S3CoreModule under apps/ source now returns exactly one file (parser-storage.module.ts); workspace build 10/10 and lint 7/7 green
- [Phase 22.1]: [Phase 22.1]: BucketStorageModule is self-contained (forBucket() imports S3CoreModule) — per-service storage wrappers re-export by class to propagate dynamic-scope Symbol tokens transitively; avoids Nest 11 dynamic-module export reflect quirk without reintroducing @Global()
- [Phase 23]: diToken migrated to Symbol.for() for stable cross-package DI identity; obsolete GrpcClientModule removed (zero consumers)
- [Phase 23]: [Phase 23-02]: AbstractGrpcClient uses PinoLogger.root.child({ context }) — no setContext (Pitfall 6); getService in onModuleInit (Pitfall 3); lastValueFrom for unary (Pitfall 2); per-call deadline via grpc-timeout Metadata header on top of unchanged channel interceptor (Pitfall 4 minimum-wins); base class NOT yet in external barrel — Plan 23-03 wires it with concrete modules
- [Phase 23]: Multi-package ClientGrpc (Assumption A3) worked on first try — no fallback to separate grpc.health.v1 registration needed
- [Phase 23]: require.resolve used directly in audience/auth/parser/sender/notifier-client.module.ts — tsconfig module=node16 emits CJS; no createRequire shim required
- [Phase 24]: [Phase 24-01]: AbstractHttpClient in foundation is pure framework (zero per-API knowledge); opossum isolated to packages/foundation; CB Option B wrapper (ConsecutiveThresholdError sentinel + opossum volumeThreshold:1/errorThresholdPercentage:100, timeout:false) opens on 5 consecutive failures; HttpCallOpts renamed from CallOpts to avoid barrel collision with existing gRPC CallOpts
- [Phase 24]: D-02 realised: external API types in packages/contracts/src/external/ (symmetric with generated/)
- [Phase 24]: D-19 realised: 6 new env vars with no defaults/optionals; placeholders in .env.example + .env.docker
- [Phase 999.7]: GrpcClientBuildResult.imports typed as Array<Type<unknown> | DynamicModule> to accommodate both static and dynamic NestJS modules
- [Phase 999.7]: defineGrpcClient factory returns { imports, providers, exports } not DynamicModule -- consumers compose into their own module
- [Phase 999.7]: Client facades import AbstractGrpcClient and CallOpts from @email-platform/foundation (domain-agnostic base), per-service constants stay local in apps/
- [Phase 999.7]: Single-upstream apps import XxxClientModule.forRoot() directly in root module (no compositor layer needed)
- [Phase 999.7]: Foundation fully decoupled from @email-platform/contracts; ESLint rule guards contracts->config->foundation->apps dependency direction

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

### Roadmap Evolution

- Phase 22.1 inserted after Phase 22: s3-core-encapsulation (URGENT) — encapsulate S3CoreModule into per-service composition StorageModule, root modules see single storage module
- Phase 22.2 inserted after Phase 22: bucket-provisioning-automation (URGENT) — unified automatic bucket check-and-create mechanism driven by per-service bucket constants, works on MinIO (local/docker) and Garage (dev/prod) identically, integrated with health checks
- Phase 22.3 inserted after Phase 22: storage-smoke-test-endpoints (URGENT) — per-service HTTP debug endpoints for full CRUD cycle on each bound bucket (upload/download/delete/exists/getSignedUrl); cross-service reports bucket test (parser writes → notifier reads); gated by env flag for prod safety
- Phase 22.4 inserted after Phase 22: public-bucket-abstraction (URGENT) — изначально storage-gateway-proxy (gateway streaming + HMAC), после discuss-phase направление скорректировано: per-service private bucket'ы + один `public` bucket с anonymous read, `SharedNamespaceModule.forNamespace(...)`, `NamespacedStoragePort` (Readable-only + multipart через `@aws-sdk/lib-storage`), env `STORAGE_PUBLIC_URL` + `STORAGE_MAX_UPLOAD_BYTES`, bucket `reports` → `public`. Блокирующий insight из research (Garage не поддерживает anonymous S3 policy, только website mode) вынудил добавить prerequisite-фазу 22.5. Phase 22.4 Depends on расширен: Phase 22 + Phase 22.5.
- Phase 22.5 inserted after Phase 22: local-garage-unification (URGENT) — prerequisite к 22.4. Заменить MinIO на Garage Docker image в local-native и local-isolated окружениях, обновить `infra/docker-compose*.yml`, `env.example`/`env.docker`, `packages/config/src/schemas/storage.ts`, runbook `docs/runbooks/bucket-provisioning.md`. Цель — один S3 impl (Garage) во всех 4 окружениях вместо сегодняшней раздвоенной реальности MinIO↔Garage. Устраняет расхождения bucket policy / URL формата / CLI между local и dev/prod.
- Phase 24.1 inserted after Phase 24: http-client-foundation-hardening-di-env-hygiene-magic-values (URGENT) — пост-аудит фазы 24. Scope: (1) ротация утёкшего в git Telegram bot token + `git rm --cached .env.docker` + создание `.env.docker.example` + документирование назначения env-файлов; (2) Logger через DI-порт (`HttpClientLogger` + `PinoHttpClientLoggerAdapter`) вместо `PinoLogger.root.child`; (3) экстракция magic values (`Content-Type`/`application/json` в abstract-http.client, литералы 200 и '500' в http-smoke controller); (4) экспорт `CircuitState` типа из foundation; (5) хелпер `getRequiredString(config, key)` против `!` non-null assertions; (6) `createHttpClientProvider` factory-хелпер против дублирования boilerplate 4 per-service модулей; (7) перенос `HttpSmokeClient` в `apps/gateway/src/infrastructure/clients/http-smoke/` (контроллер/модуль остаются в `test/` и удаляются перед релизом, клиент остаётся); (8) `HTTP_SMOKE_PATH.status()` builder; (9) JSDoc AbstractHttpClient про ClsModule; (10) TODO-метка на `res.json() as T`. Архитектурное решение: CircuitBreaker и RetryPolicy НЕ декомпозируются через DI (overengineering для стабильного opossum) — зафиксировать в ADR.
- Phase 999.7.1 inserted after Phase 999.7: grpc-client-tokens-refactor-generate-inside-definegrpcclient (URGENT) — убрать per-service `*-client.constants.ts` файлы. `defineGrpcClient()` генерит внутренние токены (`grpcToken`, `healthToken`) из `service.id`, возвращает их в результате. SERVICE catalog остаётся domain-focused с только `diToken`. Consistency с существующими infrastructure modules (Persistence/Cache/Storage имеют свои токены внутри foundation, не в catalog). Discovered в /gsd:verify-work 999.7 discussion 2026-04-17.

## Session Continuity

Last session: 2026-04-17T06:44:52.455Z
Stopped at: Completed 999.7-04-PLAN.md
Resume file: None
