---
name: composition-over-inheritance
description: Prefer composition (has-a) over inheritance (is-a) for runtime behavior. Codebase-wide rule across apps/ and packages/ — all layers (domain, application, infrastructure, packages). Triggers on inheritance, extends, base class, abstract class, superclass, parent class, is-a, has-a, class hierarchy, polymorphism via inheritance, inherit behavior, shared base, DRY via inheritance. Apply whenever creating or refactoring any class — before writing `extends`, check this skill. Narrow runtime exceptions for Error subclasses, NestJS framework-required bases, Node.js stdlib bases; type-system `extends` (generic constraints, interface-extends-interface, conditional types) is fully exempt. Reference implementation: Phase 999.7.2 (gRPC client composition refactor).
---

# Composition over Inheritance — Prefer `has-a` / `uses-a` over `is-a`

Runtime behavior composition should be achieved by INJECTING collaborators, not by extending an abstract base class. Inheritance is a smell requiring explicit justification — only 4 narrow exception categories are allowed across the entire codebase. This skill is codebase-wide (apps + packages, all layers). It is the universal form of the gRPC-specific rule in `infrastructure-client-layering`.

**Reference implementations:**

- `.planning/phases/999.7.2-grpc-client-composition-refactor-replace-inheritance-with-injected-grpc-caller/` — first canonical example: the 8 gRPC client facades migrated from `extends AbstractGrpcClient<T>` to plain classes receiving an injected `GrpcCaller` helper via the constructor.
- `.planning/phases/999.7.3-grpc-client-promisify-proxy-replace-per-method-wrappers/` — second canonical example: per-method wrapper classes eliminated entirely via a generic `Promisified<T>` Proxy in foundation. Wrapper classes are another form of over-engineering, kindred to inheritance — both create abstractions whose only value is mechanical intermediation. Replace with a single generic primitive in foundation; consumer apps inject the raw protocol interface directly.

## Rule

**Prohibited:** `class Foo extends Bar { ... }` for runtime behavior composition — OUTSIDE the narrow allowed-exception list below.

**Allowed (type-system only — NEVER runtime):**

- Generic constraints: `<T extends X>`, `function f<T extends ZodType>(...)`
- Interface-extends-interface: `interface B extends A { ... }` (interfaces describe shape, have no runtime implementation)
- Conditional types: `T extends U ? X : Y`

These are type-system mechanisms with no runtime inheritance — fully exempt.

**Allowed (narrow runtime exceptions, documented):**

1. **`extends Error` / typed exception hierarchy** — only idiomatic way to create a typed exception in TypeScript/JS. `instanceof` discrimination is load-bearing for error handling; `cause` / discriminated unions do NOT replace it. Example: `class GrpcException extends RpcException`, `class HttpError extends HttpClientError`, `class StorageUploadTooLargeError extends Error`.

2. **`extends <framework-required base>`** — NestJS / other frameworks use reflection or metadata to discover subclasses. Framework requirement, not a design choice. Examples: `BaseRpcExceptionFilter` (NestJS), `HealthIndicator` (`@nestjs/terminus`), `PipeTransform`, `NestInterceptor`, `ExceptionFilter`, `RpcException`. Keep the subclass THIN — delegate real work to injected collaborators.

3. **`extends <Node.js stdlib base>`** — stdlib contracts require subclassing. Examples: `stream.Transform` (must override `_transform`), `EventEmitter` (may subclass for custom events), `Readable`, `Writable`. No composition alternative preserves the stdlib semantics.

4. **[Prospective] `extends <DDD tactical-pattern base>`** — if the project adopts canonical DDD tactical patterns in the future (`AggregateRoot`, `Entity`, `ValueObject`), those base classes become a documented exception. Currently NOT applicable — no such bases exist yet. Listed prospectively.

```typescript
// ALLOWED — typed exception (exception category 1)
class GrpcException extends RpcException {
  constructor(code: status, message: string, public readonly details?: Record<string, unknown>) {
    super({ code, message });
  }
}

// ALLOWED — framework-required base (exception category 2)
@Catch()
export class AllRpcExceptionsFilter extends BaseRpcExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    // NestJS discovers this via reflection — subclass is required
    return super.catch(exception, host);
  }
}

// ALLOWED — stdlib base (exception category 3)
export class SizeCountingTransform extends Transform {
  constructor(private readonly limit: number) { super(); }
  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    // stdlib contract — subclass must override _transform
    this.push(chunk);
    cb();
  }
}

// ALLOWED — type-system generic constraint (not runtime inheritance)
function httpClientProvider<T extends AbstractHttpClient>(opts: Opts<T>): Provider {
  // TypeScript-only — no runtime class hierarchy established
}

// PROHIBITED — runtime behavior composition via inheritance
export class AuthClient extends AbstractGrpcClient<AuthProto.AuthServiceClient> {
  // Hidden state (this.raw, this.call, this.buildMetadata) comes from base.
  // Replace with composition: inject a GrpcCaller helper via constructor.
}

// PROHIBITED — "DRY via inheritance" on business/domain classes
class BaseService {
  protected log(msg: string) { this.logger.info(msg); }
}
class UserService extends BaseService { /* "gets logging for free" */ }
class OrderService extends BaseService { /* "gets logging for free" */ }
// Replace: inject a Logger into each service explicitly.
```

