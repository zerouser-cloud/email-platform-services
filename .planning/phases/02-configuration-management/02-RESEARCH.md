# Phase 2: Configuration Management - Research

**Researched:** 2026-04-02
**Domain:** NestJS ConfigService DI, Zod schema validation, Docker Compose env substitution
**Confidence:** HIGH

## Summary

This phase refactors configuration management across the email platform monorepo. The core problem is well-understood: 9 files call `loadGlobalConfig()` at module scope (outside NestJS DI), bypassing the already-correct `AppConfigModule` that provides `ConfigService` globally. The refactoring patterns are straightforward NestJS DI -- async factories with `inject: [ConfigService]`, constructor injection, and removing module-scope side effects.

The secondary objectives -- Zod CORS validation and Docker Compose env substitution -- are mechanical changes. Zod 4.3.6 (installed) supports `.refine()` on schema instances via the classic API. Docker Compose `${VAR:-default}` substitution is native syntax.

The key challenge is `LoggingModule.forGrpc()` and `LoggingModule.forHttp()`, which accept `logLevel` and `logFormat` as direct parameters. Modules currently call `loadGlobalConfig()` at module scope to obtain these values. The fix is to add async variants (`forHttpAsync` / `forGrpcAsync`) that inject ConfigService internally. This is confirmed viable: `nestjs-pino` 4.6.0 provides `LoggerModule.forRootAsync({ inject, useFactory })`.

**Primary recommendation:** Refactor modules to use `ConfigService` injection via async factories. For `LoggingModule`, add async variants (`forHttpAsync` / `forGrpcAsync`) that use `PinoLoggerModule.forRootAsync()` with `inject: [ConfigService]`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Remove all direct `loadGlobalConfig()` calls from module files (*.module.ts). Replace with NestJS `ConfigService` injection. `loadGlobalConfig()` stays ONLY in `main.ts` for bootstrap (before NestJS DI is available) and in `AppConfigModule` (the DI bridge).
- **D-02:** `AppConfigModule` already exists with correct setup (`ConfigModule.forRoot({ load: [loadGlobalConfig], isGlobal: true, cache: true })`). Keep it as-is. It's the single entry point for config into NestJS DI.
- **D-03:** `GrpcClientModule` in foundation calls `loadGlobalConfig()` directly. Refactor to accept config via module options or inject ConfigService.
- **D-04:** `ThrottleModule` in gateway calls `loadGlobalConfig()` directly. Refactor to use ConfigService via async factory.
- **D-05:** `HealthController` in gateway calls `loadGlobalConfig()`. Refactor to inject ConfigService.
- **D-06:** Add `NODE_ENV` field to Zod schema (with default 'development').
- **D-07:** Add `.refine()` to GlobalEnvSchema: if `NODE_ENV === 'production'`, `CORS_ORIGINS` cannot be `*`. Fails at startup with clear error message.
- **D-08:** Update `.env.example` with safe CORS default and comment explaining production requirements.
- **D-09:** Replace hardcoded MinIO credentials in `infra/docker-compose.yml` with `${MINIO_ROOT_USER:-minioadmin}` and `${MINIO_ROOT_PASSWORD:-minioadmin}` env var substitution.

### Claude's Discretion
- Exact ConfigService getter patterns (typed getters vs generic `get()`)
- How to handle `GrpcClientModule` -- module options pattern vs direct injection
- Whether to add other env-aware validations beyond CORS (e.g., require explicit MongoDB URI in production)
- `.env.example` comment formatting

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONF-01 | `loadGlobalConfig()` called once, config available via injectable `ConfigService` in all services | D-01 through D-05: refactor all 9 files to use ConfigService injection; LoggingModule needs async variant; GrpcClientModule needs `registerAsync` with ConfigService |
| CONF-02 | Zod schema rejects `CORS_ORIGINS=*` when `NODE_ENV=production` | D-06, D-07: add NODE_ENV to schema, add `.refine()` cross-field validation |
| CONF-03 | MinIO credentials in docker-compose use `${VAR:-default}` substitution | D-09: two-line change in `infra/docker-compose.yml` lines 190-191 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** NestJS 11, TypeScript, gRPC, MongoDB, RabbitMQ, Redis -- do not change
- **No business logic:** Only structural/infrastructure changes
- **No tests:** Testing is a separate next stage
- **Architecture apps/:** Clean/DDD/Hexagonal
- **Architecture packages/:** Simple utilitarian structure, no DDD
- **GSD workflow:** Use GSD commands for planned work

