---
name: infrastructure-client-layering
description: Architectural rule for placing infrastructure-client artefacts (modules, factories, DI tokens) across catalog / foundation / apps layers. Triggers on creating or refactoring HTTP clients, gRPC clients, RabbitMQ producers/consumers, cache adapters, object-storage adapters, DB/ORM modules, CONFIG MODULES, or any other infra-client. Apply whenever a new infra-client mechanism is introduced or an existing one is refactored. No per-method hand-written wrapper classes; use a generic promisified proxy for Observable-returning interfaces at the foundation level. Reference phases (for historical context and worked examples): `.planning/phases/999.7.x` (gRPC), `.planning/phases/999.11.1` (Config — Canonical Config Access Contract), `.planning/phases/999.11.2` (placement refinement under `bootstrap/config/`), `.planning/phases/22.1-*` (storage subpath boundary), `.planning/phases/22.4-*` (per-namespace storage factory).
---

# Infrastructure Client Layering

## Principles, Not Inventory

This skill describes **timeless principles** for layering client-side infrastructure across catalog / foundation / apps. It does **not** describe the current state of the codebase. Do **not** add inventory to this file: specific file paths beyond stable workspace roots (`apps/`, `packages/`), port numbers, production class or function names, enumerated counts of files / services / overrides / lines. For current-state lookups, link to a tracked configuration file by **role** (e.g., "the project ESLint config"), link to the enclosing **directory** (not a file), or provide a `grep` command the reader runs on demand.

Author-facing rule: if you feel the urge to write a specific file path, a real class name, or a count, stop and apply the **rename test** — would this sentence still be true if that file / class / number were renamed or changed tomorrow? If no, rewrite the sentence until it is.

## Authoritative references

The current **file-path matrix** naming every concrete infra-client slice in this project lives in the project-level paired doc: **CLAUDE.md §"NestJS↔Hexagonal Layer Mapping"** — that section enumerates the per-service directory layout for `infrastructure/outbound/grpc-clients/`, `infrastructure/outbound/http-clients/`, `infrastructure/outbound/persistence/`, `infrastructure/outbound/storage/`, and `infrastructure/bootstrap/config/`. This skill is the **decision-tree + anti-patterns** subset — it defers to the CLAUDE.md paired section for the current concrete layout.

When the CLAUDE.md paired section and this skill disagree, the CLAUDE.md paired section wins — it tracks the codebase; this skill teaches the pattern.

---

Universal rule for distributing infrastructure-client artefacts (NestJS modules, factories, DI tokens) across the three project layers. Establishes consistent boundaries so new infra-clients (HTTP, RabbitMQ, cache, object-storage, DB/ORM, future) follow the same architectural principle.

## The Three-Layer Rule

```
catalog (packages/config)            ─→  IDENTITY ONLY
  ├─ what a service IS (id, public DI token)
  └─ transport-agnostic (no gRPC / HTTP / RMQ / DB specifics)

foundation (packages/foundation)     ─→  MECHANISMS ONLY
  ├─ generic factories (gRPC client factory, config-module factory,
  │   HTTP client factory, ...)
  ├─ shared health indicators, interceptors, error normalisers
  └─ does NOT know about specific services
     (no per-service names; no domain language)

apps/{svc}/src/infrastructure/...    ─→  ASSEMBLY + NAMING
  ├─ thin modules calling foundation factories with catalog identity
  ├─ per-app DI tokens re-exported for local consumer ergonomics
  └─ composition root wires foundation machinery + per-service identity
```

**Each layer knows only itself and the layer below.** Catalog never imports foundation. Foundation never references specific services. Apps import both.

## Token Classification

Every infra-client deals with tokens of distinct natures. Place each one according to its nature, not by reflex copy-paste.

| Token kind | Example (fictional) | Where it lives | Why |
|---|---|---|---|
| **Public service identity** | `SERVICE.foo.diToken` (template — substitute any service id from catalog) | catalog | Universal contract — every consumer in every app names the service the same way |
| **Transport plumbing** | per-upstream channel token, base-URL holder, queue-connection token | derived in foundation, named in apps | Transport-specific, not part of public service identity |
| **True-single-instance infra** (one per service) | `DB_TOKEN`, `CACHE_TOKEN` | foundation constants | One global symbol per service — no per-instance variation; apps `@Inject` the foundation token directly |
| **Multi-instance-per-namespace infra core** | `STORAGE_CORE_TOKEN` | foundation, internal-only (sanctioned subpath) | Shared core behind a sanctioned-subpath import boundary; apps never inject it directly |
| **Per-namespace / per-instance health indicator** | per-channel health token, per-bucket health token | derived in foundation, named in apps | Tied to a specific channel / connection / namespace instance |