## Why This Rule Exists

Inheritance looks cheap — one `extends` keyword — but it imposes costs that compound across a codebase:

- **Hidden state.** A subclass inherits fields, methods, and lifecycle hooks that are not visible at its declaration site. Readers have to open the base class to understand what the subclass actually is. Composition makes collaborators explicit at the constructor — no spelunking.
- **Tight coupling.** Changes to the base class ripple into every subclass. "One small refactor" becomes N subclass breakages. Composition localizes change to a single helper.
- **Single inheritance.** TypeScript allows one superclass. When a class needs two cross-cutting behaviors (logging + retry, caching + tracing), inheritance forces either a deeper hierarchy or a god-base class. Composition stacks arbitrarily.
- **Test friction.** Mocking an inherited base requires subclassing the mock or rewiring DI. Mocking an injected helper is a one-line substitution with structural typing.
- **Semantic misuse.** "Is-a" rarely holds: `AuthClient is-a AbstractGrpcClient` is false — AuthClient USES a gRPC calling mechanism; it is not a species of it. Composition (`has-a GrpcCaller`) says what is true.

## Decision Tree — Does This `extends` Survive?

```
About to write `class Foo extends Bar`?
|
+-- Is `Bar` a TypeScript generic constraint? (`<T extends X>`)
|   +-- ALLOWED — type system only, no runtime hierarchy
|
+-- Is this `interface B extends A`?
|   +-- ALLOWED — interfaces describe shape, not implementation
|
+-- Is this a conditional type? (T extends U ? X : Y)
|   +-- ALLOWED — type-level computation only
|
+-- Is `Bar` `Error` or part of a typed exception hierarchy?
|   +-- ALLOWED (exception cat. 1) — only idiomatic way to preserve instanceof discrimination
|
+-- Is `Bar` a NestJS framework base?
|   |  (BaseRpcExceptionFilter, HealthIndicator, PipeTransform, NestInterceptor,
|   |   ExceptionFilter, RpcException)
|   +-- ALLOWED (exception cat. 2) — framework uses reflection/metadata
|       Rule: keep the subclass THIN; delegate real work to injected collaborators
|
+-- Is `Bar` a Node.js stdlib base? (Transform, Readable, EventEmitter, ...)
|   +-- ALLOWED (exception cat. 3) — stdlib contract requires subclassing
|
+-- Is `Bar` a DDD tactical-pattern base? (AggregateRoot, Entity, ValueObject)
|   +-- ALLOWED (exception cat. 4, PROSPECTIVE) — not yet applicable; document
|       when clean-ddd-hexagonal adopts these
|
+-- Otherwise — this is runtime behavior composition via inheritance.
    +-- PROHIBITED — use composition:
        +-- Inject the collaborator via constructor (Pattern 1)
        +-- Delegate to a strategy object (Pattern 2)
        +-- Extract the shared code to a plain helper class or factory function
```

## Application by Layer

- **`apps/{service}/src/domain/**`** — pure business logic. Composition by default: entities hold value objects, aggregates delegate to domain services. No framework concerns, no abstract bases. If/when the project adopts canonical DDD tactical patterns, a thin `Entity` base may become exception category 4 — document it when adopted, not before.
- **`apps/{service}/src/application/**`** — use cases and ports. Ports are TypeScript interfaces, not classes — interface-extends-interface is fully exempt. Use cases are plain classes receiving their dependencies via constructor; they never extend a `BaseUseCase`.
- **`apps/{service}/src/infrastructure/**`** — adapters and clients. Composition via injected helpers is the norm. Canonical example: the 8 gRPC clients post-Phase-999.7.2 compose `GrpcCaller` instead of extending `AbstractGrpcClient`. The 4 HTTP clients still extend `AbstractHttpClient` — flagged as refactor-candidates for a future phase.
- **`packages/foundation/**`** — shared mechanisms. Plain helper classes, pure functions, factory functions. Framework-required bases (NestJS interceptors, pipes, filters, health indicators) live here as exception category 2 — keep them thin.

