---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Infrastructure Abstractions & Cross-Cutting
status: executing
stopped_at: "Phase 999.7.3 — Plan 05 complete (workspace invariant battery PASSED — 6 probes all green, 1 Rule-1 prettier auto-fix in grpc-client-sanity.ts; storage-smoke retype was transitively satisfied by Plan 03)"
last_updated: "2026-04-18T09:39:28Z"
last_activity: 2026-04-18
progress:
  total_phases: 26
  completed_phases: 14
  total_plans: 57
  completed_plans: 56
  percent: 98
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Each service isolated with clear boundaries, single source of truth, and correct contracts -- reliable foundation for business logic
**Current focus:** Phase 999.7.3 — grpc-client-promisify-proxy-replace-per-method-wrappers

## Current Position

Phase: 999.7.3 (grpc-client-promisify-proxy-replace-per-method-wrappers) — EXECUTING
Plan: 6 of 6
Status: Plan 05 COMPLETE (`42770da`). Workspace invariant battery PASSED — all 6 probes green: (1) typecheck 12/12 turbo, 0 TS errors; (2) lint 7/7 turbo, 0 errors after one Rule-1 prettier-format auto-fix in `apps/gateway/src/test/grpc-client-sanity.ts` (cosmetic-only, `auth.login(...)` argument formatting residue from Plan 03 sweeps); (3) D-15 invariant — 0 gRPC `*.client.ts` files at the 8 enumerated paths (4 HTTP-client `*.client.ts` files remain — out of D-15 scope); (4) D-02/D-10 invariant — 0 source `GrpcCaller` references (stale `dist/*.d.ts` only); (5) D-16 ESLint guard preserved — Override 6 enumerates 8 D-15 paths with `ClassDeclaration[superClass]` selector intact (per-path enumeration form, semantically equivalent to wildcard); (6) D-17 invariant — `storage-smoke.controller.ts` uses `Promisified<ParserProto.ParserServiceClient>` + `Promisified<NotifierProto.NotifierServiceClient>` (already retyped transitively by Plan 03 commits eec1619 + 517d30f). Plan 05 Task 1 (D-17 type-only patch) was satisfied without new source patching — Plan 03's atomic Rule-3 auto-fixes over-delivered. Phase is structurally complete pending Plan 06 (D-20 + D-21 skill updates + formal dual-mode runtime smoke gate `start:native` + `start:isolated`).
Last activity: 2026-04-18

Progress: [██████████] 100% phase, [==============================] 100% overall

## Performance Metrics

**Velocity:**