**Rule:** transport tokens are NEVER added to catalog. The catalog stays identity-only. If you find yourself writing `SERVICE.{svc}.grpcToken` or `SERVICE.{svc}.httpToken` — stop, that's a layer violation.

## Tier 1/2/3 Token Framework + Layer-Name Axis

Every infra-client surface declares tokens of three distinct natures. Place each
according to its nature, not by reflex copy-paste. The framework refines §"Token
Classification" above by sorting tokens along an orthogonal axis: **what the token
binds** (abstract surface vs raw library object vs library-specific defaults) and,
in turn, **which name-axis the token MUST follow** (layer-name vs tech-name).

| Tier | What it binds | Naming axis | Example (fictional) |
|------|---------------|-------------|---------------------|
| **Tier 1** | An abstract domain-role surface — DI tokens binding `*HealthIndicator` types, service tokens binding port interfaces, config-port tokens, abstract type names | **Layer-name** (the hexagonal layer, e.g., `foo` / `bar`) | `FOO_HEALTH` (token), `FOO_SERVICE` (token), `FOO_CONFIG_PORT` (token), `FooHealthIndicator` (type), `FooPort` (type) — where `Foo` is the layer |
| **Tier 2** | A raw library instance — DI binds the literal library object (a real client / handle / connection) | **Tech-name** (legitimately tech-specific — DI injects a concrete library object, the name should honest-reflect that identity) | `LIB_CLIENT` (raw library handle for `LibName`) |
| **Tier 3** | Library-specific defaults / commands — `as const` objects holding library options, health-check command literals, knobs honoured by one specific library | **Tech-name** (tech identifier honest — these are concrete library knobs, renaming them to abstract loses readability) | `LIB_DEFAULTS = { KEEPALIVE_MS: ... } as const`, `LIB_HEALTH_CHECK = { COMMAND: 'PING' } as const` |

### The Layer-Name Axis Rule (Tier 1 only)

The prefix of any Tier-1 artefact MUST equal its **hexagonal-layer name** (the
architectural layer in the Cockburn / Evans / Uncle Bob sense — the folder name
under `packages/foundation/src/external/`), NOT the **backing-service domain**
(database / queue / object-store / key-value-store), NOT the **specific tech**
(any concrete library or vendor identifier). The rule survives any change of
underlying tech: swap one library for another within the same layer and the
Tier-1 surface name `FOO_HEALTH` (where `Foo` is the layer) stays correct;
`FOO_LIBNAME_HEALTH` would orphan immediately.

**Rename test:** if the Tier-1 token contains the name of the backing library
(or its synonym in domain language — e.g., the database product name standing
in for the persistence layer), it fails the rule. Fix by replacing the library
identifier with the hexagonal-layer name. The Tier-2 and Tier-3 names in the
same module remain tech-named — only Tier 1 is bound to the layer-name axis.

### Worked Example

A canonical implementation lives at the directory
`packages/foundation/src/external/storage/` — open the directory to see the
applied pattern: Tier-1 tokens prefixed with the layer name (layer-name axis),
Tier-2 raw client tokens prefixed with the library name (tech-name honest),
Tier-3 library options as `*_DEFAULTS` (tech-name honest). The directory is
the entry point; specific filenames intentionally omitted per the rename test.

## Decision Tree -- Adding a New Infra-Client

```
New infra-client mechanism (HTTP / RMQ / cache / object-storage / DB / ...)?
|
+-- Step 1: How many instances per service?
|   +-- ONE (true single-instance, e.g., DB pool, cache connection)
|   |   |
|   |   +-- Token in foundation as exported constant
|   |       (Symbol('TOKEN_NAME') in {infra}.constants.ts)
|   |   +-- Module in foundation, exposed via forRootAsync()
|   |   +-- Apps just import the module — no per-app naming needed
|   |
|   +-- MANY (e.g., gRPC clients to multiple upstreams,
|       multiple HTTP APIs, multiple storage namespaces)
|       |
|       +-- Step 2: Is there a catalog identity for each instance?
|           |
|           +-- YES (e.g., gRPC upstreams: SERVICE.foo, SERVICE.bar)
|           |   |
|           |   +-- Foundation provides MECHANISM (factory) that
|           |   |   derives transport tokens from catalog id
|           |   |   (Symbol.for(`${service.id}_<KIND>`))
|           |   +-- Per-app module captures factory result and
|           |   |   re-exports named tokens for local consumers
|           |   +-- Catalog is the ONLY source of identity strings
|           |
|           +-- NO (e.g., external 3rd-party APIs without catalog,
|               OR multiple namespaces of one external infra)
|               |
|               +-- Per-app constants file declares tokens explicitly
|               +-- Per-app module wires foundation factory with those tokens
|               +-- No catalog leak — these are app-private identifiers
|
+-- Step 3: Consumer-facing shape
    +-- Apps receive a TYPED port from the factory — never the raw
        transport primitive. The port is either the generic
        promisified proxy (for transport clients) or a typed
        namespace port (for multi-instance-per-namespace infra).
```

