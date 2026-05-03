---
name: composition-over-inheritance
description: Prefer composition (has-a) over inheritance (is-a) for runtime behavior. Codebase-wide rule across apps/ and packages/ — all layers (domain, application, infrastructure, packages). Triggers on inheritance, extends, base class, abstract class, superclass, parent class, is-a, has-a, class hierarchy, polymorphism via inheritance, inherit behavior, shared base, DRY via inheritance. Apply whenever creating or refactoring any class — before writing `extends`, check this skill. Narrow runtime exceptions for Error subclasses, NestJS framework-required bases, Node.js stdlib bases; type-system `extends` (generic constraints, interface-extends-interface, conditional types) is fully exempt. Reference phases (for historical context and worked examples): `.planning/phases/999.7.2-*/` (the initial composition refactor — introduces an injected helper) and `.planning/phases/999.7.3-*/` (the wrapper-class elimination — introduces a generic promisified proxy).
---

# Composition over Inheritance — Prefer `has-a` / `uses-a` over `is-a`

## Principles, Not Inventory

This skill describes **timeless principles** for preferring composition over inheritance. It does **not** describe the current state of the codebase. Do **not** add inventory to this file: specific file paths beyond stable workspace roots (`apps/`, `packages/`), port numbers, production class or function names, enumerated counts of files / services / overrides / lines. For current-state lookups, link to a tracked configuration file by **role** (e.g., "the project ESLint config"), link to the enclosing **directory** (not a file), or provide a `grep` command the reader runs on demand.

Author-facing rule: if you feel the urge to write a specific file path, a real class name, or a count, stop and apply the **rename test** — would this sentence still be true if that file / class / number were renamed or changed tomorrow? If no, rewrite the sentence until it is.

Runtime behavior composition should be achieved by INJECTING collaborators, not by extending an abstract base class. Inheritance is a smell requiring explicit justification — only 4 narrow exception categories are allowed across the entire codebase. This skill is codebase-wide (apps + packages, all layers). It is the universal form of the gRPC-specific rule in `infrastructure-client-layering`.

**Reference phases** (planning directory prefixes, stable per D-8 "top-level workspace paths"):

- `.planning/phases/999.7.2-*/` — the initial composition refactor: gRPC client facades migrated from inheritance to composition by injecting a helper that owns the call mechanism.
- `.planning/phases/999.7.3-*/` — the wrapper-class elimination: per-method wrapper classes replaced by a generic promisified-proxy primitive in foundation. Wrapper classes are another form of over-engineering kindred to inheritance — both create abstractions whose only value is mechanical intermediation. Replace with a single generic primitive; consumer apps inject the raw protocol interface directly.

Open those phase directories for the canonical project-specific reference implementations.

## Rule

**Prohibited:** `class Foo extends Bar { ... }` for runtime behavior composition — OUTSIDE the narrow allowed-exception list below.

**Allowed (type-system only — NEVER runtime):**

- Generic constraints: `<T extends X>`, `function f<T extends ZodType>(...)`
- Interface-extends-interface: `interface B extends A { ... }` (interfaces describe shape, have no runtime implementation)
- Conditional types: `T extends U ? X : Y`

These are type-system mechanisms with no runtime inheritance — fully exempt.

**Allowed (narrow runtime exceptions, documented):**

1. **`extends Error` / typed exception hierarchy** — only idiomatic way to create a typed exception in TypeScript/JS. `instanceof` discrimination is load-bearing for error handling; `cause` / discriminated unions do NOT replace it.

2. **`extends <framework-required base>`** — NestJS / other frameworks use reflection or metadata to discover subclasses. Framework requirement, not a design choice. Common examples from NestJS / `@nestjs/terminus`: `BaseRpcExceptionFilter`, `HealthIndicator`, `PipeTransform`, `NestInterceptor`, `ExceptionFilter`, `RpcException`. Keep the subclass THIN — delegate real work to injected collaborators.

3. **`extends <Node.js stdlib base>`** — stdlib contracts require subclassing. Examples: `stream.Transform` (must override `_transform`), `EventEmitter` (may subclass for custom events), `Readable`, `Writable`. No composition alternative preserves the stdlib semantics.

4. **[Prospective] `extends <DDD tactical-pattern base>`** — if the project adopts canonical DDD tactical patterns in the future (`AggregateRoot`, `Entity`, `ValueObject`), those base classes become a documented exception. Listed prospectively; this is a future exception, not a present one.