- Total plans completed: 68 (v1.0: 18, v2.0: 6, v3.0: 11)
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
| 999.7.1 | 5 | - | - |

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
| Phase 999.7.3 P01 | 8min | 3 tasks | 4 files |
| Phase 999.7.3 P02 | 5min | 3 tasks | 4 files |
| Phase 999.7.3 P03 | 7min | 4 sweep + 1 deferred smoke | 14 files (10 modified, 4 deleted) |
| Phase 999.7.3 P04 | 2min | 3 sweep + post-sweep smoke | 9 files (6 modified, 3 deleted) |
| Phase 999.7.3 P05 | 2min (97s) | 1 transitive + 6-probe invariant battery + 1 Rule-1 lint-fix | 1 file modified (grpc-client-sanity.ts prettier-only) |

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
- [Phase ?]: [Phase 999.7.3-01]: Foundation Promisified Proxy primitive landed atomically; GrpcCaller deleted; defineGrpcClient<TRaw>(opts) single-arg signature with inlined Promisified Proxy; barrels updated; 16 expected interim TS errors documented for Plans 02-05 sweep
- [Phase 999.7.3-02]: AuthClient pilot migrated to canonical 10-line shape (defineGrpcClient<AuthProto.AuthServiceClient>(opts)); auth.client.ts wrapper deleted; barrel cleaned; grpc-client-sanity.ts retyped to Promisified<AuthProto.AuthServiceClient> (Rule 3); auth wedge cleared (1 TS2554 + 1 TS2305 fixed; 8 root errors remain); BLOCKING runtime smoke gate DEFERRED to Plan 03 because gateway compile-blocked by 4 unmigrated upstream modules — auth/notifier microservices DID start cleanly, validating Plan 01 foundation safety for upstream-free services
- [Phase 999.7.3-02]: Promisified<T> public TYPE preserves original ts-proto Metadata signature even though runtime Proxy accepts CallOpts; consumers must either omit second arg, construct Metadata manually, or wait for foundation refinement to widen typed signature to Metadata | CallOpts (backlog for Plan 05 or future fast pass)
- [Phase 999.7.3-03]: 4 atomic per-upstream sweep commits (sender → parser → audience → notifier alphabetical) migrate gateway gRPC clients to canonical Pattern B; 4 *.client.ts deleted (227 LOC removed); gateway typecheck FULLY GREEN. Each sweep bundled its consumer Rule 3 retypes (grpc-client-sanity.ts every commit; storage-smoke.controller.ts in parser + notifier commits) — staying consistent with Plan 02 auth precedent of atomic-commit-includes-direct-consequences. storage-smoke.controller.ts retyped to Promisified<T> in Plan 03 instead of Plan 05 because the deferred BLOCKING smoke needed the gateway to compile. Deferred smoke executed: gateway boots end-to-end, /health/ready reaches all 5 Promisified Proxy facades; 2 upstreams up (auth, notifier — services without their own gRPC clients), 3 down (sender/parser/audience — blocked from boot by their own un-migrated cross-service *.client.ts files which Plan 04 sweeps). STRUCTURAL DESIGN validated; STRICT 5/5-up criterion is naturally Plan 04's gate (no defer-smoke pass marker committed).
- [Phase 999.7.3-04]: 3 atomic per-upstream cross-service sweep commits (sender→audience 1458147, parser→notifier ee68136, audience→parser 9f9fece) close the cross-service tier. 3 *.client.ts deleted (155 LOC removed; 9+3+8 = 20 wrapper methods gone). NO Rule 3 patches needed — pre-task grep confirmed each consumer app had zero external references to the soon-to-be-deleted wrapper class. D-15 enumerated invariant FULLY ACHIEVED: all 8 *.client.ts paths from CONTEXT.md gone workspace-wide. Workspace typecheck FULLY GREEN: 12/12 turbo tasks successful, 0 TS2554/TS2305/TS2614(GrpcCaller) errors. Post-sweep validation PASSED with strict 5/5-upstreams-up criterion: pnpm start:native boots all 6 services; /health/ready returns HTTP 200 with auth/sender/parser/audience/notifier all `status:up`. Plan 03's deferred BLOCKING smoke gate now FULLY satisfied. Plan 05's planned storage-smoke.controller.ts retype was already atomically bundled into Plan 03 sweeps — Plan 05 has no consumer-side typecheck work left; may now focus on backlog cleanup or roll into Plan 06 dual-mode gate.
- [Phase 999.7.3-05]: 6-probe workspace invariant battery PASSED — typecheck 12/12 turbo (0 TS errors, cached), lint 7/7 turbo (0 errors after one Rule-1 prettier auto-fix), D-15 invariant 0 gRPC `*.client.ts` files at the 8 enumerated paths, D-02/D-10 invariant 0 source `GrpcCaller` references, D-16 ESLint guard preserved (Override 6 enumerates 8 D-15 paths with `ClassDeclaration[superClass]` selector intact — implementation form is per-path enumeration not wildcard glob, semantically equivalent), D-17 invariant `storage-smoke.controller.ts` uses `Promisified<T>` for both parser + notifier injections. Plan 05 Task 1 (D-17 type-only patch) was satisfied transitively by Plan 03 atomic Rule-3 auto-fixes (commits eec1619 + 517d30f bundled storage-smoke retype into parser + notifier sweeps). Single Rule-1 deviation: pre-existing prettier-format regression in `apps/gateway/src/test/grpc-client-sanity.ts` (auth.login(...) call body — residue from Plan 03 sweeps) was auto-fixed via `eslint --fix` to clear invariant 2 (lint clean). Cosmetic-only diff (4 insertions / 3 deletions), no semantic change. Atomic verification commit `42770da`. Phase 999.7.3 is now structurally complete pending Plan 06 (D-20 + D-21 skill updates + formal dual-mode runtime smoke gate).

### Pending Todos

- Consider widening Promisified<T> typed second-arg from Metadata to Metadata | CallOpts in foundation. Documented in `apps/gateway/src/test/grpc-client-sanity.ts` lines 31-34. Not blocking — sanity probe ergonomics issue only. Carry-forward to future fast/cleanup pass (no longer Plan 05 candidate; Plan 05 closed).
- Plan 06 owns the formal dual-mode (native + isolated) runtime smoke gate; Plan 04's post-sweep smoke validates only the native flow.
- Plan 06 owns D-20 + D-21 skill updates: `infrastructure-client-layering` ANTI-PATTERN 8 + reference rewrite; `composition-over-inheritance` cross-reference to Phase 999.7.3 as second canonical example.

### Blockers/Concerns

- None. Strict 5/5-upstreams-up runtime smoke gate (carried forward from Plans 02 → 03 → 04) was MET in Plan 04 post-sweep validation: HTTP 200 + auth/sender/parser/audience/notifier all `up`. Plan 06 will re-validate on the isolated flow.

### Roadmap Evolution

