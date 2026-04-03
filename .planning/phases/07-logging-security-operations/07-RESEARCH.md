# Phase 7: Logging, Security & Operations - Research

**Researched:** 2026-04-03
**Domain:** NestJS structured logging (Pino), lifecycle hooks, security validation
**Confidence:** HIGH

## Summary

Phase 7 covers four requirements across three domains: structured log enrichment (LOG-01, LOG-02), security validation (SEC-01), and graceful shutdown (OPS-01). The codebase already has strong foundations -- LoggingModule with forHttpAsync/forGrpcAsync, GrpcLoggingInterceptor with duration tracking, Zod CORS refine, and enableShutdownHooks in all main.ts files. The remaining work is additive: inject base fields into Pino config, create an HTTP timing interceptor for gateway, verify SEC-01 completeness, and add onModuleDestroy stubs to all 6 service modules.

All changes touch well-established NestJS patterns (Pino base option, NestInterceptor, OnModuleDestroy lifecycle interface). The LoggingModule already uses forRootAsync with ConfigService injection, so adding base fields is a config-level change. The HTTP timing interceptor follows the exact same pattern as the existing GrpcLoggingInterceptor. Graceful shutdown stubs implement the OnModuleDestroy interface with placeholder close() calls.

**Primary recommendation:** Execute as 3 focused plans -- (1) LOG-01 base fields in LoggingModule, (2) LOG-02 HTTP timing interceptor + verify gRPC interceptor, (3) SEC-01 verification + OPS-01 shutdown stubs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Add base fields to every Pino log entry: `service` (from SERVICE.*.id), `environment` (from NODE_ENV), `instanceId` (crypto.randomUUID() generated once at process start).
- D-02: Base fields configured in `pinoHttp` config within LoggingModule's `forHttpAsync` and `forGrpcAsync` methods. Pass as `base` option to Pino.
- D-03: Service name passed as parameter to LoggingModule factory methods (each service knows its own name).
- D-04: Create NestJS interceptor that logs `{ method, path, statusCode, durationMs }` for every HTTP request.
- D-05: For gRPC services, the existing `GrpcLoggingInterceptor` already handles this -- verify it includes duration.
- D-06: HTTP timing interceptor added to gateway's LoggingModule (HTTP-facing service).
- D-07: Phase 2 already implemented: Zod refine rejects CORS_ORIGINS=* in production, .env.example updated with safe defaults. Verify completeness and add any missing documentation.
- D-08: `enableShutdownHooks()` already called in all 6 main.ts files -- keep as-is.
- D-09: Add `onModuleDestroy` to each service's main module with full stub close() calls for future connections (MongoDB, Redis, RabbitMQ close stubs). Log "shutting down [service]" on destroy.
- D-10: Gateway: drain HTTP server. gRPC services: drain gRPC connections. Notifier: close RabbitMQ subscriber. All via onModuleDestroy lifecycle hook.

### Claude's Discretion
- Exact interceptor implementation (NestJS standard pattern)
- Whether to add `onApplicationShutdown` in addition to `onModuleDestroy`
- Log format for timing interceptor (structured object vs message string)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOG-01 | Pino logs contain structured fields: service name, environment, instanceId | Pino `base` option in pinoHttp config; LoggingModule forHttpAsync/forGrpcAsync already accept ConfigService -- add `base` property and service name parameter |
| LOG-02 | NestJS interceptor logs request/response timing: `{ method, path, statusCode, durationMs }` | HTTP interceptor follows GrpcLoggingInterceptor pattern; gRPC interceptor already has duration; gateway registers via APP_INTERCEPTOR |
| SEC-01 | CORS wildcard forbidden in production, .env.example contains safe defaults with comments | Already implemented in Phase 2: Zod refine in env-schema.ts (line 33), .env.example has CORS comments -- verify only |
| OPS-01 | Graceful shutdown: in-flight requests complete, gRPC drains, DB/RabbitMQ pools close via enableShutdownHooks + onModuleDestroy | enableShutdownHooks in all 6 main.ts confirmed; add OnModuleDestroy interface to 6 module classes |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nestjs-pino | 4.6.0 | Pino integration for NestJS | Already in use; `base` option is standard Pino feature |
| pino | 10.3.1 | Structured JSON logger | Already in use; `base` field merges into every log entry |
| @nestjs/common | 11.0.1 | NestInterceptor, OnModuleDestroy interfaces | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nestjs-cls | 6.2.0 | Request context (correlationId) | Already integrated; no changes needed |
| @nestjs/config | 4.0.3 | ConfigService for NODE_ENV, service name | Already injected in forHttpAsync/forGrpcAsync |