## Application by Infra Type

### gRPC (client-side)

- **Catalog:** `SERVICE.{svc}` — identity only (id, public DI token, transport-agnostic metadata).
- **Foundation:** the gRPC-client factory in `packages/foundation/src/external/grpc/` — open the directory to see the current factory plus the generic promisified proxy exported alongside it. The factory accepts the catalog service identity plus the public DI token and returns a ready module binding a promisified proxy to that token. Derives transport + health tokens internally via `Symbol.for(\`${service.id}_<KIND>\`)`. Per-call deadline and ts-proto-aware metadata handling live inside the proxy, not inside per-upstream code.
- **Apps:** a per-upstream client module in `infrastructure/outbound/grpc-clients/{upstream}/` that calls the foundation factory with the catalog identity and re-exports the named DI tokens (client token + health token) the factory binds. Shape is a thin module, not a handwritten wrapper class.
- **Consumer:** inject directly as the promisified form of the ts-proto-generated client interface, using the public DI token from catalog. No per-upstream type alias. No per-method wrapper class. Adding a new RPC to the `.proto` file becomes consumer-callable without touching apps-level wiring code.

For the current factory and worked examples, see `packages/foundation/src/external/grpc/` and `.planning/phases/999.7.x` (reference phases).

### Config

Config is infra-like — every service needs "env data" the same way it needs a gRPC channel or a DB pool. The three-layer rule applies unchanged.

- **Catalog (`packages/config`):** stays schema-only. Per-service env schemas compose shared schema primitives (database, cache, logging, storage, ...) into a per-service composite. NO DI tokens for env values live here — the catalog never names a concrete service's config instance.
- **Foundation (`packages/foundation`):** declares narrow config interfaces (one per subsystem — cache, persistence, logging, storage core, public storage, gRPC client, HTTP, ...) plus matching config-port `Symbol` tokens. Factories at the foundation layer inject the narrow interface via the port (never the full per-service env shape). Foundation NEVER imports per-service env types.
- **Apps:** each service owns a co-located slice under `infrastructure/bootstrap/config/` that binds the service's config token, composes narrow-port slices from the typed env, and exposes a `@Global()` DynamicModule imported FIRST in the root `imports:[]`.

#### Config-factory principle (reused verbatim from the paired nestjs-hexagonal-mapping skill)

> A foundation factory accepts (a) a Zod schema, (b) a config DI token, and (c) a set of narrow config ports the service exposes, and returns a ready `@Global() DynamicModule`. The app-level config module is the result of calling the factory — not a hand-rolled class with `static forRoot()`. Consumers inject the token and receive a validated, typed config object. When a narrow port is introduced, it is added to the factory call; no bespoke provider wiring is written by hand.

Directory-level link for the factory's enclosing directory: `packages/foundation/src/external/config/` — open the directory to see the current factory + load helpers. The factory function name is intentionally omitted here per the rename-test — use the directory as the entry point.

Fictional shape of the call at a consumer app (one example per D-3):

```typescript
// apps/foo/src/infrastructure/bootstrap/config/foo-config.module.ts  — illustrative names only
export const FooConfigModule = createAppConfigModule({
  schema: FooEnvSchema,
  token: FOO_CONFIG,
  narrowPorts: [
    /* one entry per narrow config port this service consumes */
  ],
});
```

See `packages/foundation/src/external/config/` for the current factory and `apps/{svc}/src/infrastructure/bootstrap/config/` in any service for the call-site shape.