## Standard Stack

### Core (already installed, no changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/config | 4.0.3 | DI-based config management | Already in use via AppConfigModule; provides ConfigService globally |
| zod | 4.3.6 | Runtime schema validation | Already validates env vars in env-schema.ts; supports `.refine()` in classic API |
| nestjs-pino | 4.6.0 | Structured logging | Already in use; provides `LoggerModule.forRootAsync()` for DI-based config |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/core | 11.x | DI container, module system | Provides Inject, Module, DynamicModule |
| @nestjs/throttler | 6.5.0 | Rate limiting | ThrottleModule already uses forRootAsync |
| @nestjs/terminus | 11.1.1 | Health checks | HealthController already uses it |
| nestjs-cls | 6.2.0 | Request context storage | ClsModule.forRoot() for correlation IDs |

**No new packages required.** All dependencies are already installed.

## Architecture Patterns

### Pattern 1: ConfigService Injection via Async Factory

**What:** Replace `loadGlobalConfig()` calls in module decorators with `ConfigService` injection using NestJS async module patterns.

**When to use:** Any module that needs config values and currently calls `loadGlobalConfig()` at module scope.

**Current anti-pattern (apps/auth/src/auth.module.ts):**
```typescript
// BAD: module-scope side effect
const config = loadGlobalConfig();

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forGrpc(config.LOG_LEVEL, config.LOG_FORMAT),
  ],
})
export class AuthModule {}
```

**Target pattern:**
```typescript
// GOOD: no module-scope side effects
@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forGrpcAsync(),  // reads config internally via ConfigService
  ],
})
export class AuthModule {}
```

### Pattern 2: GrpcClientModule with ConfigService Injection (D-03)

**Current code:**
```typescript
static register(service: GrpcServiceDeclaration): DynamicModule {
  return {
    imports: [
      ClientsModule.registerAsync([{
        name: service.diToken,
        useFactory: () => {
          const config = loadGlobalConfig(); // BAD
          return { transport: Transport.GRPC, options: { ... } };
        },
      }]),
    ],
  };
}
```

**Target pattern:**
```typescript
static register(service: GrpcServiceDeclaration): DynamicModule {
  return {
    imports: [
      ClientsModule.registerAsync([{
        name: service.diToken,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const config = configService.get('') as GlobalEnv;
          // or access individual keys
          return { transport: Transport.GRPC, options: { ... } };
        },
      }]),
    ],
  };
}
```

**Key insight:** `ClientsModule.registerAsync` already supports `inject` array. Since `AppConfigModule` uses `isGlobal: true`, `ConfigService` is available everywhere without explicit imports.

### Pattern 3: ThrottleModule with ConfigService (D-04)

**Current code already uses `forRootAsync` -- just add `inject`:**
```typescript
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return {
      throttlers: [
        {
          name: THROTTLE_TIER.BURST,
          ttl: configService.get('RATE_LIMIT_BURST_TTL'),
          limit: configService.get('RATE_LIMIT_BURST_LIMIT'),
        },
        // ...
      ],
    };
  },
}),
```

### Pattern 4: HealthController with Constructor Injection (D-05)

**Current code has module-scope `loadGlobalConfig()`:**
```typescript
const config = loadGlobalConfig();  // BAD: module scope
const GRPC_SERVICES = [
  { key: SERVICE.auth.id, url: envRecord[SERVICE.auth.envKeys.GRPC_URL!] },
  // ...
];

@Controller(HEALTH.ROUTE)
export class HealthController {
  constructor(private readonly health: HealthCheckService, ...) {}
}
```

**Target pattern:**
```typescript
@Controller(HEALTH.ROUTE)
export class HealthController {
  private readonly grpcServices: Array<{ key: string; url: string }>;

  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly grpc: GRPCHealthIndicator,
    private readonly configService: ConfigService,
  ) {
    const config = this.configService.get('') as GlobalEnv;
    const envRecord = config as unknown as Record<string, string>;
    this.grpcServices = [
      { key: SERVICE.auth.id, url: envRecord[SERVICE.auth.envKeys.GRPC_URL!] },
      // ...
    ];
  }
}
```

