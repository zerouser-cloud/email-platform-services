# Feature Landscape: Foundation Audit

**Domain:** NestJS Microservices Monorepo Foundation Audit & Hardening
**Researched:** 2026-04-02
**Mode:** Ecosystem (subsequent milestone -- platform exists, auditing foundations)

## Table Stakes

Features the foundation must have. Without these, building business logic on top is risky.

### Contract Hygiene

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single source of truth for generated contracts | Two locations (`contracts/src/generated/` and `contracts/generated/`) create drift risk. Proto is the contract -- generated code must live in exactly one place. | Low | Delete duplicate directory, update imports, ensure proto generation targets single output. Identified in CONCERNS.md. |
| Proto generation in build pipeline | Generated code must be reproducible from proto source. Committing generated code without pipeline means manual drift. | Low | Add proto generation step to Turbo pipeline. Verify `protoc-gen-ts_proto` output matches committed files. |
| Controller stubs match proto definitions | 4 controllers are empty stubs despite proto files defining RPC methods. The skeleton should at least declare method signatures with `@GrpcMethod` decorators, even if bodies throw "not implemented." | Medium | Auth, Sender, Parser, Audience controllers. Not implementing business logic -- just ensuring the gRPC handler surface matches proto contracts so the type system catches mismatches. |

### Configuration Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single config load via DI | `loadGlobalConfig()` called 7+ times at module import level. Must load once and inject via DI token. | Medium | Create `ConfigService` provider, inject everywhere. Eliminates repeated Zod parsing, enables testability, follows NestJS patterns. Critical bug source per CONCERNS.md. |
| Environment-aware validation | CORS wildcard accepted in production. Config schema must reject dangerous values based on `NODE_ENV`. | Low | Add Zod `.refine()` rules: if `NODE_ENV=production`, reject `CORS_ORIGINS=*`, require explicit origins. |
| Secrets out of committed files | MinIO credentials hardcoded in docker-compose.yml. Use env var substitution (`${VAR:-default}`). | Low | Not about secrets management infrastructure -- just stop committing plaintext credentials. |

### Error Handling & Safety

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fix metadata array access bug | `metadata.get(HEADER.CORRELATION_ID)[0]` crashes on empty arrays. Correlation ID propagation breaks silently. | Low | Add optional chaining + fallback. Exact fix documented in CONCERNS.md. |
| Error message sanitization | gRPC error messages pass through to HTTP responses unsanitized. Internal details (DB connection strings, service URLs) leak to clients. | Medium | Map gRPC errors to safe client-facing messages. Log original details server-side. Define error message allowlist per status code. |
| Consistent error shape across services | Each service should return errors in the same structure. Gateway must normalize all error responses to a single contract. | Medium | Define standard error response DTO: `{ statusCode, message, error, correlationId }`. Apply via global exception filter. |

### Architectural Boundaries

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Clean Architecture enforcement in apps/ | Architecture declared as Clean/Hexagonal but not consistently applied. Each app needs `domain/`, `application/`, `infrastructure/` layers with correct dependency direction. | High | Use the built-in `gsd-architecture-validator` agent. Enforce: domain has zero imports from infrastructure; application depends only on domain; infrastructure implements ports. |
| Code location audit (apps/ vs packages/) | Shared code must live in `packages/`, service-specific code in `apps/`. Concerns doc flags "code smearing." | Medium | Audit each service for duplicated utilities. Move shared logic to appropriate package. Verify no cross-service imports between apps/. |
| Notifier service architectural alignment | Notifier is HTTP-only, no gRPC, no proto, no health check. Inconsistent with other services. | Medium | Either add gRPC transport and health check (if it needs to be called by other services) or explicitly document it as event-consumer-only and add RabbitMQ-based health check. |

