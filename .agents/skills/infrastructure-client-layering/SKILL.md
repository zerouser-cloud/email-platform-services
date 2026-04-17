---
name: infrastructure-client-layering
description: Architectural rule for placing infrastructure-client artifacts (modules, factories, DI tokens, abstract base classes) across catalog/foundation/apps layers. Triggers on creating or refactoring HTTP clients, gRPC clients, RabbitMQ producers/consumers, Redis adapters, S3 adapters, DB/ORM modules, or any other infra-client. Apply whenever a new infra-client mechanism is introduced or an existing one is refactored. Reference implementation: Phase 999.7.x (gRPC).
---

# Infrastructure Client Layering

Universal rule for distributing infrastructure-client artifacts (NestJS modules, factories, DI tokens, abstract bases) across the three project layers. Establishes consistent boundaries so new infra-clients (HTTP, RabbitMQ, Redis, S3, DB/ORM, future) follow the same architectural principle.

**Reference implementation:** `.planning/phases/999.7-*` and `.planning/phases/999.7.1-*` (gRPC client modules). When in doubt — read the gRPC pattern, then apply with adjustments for the new infra's specifics.

## The Three-Layer Rule

```
catalog (packages/config)            ─→  IDENTITY ONLY
  ├─ what a service IS (id, public DI token)
  └─ transport-agnostic (no gRPC/HTTP/RMQ specifics)

foundation (packages/foundation)     ─→  MECHANISMS ONLY
  ├─ abstract base classes (AbstractGrpcClient, AbstractHttpClient, ...)
  ├─ factories (defineGrpcClient, httpClientProvider, ...)
  ├─ shared health indicators, interceptors, error normalizers
  └─ does NOT know about specific services (no `auth`, no `sender` references)

apps/{service}/infrastructure/...    ─→  ASSEMBLY + NAMING
  ├─ concrete client classes (typed facades extending abstract bases)
  ├─ NestJS modules wiring catalog identity + foundation mechanism
  └─ re-exports named DI tokens for local consumer ergonomics
```

**Each layer knows only itself and the layer below.** Catalog never imports foundation. Foundation never references specific services. Apps imports both.

## Token Classification

Every infra-client deals with tokens of distinct natures. Place each one according to its nature, not by reflex copy-paste.

| Token kind | Example | Where it lives | Why |
|---|---|---|---|
| **Public service identity** | `SERVICE.auth.diToken` | catalog | Universal contract — every consumer in every app names the service the same way |
| **Transport plumbing** | gRPC channel token, HTTP base-URL holder, RMQ connection token | derived in foundation, named in apps | Transport-specific, not part of public service identity |
| **Single-instance infra** (one per service) | `DRIZZLE`, `S3_CLIENT`, `CACHE_SERVICE` | foundation constants | One global symbol per service — no per-instance variation |
| **Per-instance health indicator** | `*_GRPC_HEALTH`, future `*_RMQ_HEALTH` | derived in foundation, named in apps | Tied to a specific channel/connection instance |

**Rule:** transport tokens are NEVER added to catalog. The catalog stays identity-only. If you find yourself writing `SERVICE.auth.grpcToken` or `SERVICE.auth.httpToken` — stop, that's a layer violation.

## Decision Tree -- Adding a New Infra-Client

```
New infra-client mechanism (HTTP/RMQ/Redis/S3/DB/...)?
|
+-- Step 1: How many instances per service?
|   +-- ONE (e.g., DB pool, Redis client, S3 client)
|   |   |
|   |   +-- Token in foundation as exported constant
|   |       (Symbol('TOKEN_NAME') in {infra}.constants.ts)
|   |   +-- Module in foundation, exposed via forRootAsync()
|   |   +-- Apps just import the module — no per-app naming needed
|   |
|   +-- MANY (e.g., gRPC clients to multiple services, multiple HTTP APIs)
|       |
|       +-- Step 2: Is there a catalog identity for each instance?
|           |
|           +-- YES (e.g., gRPC: SERVICE.auth, SERVICE.sender)
|           |   |
|           |   +-- Foundation provides MECHANISM (factory) that
|           |   |   derives transport tokens from catalog id
|           |   |   (Symbol.for(`${service.id}_<KIND>`))
|           |   +-- Per-app module captures factory result and
|           |   |   re-exports named tokens for local consumers
|           |   +-- Catalog is the ONLY source of identity strings
|           |
|           +-- NO (e.g., HTTP: external 3rd-party APIs without catalog)
|               |
|               +-- Per-app constants file declares tokens explicitly
|               +-- Per-app module wires foundation factory with those tokens
|               +-- No catalog leak — these are app-private identifiers
|
+-- Step 3: Concrete client class
    +-- Lives in apps/{service}/infrastructure/clients/{name}/
    +-- Extends abstract base from foundation (AbstractGrpcClient,
    |   AbstractHttpClient, ...)
    +-- NO @Injectable / @Inject decorators when wired via useFactory
    |   (decorators are dead code under useFactory and leak wiring
    |   concerns into the domain class)
    +-- Receives dependencies as positional constructor params
```

## Application by Infra Type

### gRPC (reference, Phase 999.7.x)

- **Catalog:** `SERVICE.auth = { id, diToken, grpc, envKeys }` — identity only.
- **Foundation:** `defineGrpcClient(opts, build)` — derives `grpcToken = Symbol.for('${service.id}_CLIENT_GRPC')` and `healthToken = Symbol.for('${service.id}_GRPC_HEALTH')`. Returns them in build result.
- **Apps:** `auth-client.module.ts` calls `defineGrpcClient`, re-exports `AUTH_GRPC_HEALTH = grpc.healthToken` for `health.controller`.
- **Client class:** `AuthClient extends AbstractGrpcClient` — no NestJS decorators.