```typescript
// ALLOWED — typed exception (exception category 1)
class FooException extends RpcException {
  constructor(code: status, message: string, public readonly details?: Record<string, unknown>) {
    super({ code, message });
  }
}

// ALLOWED — framework-required base (exception category 2)
@Catch()
export class FooExceptionsFilter extends BaseRpcExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    // NestJS discovers this via reflection — subclass is required
    return super.catch(exception, host);
  }
}

// ALLOWED — stdlib base (exception category 3)
export class BazCountingTransform extends Transform {
  constructor(private readonly limit: number) { super(); }
  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    // stdlib contract — subclass must override _transform
    this.push(chunk);
    cb();
  }
}

// ALLOWED — type-system generic constraint (not runtime inheritance)
function fooProvider<T extends HelperBase>(opts: Opts<T>): Provider {
  // TypeScript-only — no runtime class hierarchy established
}

// PROHIBITED — runtime behavior composition via inheritance
export class FooClient extends FooClientBase<FooProto.FooServiceClient> {
  // Hidden state (this.raw, this.call, this.meta) comes from base.
  // Replace with composition: inject a helper via constructor.
}
```

## Why This Rule Exists

Inheritance looks cheap — one `extends` keyword — but it imposes costs that compound across a codebase:

- **Hidden state.** A subclass inherits fields, methods, and lifecycle hooks that are not visible at its declaration site. Readers have to open the base class to understand what the subclass actually is. Composition makes collaborators explicit at the constructor — no spelunking.
- **Tight coupling.** Changes to the base class ripple into every subclass. "One small refactor" becomes N subclass breakages. Composition localizes change to a single helper.
- **Single inheritance.** TypeScript allows one superclass. When a class needs two cross-cutting behaviors (logging + retry, caching + tracing), inheritance forces either a deeper hierarchy or a god-base class. Composition stacks arbitrarily.
- **Test friction.** Mocking an inherited base requires subclassing the mock or rewiring DI. Mocking an injected helper is a one-line substitution with structural typing.
- **Semantic misuse.** "Is-a" rarely holds: a fictional `FooClient is-a FooClientBase` is false — `FooClient` USES a calling mechanism; it is not a species of it. Composition (`has-a helper`) says what is true.

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
- **`apps/{service}/src/infrastructure/**`** — adapters and clients. Composition via injected helpers is the norm (per the `999.7.x` reference phases above). Some adapter clients may still extend a foundation abstract base pending migration. For the current inheritance inventory, run `grep -rn 'extends ' apps/ packages/ --include='*.ts' | grep -v node_modules` and walk each hit through the Decision Tree; legitimate hits map to exception categories 1-4, the rest are refactor-candidates.
- **`packages/foundation/**`** — shared mechanisms. Plain helper classes, pure functions, factory functions. Framework-required bases (NestJS interceptors, pipes, filters, health indicators) live here as exception category 2 — keep them thin.

## Pattern 1 — Inject a Helper (Composition)

**When:** A class needs a reusable mechanism (logging, metadata construction, retry, transaction, caching). The mechanism is service-agnostic and has its own collaborators (context service, config).

**Approach:** Extract the mechanism into a plain helper class. Inject it via constructor. The host class stores the helper in a private readonly field and delegates.

**BEFORE** (inheritance — anti-pattern):

```ts
export class FooClient extends FooClientBase<FooProto.FooServiceClient> {
  constructor(rpc: ClientRpc, ctx: CtxService, defaultTimeoutMs: number) {
    super(rpc, ctx, SERVICE.foo.rpc.serviceName, defaultTimeoutMs, FooClient.name);
    // this.raw, this.call, this.buildContext, this.logger all come from base — HIDDEN STATE
  }
  doFoo(req: FooProto.DoFooRequest, opts?: CallOpts): Promise<FooProto.FooResult> {
    return this.call('doFoo', this.raw.doFoo(req, this.buildContext(opts)));
  }
}
```

**AFTER** (composition):

```ts
export class FooClient {
  // Explicit field — dependency is visible at the type level
  private readonly raw: FooProto.FooServiceClient;

  constructor(rpcClient: ClientRpc, private readonly helper: RpcHelper) {
    // Initialization is in user code — no hidden base constructor
    this.raw = rpcClient.getService<FooProto.FooServiceClient>(SERVICE.foo.rpc.serviceName);
  }

  doFoo(req: FooProto.DoFooRequest, opts?: CallOpts): Promise<FooProto.FooResult> {
    // Delegation is explicit — no `this.call` mystery
    return this.helper.call('doFoo', opts, (m) => this.raw.doFoo(req, m));
  }
}
```

**Diff summary:**

- Removed: `extends FooClientBase<T>` + `super(...)` + inherited `this.raw` / `this.call` / `this.buildContext`
- Added: explicit `private readonly raw: T` field + `private readonly helper: RpcHelper` via DI + explicit `this.raw = rpcClient.getService<T>(...)` in constructor
- Method body: `this.call(m, this.raw.m(req, this.buildContext(opts)))` → `this.helper.call(m, opts, (m) => this.raw.m(req, m))`

