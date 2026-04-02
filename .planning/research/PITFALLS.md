# Domain Pitfalls

**Domain:** NestJS Microservices Monorepo Foundation Audit
**Researched:** 2026-04-02

## Critical Pitfalls

Mistakes that cause rewrites, broken builds, or cascading failures across the monorepo.

### Pitfall 1: Big-Bang Contract Consolidation Breaks Importers

**What goes wrong:** When consolidating the duplicate generated contracts (`contracts/generated/` vs `contracts/src/generated/`), all imports across all 6 services break simultaneously if the migration is done in one step. The build fails, and because Turbo's `dependsOn: ["^build"]` means contracts must build first, every downstream package and app fails too.

**Why it happens:** The two directories contain slightly different generated files (1388 vs 1373 lines for sender.ts). Services may import from either location. A naive "delete one directory, update imports" approach doesn't account for subtle type differences or re-export paths in the contracts package's `index.ts`.

**Consequences:** Complete build failure across the monorepo. Developers cannot tell which import path is correct. Rollback is messy if partially committed.

**Prevention:**
1. Before deleting anything, audit every import path with `grep -r "contracts/generated" apps/ packages/`
2. Verify that `packages/contracts/src/index.ts` re-exports everything consumers need
3. Regenerate types from proto once into the canonical location
4. Diff the two generated directories to ensure no hand-edited modifications exist
5. Update all imports in a single atomic commit

**Detection:** Build failure after contracts change. Imports referencing `@email-platform/contracts/generated/` instead of `@email-platform/contracts` (the package entry point).

**Phase mapping:** Phase 1 - must be resolved first since every other fix depends on stable contracts.

---

### Pitfall 2: Config Refactoring Creates Runtime Initialization Order Bugs

**What goes wrong:** Moving `loadGlobalConfig()` from top-level module scope into NestJS dependency injection (DI) changes the initialization order. Config that was previously available synchronously at module declaration time becomes asynchronous, breaking `LoggingModule.forHttp(config.LOG_LEVEL, config.LOG_FORMAT)` and similar static module registration patterns.

**Why it happens:** NestJS `forRoot()`/`forRootAsync()` dynamic modules require async factory functions, but the current code passes config values directly to static `forHttp()` / `forGrpc()` methods. Converting to async means rewriting the LoggingModule, every Module decorator, and every `main.ts` bootstrap. The temptation is to "just move config into DI" without realizing the cascade.

**Consequences:** Services fail to start. Config is `undefined` during module registration. Logging is misconfigured or silent during startup, making the problem harder to debug.

**Prevention:**
1. Identify all places `loadGlobalConfig()` result is used at module declaration time (line 7 patterns in all `*.module.ts`)
2. Convert `LoggingModule.forHttp()` and `LoggingModule.forGrpc()` to `forRootAsync()` pattern first
3. Create a `ConfigModule.forRoot()` that calls `loadGlobalConfig()` once and provides via DI token
4. Migrate one service at a time (gateway first since it is the entry point), verify it starts, then proceed

**Detection:** Services crash on startup with `Cannot read property 'LOG_LEVEL' of undefined`. Pino logger silent during boot.

**Phase mapping:** Phase 2 - after contracts are stable, before adding any business logic scaffolding.

---

### Pitfall 3: Over-Engineering Clean/Hexagonal Architecture in Empty Services

**What goes wrong:** Applying full Clean Architecture (ports, adapters, use cases, domain entities, repository interfaces) to services that have zero business logic creates a massive boilerplate explosion. Every service gets 15+ files with empty interfaces and pass-through classes. Future developers spend more time navigating the architecture than understanding the (nonexistent) logic.

**Why it happens:** The project constraint says "Clean/Hexagonal Architecture in all apps/". The natural instinct is to scaffold the full layered structure now. But these services have empty controllers -- there is no domain logic to protect with architectural boundaries.

**Consequences:** 60+ files of pure boilerplate across 5 services. Each proto RPC method gets an empty use case, an empty port interface, an empty adapter. Refactoring these later when actual business logic arrives means touching every file again. Architecture becomes cargo cult rather than protective boundary.

**Prevention:**
1. Only create the directory structure (folders for `domain/`, `application/`, `infrastructure/`) without populating empty files
2. Implement one service end-to-end as the reference (e.g., auth with a simple health/ping method) to validate the pattern
3. For stub controllers, implement the gRPC method signatures that return `UNIMPLEMENTED` status -- this is legitimate gRPC practice, not architecture
4. Defer full Clean Architecture scaffolding to when business logic is actually implemented
5. Use the `gsd-architecture-validator` agent to verify the reference service, then replicate