No new dependencies required for this phase.

## Architecture Patterns

### Pattern 1: Pino `base` Option for Static Fields
**What:** Pino's `base` option merges static key-value pairs into every log entry automatically. Setting `base: { service: 'auth', environment: 'development', instanceId: 'uuid' }` means every log line includes those fields without explicit inclusion.
**When to use:** Process-level metadata that should appear on every log entry.
**Current state in codebase:** Neither forHttpAsync nor forGrpcAsync set `base`. They only configure `level`, `transport`, `genReqId`, `serializers`, and `autoLogging`.
**Implementation:** Add `base` property to pinoHttp config object inside the useFactory callbacks.

```typescript
// In LoggingModule forHttpAsync/forGrpcAsync useFactory:
const instanceId = crypto.randomUUID(); // generated once at module init

useFactory: (configService: ConfigService) => {
  const logLevel = configService.get<string>('LOG_LEVEL') as LogLevel;
  const logFormat = configService.get<string>('LOG_FORMAT') as LogFormat;
  return {
    pinoHttp: {
      level: logLevel,
      base: {
        service: serviceName, // passed as parameter to factory method
        environment: configService.get<string>('NODE_ENV'),
        instanceId,
      },
      transport: resolveTransport(logFormat),
      // ... rest of existing config
    },
  };
};
```

**Key detail:** `instanceId` must be generated ONCE per process, not per request. Use a module-level `crypto.randomUUID()` call or a static field on LoggingModule.

### Pattern 2: HTTP Timing Interceptor (NestJS Standard)
**What:** NestJS interceptor measuring request duration using `Date.now()` diff with `tap` operator on the response Observable.
**When to use:** Gateway HTTP requests need timing logged identically to how GrpcLoggingInterceptor logs gRPC calls.
**Existing pattern to follow:** `GrpcLoggingInterceptor` at `packages/foundation/src/logging/grpc-logging.interceptor.ts` -- exact same structure, different context extraction.

```typescript
@Injectable()
export class HttpTimingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;
    const path = req.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          const durationMs = Date.now() - startTime;
          this.logger.info({ method, path, statusCode: res.statusCode, durationMs }, 'HTTP request completed');
        },
        error: (error: Error) => {
          const durationMs = Date.now() - startTime;
          this.logger.error({ method, path, durationMs, error: error.message }, 'HTTP request failed');
        },
      }),
    );
  }
}
```

### Pattern 3: OnModuleDestroy Lifecycle Hook
**What:** NestJS OnModuleDestroy interface triggers when SIGTERM received (after enableShutdownHooks). Module class implements `onModuleDestroy()` method.
**When to use:** Clean resource teardown -- close DB connections, drain servers, unsubscribe from message queues.
**Current state:** No service module implements OnModuleDestroy. All 6 main.ts already call `enableShutdownHooks()`.

```typescript
@Module({ /* ... */ })
export class AuthModule implements OnModuleDestroy {
  private readonly logger = new Logger(AuthModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down auth service...');
    // TODO: close MongoDB connection when integrated
    // TODO: close gRPC server connections
  }
}
```