**Critical: `@Global()` is REQUIRED on the returned DynamicModule, not optional.** Foundation modules that do nested third-party `forRootAsync` run in a nested DI scope that CANNOT resolve tokens from the root module's `providers:[]` array. Without `@Global()` the app fails at boot with `UnknownDependenciesException: can't resolve Symbol(<config port name>)`. The factory applies `global: true` internally so consumers never re-decorate by hand. This makes the exported tokens visible to every nested dynamic module across the app.

**Consumer injection rule:**
- ✅ `infrastructure/**` (controllers, adapters, clients, repositories) — inject the config token directly and receive the typed env.
- ✅ Module factories (`useFactory`, `forRootAsync`) — composition root.
- ✅ `application/services/**` — services are the seam between env and business logic; they orchestrate use-cases with env-derived knobs.
- 🚫 `application/use-cases/**` — use-cases receive env values as **method args** from the parent service, NOT via `@Inject`. Use-cases stay env-agnostic and reusable across contexts.
- 🚫 `domain/**` — enforced by the project's ESLint configuration.

**Why not a generic configuration-service pattern (`configService.get<T>(KEY)!`):** three structural problems — (1) the `get<T>` return type forces non-null assertions everywhere and bypasses Zod's type guarantees; (2) a globally-registered configuration service imported in foundation would break layer boundaries (foundation would know about string-keyed lookup semantics); (3) a dual path — "module imports configuration + apps expose env type" — creates naming confusion. The per-service config-token Symbol plus typed narrow foundation interfaces fixes all three: type-safe (no non-null assertions), layer-clean (foundation sees narrow interface only), single-path (one Symbol, one provider, typed everywhere).

**Co-location rule.** All artefacts that belong to *this service's* composition-root config — the config DI token, the `@Global()` module, any per-service schema wrapper — live inside one directory: `apps/{svc}/src/infrastructure/bootstrap/config/`. Open that directory in any service to see the current file set; individual filenames drift across refactors, but the directory is the source of truth.

**Root-constants cohabitation rule.** A service's root `{svc}.constants.ts` (the file adjacent to `{svc}.module.ts`) exists if and only if the composition root owns **cross-folder domain-port Symbols** (inbound/outbound ports consumed across `infrastructure/` and `application/`). A service with no cross-folder domain-port Symbols has no root constants file — its config lives entirely in `bootstrap/config/`. This is a predicate over ownership, not over a specific service name.

Reference phases (for historical context): `.planning/phases/999.11.1` established the Canonical Config Access Contract; `.planning/phases/999.11.2` relocated the slice into `bootstrap/config/` under the canonical `inbound/ / outbound/ / bootstrap/` direction split.

### HTTP (client-side)

- **Catalog:** none — external third-party APIs have no service identity in catalog.
- **Foundation:** a generic HTTP client factory exposing error normalisers, retry / circuit-breaker primitives, and a typed config port for base URL + credentials.
- **Apps:** per-vendor constants declare per-vendor DI tokens explicitly (because no catalog source). A per-vendor module in `infrastructure/outbound/http-clients/{vendor}/` wires the foundation factory with those tokens.
- **Client class:** a plain class composed with the foundation client primitive — never a subclass of a foundation base class (see anti-patterns below).

### RabbitMQ (messaging)

- **Catalog decision:** if a queue catalog exists (named queues with stable identities) → follow the gRPC pattern (derive tokens from catalog identity). If queues are declared per-service ad-hoc → follow the HTTP pattern (per-app constants).
- **Foundation:** generic consumer / producer factories. Derive connection / channel tokens from queue identity (or accept opts).
- **Apps:** consumer / producer modules in `infrastructure/inbound/rmq/` (for consumers) and `infrastructure/outbound/publishers/` (for producers) wire the factory and re-export named tokens.

### True-single-instance infra (e.g., cache, DB+ORM)

- **Catalog:** none — single-instance infra, no per-service identity needed.
- **Foundation:** one module + one DI token per subsystem, exported at the package's public surface. The token's role is "the single connection / client for this infra in this service".
- **Apps:** import the foundation module (typically via a `forRootAsync` that consumes the relevant narrow config port), then `@Inject` the foundation token directly in any consumer inside `infrastructure/**`. No per-app constants layer — there is no multiplicity to name.
- **Rationale:** one instance, one name, defined at the single place that owns the mechanism (foundation). Introducing a per-app token here is redundant and creates a second source of identity for the same thing.

For the current modules and tokens, see `packages/foundation/src/external/cache/` and `packages/foundation/src/external/persistence/` — directory-level links; open the directories to see current constants files.

### Multi-instance-per-namespace infra (e.g., object-storage with multiple buckets)

When a single external infrastructure (one account, one endpoint, one credential pair) is consumed in *multiple logical namespaces* (buckets, schemas, partitions), the "true-single-instance" pattern no longer fits. The architectural shape is:

- **Catalog:** none — one external service, no per-namespace catalog identity.
- **Foundation (core):** a shared core module carries the connection + credentials + a generic client primitive. The core token is exposed through a **sanctioned internal-only import path** (a dedicated subpath export), *never* through the public package surface. The project's ESLint configuration enforces the boundary: app code imports the core only through the sanctioned subpath, never through the public package root. This encapsulation lets future authorisation / accounting / observability layers evolve without breaking consumers.
- **Foundation (per-namespace factory):** a per-namespace factory that apps call to produce a typed port scoped to one namespace. The factory is the consumer-facing surface. Apps receive a typed port (one port type per access class — e.g., private vs shared-read), never the raw core client.
- **Apps:** per-service per-namespace constants files declare per-namespace DI tokens. Per-namespace modules in `infrastructure/outbound/storage/{namespace}/` call the factory with the namespace + its typing and bind the typed port to the per-namespace token.

The behavioural rules that survive any rename:
1. The shared core is encapsulated behind a sanctioned internal import path. Apps never import the core from the public package surface.
2. Apps consume typed namespace ports, not the raw core. The port type is the consumer boundary.
3. Each namespace gets its own DI token in apps — identity is per-namespace, not per-service-infra.

For the current core module, subpath export, and per-namespace factories, see `packages/foundation/src/external/storage/` and the accompanying sanctioned-subpath directory; reference phases `.planning/phases/22.1-*` established the subpath boundary and `.planning/phases/22.4-*` established the per-namespace factory pattern.

## Required for Every New Infra-Client

```
1. Foundation has the factory and the generic mechanism ─→ NEVER duplicate logic per service
2. Catalog stays identity-only                          ─→ NO transport tokens in SERVICE.*
3. Apps assemble + name (only when MANY instances exist)─→ True single-instance = no apps-level naming
4. Consumer-facing surface is a typed port              ─→ NEVER leak raw transport primitives to consumer code
5. Re-export named tokens in the per-app module file    ─→ NEVER export the raw factory-result object
6. Token symbols use Symbol.for() when derived from catalog identity
                                                        ─→ Same identity string = same symbol everywhere
7. Document the new infra in this skill                 ─→ Add a subsection under §Application by Infra Type
8. Composition over inheritance, no per-method wrappers ─→ Client facade gets dependencies via DI; does NOT extend a foundation base class. For Observable-returning interfaces, use a generic promisified proxy at the foundation level rather than writing one wrapper class per upstream with one method per RPC. Adding a new RPC automatically becomes consumer-callable; no manual wrapper code needed. See `.agents/skills/composition-over-inheritance/SKILL.md`.
```

## Anti-Patterns

```typescript
// ANTI-PATTERN 1 — Transport token in catalog
SERVICE.foo = {
  id: 'FOO',
  diToken: Symbol.for('FOO_CLIENT'),
  grpcToken: Symbol.for('FOO_GRPC'),   // ← LEAK: catalog must stay transport-agnostic
};

// ANTI-PATTERN 2 — Foundation knows specific services
// packages/foundation/.../foo-client.module.ts           ← LEAK: foundation must stay agnostic
export class FooClientModule { /* ... */ }