### Pattern 5: Zod Cross-Field Validation with .refine() (D-06, D-07)

**Zod 4.3.6 classic API supports `.refine()` as a method on schema instances.**

```typescript
export const GlobalEnvSchema = z.object({
  ...TopologySchema.shape,
  ...InfrastructureSchema.shape,
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // ... existing fields ...
  CORS_ORIGINS: z.string().min(1),
  // ... rest ...
}).refine(
  (data) => !(data.NODE_ENV === 'production' && data.CORS_ORIGINS === '*'),
  {
    message: 'CORS_ORIGINS cannot be "*" in production. Specify explicit origins.',
    path: ['CORS_ORIGINS'],
  }
);
```

**Important Zod 4 note:** `.refine()` returns a refined type, which changes the inferred type. Since `GlobalEnv` is manually defined (not inferred via `z.infer`), this is not an issue -- the manual type just needs `NODE_ENV` added.

### Pattern 6: LoggingModule Async Variants

The biggest refactoring challenge. `LoggingModule.forHttp()` and `LoggingModule.forGrpc()` are static factories accepting `logLevel` and `logFormat` parameters. All 6 service modules pass these from module-scope config.

**Verified:** `nestjs-pino` 4.6.0 provides `LoggerModule.forRootAsync()` with `LoggerModuleAsyncParams` interface supporting `{ inject, useFactory }`. This confirms the async variant approach is viable.

**Recommended approach -- add async variants:**
```typescript
@Module({})
export class LoggingModule {
  // Keep existing static methods for backward compat if needed
  static forHttp(logLevel: LogLevel, logFormat: LogFormat): DynamicModule { ... }
  static forGrpc(logLevel: LogLevel, logFormat: LogFormat): DynamicModule { ... }

  // New async variants that inject ConfigService
  static forHttpAsync(): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            generateId: true,
            idGenerator: (req: Request) =>
              (req.headers[HEADER.CORRELATION_ID] as string) || crypto.randomUUID(),
          },
        }),
        PinoLoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const logLevel = configService.get<string>('LOG_LEVEL') as LogLevel;
            const logFormat = configService.get<string>('LOG_FORMAT') as LogFormat;
            return {
              pinoHttp: {
                level: logLevel,
                transport: resolveTransport(logFormat),
                genReqId: (req) =>
                  ((req as unknown as Request).headers[HEADER.CORRELATION_ID] as string) ||
                  crypto.randomUUID(),
                serializers: { req: (req) => ({ ... }), res: (res) => ({ ... }) },
              },
            };
          },
        }),
      ],
      exports: [ClsModule, PinoLoggerModule],
    };
  }

  static forGrpcAsync(): DynamicModule {
    // Similar pattern but with:
    // - ClsModule interceptor mode (not middleware)
    // - autoLogging: false
    // - gRPC-specific providers (GrpcCorrelationInterceptor, etc.)
  }
}
```

**Key detail:** `ClsModule.forRoot()` does NOT need config values -- it uses `crypto.randomUUID()` and request headers for correlation IDs. So it can remain static. Only `PinoLoggerModule` needs the async pattern.

### Anti-Patterns to Avoid
- **Module-scope function calls:** `const config = loadGlobalConfig()` at file top-level creates side effects during import. Move to constructors or async factories.
- **Accessing ConfigService values before DI is ready:** Don't try to use ConfigService in static `forRoot()` calls -- use `forRootAsync()` with `inject`.
- **Breaking the GlobalEnv type:** When adding `.refine()`, don't use `z.infer<typeof GlobalEnvSchema>` as the type -- the manual `GlobalEnv` type is already defined and must be updated manually.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config DI bridge | Custom provider factory for config | `@nestjs/config` ConfigModule.forRoot with `isGlobal: true` | Already set up in AppConfigModule, handles caching, env parsing |
| Async module config | Manual promise-based config loading | `forRootAsync` / `registerAsync` with `inject: [ConfigService]` | NestJS built-in pattern, handles DI lifecycle correctly |
| Env validation | Custom validation logic | Zod `.refine()` on schema | Runs at parse time, fails with structured error, part of existing validation pipeline |
| Docker secrets | Custom entrypoint scripts | Docker Compose `${VAR:-default}` syntax | Native Docker Compose feature, zero overhead |