### Anti-Patterns to Avoid
- **Generating instanceId per request:** instanceId is a process identifier, not request-scoped. Generate once at module initialization or at file scope.
- **Putting HTTP interceptor in foundation package providers:** The HTTP timing interceptor belongs in forHttpAsync only, not forGrpcAsync. gRPC already has GrpcLoggingInterceptor.
- **Using onApplicationShutdown instead of onModuleDestroy:** Per D-09, use onModuleDestroy. It fires per module, allowing each service to clean up its own resources. onApplicationShutdown fires after all modules are destroyed -- less granular control.
- **Actually closing non-existent connections:** MongoDB, Redis, RabbitMQ are not yet integrated. Stubs should log intent and have TODO comments, not call `.close()` on undefined references.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static log fields | Custom middleware adding fields to each log call | Pino `base` option | Built-in, zero runtime overhead, guaranteed on every entry |
| Request timing | Custom middleware with req/res events | NestJS interceptor with tap() | Integrates with NestJS lifecycle, handles errors, Observable-compatible |
| Shutdown coordination | Custom signal handlers | NestJS enableShutdownHooks + OnModuleDestroy | Framework handles SIGTERM/SIGINT, proper ordering, testable |

## Common Pitfalls

### Pitfall 1: instanceId Regenerated on Hot Reload
**What goes wrong:** If instanceId is inside the useFactory function, it regenerates when the module re-initializes during dev hot reload, making it useless for process identification.
**Why it happens:** useFactory runs on every module init.
**How to avoid:** Generate instanceId at file/module scope level, not inside useFactory. A module-level constant or static property works.
**Warning signs:** Different instanceId values in consecutive log entries without process restart.

