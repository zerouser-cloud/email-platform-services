# Project Research Summary

**Project:** Email Platform Foundation Audit
**Domain:** NestJS Microservices Monorepo -- Architectural Quality Enforcement
**Researched:** 2026-04-02
**Confidence:** HIGH

## Executive Summary

This project is a foundation audit of an existing NestJS microservices email platform built as a Turborepo/pnpm monorepo with 6 services (gateway, auth, sender, parser, audience, notifier) and 3 shared packages (config, contracts, foundation). The codebase has a well-defined target architecture (Clean/Hexagonal) documented in `docs/TARGET_ARCHITECTURE.md`, but the current state diverges significantly: services have flat structures with empty controller stubs, generated proto contracts are duplicated across two directories, config loading relies on module-scope side effects, and the linting toolchain (ESLint 8) is EOL. No business logic exists yet -- this is purely a structural hardening exercise before implementation begins.

The recommended approach is a phased audit that respects the dependency graph: fix shared packages first (contracts consolidation, config loading pattern), then introduce modern tooling (ESLint 9, dependency-cruiser, Buf CLI, knip), then restructure service internals to match the target architecture using a single reference implementation before replicating. All recommended tools are high-confidence, actively maintained, and compatible with the existing Turborepo setup. The stack avoids ecosystem switches (no Nx migration) and defers testing, CI/CD, and business logic to subsequent milestones.

The primary risks are: breaking all downstream builds during contract consolidation (mitigated by atomic migration with import auditing), creating runtime initialization bugs during config refactoring (mitigated by converting LoggingModule to async patterns first), and over-engineering Clean Architecture scaffolding in empty services (mitigated by implementing one reference service before replicating). Every pitfall has a clear prevention strategy tied to a specific phase.

## Key Findings

### Recommended Stack

The project needs tooling modernization, not a technology pivot. The existing Turborepo + pnpm + NestJS foundation is sound. The gaps are in enforcement and hygiene tooling. See [STACK.md](./STACK.md) for full details.

**Core technologies:**
- **ESLint 9 + typescript-eslint v8:** Replace EOL ESLint 8; migrate to flat config. Foundation for all lint-based enforcement.
- **eslint-plugin-boundaries:** Declarative architecture boundary enforcement, replacing brittle `no-restricted-imports` overrides.
- **eslint-plugin-import-x:** Flat-config-native import linting with circular dependency detection.
- **dependency-cruiser:** Whole-graph dependency validation, replacing the bash grep script (`scripts/check-architecture.sh`).
- **Buf CLI:** Proto linting, breaking change detection, and deterministic code generation. Replaces manual `generate.sh` script.
- **knip:** Dead code, unused dependency, and unused export detection across the monorepo.
- **sherif:** Zero-config monorepo consistency linting (version alignment, dependency placement).
- **TypeScript `noUncheckedIndexedAccess`:** Catches the documented metadata array access bug class at compile time.

### Expected Features

The feature landscape is structured around making the codebase safe for business logic implementation. See [FEATURES.md](./FEATURES.md) for full details.

**Must have (table stakes):**
- Single source of truth for generated contracts (eliminate duplicate `generated/` directory)
- Proto generation integrated into Turbo build pipeline
- Single config load via NestJS DI (eliminate 7+ module-scope `loadGlobalConfig()` calls)
- Fix metadata array access bug (crashes on empty arrays)
- Clean Architecture directory structure in all domain services
- Error message sanitization (prevent internal details leaking to clients)
- Parallel health checks (sequential checks cause Kubernetes probe timeouts)
- Environment-aware config validation (reject wildcard CORS in production)
- Structured logging fields (service name, environment, request duration)

**Should have (differentiators):**
- OpenTelemetry distributed tracing
- OpenAPI/Swagger for gateway
- Architecture boundary linting in CI
- Graceful shutdown handling
- Connection pool configuration

**Defer (post-audit):**
- Business logic implementation
- Test suites (next milestone)
- CI/CD pipeline
- API versioning
- Inter-service circuit breakers
- Database migrations framework

### Architecture Approach

The target is Clean/Hexagonal Architecture with strict layer separation: `domain/` (pure TypeScript, no framework imports), `application/` (ports and use cases), `infrastructure/` (NestJS adapters, persistence, messaging). The gateway is exempt -- it is a routing facade, not a domain service. The dependency graph is a clean DAG: `config -> (nothing)`, `contracts -> (nothing)`, `foundation -> config, contracts`, `apps/* -> all packages`. No cross-service compile-time imports exist (good). See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