## Pattern 1 — Inject a Helper (Composition) — Canonical 999.7.2 Example

**When:** A class needs a reusable mechanism (logging, metadata construction, retry, transaction, caching). The mechanism is service-agnostic and has its own collaborators (ClsService, config).

**Approach:** Extract the mechanism into a plain helper class. Inject it via constructor. The host class stores the helper in a private readonly field and delegates.

**999.7.2 BEFORE** (inheritance):

```ts
import { AbstractGrpcClient } from '@email-platform/foundation';

export class AuthClient extends AbstractGrpcClient<AuthProto.AuthServiceClient> {
  constructor(grpc: ClientGrpc, cls: ClsService, defaultDeadlineMs: number) {
    super(grpc, cls, SERVICE.auth.grpc.serviceName, defaultDeadlineMs, AuthClient.name);
    // this.raw, this.call, this.buildMetadata, this.logger all come from base — HIDDEN STATE
  }
  login(request: AuthProto.LoginRequest, opts?: CallOpts): Promise<AuthProto.TokenPair> {
    return this.call('login', this.raw.login(request, this.buildMetadata(opts)));
  }
}
```

**999.7.2 AFTER** (composition):

```ts
import type { GrpcCaller, CallOpts } from '@email-platform/foundation';

export class AuthClient {
  // Explicit field — dependency is visible at the type level
  private readonly raw: AuthProto.AuthServiceClient;

  constructor(grpcClient: ClientGrpc, private readonly grpc: GrpcCaller) {
    // Initialization is in user code — no hidden base constructor
    this.raw = grpcClient.getService<AuthProto.AuthServiceClient>(SERVICE.auth.grpc.serviceName);
  }

  login(req: AuthProto.LoginRequest, opts?: CallOpts): Promise<AuthProto.TokenPair> {
    // Delegation is explicit — no `this.call` mystery
    return this.grpc.call('login', opts, (m) => this.raw.login(req, m));
  }
}
```

**Diff summary:**

- Removed: `extends AbstractGrpcClient<T>` + `super(...)` + inherited `this.raw` / `this.call` / `this.buildMetadata`
- Added: explicit `private readonly raw: T` field + `private readonly grpc: GrpcCaller` via DI + explicit `this.raw = grpcClient.getService<T>(...)` in constructor
- Method body: `this.call(m, this.raw.m(req, this.buildMetadata(opts)))` → `this.grpc.call(m, opts, (m) => this.raw.m(req, m))`

**Benefits:**

- Explicit dependencies at the constructor — no hidden inherited state
- Trivially testable — pass a mock `GrpcCaller` in one line (structural typing)
- Helper (`GrpcCaller`) lives in a single file — extension points (tracing, retry, circuit breaker) go there without touching 8 client files
- No lifecycle hooks leak into domain classes (no `OnModuleInit` to fight with)

## Pattern 2 — Delegate to a Strategy / Collaborator (General Shape)

**When:** Multiple classes need a behavior that may vary independently, or a single class needs one of several interchangeable behaviors.

**Approach:** Define a port interface (or plain type). Provide one or more adapter implementations. Host class receives the port via constructor and calls it.

```ts
// Port (plain type — interface is fine too)
type RetryPolicy = {
  shouldRetry(error: unknown, attempt: number): boolean;
  backoffMs(attempt: number): number;
};

// Adapters
const EXPONENTIAL_BACKOFF: RetryPolicy = {
  shouldRetry: (err, attempt) => attempt < 3 && isRetryable(err),
  backoffMs: (attempt) => 100 * 2 ** attempt,
};

// Host — composition, not `extends RetryableService`
class ApiClient {
  constructor(private readonly http: HttpPort, private readonly retry: RetryPolicy) {}
  async call<T>(op: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await op(); }
      catch (err) {
        if (!this.retry.shouldRetry(err, attempt)) throw err;
        await sleep(this.retry.backoffMs(attempt));
      }
    }
  }
}
```

Swapping strategies is a constructor-arg change, not a class-hierarchy migration.

## Anti-Patterns