**Detection:** Files containing only interface definitions with no implementations. Use cases that are single-line pass-throughs. More than 10 files per service with under 5 lines of actual logic.

**Phase mapping:** Phase 3 - after contracts and config are solid. Create reference implementation in one service, defer others.

---

### Pitfall 4: Foundation Package Becomes a God Module

**What goes wrong:** During audit and refactoring, more shared code gets moved into `@email-platform/foundation`. Error handling, logging, resilience, gRPC clients, health checks, and now maybe config utilities, validation helpers, common decorators. Foundation grows unbounded and every service depends on everything in it.

**Why it happens:** "It is shared code, it belongs in packages/" is correct in principle but wrong in execution. The foundation package already contains errors, gRPC, health, logging, and resilience -- five unrelated domains. Adding more creates a package where changing the logging interceptor forces a rebuild of services that only use the health check.

**Consequences:** Slow builds (any foundation change rebuilds all 6 services). Tight coupling -- services import foundation for one utility but get dependency on gRPC, pino, nestjs-cls, terminus, and everything else. Version conflicts when one module needs a newer NestJS version but another does not.

**Prevention:**
1. Before adding anything to foundation, ask: "Does every service need this?" If not, it is not foundation.
2. Consider splitting foundation into focused packages: `@email-platform/logging`, `@email-platform/grpc-utils`, `@email-platform/health` -- but only if build times become a problem
3. For now, ensure foundation uses barrel exports (`index.ts`) that allow tree-shaking and keep internal modules loosely coupled
4. Never add business-domain code to foundation. If auth needs a JWT utility that sender does not, it stays in `apps/auth/`

**Detection:** Foundation's `package.json` dependencies growing beyond 10 items. Services importing foundation but only using one sub-module. Build times increasing disproportionately.

**Phase mapping:** Ongoing concern during all phases. Review foundation scope at each phase boundary.

---

### Pitfall 5: Fixing Security Issues in Wrong Order Breaks Deployment

**What goes wrong:** Fixing CORS wildcard rejection, error message sanitization, and credential hardcoding all at once in a "security hardening" pass. The CORS fix rejects the development environment's `*` origin. The error sanitization hides useful debugging information. The credential change breaks `docker-compose up`.

**Why it happens:** Security issues feel urgent and are tempting to batch. But each fix has different blast radius: CORS affects only gateway in production, error sanitization affects all services, credential extraction affects local dev workflow.

**Consequences:** Local development breaks (`docker-compose up` fails with missing env vars). Developers cannot debug issues because error messages are now generic. CORS blocks legitimate development requests.

**Prevention:**
1. Fix local-dev-safe issues first: use environment variable substitution in docker-compose (`${MINIO_ROOT_USER:-minioadmin}`) which preserves defaults
2. For CORS: add environment-aware validation (`NODE_ENV === 'production' && CORS_ORIGINS === '*'` throws) but keep `*` working in development
3. For error sanitization: log original error at DEBUG level, return sanitized message -- implement both sides simultaneously
4. Test each security fix independently before combining

**Detection:** `docker-compose up` fails after security changes. Developers adding `CORS_ORIGINS=*` back to `.env` to "make it work". Error logs showing `[SANITIZED]` but no corresponding debug log with the original message.

**Phase mapping:** Spread across phases. Docker credentials in Phase 1 (low risk). CORS environment guard in Phase 2 (with config refactor). Error sanitization in Phase 3 (needs proper logging first).

## Moderate Pitfalls

### Pitfall 6: Proto Generation Script Not Integrated Into Build Pipeline

**What goes wrong:** After consolidating generated contracts to one location, the `generate` script in contracts package runs independently of the Turbo build pipeline. Developers modify `.proto` files but forget to regenerate. The committed generated types drift from the proto definitions.

**Prevention:**
1. Add `generate` as a Turbo task that runs before `build` in the contracts package
2. Add a CI check that regenerates and diffs -- fails if generated files are stale
3. Consider adding generated files to `.gitignore` and generating at build time (tradeoff: slower builds, but guaranteed consistency)

**Detection:** TypeScript types do not match proto definitions. Runtime gRPC errors about missing fields that exist in proto but not in generated types.