### HTTP (current legacy, planned refactor)

- **Catalog:** none — external APIs (Telegram, AppStoreSpy, CloudFn) have no service identity in catalog.
- **Foundation:** `httpClientProvider(opts, build)` — generic factory. Provides `AbstractHttpClient`, error normalizers, retry/circuit-breaker.
- **Apps:** per-API constants (`TELEGRAM_CLIENT`, `CLOUDFN_CLIENT`) — explicit because no catalog source.
- **Client class:** extends `AbstractHttpClient`, no decorators.

When refactoring HTTP: keep per-app token strategy (no catalog source), but apply decorator-cleanup and ensure foundation factory derives ALL plumbing it can from opts.

### RabbitMQ (future)

- **Catalog decision:** if there will be a queue-catalog (e.g., `QUEUE.parserBatchReady = { name, exchange, routingKey }`) → follow gRPC pattern (derive tokens from catalog id). If queues are declared per-service ad-hoc → follow HTTP pattern (per-app constants).
- **Foundation:** `defineRabbitConsumer({...}, build)` and `defineRabbitProducer(...)` factories. Derive connection/channel tokens from queue identity (or accept opts).
- **Apps:** consumer/producer modules wire factory + re-export named tokens.

### Redis / S3 / DB+ORM (single-instance)

- **Catalog:** none — single-instance infra, no per-service identity needed.
- **Foundation:** module + constants exported directly (`CACHE_SERVICE`, `S3_CLIENT`, `DRIZZLE`).
- **Apps:** `imports: [CacheModule.forRootAsync(...)]`, then `@Inject(CACHE_SERVICE)` directly — no per-app constants.

When refactoring these: ensure foundation module exposes `forRootAsync` cleanly; verify there's no per-app constants duplication (single-instance = no need for naming layer in apps).

## Required for Every New Infra-Client

```
1. Foundation has the abstract base class and the factory ─→ NEVER duplicate logic per service
2. Catalog stays identity-only                            ─→ NO transport tokens in SERVICE.*
3. Apps assemble + name (only when MANY instances exist)  ─→ Single-instance = no apps-level naming
4. Client class is decorator-free under useFactory        ─→ No @Injectable / @Inject leakage
5. Re-export named tokens in module file                  ─→ NEVER export the raw factory-result object
6. Token symbols use Symbol.for() when derived            ─→ Same key everywhere = same symbol
7. Document the new infra in this skill                   ─→ Add a section under "Application by Infra Type"
```

## Anti-Patterns

```typescript
// ANTI-PATTERN 1 — Transport token in catalog
SERVICE.auth = {
  id: 'AUTH',
  diToken: Symbol.for('AUTH_CLIENT'),
  grpcToken: Symbol.for('AUTH_GRPC'),  // ← LEAK: catalog must stay transport-agnostic
};

// ANTI-PATTERN 2 — Foundation knows specific services
// packages/foundation/.../auth-client.module.ts            ← LEAK: foundation must stay agnostic
export class AuthClientModule { ... }

// ANTI-PATTERN 3 — Decorator wiring on factory-built class
@Injectable()
export class AuthClient extends AbstractGrpcClient {
  constructor(@Inject(AUTH_CLIENT_GRPC) grpc: ClientGrpc, ...) { }
  // ← Dead code under useFactory; leaks DI wiring into domain class
}

// ANTI-PATTERN 4 — Exporting raw factory result
export const authGrpc = defineGrpcClient(...);
// ← Exposes imports/providers/exports — consumer can bypass module.forRoot()

// ANTI-PATTERN 5 — Per-app constants for single-instance infra
// apps/sender/.../redis-client.constants.ts               ← REDUNDANT
export const SENDER_REDIS = Symbol('SENDER_REDIS');
// Single-instance: just @Inject(CACHE_SERVICE) from foundation directly

// ANTI-PATTERN 6 — Hardcoded token strings outside Symbol.for() pattern
@Inject('AUTH_CLIENT')                                    // ← STRING TOKEN BAD
@Inject(Symbol.for('AUTH_CLIENT'))                        // ← UNNAMED USE BAD
@Inject(SERVICE.auth.diToken)                             // ← OK (named, from catalog)
@Inject(AUTH_GRPC_HEALTH)                                 // ← OK (named, re-exported from module)
```

## When to Apply This Skill

- Creating a new infra-client module (HTTP API, message queue, cache, storage)
- Refactoring an existing infra-client to a foundation factory
- Reviewing a PR that adds infra wiring
- Designing a new abstract base class in foundation
- Resolving "where should this token live?" questions

When the answer is unclear, follow the decision tree top-to-bottom. If the new infra has nuances not covered (streaming, sharding, multi-region) — extend this skill with a new section under "Application by Infra Type" rather than improvising.

## See Also

- `.agents/skills/no-magic-values/SKILL.md` — DI tokens use `Symbol()`/`Symbol.for()`, not strings
- `.agents/skills/clean-ddd-hexagonal/SKILL.md` — apps/ Clean/Hexagonal architecture
- `.agents/skills/twelve-factor/SKILL.md` — config from env via `@email-platform/config`, not direct `process.env`
- `.planning/phases/999.7-grpc-client-modules-foundation-infrastructure-layer-backlog/` — reference: gRPC layer migration
- `.planning/phases/999.7.1-grpc-client-tokens-refactor-generate-inside-definegrpcclient/` — reference: token derivation pattern