### Health & Resilience

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Parallel health checks | Gateway checks 4 gRPC services sequentially. Worst case = 4x timeout. Kubernetes probes will fail. | Low | Switch to `Promise.all()` for health check execution. Already identified in CONCERNS.md. |
| Tuned retry configuration | Default retry: 10 attempts, up to 30s backoff = 2 min total. Too aggressive for Kubernetes startup. | Low | Reduce to 5 retries, 200ms base delay, add jitter. Make configurable per service via env vars. |
| Separate liveness vs readiness probes | Currently one health endpoint. Liveness should check "is the process alive," readiness should check "are dependencies ready." | Medium | Liveness: always 200 if process running. Readiness: check gRPC connections, DB, RabbitMQ. Kubernetes needs both. |

### Logging & Observability (Baseline)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Structured log fields | Pino integrated but logs lack service name, environment, instance ID, request duration. Unusable in production log aggregation. | Low | Add base fields to Pino config: `service`, `environment`, `instanceId`. These are non-negotiable for production logging. |
| Request/response timing | No request duration tracking. Cannot identify slow endpoints or measure SLAs. | Low | Add NestJS interceptor that logs `{ method, path, statusCode, durationMs }` for every request. |

### Security Baseline

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CORS production lockdown | Wildcard CORS in production enables CSRF. Must reject `*` when `NODE_ENV=production`. | Low | Covered by environment-aware validation above. Also change `.env.example` default from `*` to `http://localhost:3000`. |
| Default `.env.example` safety | Current defaults are insecure (wildcard CORS, admin/admin credentials). Developer convenience must not create production risk. | Low | Audit all `.env.example` values. Set secure defaults. Add comments marking what MUST be changed for production. |

## Differentiators

Nice to have. Improve the platform significantly but not blockers for building business logic.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| OpenTelemetry distributed tracing | Visualize request flow across all 6 services. Debug latency. Currently only correlation IDs in logs -- no trace visualization. | High | Integrate `@opentelemetry/sdk-node` with gRPC and HTTP auto-instrumentation. Export to Jaeger/Zipkin. Powerful but not blocking for foundation audit. |
| OpenAPI/Swagger for gateway | Machine-readable API spec for gateway HTTP endpoints. Enables frontend dev tooling, API documentation. | Medium | Add `@nestjs/swagger` to gateway. Decorate DTOs and controllers. Generate spec on build. |
| Architecture boundary linting in CI | Automated enforcement that apps/ don't import across service boundaries and dependency direction is correct. | Medium | Could use custom ESLint rules or Turbo dependency constraints. Prevents regression after manual audit. |
| Connection pool configuration | MongoDB, Redis, RabbitMQ connections have no visible pooling config. Could exhaust connections under load. | Medium | Expose pool size, timeout, and max connections via env vars. Not urgent at current scale but prevents surprises. |
| Inter-service rate limiting / circuit breaker | Gateway has rate limiting but inter-service gRPC calls are unlimited. A buggy service can overwhelm others. | High | Add circuit breaker pattern (e.g., `opossum` or custom NestJS interceptor) for gRPC client calls. Complex to get right. |
| Health check result caching | Prevent thundering herd on health endpoints. Cache results for 5-10 seconds. | Low | Simple TTL cache in health controller. Minor optimization. |
| Graceful shutdown handling | Ensure in-flight requests complete before process exits. Drain gRPC connections, close DB pools. | Medium | NestJS has `enableShutdownHooks()`. Wire up `onModuleDestroy` in each service. Important for zero-downtime deploys. |
| Pre-commit secret detection | Prevent hardcoded secrets from being committed. | Low | Add pre-commit hook with tool like `detect-secrets` or `gitleaks`. |

## Anti-Features