**Phase mapping:** Phase 1 - part of contracts consolidation.

---

### Pitfall 7: Circular Dependencies Between Foundation and Config

**What goes wrong:** Foundation depends on config (`@email-platform/config: "workspace:*"`). If config ever needs a utility from foundation (e.g., a logger during config validation), a circular dependency forms. NestJS circular dependencies are notoriously hard to debug -- the error message is "Nest cannot create the [Module] instance" with no indication of the cycle.

**Prevention:**
1. Config must remain a leaf package with zero internal dependencies
2. Foundation can depend on config but not vice versa
3. Draw the dependency graph: `config -> (nothing)`, `foundation -> config, contracts`, `apps/* -> foundation, config, contracts`
4. Use `madge --circular` in CI to detect cycles early
5. Never use `forwardRef()` as a fix for circular dependencies between packages -- it masks the real problem

**Detection:** `Nest cannot create the [X] instance` errors during startup. `madge --circular` output showing cycles. Import chains that form loops.

**Phase mapping:** Ongoing. Validate at every phase boundary with `madge`.

---

### Pitfall 8: Notifier Service Architectural Divergence Goes Unaddressed

**What goes wrong:** Notifier uses HTTP (`LoggingModule.forHttp()`) while all other services use gRPC (`LoggingModule.forGrpc()`). During the audit, notifier gets refactored to match the other services' patterns, but its actual purpose (consuming RabbitMQ events and sending notifications) does not need gRPC at all. Alternatively, it gets ignored entirely and becomes a dead service that nobody maintains.

**Prevention:**
1. Decide notifier's architectural role explicitly: is it a gRPC service, a RabbitMQ consumer, or both?
2. If RabbitMQ-only: document why it differs and create a `LoggingModule.forWorker()` pattern
3. Do not force gRPC onto a service that does not serve RPC methods
4. Add notifier to the gateway health check if it should be monitored, or explicitly exclude it with documentation

**Detection:** Notifier service not mentioned in health checks. No proto file for notifier. Inconsistent logging module usage.

**Phase mapping:** Phase 2 - decide during config/architecture normalization.

---

### Pitfall 9: Turbo Cache Masks Stale Builds During Refactoring

**What goes wrong:** Turbo caches build outputs based on file hashes. During refactoring, if you change a package's exports but a consumer's import statement stays the same string, Turbo may serve a cached build that does not reflect the actual change. The build appears to succeed but the runtime uses stale code.

**Prevention:**
1. Run `turbo build --force` after any refactoring that changes package exports or barrel files
2. Ensure `turbo.json` includes relevant config files in task inputs (currently it does not specify `inputs`, relying on defaults)
3. After completing a refactoring phase, do a clean build (`rm -rf node_modules/.cache && turbo build --force`) to verify
4. Pin Turbo version with `~2.8.14` instead of `^2.8.14` to prevent behavior changes between versions

**Detection:** Runtime errors that do not reproduce after a clean build. TypeScript compilation succeeds but runtime imports fail. "Module not found" errors that appear intermittently.

**Phase mapping:** Ongoing. Force clean builds at phase boundaries.

---

### Pitfall 10: Metadata Bug Fix Introduces Subtle Behavioral Change

**What goes wrong:** The metadata array access bug (`metadata.get(HEADER.CORRELATION_ID)[0]`) currently returns `undefined` when the header is missing. Some downstream code may already handle this `undefined` case. Fixing it to return a generated UUID changes behavior -- code that checked for `undefined` correlation IDs now gets valid-looking UUIDs for uncorrelated requests.

**Prevention:**
1. Before fixing, audit all consumers of correlation IDs to understand how `undefined` propagates
2. Ensure the fix generates a UUID and logs a warning that a correlation ID was auto-generated (distinguishable from caller-provided IDs)
3. Consider using a prefix (e.g., `auto-`) for auto-generated IDs so they are distinguishable in logs

**Detection:** Log analysis showing correlation IDs that do not match any originating request. Traces that appear complete but actually span unrelated requests sharing an auto-generated ID.

**Phase mapping:** Phase 1 - small fix but validate downstream impact first.

## Minor Pitfalls

### Pitfall 11: Retry Configuration Tuning Without Load Testing

**What goes wrong:** Reducing `baseDelayMs` from 1000ms to 100ms and `maxRetries` from 10 to 5 seems safe but changes startup behavior in production. Services that previously waited long enough for dependencies to become ready now fail fast and enter a crash loop.