// ANTI-PATTERN 3 — Decorator wiring on a factory-built class
@Injectable()
export class FooClient /* extends foundation base */ {
  constructor(@Inject(FOO_CLIENT_GRPC) grpc: unknown, ...) { /* ... */ }
  // ← Dead code under useFactory; leaks DI wiring into the domain class
}

// ANTI-PATTERN 4 — Exporting the raw factory result
export const fooModuleResult = createFooClientModule(/* ... */);
// ← Exposes imports/providers/exports internals — consumer can bypass the module abstraction

// ANTI-PATTERN 5 — Per-app constants for true-single-instance infra
// apps/foo/.../foo-cache.constants.ts                    ← REDUNDANT
export const FOO_CACHE = Symbol('FOO_CACHE');
// True single-instance: just @Inject(CACHE_TOKEN) from foundation directly.

// ANTI-PATTERN 6 — Hardcoded string tokens outside Symbol / Symbol.for()
@Inject('FOO_CLIENT')                                    // ← STRING TOKEN BAD
@Inject(Symbol.for('FOO_CLIENT'))                        // ← UNNAMED USE BAD
@Inject(SERVICE.foo.diToken)                             // ← OK (named, from catalog)
@Inject(FOO_GRPC_HEALTH)                                 // ← OK (named, re-exported from module)