## Common Pitfalls

### Pitfall 1: ConfigService Namespace for load Functions
**What goes wrong:** `configService.get('LOG_LEVEL')` may return `undefined` because `loadGlobalConfig()` returns the entire config as a single factory function result, not as separate keys.
**Why it happens:** `@nestjs/config` `ConfigModule.forRoot({ load: [loadGlobalConfig] })` puts the return value of `loadGlobalConfig()` under the key of the function name or as the root config namespace. When a load function does NOT use `registerAs()`, the behavior depends on the return value structure.
**How to avoid:** The implementer MUST verify access pattern at runtime in the first refactored file before proceeding. Test `configService.get('LOG_LEVEL')` and if undefined, try `configService.get('loadGlobalConfig')` to get the full object. According to NestJS docs, when `load` functions return a plain object (no `registerAs`), the properties are merged into the root config namespace -- so `configService.get('LOG_LEVEL')` should work.
**Warning signs:** Getting `undefined` from `configService.get()` despite config being present.

### Pitfall 2: ClsModule.forRoot Does Not Need Async
**What goes wrong:** Attempting to make ClsModule async when it doesn't need config values.
**Why it happens:** Over-engineering the refactor.
**How to avoid:** `ClsModule.forRoot()` configuration uses `crypto.randomUUID()` and request headers -- no env config needed. Keep it static inside the async LoggingModule variant.
**Warning signs:** Unnecessary complexity in the LoggingModule async variants.

### Pitfall 3: Circular Module Dependency
**What goes wrong:** Adding `ConfigService` injection to `GrpcClientModule` (in `packages/foundation`) could create circular dependency if foundation depends on config and config depends on foundation.
**Why it happens:** Monorepo package layering.
**How to avoid:** Check the dependency graph. Currently: `contracts (leaf) -> config -> foundation -> apps`. Foundation already imports from config (`import { loadGlobalConfig } from '@email-platform/config'`), so injecting ConfigService follows the same direction. No circular dependency risk.
**Warning signs:** Turborepo cycle errors during build.

### Pitfall 4: Zod .refine() and .shape Access
**What goes wrong:** After adding `.refine()`, the schema type might prevent `.shape` access if used elsewhere.
**Why it happens:** In Zod 3, `.refine()` wraps the schema in `ZodEffects`. In Zod 4 classic API, `.refine()` returns `this` (same instance via `.check()`), so `.shape` should still work.
**How to avoid:** The current `env-schema.ts` uses `z.object({ ...TopologySchema.shape, ...InfrastructureSchema.shape, ... })` which spreads shapes from sub-schemas. The `.refine()` is added to the final `GlobalEnvSchema`, not to the sub-schemas being spread. This is safe regardless.
**Warning signs:** TypeScript errors about `.shape` not existing on the refined schema.

### Pitfall 5: NODE_ENV Default vs Docker/CI
**What goes wrong:** Adding `NODE_ENV` with `.default('development')` means Docker containers without explicit NODE_ENV silently run as development.
**Why it happens:** Zod defaults fill in missing values.
**How to avoid:** This is actually the desired behavior (safe default). Production deployments MUST set `NODE_ENV=production` explicitly. Document this in `.env.example`.
**Warning signs:** Production deployment missing NODE_ENV and not getting CORS validation.

## Code Examples

### ConfigService Access Pattern
```typescript
// Source: @nestjs/config 4.0.3 type definitions
import { ConfigService } from '@nestjs/config';

// With load: [loadGlobalConfig] (no registerAs), properties are merged into root:
const logLevel = configService.get<string>('LOG_LEVEL');
const corsOrigins = configService.get<string>('CORS_ORIGINS');

// If the above returns undefined, fall back to getting the whole object:
const config = configService.get<GlobalEnv>('loadGlobalConfig');
// Then access: config.LOG_LEVEL
```

### Zod 4 .refine() on Object Schema
```typescript
// Source: Verified against installed zod@4.3.6 classic API
// v4/classic/schemas.d.ts line 38 confirms .refine() method exists on ZodType
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGINS: z.string().min(1),
}).refine(
  (data) => !(data.NODE_ENV === 'production' && data.CORS_ORIGINS === '*'),
  { message: 'CORS_ORIGINS=* is not allowed in production', path: ['CORS_ORIGINS'] }
);
```