**Major components:**
1. **packages/contracts** -- Proto definitions, generated gRPC types, event type contracts. Lowest shared dependency; everything imports from it.
2. **packages/config** -- Environment validation via Zod schemas, service catalog, topology. Must remain a leaf package with zero internal deps.
3. **packages/foundation** -- NestJS infrastructure modules (logging, gRPC, errors, health, resilience). Risk of becoming a god module.
4. **apps/gateway** -- REST-to-gRPC facade with auth guards. No domain layer. Restructure last because it depends on all service contracts.
5. **apps/{auth,sender,parser,audience}** -- Domain services following hex arch. Currently flat with empty stubs.
6. **apps/notifier** -- Event consumer (RabbitMQ), no gRPC server. Architecturally divergent; needs explicit role decision.

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for complete list with 13 identified pitfalls.

1. **Big-bang contract consolidation breaks all importers** -- Audit all import paths first; diff the two generated directories; migrate atomically in one commit.
2. **Config refactoring creates runtime initialization order bugs** -- Convert `LoggingModule` to `forRootAsync()` pattern before moving config into DI. Migrate one service at a time.
3. **Over-engineering Clean Architecture in empty services** -- Create directory structure only; implement one reference service (auth) end-to-end; defer full scaffolding for other services.
4. **Foundation package becomes a god module** -- Gate every addition with "does every service need this?" Consider splitting if build times degrade.
5. **Security fixes in wrong order break local dev** -- Use environment-aware guards (`NODE_ENV` checks), preserve dev-safe defaults, fix incrementally.

## Implications for Roadmap

Based on combined research, the audit should be structured as 5 phases following the dependency graph. Shared packages first, then tooling, then service restructuring, then gateway, then production hardening.

### Phase 1: Contract and Build Foundation
**Rationale:** Everything depends on the contracts package. Fix it first to prevent cascading issues in later phases. Also the right time to verify the build graph and document dependency patterns.
**Delivers:** Single source of truth for generated types; proto generation in Turbo pipeline; typed event contracts; verified build DAG.
**Addresses:** Contract hygiene (3 features), proto generation pipeline, metadata bug fix.
**Avoids:** Pitfall 1 (big-bang contract breakage), Pitfall 6 (proto generation drift), Pitfall 13 (build order chain).
**Stack used:** Buf CLI for proto linting and generation orchestration.

### Phase 2: Config and Tooling Modernization
**Rationale:** Config loading pattern affects every service module. Fix it before restructuring services to avoid redoing module wiring. ESLint migration is independent and can be parallelized with config work.
**Delivers:** NestJS DI-based config loading; ESLint 9 flat config with boundary enforcement; dependency-cruiser replacing bash grep script; knip for dead code detection.
**Addresses:** Single config load via DI, environment-aware validation, CORS lockdown, notifier role decision.
**Avoids:** Pitfall 2 (config initialization order), Pitfall 7 (circular dependencies), Pitfall 9 (Turbo cache staleness).
**Stack used:** ESLint 9 + typescript-eslint v8, eslint-plugin-boundaries, eslint-plugin-import-x, dependency-cruiser, knip, sherif, `noUncheckedIndexedAccess`.

### Phase 3: Service Architecture (Reference Implementation)
**Rationale:** With contracts and config stable, restructure one domain service (auth) as the reference implementation for Clean/Hexagonal Architecture. Validate the pattern before replicating.
**Delivers:** Auth service with correct layer separation (domain/application/infrastructure), port interfaces, gRPC adapter, use case stubs returning UNIMPLEMENTED.
**Addresses:** Clean Architecture enforcement, controller stubs matching proto, code location audit.
**Avoids:** Pitfall 3 (over-engineering empty services), Pitfall 4 (foundation god module).

### Phase 4: Service Architecture (Replication) + Gateway
**Rationale:** Apply validated pattern from Phase 3 to remaining services (audience, parser, sender, notifier in that order by complexity). Restructure gateway last since it depends on all service contracts.
**Delivers:** All services following hex arch pattern; gateway with domain-specific controllers, auth guard, DTOs; notifier with explicit architectural role.
**Addresses:** Remaining architecture enforcement, notifier alignment, error message sanitization, consistent error shape.
**Avoids:** Pitfall 8 (notifier divergence), Pitfall 5 (security fixes breaking local dev).