// ANTI-PATTERN 7 — Client facade extends a foundation base class
export class FooClient extends FoundationBaseClient<T> { // ← NO: see composition-over-inheritance skill
  /* ... */
}
// Instead: compose via an injected generic caller / helper primitive exposed by foundation.

// ANTI-PATTERN 8 — Per-method hand-written wrapper class
export class FooClient {
  constructor(rawClient: unknown, private readonly helper: unknown) { /* ... */ }
  doX(req: unknown, opts?: unknown): Promise<unknown> { /* one mechanical wrapper */ }
  doY(req: unknown, opts?: unknown): Promise<unknown> { /* another mechanical wrapper */ }
  // ...×N more identical wrappers, mechanical boilerplate
}
// Why bad: mechanical boilerplate per service × N services. Adding a new RPC requires
// manual wrapper update. For Observable-returning interfaces, use a generic promisified
// proxy at the foundation level and let the consumer inject the raw ts-proto interface
// directly via its catalog DI token.

// ANTI-PATTERN 9 — Injecting the multi-instance-per-namespace core directly from the
// public package surface (bypassing the sanctioned subpath + typed port abstraction)
import { STORAGE_CORE_TOKEN } from '@email-platform/foundation';   // ← NO: core is internal-only
@Inject(STORAGE_CORE_TOKEN) private readonly raw: unknown;         // ← NO: typed port is the contract
// Instead: call the foundation per-namespace factory and receive a typed namespace port
// bound to a per-namespace DI token declared in this app's constants.

// ANTI-PATTERN 10 — Tier-1 token bound to an abstract type but tech-named (axis mismatch)
@Inject(LIBNAME_HEALTH) private readonly layer: LayerHealthIndicator;
//      ^^^^^^^^^^^^^^^                       ^^^^^^^^^^^^^^^^^^^^^^^
//      Tier-1 token: tech-name prefix        Tier-1 type: layer-name prefix
//      ← Mismatch: token reads as Tier 2 (raw lib) but binds Tier 1 (abstract surface).
// Symptom: code-review confusion ("is this the abstract surface or the raw client?"),
// orphaned token name on next library swap. Fix by renaming the token prefix to the
// layer name (LAYER_HEALTH); the type stays unchanged. Tier-2 raw-library tokens in
// the same module legitimately keep tech-names — the rule applies to Tier 1 only.
```

## When to Apply This Skill

- Creating a new infra-client module (HTTP API, message queue, cache, storage namespace).
- Refactoring an existing infra-client onto a foundation factory.
- Reviewing a PR that adds infra wiring.
- Designing a new foundation factory or typed port.
- Resolving "where should this token live?" questions.

When the answer is unclear, follow the decision tree top-to-bottom. If the new infra has nuances not covered (streaming, sharding, multi-region) — extend this skill with a new subsection under §Application by Infra Type rather than improvising.

## See Also

- `.agents/skills/no-magic-values/SKILL.md` — DI tokens use `Symbol()` / `Symbol.for()`, not strings.
- `.agents/skills/clean-ddd-hexagonal/SKILL.md` — apps' Clean / Hexagonal architecture (language-agnostic).
- `.agents/skills/composition-over-inheritance/SKILL.md` — universal rule forbidding inheritance outside narrow exceptions; this skill concretises the rule for infra-client facades.
- `.agents/skills/twelve-factor/SKILL.md` — config from env via `@email-platform/config`, not direct `process.env`.
- `.agents/skills/nestjs-hexagonal-mapping/SKILL.md` — server-side counterpart. Places Controller / Service / UseCase / Port / Adapter / Domain inside `apps/{svc}/src/` for server-side inbound / outbound / bootstrap adapters.
- CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" — project-level authoritative file-path matrix and paired doc (the current canonical directory layout for this project).
- `.planning/phases/999.7.x` — reference phases: gRPC client layer migration (foundation factory + generic promisified proxy).
- `.planning/phases/999.11.1` — reference phase: Canonical Config Access Contract (per-service config token + narrow foundation configs).
- `.planning/phases/999.11.2` — reference phase: relocation of the config slice into `bootstrap/config/` under the inbound / outbound / bootstrap direction-split tree.
- `.planning/phases/22.1-*` — reference phase: storage core encapsulation via sanctioned subpath export.
- `.planning/phases/22.4-*` — reference phase: per-namespace storage factory + typed ports.