**Benefits:**

- Explicit dependencies at the constructor — no hidden inherited state
- Trivially testable — pass a mock helper in one line (structural typing)
- Helper lives in a single file — extension points (tracing, retry, circuit breaker) go there without touching every client
- No lifecycle hooks leak into domain classes (no `OnModuleInit` to fight with)

**Evolution note.** This project's canonical reference implementations for this transition live under `.planning/phases/999.7.2-*/` (the initial composition refactor — introduces the helper) and `.planning/phases/999.7.3-*/` (the wrapper-class elimination — introduces a generic proxy that removes the need for per-method wrapper classes entirely). Read those phases for the current project-specific shape; the example above teaches the behavioural pattern abstractly.

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
class FooClient extends BaseClient { }   // ← NO: inject Logger + ClsService directly
class BarClient extends BaseClient { }   //    into each concrete class (or into a
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

// ANTI-PATTERN 6 — Client facade extending abstract infrastructure base
export class FooClient extends FooClientBase<FooProto.FooServiceClient> { /* ... */ }
// Replace with composition — inject a helper:
export class FooClient {
  constructor(rpcClient: ClientRpc, private readonly helper: RpcHelper) { /* ... */ }
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

**When NOT to use this skill:** Ignoring it does NOT create a production bug immediately; it creates a debt smell. But the whole codebase is expected to align with the rule — stale inheritance found in reviews should be filed as refactor-candidate work. Run `grep -rn 'extends ' apps/ packages/ --include='*.ts' | grep -v node_modules` to see the current inventory; each hit classifies against the Decision Tree.

## Enforcement

Codebase-wide enforcement of this rule is staged through two mechanisms:

- The project's ESLint configuration (currently `.eslintrc.js` at the repository root) contains a `no-restricted-syntax` rule that forbids `extends` on the primary-adapter-client paths. For the current glob set and rule shape, read that file. The config is the single source of truth — if paths or globs change, the config is the only place that needs updating.
- Skill activation on trigger keywords (`extends`, `inheritance`, `base class`, `abstract class`, `superclass`) covers authoring and review workflows across the rest of the codebase.

The ESLint guard is retained as a regression trap: if a class using `extends` is reintroduced on the guarded paths, the rule fires on the `extends` line at lint time. A zero-match state for the guard is the intended steady-state, not a sign the guard is dead code.

Broader mechanical enforcement (workspace-wide `no-restricted-syntax`) is deferred until legitimate exception-category hits on other paths are driven to zero — today such a rule would fire on legitimate infrastructure code pending refactor.

## Finding the Current `extends` Census

To see the current runtime `extends` usages across the codebase classified against the Decision Tree, run:

```bash
grep -rn 'extends ' apps/ packages/ --include='*.ts' | grep -v node_modules
```

Walk each hit through the Decision Tree — legitimate hits map to exception categories 1-4; the rest are refactor-candidates.

**Type-system-only `extends`** (generic constraints, interface-extends-interface, conditional types) appear in the grep output as noise. Classify them as "type-system only — not counted" and move on — they are fully exempt.

Pattern-level output (role-based): most hits should cluster around framework-required bases (NestJS filters / interceptors / pipes / Terminus health indicators), typed-exception hierarchies, and Node.js stdlib bases (`Transform` / `Readable`). Any hits outside these clusters on primary-adapter paths are refactor-candidates.

## See Also

- `.claude/skills/infrastructure-client-layering/SKILL.md` — concretization of this rule for infra-client facades (catalog / foundation / apps three-layer rule). Reference when designing a new infra-client.
- `.claude/skills/clean-ddd-hexagonal/SKILL.md` — `apps/` Clean/DDD/Hexagonal architecture; DDD tactical-pattern bases (`AggregateRoot` / `Entity` / `ValueObject`) — when/if adopted — add a documented exception to this skill.
- `.claude/skills/no-magic-values/SKILL.md` — related rule: prefer named constants over magic literals. Often applies alongside composition (helpers store constants that were previously hardcoded in base classes).
- `.claude/skills/branching-patterns/SKILL.md` — related rule: prefer polymorphism via composition (Record dispatch / Map fallback / canHandle chain) over `switch/case` or `if/else` chains. Complementary to this skill — both aim at replacing behavior-via-inheritance with behavior-via-collaboration.
- `.planning/phases/999.7.2-*/` — first canonical reference implementation: inheritance → injected helper composition.
- `.planning/phases/999.7.3-*/` — second canonical reference: per-method wrapper classes eliminated via generic promisified-proxy primitive in foundation. Demonstrates that wrapper classes are a sibling form of over-engineering to inheritance — both create abstractions whose only value is mechanical mediation.