### Phase 5: Production Readiness Hardening
**Rationale:** With architecture stable, apply operational improvements that require the correct structure to be in place (structured logging needs interceptors in the right layer, health checks need proper service topology).
**Delivers:** Structured log fields, request/response timing, parallel health checks, separate liveness/readiness probes, tuned retry configuration, secure `.env.example` defaults.
**Addresses:** All health/resilience features, logging baseline, security baseline.
**Avoids:** Pitfall 5 (security order), Pitfall 11 (retry tuning without configurability).

### Phase Ordering Rationale

- **Contracts before config:** Config refactoring touches every module file. If contracts are broken, module changes get tangled with import fixes.
- **Config before architecture:** Service module restructuring requires knowing the correct config injection pattern. Doing it before means rewriting modules twice.
- **Reference implementation before replication:** Pitfall 3 is real. One validated service prevents 60+ files of cargo-cult boilerplate across 5 services.
- **Gateway last among services:** Gateway's controller structure, DTOs, and guard depend on understanding all service contracts. It is the integration point.
- **Production hardening last:** Logging interceptors, health checks, and retry config require the correct architectural layers to exist. Adding them to flat-structured services means moving them again after restructuring.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Config/Tooling):** ESLint flat config migration has edge cases with NestJS decorator metadata. The `LoggingModule.forRootAsync()` conversion pattern needs prototyping.
- **Phase 3 (Reference Implementation):** Clean Architecture in NestJS has competing conventions. The exact port/adapter wiring with NestJS DI tokens needs validation against NestJS module lifecycle.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Contracts):** Buf CLI setup is well-documented. Contract consolidation is mechanical.
- **Phase 4 (Replication):** Follows the pattern established in Phase 3. No new decisions.
- **Phase 5 (Production Hardening):** NestJS interceptors, health checks, and Pino configuration are well-documented patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools verified against current versions, npm packages confirmed, compatibility with Turborepo validated. ESLint 8 EOL is documented fact. |
| Features | HIGH | Features derived from direct codebase inspection and project CONCERNS.md. Priority ordering based on dependency analysis. |
| Architecture | HIGH | Target architecture documented by the project itself. Gap analysis based on direct file inspection. Clean/Hexagonal patterns well-established. |
| Pitfalls | HIGH | Pitfalls derived from concrete code patterns found in codebase. Prevention strategies map to specific NestJS behaviors. |

**Overall confidence:** HIGH

### Gaps to Address

- **Notifier service role:** Research identified the divergence (HTTP-only, no gRPC, no proto) but the decision of whether to add gRPC or document it as event-consumer-only requires a product decision, not a technical one. Must be resolved in Phase 2 planning.
- **Per-service vs shared database:** Architecture research flagged that all services may share one MongoDB database with collection ownership as convention only. Whether to enforce per-service databases is a deployment decision that affects Phase 3+ schema design.
- **Generated code in git vs build-time generation:** The contracts package could either commit generated types (current approach, faster builds) or generate at build time (guaranteed consistency, slower). This tradeoff needs a decision in Phase 1 planning.
- **Foundation package splitting:** Research flags the god-module risk but recommends deferring the split until build times degrade. This needs monitoring, not immediate action.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all `apps/` and `packages/` source files
- Project `docs/TARGET_ARCHITECTURE.md`, `docs/CONCERNS.md`, `docs/ARCHITECTURE.md`
- [ESLint v8 EOL announcement](https://eslint.org/blog/2024/09/eslint-v8-eol-version-support/)
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
- [Buf CLI documentation](https://buf.build/docs/cli/quickstart/)
- [Knip documentation](https://knip.dev)
- [NestJS Microservices gRPC](https://docs.nestjs.com/microservices/grpc)

### Secondary (MEDIUM confidence)
- [NestJS Monorepo Best Practices](https://dev.to/ezilemdodana/best-practices-for-building-microservices-with-nestjs-p3e)
- [Clean Architecture alternatives for NestJS](https://dev.to/thiagomini/dont-go-all-in-clean-architecture-an-alternative-for-nestjs-applications-p53)
- [Sherif monorepo linter](https://github.com/QuiiBz/sherif)
- [eslint-plugin-import-x](https://github.com/un-ts/eslint-plugin-import-x)

### Tertiary (LOW confidence)
- Community patterns for NestJS hex arch port-adapter DI wiring -- multiple approaches exist, needs validation during Phase 3

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