```typescript
// ANTI-PATTERN 1 — "DRY via inheritance" on business classes
abstract class BaseService {
  protected logger = PinoLogger.root.child({ context: this.constructor.name });
  protected log(msg: string) { this.logger.info(msg); }
}
class UserService extends BaseService { }   // ← NO: inject a Logger instead
class OrderService extends BaseService { }

// ANTI-PATTERN 2 — Extending for a single added field
class TimeoutError extends Error { }         // ← OK (exception cat. 1)
class VerboseTimeoutError extends TimeoutError {
  constructor(msg: string, public readonly details: unknown) { super(msg); }
}  // ← MAYBE: if the hierarchy supports instanceof discrimination, allowed. If
   //          just to add a field, prefer composition (TimeoutError with details field directly).

// ANTI-PATTERN 3 — Multi-level deep hierarchy
class A { /* ... */ }
class B extends A { /* ... */ }
class C extends B { /* ... */ }
class D extends C { /* ... */ }   // ← Inheritance depth > 2 almost always indicates a
                                  //    design bug. Refactor to composition.

// ANTI-PATTERN 4 — Extending a "Base" class just to inject dependencies
class BaseClient {
  constructor(protected readonly logger: Logger, protected readonly cls: ClsService) {}
}
class AuthClient extends BaseClient { }   // ← NO: inject Logger + ClsService directly
class SenderClient extends BaseClient { } //    into each concrete class (or into a
                                          //    plain helper and inject the helper)

// ANTI-PATTERN 5 — Using `extends` for configuration composition
abstract class ConfiguredService {
  abstract readonly timeout: number;
  abstract readonly retries: number;
}
class FastService extends ConfiguredService {
  readonly timeout = 100;
  readonly retries = 1;
}
// ← NO: use a plain config object passed to the constructor.

// ANTI-PATTERN 6 — Client facade extending abstract infrastructure base (canonical 999.7.2 target)
export class AuthClient extends AbstractGrpcClient<AuthProto.AuthServiceClient> { /* ... */ }
// Replace with composition — inject a GrpcCaller helper:
export class AuthClient {
  constructor(grpcClient: ClientGrpc, private readonly grpc: GrpcCaller) { /* ... */ }
}
```

## When to Apply This Skill

- **Writing a new class.** Before typing `extends`, walk the Decision Tree.
- **Reviewing a PR that adds `extends`.** Ask: which exception category is this? If none fit, request composition.
- **Refactoring pain points.** If tests are hard to write because the class inherits hidden state, OR if a change to a base class breaks multiple subclasses, OR if an inheritance hierarchy is > 2 levels deep — that's the smell this skill addresses.
- **Designing a new abstract base class** in `packages/foundation/`. Ask: could this be a plain helper that callers inject, instead of a base class callers extend? If yes (most cases), prefer that.
- **Adapting a framework primitive** (NestJS filter/interceptor/pipe). Exception category 2 applies — extend, but keep the subclass thin.
- **Adding a new typed exception.** Exception category 1 applies — extend `Error` or an existing typed exception.
- **Creating a stream processor.** Exception category 3 applies — extend `stream.Transform`.

**When NOT to use this skill:** Ignoring it does NOT create a production bug immediately; it creates a debt smell. But the whole codebase is expected to align with the rule — stale inheritance found in reviews should be filed as refactor-candidate work (e.g., the 4 HTTP clients in `apps/*/infrastructure/clients/{telegram,cloudfn,appstorespy,http-smoke}` that still extend `AbstractHttpClient` — flagged as pending an HTTP composition phase analogous to 999.7.2).

## Enforcement

Codebase-wide enforcement of this rule is currently partial and staged:

- **ESLint Override 6** in `.eslintrc.js` enforces `no-restricted-syntax: ClassDeclaration[superClass]` on the 8 enumerated gRPC client paths (`apps/*/src/infrastructure/clients/{auth,sender,parser,audience,notifier}/*.client.ts` + 3 cross-service paths). Added in Phase 999.7.2 Plan 04. Any future `extends` on those paths fails lint.
- **Skill activation** on trigger keywords (`extends`, `inheritance`, `base class`, `abstract class`, `superclass`) covers the rest of the codebase during authoring and review — no mechanical rule, but the skill loads automatically when the relevant keywords appear.
- **PR review.** Reviewers use the Decision Tree above to classify every new `extends`. Non-matching exceptions are rejected or filed as refactor-candidates.

Broader mechanical enforcement (workspace-wide `no-restricted-syntax`) is deferred until the 4 HTTP clients migrate — today that rule would fire on legitimate infrastructure code pending refactor.

## Known Exceptions in Codebase (Inventory Snapshot — Phase 999.7.2, 2026-04-17)

Legitimate `extends` usages across the codebase — classification of the 23 `extends` hits catalogued in RESEARCH Target 7:

| # | File | `extends` target | Category | Disposition |
|---|------|------------------|----------|-------------|
| 1-8 | `apps/*/src/infrastructure/clients/*/*.client.ts` (8 gRPC clients) | `AbstractGrpcClient` | — | **this-phase target** (eliminated by 999.7.2) |
| 9-12 | 4 HTTP clients: `apps/notifier/.../telegram/telegram.client.ts`, `apps/sender/.../cloud-functions/cloudfn.client.ts`, `apps/parser/.../appstorespy/appstorespy.client.ts`, `apps/gateway/.../http-smoke/http-smoke.client.ts` | `AbstractHttpClient` | — | **refactor-candidate** (future HTTP composition phase analogous to 999.7.2) |
| 13 | `packages/foundation/src/external/http/client/abstract-http.client.ts` | (abstract base itself — no superclass) | N/A | base class itself — refactored away alongside HTTP composition phase |
| 14 | `packages/foundation/src/external/errors/rpc-exception.filter.ts` (`AllRpcExceptionsFilter`) | `BaseRpcExceptionFilter` | 2 | NestJS framework base — discovered via reflection |
| 15 | `packages/foundation/src/external/errors/grpc-exceptions.ts` (`GrpcException`) | `RpcException` | 1 | typed exception hierarchy base |
| 16 | `packages/foundation/src/external/errors/grpc-exceptions.ts` (7 concrete: `NotFound` / `InvalidArgument` / `AlreadyExists` / `PermissionDenied` / `Unauthenticated` / `Internal` / `Unavailable`) | `GrpcException` | 1 | typed exception hierarchy |
| 17-21 | 5 HTTP error classes: `HttpClientError`, `HttpError`, `TimeoutError`, `NetworkError`, `CircuitOpenError` in `packages/foundation/src/external/http/errors/*.ts` | `Error` / `HttpClientError` | 1 | typed exception hierarchy |
| 22 | `packages/foundation/src/external/storage/public/size-counting.transform.ts` (`SizeCountingTransform`) | `stream.Transform` | 3 | Node.js stdlib — subclass required by stdlib contract |
| 23 | `packages/foundation/src/external/storage/public/upload-too-large.error.ts` (`StorageUploadTooLargeError`) | `Error` | 1 | typed exception |

**Type-system-only `extends` (fully exempt, not counted above):**

- `<T extends AbstractHttpClient>` in `http-client.provider.ts`
- `TArgs extends unknown[]` in `opossum-circuit-breaker.adapter.ts` + `circuit-breaker.port.ts`
- `<T extends object>` in `define-grpc-client.ts`
- `loadConfig<T extends z.ZodType>` in `config-loader.ts`
- Additional generic constraints in `compose.ts`, `define-service.ts`, `services.ts`
- Interface-extends-interface usages across contracts and port declarations

**Summary:** 11 legitimate runtime `extends` (categories 1-3) + 4 refactor-candidate HTTP clients + 1 abstract base pending deletion alongside HTTP refactor. Post-999.7.2, the 8 gRPC clients move out of the `extends` inventory entirely.

## See Also

- `.agents/skills/infrastructure-client-layering/SKILL.md` — concretization of this rule for infra-client facades (catalog / foundation / apps three-layer rule). Reference when designing a new infra-client.
- `.agents/skills/clean-ddd-hexagonal/SKILL.md` — `apps/` Clean/DDD/Hexagonal architecture; DDD tactical-pattern bases (`AggregateRoot` / `Entity` / `ValueObject`) — when/if adopted — add a documented exception to this skill.
- `.agents/skills/no-magic-values/SKILL.md` — related rule: prefer named constants over magic literals. Often applies alongside composition (helpers store constants that were previously hardcoded in base classes).
- `.agents/skills/branching-patterns/SKILL.md` — related rule: prefer polymorphism via composition (Record dispatch / Map fallback / canHandle chain) over `switch/case` or `if/else` chains. Complementary to this skill — both aim at replacing behavior-via-inheritance with behavior-via-collaboration.
- `.planning/phases/999.7.2-grpc-client-composition-refactor-replace-inheritance-with-injected-grpc-caller/` — canonical reference implementation: `AbstractGrpcClient` inheritance → injected `GrpcCaller` composition. 8 files migrated; skill rationale distilled from the retrospective.
- `.planning/phases/999.7.3-grpc-client-promisify-proxy-replace-per-method-wrappers/` — second canonical reference: per-method `*.client.ts` wrapper classes (introduced as the composition target by 999.7.2) eliminated via generic `Promisified<T>` Proxy in foundation. Demonstrates that wrapper classes are a sibling form of over-engineering to inheritance — both create abstractions whose only value is mechanical mediation. Replace with a generic Proxy + TypeScript mapped type — single foundation primitive, zero apps-level boilerplate.
- `apps/gateway/src/infrastructure/clients/auth/auth.client.ts` — canonical post-refactor source showing the composition shape.