- Phase 22.1 inserted after Phase 22: s3-core-encapsulation (URGENT) — encapsulate S3CoreModule into per-service composition StorageModule, root modules see single storage module
- Phase 22.2 inserted after Phase 22: bucket-provisioning-automation (URGENT) — unified automatic bucket check-and-create mechanism driven by per-service bucket constants, works on MinIO (local/docker) and Garage (dev/prod) identically, integrated with health checks
- Phase 22.3 inserted after Phase 22: storage-smoke-test-endpoints (URGENT) — per-service HTTP debug endpoints for full CRUD cycle on each bound bucket (upload/download/delete/exists/getSignedUrl); cross-service reports bucket test (parser writes → notifier reads); gated by env flag for prod safety
- Phase 22.4 inserted after Phase 22: public-bucket-abstraction (URGENT) — изначально storage-gateway-proxy (gateway streaming + HMAC), после discuss-phase направление скорректировано: per-service private bucket'ы + один `public` bucket с anonymous read, `SharedNamespaceModule.forNamespace(...)`, `NamespacedStoragePort` (Readable-only + multipart через `@aws-sdk/lib-storage`), env `STORAGE_PUBLIC_URL` + `STORAGE_MAX_UPLOAD_BYTES`, bucket `reports` → `public`. Блокирующий insight из research (Garage не поддерживает anonymous S3 policy, только website mode) вынудил добавить prerequisite-фазу 22.5. Phase 22.4 Depends on расширен: Phase 22 + Phase 22.5.
- Phase 22.5 inserted after Phase 22: local-garage-unification (URGENT) — prerequisite к 22.4. Заменить MinIO на Garage Docker image в local-native и local-isolated окружениях, обновить `infra/docker-compose*.yml`, `env.example`/`env.docker`, `packages/config/src/schemas/storage.ts`, runbook `docs/runbooks/bucket-provisioning.md`. Цель — один S3 impl (Garage) во всех 4 окружениях вместо сегодняшней раздвоенной реальности MinIO↔Garage. Устраняет расхождения bucket policy / URL формата / CLI между local и dev/prod.
- Phase 24.1 inserted after Phase 24: http-client-foundation-hardening-di-env-hygiene-magic-values (URGENT) — пост-аудит фазы 24. Scope: (1) ротация утёкшего в git Telegram bot token + `git rm --cached .env.docker` + создание `.env.docker.example` + документирование назначения env-файлов; (2) Logger через DI-порт (`HttpClientLogger` + `PinoHttpClientLoggerAdapter`) вместо `PinoLogger.root.child`; (3) экстракция magic values (`Content-Type`/`application/json` в abstract-http.client, литералы 200 и '500' в http-smoke controller); (4) экспорт `CircuitState` типа из foundation; (5) хелпер `getRequiredString(config, key)` против `!` non-null assertions; (6) `createHttpClientProvider` factory-хелпер против дублирования boilerplate 4 per-service модулей; (7) перенос `HttpSmokeClient` в `apps/gateway/src/infrastructure/clients/http-smoke/` (контроллер/модуль остаются в `test/` и удаляются перед релизом, клиент остаётся); (8) `HTTP_SMOKE_PATH.status()` builder; (9) JSDoc AbstractHttpClient про ClsModule; (10) TODO-метка на `res.json() as T`. Архитектурное решение: CircuitBreaker и RetryPolicy НЕ декомпозируются через DI (overengineering для стабильного opossum) — зафиксировать в ADR.
- Phase 999.7.1 inserted after Phase 999.7: grpc-client-tokens-refactor-generate-inside-definegrpcclient (URGENT) — убрать per-service `*-client.constants.ts` файлы. `defineGrpcClient()` генерит внутренние токены (`grpcToken`, `healthToken`) из `service.id`, возвращает их в результате. SERVICE catalog остаётся domain-focused с только `diToken`. Consistency с существующими infrastructure modules (Persistence/Cache/Storage имеют свои токены внутри foundation, не в catalog). Discovered в /gsd:verify-work 999.7 discussion 2026-04-17.

## Session Continuity

Last session: 2026-04-18T09:39:28Z
Stopped at: "Phase 999.7.3 — Plan 05 complete (workspace invariant battery PASSED — 6 probes all green: typecheck 12/12 turbo 0 errors, lint 7/7 turbo 0 errors after one Rule-1 prettier auto-fix in grpc-client-sanity.ts cosmetic-only, D-15 0 gRPC client files at 8 enumerated paths, D-02/D-10 0 source GrpcCaller refs, D-16 ESLint guard preserved per-path enumeration form, D-17 storage-smoke uses Promisified<T>; Plan 05 Task 1 satisfied transitively by Plan 03 commits eec1619 + 517d30f; atomic verification commit 42770da)"
Resume file: None
