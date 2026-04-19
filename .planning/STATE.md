---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Infrastructure Abstractions & Cross-Cutting
status: executing
stopped_at: "Phase 999.10.1 Plan 01 COMPLETE — auth pilot: 2 atomic commits on feature/phase-20-config-decomposition (D-21): 16c52f3 controller rename (6 inbound-port fields: loginPort→loginService etc. + 6 use-site renames per D-01/D-16) and e6ab119 use-case Repository rename (4 files: users→userRepository per D-04 domain-role mirror). auth.constants.ts + auth.module.ts git diff empty (D-03/D-17 invariants preserved). Auth application services untouched (6/6 already compliant per D-05 row 2 baseline — bonus finding confirmed). D-10 dual-mode runtime smoke PASSED: native (localhost:3000) + isolated (localhost:4000) both HTTP 200 on /health/ready with 5/5 upstreams up (auth/sender/parser/audience/notifier). 13/13 structural grep invariants PASS on auth slice. 0 deviations, 0 auto-fixes, 0 retries. Plans 02-04 unblocked for mechanical replication."
last_updated: "2026-04-19T11:09:27Z"
last_activity: 2026-04-19 -- Phase 999.10.1 Plan 01 auth pilot complete
progress:
  total_phases: 28
  completed_phases: 16
  total_plans: 69
  completed_plans: 65
  percent: 94
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Each service isolated with clear boundaries, single source of truth, and correct contracts -- reliable foundation for business logic
**Current focus:** Phase 999.10.1 — hexagonal-naming-convention-refactor

## Current Position

Phase: 999.10.1 (hexagonal-naming-convention-refactor) — EXECUTING
Plan: 2 of 5 (Plan 01 auth pilot COMPLETE)
Status: Executing Phase 999.10.1
Last activity: 2026-04-19 -- Phase 999.10.1 Plan 01 auth pilot complete (2 atomic commits + dual-mode smoke PASS)

Progress: [██░░░░░░░░] 20% phase (1/5 plans), [=============================] 94% overall

## Performance Metrics

**Velocity:**