Things to deliberately NOT do during a foundation audit.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Implement business logic | Foundation audit is about structural correctness, not features. Adding business logic couples audit fixes to untested functionality. | Create clean method stubs with `@GrpcMethod` decorators that throw "not implemented." Business logic comes after the foundation is solid. |
| Write comprehensive test suites | Tests are explicitly scoped to the next milestone. Writing tests now interleaves two concerns and slows the audit. | Ensure the codebase is testable (DI, interfaces, ports) so the next milestone can add tests efficiently. |
| Add new services or transports | The audit works with existing 6 services. Adding services introduces new variables during stabilization. | Document what new services would need (architectural template) but don't create them. |
| Adopt Nx or switch from Turbo | Switching monorepo tooling during audit is a rewrite disguised as improvement. Turbo works. | If Turbo has specific issues, document them. Don't migrate tooling mid-audit. |
| Implement DDD in packages/ | Project constraint: packages/ are utilitarian libraries. DDD adds unnecessary complexity to shared utilities. | Keep packages/ as flat utility exports. DDD is for apps/ domain layers only. |
| Add database migrations framework | No business entities exist yet (controllers are stubs). Migration tooling without data models is premature. | Ensure MongoDB connection config is clean and injectable. Migrations come with business logic. |
| Build CI/CD pipeline | Infrastructure concern, not foundation code audit. Mixing infra and code audit dilutes focus. | Document CI/CD requirements (proto generation, lint, build order) but don't implement the pipeline. |
| Introduce API versioning | No API consumers exist yet. Versioning empty stubs is overhead with zero benefit. | Design contracts to be extensible (proto3 field numbering). Add versioning when there are actual consumers. |

## Feature Dependencies

```
Proto single source of truth ─────────> Controller stubs match proto
                                              │
                                              v
                              Clean Architecture enforcement
                                              │
                                              v
                              Code location audit (apps/ vs packages/)

Single config load via DI ──────────> Environment-aware validation
         │                                    │
         v                                    v
  Secrets out of committed files     CORS production lockdown

Fix metadata array access ──────────> Structured log fields
                                              │
                                              v
                                    Request/response timing

Error message sanitization ─────────> Consistent error shape

Parallel health checks ─────────────> Separate liveness vs readiness
         │
         v
  Tuned retry configuration
```

**Key dependency chain:** Contract hygiene must come first because Clean Architecture enforcement depends on knowing which generated types to import. Config management should be second because many other fixes need injectable config. Error handling and health checks can run in parallel after those.

## MVP Recommendation

**Priority 1 -- Contract & Config (unblock everything else):**
1. Single source of truth for generated contracts (Low)
2. Proto generation in build pipeline (Low)
3. Single config load via DI (Medium)
4. Fix metadata array access bug (Low)

**Priority 2 -- Boundaries & Safety (structural correctness):**
5. Clean Architecture enforcement in apps/ (High)
6. Code location audit (Medium)
7. Controller stubs match proto definitions (Medium)
8. Error message sanitization (Medium)

**Priority 3 -- Production Readiness (operational correctness):**
9. Environment-aware validation (Low)
10. Structured log fields (Low)
11. Parallel health checks (Low)
12. Separate liveness vs readiness probes (Medium)
13. Tuned retry configuration (Low)
14. Consistent error shape (Medium)
15. Notifier architectural alignment (Medium)

**Defer to post-audit:**
- OpenTelemetry distributed tracing (High complexity, high value but not blocking)
- OpenAPI/Swagger (Medium, useful but no consumers yet)
- Inter-service circuit breaker (High complexity, premature at current scale)

## Sources

- Project CONCERNS.md and ARCHITECTURE.md (primary source for known issues)
- [NestJS Monorepo Documentation](https://docs.nestjs.com/cli/monorepo)
- [NestJS gRPC Microservices](https://docs.nestjs.com/microservices/grpc)
- [NestJS CORS Security](https://docs.nestjs.com/security/cors)
- [CORS Production Hardening Guide](https://felixastner.com/articles/enabling-cors-in-nestjs)
- [Microservices Health Check Patterns](https://microservices.io/patterns/observability/health-check-api.html)
- [NestJS Microservices Best Practices](https://dev.to/ezilemdodana/best-practices-for-building-microservices-with-nestjs-p3e)
- [Monorepo Architecture with NestJS](https://www.djamware.com/post/monorepo-architecture-with-nestjs-and-nx-cicd-docker-k8s)

---

*Features audit: 2026-04-02*