### Pitfall 2: Forgetting to Update Method Signature
**What goes wrong:** Adding `serviceName` parameter to forHttpAsync/forGrpcAsync without updating all call sites.
**Why it happens:** There are 6 call sites across 6 service modules.
**How to avoid:** Update the method signature first, let TypeScript catch all broken call sites.
**Call sites to update:**
- `apps/gateway/src/gateway.module.ts` -- `LoggingModule.forHttpAsync()`
- `apps/auth/src/auth.module.ts` -- `LoggingModule.forGrpcAsync()`
- `apps/sender/src/sender.module.ts` -- `LoggingModule.forGrpcAsync()`
- `apps/parser/src/parser.module.ts` -- `LoggingModule.forGrpcAsync()`
- `apps/audience/src/audience.module.ts` -- `LoggingModule.forGrpcAsync()`
- `apps/notifier/src/notifier.module.ts` -- `LoggingModule.forHttpAsync()` (note: notifier uses forHttpAsync even though it's not a REST API)

### Pitfall 3: pinoHttp base vs pino base Confusion
**What goes wrong:** Setting `base` at the wrong nesting level in nestjs-pino config.
**Why it happens:** nestjs-pino wraps pino-http which wraps pino. The `base` option belongs inside `pinoHttp` (which pino-http passes through to pino).
**How to avoid:** Set `base` as a direct property of the `pinoHttp` object in the forRootAsync useFactory return value.

### Pitfall 4: OnModuleDestroy Without Interface Import
**What goes wrong:** Writing `onModuleDestroy()` method without implementing the `OnModuleDestroy` interface. NestJS won't call it.
**Why it happens:** NestJS uses the interface to detect lifecycle hook implementations.
**How to avoid:** Always `implements OnModuleDestroy` on the class and import from `@nestjs/common`.

## Code Examples

### Verified: GrpcLoggingInterceptor Already Has Duration
The existing interceptor at `packages/foundation/src/logging/grpc-logging.interceptor.ts` line 13-20 already logs `{ method, duration, status }` -- confirming D-05 is already satisfied. No changes needed to gRPC timing.

### Verified: SEC-01 Already Complete
- `packages/config/src/env-schema.ts` line 32-39: `.refine()` rejects `CORS_ORIGINS=*` when `NODE_ENV=production`
- `.env.example` line 42-44: Contains warning comment about wildcard rejection in production

### Service Module Inventory (for OnModuleDestroy)

| Module | File | LoggingModule | Shutdown Resources |
|--------|------|---------------|-------------------|
| GatewayModule | `apps/gateway/src/gateway.module.ts` | forHttpAsync() | HTTP server drain |
| AuthModule | `apps/auth/src/auth.module.ts` | forGrpcAsync() | gRPC drain, MongoDB stub |
| SenderModule | `apps/sender/src/sender.module.ts` | forGrpcAsync() | gRPC drain, MongoDB stub, Redis stub |
| ParserModule | `apps/parser/src/parser.module.ts` | forGrpcAsync() | gRPC drain, MongoDB stub |
| AudienceModule | `apps/audience/src/audience.module.ts` | forGrpcAsync() | gRPC drain, MongoDB stub |
| NotifierModule | `apps/notifier/src/notifier.module.ts` | forHttpAsync() | RabbitMQ subscriber close |

### Service Name Mapping (for LOG-01 base fields)

| Service | SERVICE constant | id value |
|---------|-----------------|----------|
| Gateway | SERVICE.gateway | 'gateway' |
| Auth | SERVICE.auth | 'auth' |
| Sender | SERVICE.sender | 'sender' |
| Parser | SERVICE.parser | 'parser' |
| Audience | SERVICE.audience | 'audience' |
| Notifier | SERVICE.notifier | 'notifier' |

These IDs come from `packages/config/src/catalog/services.ts`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (testing is out of scope per CLAUDE.md) |
| Config file | N/A |
| Quick run command | `pnpm -r exec tsc --noEmit` (type-check only) |
| Full suite command | `pnpm -r exec tsc --noEmit` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOG-01 | Base fields in Pino config | manual-only | Verify via `tsc --noEmit` (type safety) + runtime log inspection | N/A |
| LOG-02 | HTTP timing interceptor | manual-only | Verify via `tsc --noEmit` + curl timing check | N/A |
| SEC-01 | CORS production refine | manual-only | Already verified in Phase 2 | N/A |
| OPS-01 | onModuleDestroy stubs | manual-only | Verify via `tsc --noEmit` + SIGTERM test | N/A |

**Justification for manual-only:** CLAUDE.md explicitly states "No tests" -- testing is a separate next stage. Validation relies on TypeScript compilation and runtime verification in Phase 8.

### Sampling Rate
- **Per task commit:** `pnpm -r exec tsc --noEmit`
- **Per wave merge:** Same
- **Phase gate:** TypeScript compiles clean; visual log inspection confirms base fields

### Wave 0 Gaps
None -- no test infrastructure expected per project constraints.

## Open Questions

1. **Should forHttp/forGrpc (non-Async) also get base fields?**
   - What we know: Both sync and async variants exist. Only async variants are used in service modules currently.
   - What's unclear: Whether sync variants should be updated for consistency or deprecated.
   - Recommendation: Update sync variants for consistency since they exist as public API, but this is Claude's discretion.

2. **Notifier uses forHttpAsync but is not HTTP-facing**
   - What we know: Notifier module imports `LoggingModule.forHttpAsync()` despite being an event consumer (no REST endpoints).
   - What's unclear: Whether this was intentional (it still needs a base HTTP logger for health endpoints) or oversight.
   - Recommendation: Keep forHttpAsync for notifier -- it does listen on an HTTP port for health checks. The HTTP timing interceptor is harmless there (just won't trigger often).

## Sources

### Primary (HIGH confidence)
- Codebase inspection: All 6 main.ts, all 6 module files, LoggingModule, GrpcLoggingInterceptor, env-schema.ts, .env.example
- [Pino API docs - base option](https://github.com/pinojs/pino/blob/main/docs/api.md)
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)

### Secondary (MEDIUM confidence)
- [nestjs-pino GitHub](https://github.com/iamolegga/nestjs-pino) - forRootAsync config passthrough to pinoHttp
- [Graceful Shutdown in NestJS - DEV Community](https://dev.to/hienngm/graceful-shutdown-in-nestjs-ensuring-smooth-application-termination-4e5n)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - patterns verified from existing codebase (GrpcLoggingInterceptor as template)
- Pitfalls: HIGH - identified from codebase analysis (6 call sites, instanceId scope, interface requirement)

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable patterns, no fast-moving dependencies)