- Total plans completed: 74 (v1.0: 18, v2.0: 6, v3.0: 11)
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
| 999.7.3 | 6 | - | - |

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
| Phase 999.7.3 P06 | 12min | 4 tasks | 2 files |
| Phase 999.10 P01 | 7min | 2 tasks | 7 files |
| Phase 999.10 P03 | 6min | 1 tasks | 46 files |
| Phase 999.10 P04 | 5min36s | 1 task (Task 0 pre-locked Option A) | 37 files (3 renames + 30 new + 3 modified + 4 deleted) |
| Phase 999.10 P05 | 8min30s | 1 task | 41 files (35 new + 6 modified + 3 renames incl. one full-rewrite shown as delete+add) |
| Phase 999.10 P06 | 97 | 1 tasks | 1 files |
| Phase 999.10 P07 | ~3min (docs + gate + metadata close) | 2 tasks (1 auto + 1 checkpoint:human-verify) | 3 docs + 3 metadata files |
| Phase 999.10 TOTAL | ~40min across 7 plans | 7 plans / 9 tasks | 140+ file operations (skill, auth pilot, 3 sweeps, ESLint guards, docs, phase gate) |
| Phase 999.10.1 P01 | ~5min (319s) | 2 code tasks + 1 verification gate | 5 files modified (1 controller + 4 use-cases; +16 / -16 lines) |

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
- [Phase 999.7.3-06]: Two skills updated atomically (D-20 infrastructure-client-layering: 5 edits — top callout extended with 999.7.2/999.7.3, gRPC reference rewritten to Promisified<T> + promisifyGrpcClient Proxy + single-arg defineGrpcClient<TRaw>(opts), required item 8 broadened to "no per-method wrappers", ANTI-PATTERN 8 appended, See Also extended with 999.7.3 reference, frontmatter description broadened with Promisified/Proxy keywords; D-21 composition-over-inheritance additive: top callout upgraded to plural "Reference implementations:" with 999.7.3 second canonical example, See Also extended with 999.7.3 cross-reference). Final dual-mode runtime smoke gate PASSED: native (host:3000) + isolated (host:4000→container:3000) both HTTP 200 on /health/ready with all 5 upstreams up; both /test/{parser,notifier}/storage-service endpoints PASSED with allPassed:true on every bucket; 0 error/warn entries across 6 containers in isolated mode. Atomic commits 2ad4bf5 (skills, exactly 2 files / 38+ 8-) + b304a64 (empty smoke marker, gate result documented in body). Phase 999.7.3 COMPLETE — all 21 D-* decisions (D-01..D-21) realised across Plans 01-06; ready for /gsd:verify-work gate.
- [Phase 999.10-01]: nestjs-hexagonal-mapping skill created as the third entry in the server-side triada (clean-ddd-hexagonal / infrastructure-client-layering / nestjs-hexagonal-mapping). 7 markdown files atomically committed in 2 commits: 402ec4e (SKILL.md + LAYERS.md + CALL-FLOW.md + NAMING.md) and 294a911 (EXAMPLES.md + PROTO-VISIBILITY.md + DO-DONT.md). D-15 (foundation-first — skill before code), D-16 (exact name `nestjs-hexagonal-mapping`), and D-17 (zero ESLint snippets in skill — .eslintrc.js is the single source of truth for rules, added by Plan 06) all realised. SKILL.md at 119 lines carries frontmatter with all 8 required triggers (grpc controller, service layer, use case, hexagonal nestjs, proto mapping, ts-proto controller, layer boundary, command dto), three-layer stack diagram, 8-step decision tree for adding a new RPC, 9 anti-patterns, See Also with 4 paired-skill links, references list. references/ carries per-layer definitions + canonical tree (LAYERS.md), canonical login call flow + 3 composition variants (CALL-FLOW.md), D-12 file↔class table (NAMING.md), 3 worked examples + Before/After (EXAMPLES.md), 17-row visibility matrix (PROTO-VISIBILITY.md), 9 Don't/Do/Why/Detected-by anti-pattern blocks (DO-DONT.md). pnpm lint 7/7 cache-hit green (markdown-only change). No deviations. Duration ~7min. Plan 02 auth pilot unblocked.
- [Phase ?]: [Phase 999.10-03]: Sender sweep complete — mechanical replication of auth pilot (10 Commands + 10 Ports + 10 Services + 9 Use Cases, 1 shared TransitionCampaignStatusUseCase). CloudFnSmokeController preserved in controllers[] (D-13 test-boundary exception). Runner/Message/Macros use cases stubbed without outbound ports per research recommendation. Runtime smoke PASSED first try, all 5 upstreams up. 0 proto-shape deviations — Plan 02 lesson applied proactively by reading packages/contracts/src/generated/sender.ts before writing services. D-03 reuse pattern now demonstrated twice (auth IssueTokenPairUseCase + sender TransitionCampaignStatusUseCase).
- [Phase 999.10-04]: Parser sweep complete — Pitfall 3 RESOLVED via user-approved Option A (Canonicalise). Atomic commit 22fcb5e (37 file ops: 3 renames + 30 new + 3 modified + 4 deleted, including test/storage-smoke.controller.ts). 7 Commands + 7 Ports + 7 Services + 8 Use Cases = 29 canonical classes + 1 rewritten ParserController with all 8 RPCs via @ParserServiceControllerMethods() bulk decorator. 3 smoke use cases contain REAL I/O logic (not stubs) — RunPrivateSmokeCycleUseCase (PrivateStoragePort upload/exists/download), RunPublicSmokeCycleUseCase (NamespacedStoragePort upload/exists/public-fetch), CleanupSmokeObjectUseCase (Record<bucket, deleteFn> dispatch per CLAUDE.md no-switch rule, matches prior if/if/fallback behavior). Gateway /test/parser/storage-service endpoint now routes through canonical 3-layer stack and returned allPassed:true on BOTH private parser + public reports buckets in native smoke. D-23 rename applied (start-parsing.* → create-parser-task.use-case / CreateTaskPort matching proto RPC). Pitfall 9 resolved (health.controller relative-import depth re-anchored 1→3 post git mv). AppStoreSpySmokeController preserved (D-13 test-boundary — pure client pass-through). 0 proto-shape auto-deviations (Plan 02/03 lesson applied by reading generated/parser.ts proactively). 1 trivial prettier auto-fix via eslint --fix on 2 smoke use cases (line-break preference, cosmetic). 3 pilot services (auth + sender + parser) now all demonstrate layer isolation — unblocks Plan 05 (audience) + Plan 06 (ESLint guards authoring).
- [Phase 999.10-05]: Audience sweep complete — atomic commit ce8a39d (41 file changes: 35 new + 6 modified + 1 rename-as-delete+add for controller). 8 Commands + 8 Ports + 8 Services + 7 Use Cases (6 non-shared stubs + 1 SHARED TransitionRecipientsStatusUseCase injected by BOTH MarkAsSentService AND ResetSendStatusService — third D-03 reuse proof after auth IssueTokenPair + sender TransitionCampaignStatus). GroupRepositoryPort + PgGroupRepository stub + Group domain POJO entity added for cross-aggregate symmetry (T-999.10-05-03 mitigation). 0 proto-shape auto-deviations. 1 trivial prettier auto-fix on transition-recipients-status.use-case.ts. Native runtime smoke PASSED first try — /health/ready HTTP 200 all 5 upstreams up. Workspace build 10/10 + lint 7/7 green. Plan 06 ESLint guards unblocked — all 4 services (auth + sender + parser + audience) now demonstrate layer isolation.
- [Phase ?]: [Phase 999.10-06]: Two ESLint overrides appended to .eslintrc.js (Override 8 domain isolation + Override 9 application isolation). Override 8 bans @nestjs/*, @grpc/*, @email-platform/contracts[/*], drizzle-orm[/*], pg[/*] in apps/*/src/domain/**. Override 9 bans @email-platform/contracts[/*] + @nestjs/microservices[/*] in apps/*/src/application/**. Both carry skill-linked error messages (clean-ddd-hexagonal + nestjs-hexagonal-mapping). D-18 realised mechanically. A4 empirically confirmed: pnpm lint --force green 7/7, zero new violations across auth+sender+parser+audience. Negative fixture probe confirmed Override 8 fires with correct skill-linked message. Atomic commit f5f46e8 (+51 lines, 1 file). Overrides 1-7 byte-preserved. Plan 07 (docs phase-gate) unblocked.
- [Phase 999.10-07]: Docs update + dual-mode phase gate. Task 1 commit 2c1b249: CLAUDE.md §Architecture gains "NestJS↔Hexagonal Layer Mapping" subsection (12-row file↔class↔layer↔location table + proto-visibility rules naming Override 8/9 + canonical ASCII call-flow + key rules + skill cross-reference); .planning/codebase/ARCHITECTURE.md §Layers.Application expanded with Service-vs-UseCase distinction + new §Call Flow (Canonical for gRPC microservices) ASCII diagram + new §Proto Visibility matrix; .planning/codebase/STRUCTURE.md rewritten with canonical post-999.10 trees for all 4 gRPC services (no src/health/ outliers, mappers/ subfolder, application/{services,use-cases,commands,ports}/ structure, controllers/{grpc,rest}/ split). Task 2 blocking checkpoint:human-verify dual-mode phase gate PASSED (user "approved"): Phase A static (lint 7/7 + build 10/10 green); Phase B 13/13 structural invariants PASS (no old *.grpc-server.ts, no old src/health/, 4/4 services with new controller path + REST health path + commands folder + services folder + mappers subfolder, domain+application isolation grep clean, no GrpcServer/GrpcController suffix, skill exists, .eslintrc.js Override 8+9 present); Phase C native HTTP 200 /health/ready with 5/5 upstreams up + /test/parser/storage-service allPassed:true; Phase D isolated HTTP 200 /health/ready with 5/5 upstreams up + /test/parser/storage-service allPassed:true + 0 error/warn across 6 Docker containers in last 2m of logs; Phase E user-reviewed docs diffs — accurate. PHASE 999.10 ARCHITECTURALLY COMPLETE — all 24 D-* decisions (D-01..D-24) realised across Plans 01-07; ready for /gsd:verify-work 999.10.
- [Phase 999.10.1-01]: Auth pilot — hexagonal naming convention refactor applied mechanically. 2 atomic commits on feature/phase-20-config-decomposition (D-21): (1) 16c52f3 controller rename — 6 inbound-port fields in apps/auth/src/infrastructure/controllers/grpc/auth.controller.ts renamed xxxPort: XxxPort → xxxService: XxxPort per D-01/D-16 (loginPort→loginService, refreshTokenPort→refreshTokenService, validateTokenPort→validateTokenService, revokeTokenPort→revokeTokenService, createUserPort→createUserService, listUsersPort→listUsersService) + 6 use-site renames in method bodies (this.xxxPort.execute → this.xxxService.execute); DI tokens and type annotations preserved per D-02/D-03. (2) e6ab119 use-case Repository rename — 4 files (verify-credentials, validate-refresh-token, list-users, persist-user) renamed users: UserRepositoryPort → userRepository: UserRepositoryPort per D-04 domain-role mirror; stub bodies preserved per SP-3. auth.constants.ts + auth.module.ts git diff empty (D-03/D-17 strict invariants preserved). Auth application services (login.service.ts et al, 6 files) NOT modified — bonus finding RESEARCH §2bis.1 confirmed (6/6 already compliant with D-05 row 2 verb-field pattern). D-10 dual-mode runtime smoke PASSED first try: native (localhost:3000) + isolated (localhost:4000) both HTTP 200 on /health/ready with 5/5 upstreams up (auth/sender/parser/audience/notifier). 13/13 structural grep invariants PASS on auth slice (D-01, D-02, D-03, D-04, D-10, D-17, D-21 sub-invariants all green). 0 deviations, 0 auto-fixes, 0 retries, 0 architectural escalations. Pre-existing notifier warnings (eventType/payload unused args) logged out-of-scope per Rule Scope Boundary. Plans 02/03/04 unblocked for mechanical replication.

### Pending Todos

- Consider widening Promisified<T> typed second-arg from Metadata to Metadata | CallOpts in foundation. Documented in `apps/gateway/src/test/grpc-client-sanity.ts` lines 31-34. Not blocking — sanity probe ergonomics issue only. Carry-forward to future fast/cleanup pass (no longer Plan 05/06 candidate; Phase 999.7.3 closed pending verify-work).
- (Future observability phase) Restore the conscious D-04 regression — `grpc.client.call` per-call structured log entries are no longer emitted by the Promisified Proxy. Restoration via DI-injected logger in outer Proxy chain; rest of gRPC pipeline is unchanged so the restoration is local to `packages/foundation/src/external/grpc/clients/promisify-grpc-client.ts`.
- (Future HTTP composition phase) 4 remaining HTTP clients still extend AbstractHttpClient (`apps/{notifier/telegram, sender/cloud-functions, parser/appstorespy, gateway/http-smoke}/.../*.client.ts`) — flagged refactor-candidate in composition-over-inheritance SKILL. Apply same pattern as 999.7.2 (composition via injected helper) once 999.7.3 verifies cleanly.

### Blockers/Concerns

- None. Strict 5/5-upstreams-up runtime smoke gate met in BOTH supported flows (native + isolated) in Plan 999.10-07 final dual-mode phase gate. Phase 999.10 architecturally complete; awaiting `/gsd:verify-work 999.10` outcome.

### Roadmap Evolution

- Phase 22.1 inserted after Phase 22: s3-core-encapsulation (URGENT) — encapsulate S3CoreModule into per-service composition StorageModule, root modules see single storage module
- Phase 22.2 inserted after Phase 22: bucket-provisioning-automation (URGENT) — unified automatic bucket check-and-create mechanism driven by per-service bucket constants, works on MinIO (local/docker) and Garage (dev/prod) identically, integrated with health checks
- Phase 22.3 inserted after Phase 22: storage-smoke-test-endpoints (URGENT) — per-service HTTP debug endpoints for full CRUD cycle on each bound bucket (upload/download/delete/exists/getSignedUrl); cross-service reports bucket test (parser writes → notifier reads); gated by env flag for prod safety
- Phase 22.4 inserted after Phase 22: public-bucket-abstraction (URGENT) — изначально storage-gateway-proxy (gateway streaming + HMAC), после discuss-phase направление скорректировано: per-service private bucket'ы + один `public` bucket с anonymous read, `SharedNamespaceModule.forNamespace(...)`, `NamespacedStoragePort` (Readable-only + multipart через `@aws-sdk/lib-storage`), env `STORAGE_PUBLIC_URL` + `STORAGE_MAX_UPLOAD_BYTES`, bucket `reports` → `public`. Блокирующий insight из research (Garage не поддерживает anonymous S3 policy, только website mode) вынудил добавить prerequisite-фазу 22.5. Phase 22.4 Depends on расширен: Phase 22 + Phase 22.5.
- Phase 22.5 inserted after Phase 22: local-garage-unification (URGENT) — prerequisite к 22.4. Заменить MinIO на Garage Docker image в local-native и local-isolated окружениях, обновить `infra/docker-compose*.yml`, `env.example`/`env.docker`, `packages/config/src/schemas/storage.ts`, runbook `docs/runbooks/bucket-provisioning.md`. Цель — один S3 impl (Garage) во всех 4 окружениях вместо сегодняшней раздвоенной реальности MinIO↔Garage. Устраняет расхождения bucket policy / URL формата / CLI между local и dev/prod.
- Phase 24.1 inserted after Phase 24: http-client-foundation-hardening-di-env-hygiene-magic-values (URGENT) — пост-аудит фазы 24. Scope: (1) ротация утёкшего в git Telegram bot token + `git rm --cached .env.docker` + создание `.env.docker.example` + документирование назначения env-файлов; (2) Logger через DI-порт (`HttpClientLogger` + `PinoHttpClientLoggerAdapter`) вместо `PinoLogger.root.child`; (3) экстракция magic values (`Content-Type`/`application/json` в abstract-http.client, литералы 200 и '500' в http-smoke controller); (4) экспорт `CircuitState` типа из foundation; (5) хелпер `getRequiredString(config, key)` против `!` non-null assertions; (6) `createHttpClientProvider` factory-хелпер против дублирования boilerplate 4 per-service модулей; (7) перенос `HttpSmokeClient` в `apps/gateway/src/infrastructure/clients/http-smoke/` (контроллер/модуль остаются в `test/` и удаляются перед релизом, клиент остаётся); (8) `HTTP_SMOKE_PATH.status()` builder; (9) JSDoc AbstractHttpClient про ClsModule; (10) TODO-метка на `res.json() as T`. Архитектурное решение: CircuitBreaker и RetryPolicy НЕ декомпозируются через DI (overengineering для стабильного opossum) — зафиксировать в ADR.
- Phase 999.7.1 inserted after Phase 999.7: grpc-client-tokens-refactor-generate-inside-definegrpcclient (URGENT) — убрать per-service `*-client.constants.ts` файлы. `defineGrpcClient()` генерит внутренние токены (`grpcToken`, `healthToken`) из `service.id`, возвращает их в результате. SERVICE catalog остаётся domain-focused с только `diToken`. Consistency с существующими infrastructure modules (Persistence/Cache/Storage имеют свои токены внутри foundation, не в catalog). Discovered в /gsd:verify-work 999.7 discussion 2026-04-17.

## Session Continuity

Last session: 2026-04-19T11:09:27Z
Stopped at: Phase 999.10.1 Plan 01 auth pilot COMPLETE. 2 atomic commits on feature/phase-20-config-decomposition: 16c52f3 (controller rename, 6 inbound-port fields + 6 use-sites per D-01/D-16) and e6ab119 (use-case Repository rename, 4 files per D-04). D-10 dual-mode runtime smoke PASSED (native + isolated both HTTP 200 5/5 upstreams up). 13/13 structural invariants PASS on auth slice. Auth application services UNTOUCHED (6/6 already compliant per D-05 row 2). 0 deviations. Ready for Plan 02 sender sweep (mechanical replication of auth template).
Resume file: None