### Docker Compose Env Substitution
```yaml
# Source: Docker Compose specification
# ${VARIABLE:-default} syntax: use default if VARIABLE is unset or empty
environment:
  MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
```

### NestJS forRootAsync with ConfigService
```typescript
// Source: @nestjs/throttler, @nestjs/microservices standard patterns
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    throttlers: [{
      name: 'burst',
      ttl: configService.get<number>('RATE_LIMIT_BURST_TTL'),
      limit: configService.get<number>('RATE_LIMIT_BURST_LIMIT'),
    }],
  }),
}),
```

### nestjs-pino forRootAsync
```typescript
// Source: Verified against installed nestjs-pino@4.6.0 type definitions
// LoggerModule.d.ts confirms forRootAsync(params: LoggerModuleAsyncParams)
// LoggerModuleAsyncParams: { useFactory, inject, imports?, providers? }
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

PinoLoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    pinoHttp: {
      level: configService.get<string>('LOG_LEVEL'),
      autoLogging: false,
      transport: resolveTransport(configService.get<string>('LOG_FORMAT') as LogFormat),
    },
  }),
}),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod 3 `.refine()` returns `ZodEffects` | Zod 4 classic `.refine()` returns `this` (same instance) | Zod 4.x | `.shape` access preserved after refine |
| `ConfigModule.forRoot({ envFilePath })` | `ConfigModule.forRoot({ load: [fn], ignoreEnvFile: true })` | Already in use | Config loaded via custom function, not dotenv |

## Open Questions

1. **ConfigService namespace for `load` functions**
   - What we know: `ConfigModule.forRoot({ load: [loadGlobalConfig] })` registers the return value. When a load function returns a plain object (no `registerAs`), NestJS docs say properties are merged into root config namespace.
   - What's unclear: Whether `configService.get('LOG_LEVEL')` works directly or needs namespacing. The `loadGlobalConfig` function returns a flat object, so root-level access should work -- but this needs runtime verification.
   - Recommendation: First implementation task should verify access pattern at runtime before refactoring all files. Test in one service, confirm, then proceed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONF-01 | Config injected via DI, no module-scope loadGlobalConfig | manual smoke | Start service, verify no errors | N/A |
| CONF-02 | CORS=* rejected in production | manual smoke | `NODE_ENV=production CORS_ORIGINS=* node ...` should fail | N/A |
| CONF-03 | MinIO creds use env substitution | manual inspection | Read docker-compose.yml | N/A |

### Sampling Rate
- **Per task commit:** Manual verification (no test framework)
- **Per wave merge:** Start affected services, verify no startup errors
- **Phase gate:** All 3 success criteria from phase description verified manually

### Wave 0 Gaps
- No test framework installed (out of scope per project constraints: "No tests: Testing is a separate next stage")
- Verification is manual smoke testing only

## Sources

### Primary (HIGH confidence)
- Installed `zod@4.3.6` type definitions -- verified `.refine()` method on classic API (v4/classic/schemas.d.ts line 38)
- Installed `@nestjs/config@4.0.3` type definitions -- verified `ConfigService.get()` and `getOrThrow()` signatures
- Installed `nestjs-pino@4.6.0` type definitions -- verified `LoggerModule.forRootAsync()` and `LoggerModuleAsyncParams` with `{ inject, useFactory }` support
- Project source code -- all 9 files to refactor read and analyzed
- Docker Compose `${VAR:-default}` syntax -- stable, well-documented native feature

### Secondary (MEDIUM confidence)
- NestJS `forRootAsync` / `registerAsync` patterns -- based on installed `@nestjs/microservices` and `@nestjs/throttler` type definitions
- ConfigService namespace behavior with `load: [fn]` (no `registerAs`) -- NestJS docs say properties merge into root, but needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed, versions verified, no new dependencies
- Architecture: HIGH -- all async module APIs verified against installed type definitions; all target files read
- Pitfalls: HIGH -- only remaining uncertainty is ConfigService namespace behavior, which is a known pattern with clear verification path

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain, no fast-moving dependencies)