**Prevention:** Change retry defaults but make them configurable per-environment. Production may need longer waits than development.

**Detection:** Kubernetes pod restart counts increasing after retry config change. Services failing with "connection refused" that previously started successfully.

**Phase mapping:** Phase 2 - with config refactoring, make retry params configurable.

---

### Pitfall 12: peerDependencies vs Dependencies Confusion in Shared Packages

**What goes wrong:** Foundation declares NestJS packages as both `peerDependencies` and `devDependencies`. During audit, someone "cleans up" by removing the `devDependencies` duplicates, breaking the package's ability to build independently. Or they move `peerDependencies` to `dependencies`, causing version conflicts when apps pin different NestJS versions.

**Prevention:**
1. Keep the current pattern: `peerDependencies` for NestJS framework packages (consumer provides), `devDependencies` for the same packages (needed to build/typecheck the package itself)
2. Document this pattern in a `CONTRIBUTING.md` or package README
3. Never move NestJS packages from `peerDependencies` to `dependencies` in shared packages

**Detection:** `pnpm install` warnings about unmet peer dependencies. Multiple NestJS versions in `pnpm-lock.yaml`. Build failures in packages after dependency cleanup.

**Phase mapping:** Ongoing. Document the pattern in Phase 1.

---

### Pitfall 13: Ignoring the Build Order Dependency Chain

**What goes wrong:** Turbo's `dependsOn: ["^build"]` means contracts builds before foundation, which builds before apps. Adding a new shared package without updating `turbo.json` or `package.json` workspace references causes it to build in parallel with its dependencies, producing intermittent build failures.

**Prevention:**
1. When adding any new package, verify the dependency chain: `contracts -> foundation -> apps`
2. Ensure `package.json` has explicit `workspace:*` references for internal dependencies
3. Test with `turbo build --dry-run` to verify build order before committing

**Detection:** Intermittent build failures that resolve on retry. Missing type declarations during parallel builds.

**Phase mapping:** Phase 1 - verify build graph is correct before making changes.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Contract consolidation | Big-bang import breakage (Pitfall 1) | Audit imports first, atomic migration, clean build after |
| Contract consolidation | Proto generation drift (Pitfall 6) | Integrate generate into Turbo pipeline, CI check |
| Config refactoring | Async initialization order (Pitfall 2) | Convert LoggingModule to forRootAsync first |
| Config refactoring | Retry defaults changing behavior (Pitfall 11) | Make configurable, not just "better defaults" |
| Architecture normalization | Over-engineering empty services (Pitfall 3) | One reference implementation, defer rest |
| Architecture normalization | Notifier divergence (Pitfall 8) | Decide role explicitly before refactoring |
| Security hardening | Breaking local dev (Pitfall 5) | Environment-aware guards, preserve dev defaults |
| Foundation changes | God module growth (Pitfall 4) | Gate additions with "does every service need this?" |
| Any refactoring | Turbo cache staleness (Pitfall 9) | Force clean builds at phase boundaries |
| Any refactoring | Circular dependencies (Pitfall 7) | Run madge in CI, maintain dependency graph |

## Sources

- [NestJS Circular Dependency Documentation](https://docs.nestjs.com/fundamentals/circular-dependency)
- [NestJS gRPC Microservices Documentation](https://docs.nestjs.com/microservices/grpc)
- [NestJS Monorepo Documentation](https://docs.nestjs.com/cli/monorepo)
- [NestJS Monorepos Without the Meltdown](https://medium.com/@bhagyarana80/nestjs-monorepos-without-the-meltdown-3a155795ea94)
- [Don't Go All-In Clean Architecture: An Alternative for NestJS](https://dev.to/thiagomini/dont-go-all-in-clean-architecture-an-alternative-for-nestjs-applications-p53)
- [NestJS Circular Dependency Hell and How to Avoid It](https://dev.to/smolinari/nestjs-circular-dependency-hell-and-how-to-avoid-it-4lfp)
- [The Schema Language Question: Single Source of Truth](https://www.chiply.dev/post-schema-languages)
- [How to Structure a NestJS Project for Microservices](https://www.trpkovski.com/2025/10/12/how-to-structure-a-nestjs-project-for-microservices-monorepo-setup/)

---

*Pitfalls audit: 2026-04-02*
