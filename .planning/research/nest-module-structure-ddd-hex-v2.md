# NestJS Module Structure for DDD + Hexagonal — v2 (Refined)

**Date:** 2026-04-20
**Author:** research agent (Opus 4.7, 1M ctx)
**Supersedes / refines:** `nest-module-structure-ddd-hex.md` (v1, same date)
**Scope:** canonical physical layout of `apps/{svc}/src/` for the 6-service monorepo, with rigorous first-principles sub-partitioning inside `infrastructure/`.

---

## 1. TL;DR

1. **Keep three canonical top-level bins** under `apps/{svc}/src/`: `domain/`, `application/`, `infrastructure/`. This matches Codely's production DDD example [S-1], brocoders/nestjs-boilerplate [S-2], IDDD samples [S-9], and Herberto Graca's explicit-architecture-php [S-3].
2. **Split `infrastructure/` into three named sub-bins** — `inbound/` (primary/driving adapters), `outbound/` (secondary/driven adapters), and `bootstrap/` (framework plumbing that is NOT an adapter: health endpoint, throttle, logging interceptors, the composition root's boot wiring). This directly implements Cockburn's primary/secondary split [S-4], Uncle Bob's "Interface Adapters vs Frameworks & Drivers" distinction [S-5], and the Sagar/NestJS community "Frameworks/Primary vs Frameworks/Secondary" layout [S-6].
3. **The gRPC-controllers-as-exception disappears.** Inbound gRPC controllers live at `infrastructure/inbound/grpc/{svc}.controller.ts` — exactly parallel to `infrastructure/outbound/persistence/` and `infrastructure/outbound/grpc-clients/`. Gateway's REST controllers live at `infrastructure/inbound/rest/`. Notifier's RabbitMQ consumers live at `infrastructure/inbound/rmq/`. No folder under `inbound/` is "special"; every one is a driving adapter group, transport-clustered (which is the only honest clustering when a single `@GrpcMethod()` decorator binds an entire proto service to one class).
4. **`infrastructure/bootstrap/` houses everything that is neither adapter nor domain** — Zod env schema + config provider, HealthModule (technical liveness/readiness, not a use case), ThrottleModule (APP_GUARD registration), any logging interceptor wiring specific to the service, and `{svc}.constants.ts` (cross-folder DI tokens). This is where Mark Seemann's "composition root" artifacts [S-7] physically sit — close to `main.ts`, wired into `{svc}.module.ts` via imports only.
5. **Feature modules inside sub-bins remain.** Each outbound integration (`outbound/grpc-clients/auth/`, `outbound/persistence/`) and each framework concern (`bootstrap/health/`, `bootstrap/throttle/`) still owns a `@Module({})` + `index.ts` barrel + feature-local Symbols. v1's feature-slicing win is preserved; only the top of `infrastructure/` changes.
6. **Screaming Architecture is not violated** by transport-named folders one level under `inbound/` because SA regulates the **top** directory level of `src/` [S-8]. At `src/` root we still see `domain / application / infrastructure` — screaming "layered business system", not "Nest project". Inside `infrastructure/inbound/` the natural partition IS the transport (gRPC / REST / RMQ) because that is the boundary Cockburn's "port" draws.
7. **One canonical tree follows, not a menu of options** — see §4.

---

## 2. Part 1 — DDD + Hexagonal strict responsibilities (theory)

### Q1.1 — Does DDD+Hex mandate inbound vs outbound adapters as distinct sub-concepts?

**Yes.** Cockburn's original paper distinguishes a "driving side" (left, primary) from a "driven side" (right, secondary) and calls the corresponding adapters **primary** and **secondary** [S-4]. Herberto Graca's canonical "Ports & Adapters Architecture" post states:

> "Primary or Driving Adapters... are the ones to start some action on the application, while... Secondary or Driven Adapters... always react to an action of a primary adapter." [S-10]

Multiple reference implementations make this a physical split:
- `tim-hub/nestjs-hexagonal-example` uses `adapters/driver/` + `adapters/driven/` [S-11].
- Sagar's NestJS guide (2024) uses `Frameworks/Primary/` + `Frameworks/Secondary/` [S-6].
- Generic hexagonal Go/Java references use `adapter.in` / `adapter.out` package naming [S-12].

So the inbound/outbound split is not a stylistic choice — it is the **physical expression of the port's direction**, which is the defining structural invariant of Hexagonal Architecture.

### Q1.2 — Is "framework plumbing" (rate limiter, health check, logging interceptor) an adapter?

**No — and this is the key finding that drives v2.** Uncle Bob's Clean Architecture separates two outer rings that DDD+Hex practitioners often collapse [S-5]:

- **Ring 3 — Interface Adapters:** *"a set of adapters that convert data from the format most convenient for the use cases and entities, to the format most convenient for some external agency such as the Database or the Web."* (controllers, presenters, repositories, mappers — things that TRANSLATE)
- **Ring 4 — Frameworks & Drivers:** *"the outermost layer is generally composed of frameworks and tools such as the Database, the Web Framework, etc. Generally you don't write much code in this layer other than glue code that communicates to the next circle inwards."* (actual frameworks and your glue to them)

A **rate limiter** does not translate between an external representation and a domain command — it short-circuits requests based on IP counters. A **technical health endpoint** does not execute a use case — it reports process liveness of the NestJS instance. A **logging interceptor** does not adapt a port; it decorates the framework's execution pipeline. These are all **framework glue** (Ring 4), not **adapters** (Ring 3). Collapsing them into `infrastructure/adapters/` is the category error the user's critique correctly identified.

Graca reinforces this by placing "frameworks and tools" outside the "adapters" conceptual box: *"Far away from the most important code in our system, the application core, we have the tools that our application uses, for example, a database engine, a search engine, a Web server"* [S-13]. The adapter wraps the tool; the tool and the glue that boots it are a separate concern.

### Q1.3 — Is configuration/env-loading "infrastructure" or "composition root"?

**Composition root.** Mark Seemann's canonical definition:

> "A (preferably) unique location in an application where modules are composed together... As close as possible to the application's entry point." [S-7]

> "Only applications should have Composition Roots. Libraries and frameworks shouldn't." [S-7]

Seemann classifies the composition root as "an application infrastructure component" but explicitly distinguishes it from domain/application concerns. In a Nest app, `main.ts` + `{svc}.module.ts` ARE the composition root. The Zod schema + config provider + cross-folder DI tokens (`{svc}.constants.ts`) are wiring artifacts — they exist to feed the composition root and nowhere else. That makes them **bootstrap**, not adapter.

---

## 3. Part 2 — Canonical sub-partitions in production DDD+NestJS codebases

Direct inspection via `gh api` on 2026-04-20:

| Repo | Stars | Top-level `src/` | Infra sub-partition | Inbound vs Outbound? | Framework plumbing lives where? |
|---|---|---|---|---|---|
| **CodelyTV/typescript-ddd-example** [S-1] | 1.5k | `Contexts/<BC>/<Mod>/{domain,application,infrastructure}` + `apps/<deploy>/backend/{controllers,routes,dependency-injection}` | `infrastructure/persistence/` only (outbound) | **Yes — implicit.** Inbound = `apps/*/backend/controllers/`. Outbound = `Contexts/*/infrastructure/`. The physical separation is at the repo top level. | `apps/*/backend/dependency-injection/` (composition root) |
| **Sairyss/domain-driven-hexagon** [S-14] | 13k | `libs/` + `modules/<feature>/{commands,queries,domain,database,dtos}` | `modules/<feature>/database/` is outbound only | **Yes — inline per use case.** Inbound controllers are co-located with the command: `create-user.http.controller.ts`, `create-user.cli.controller.ts`, `create-user.message.controller.ts`. Outbound lives in `database/`. | `libs/application/interceptors/`, `libs/api/`, `configs/` (sibling to `modules/`) |
| **brocoders/nestjs-boilerplate** [S-2] | 9.6k | Feature-sliced at root: `users/`, `auth/`, `session/`, `mailer/`, `files/`, `i18n/` + `config/` + `database/` + `utils/` | Per-feature `infrastructure/persistence/` + `domain/` + `dto/` | **Partial.** Controllers sit at feature root (`users.controller.ts`). Outbound in `infrastructure/persistence/`. | `database/`, `config/`, `utils/` at src-root — NOT inside a feature's `infrastructure/` |
| **hgraca/explicit-architecture-php** [S-3] | 1.6k | `Core/` + `Infrastructure/` + `Presentation/` | Split at top-level — `Presentation/` = inbound, `Infrastructure/` = outbound | **Yes — most explicit.** `Presentation/Web/Controller/...`, `Infrastructure/.../Persistence/...`. | `Presentation/Web/{Core,Infrastructure}` — nested bootstrap layer per entry point |
| **VaughnVernon/IDDD_Samples** [S-9] | 2.7k | Java package layout: `application`, `domain`, `infrastructure`, `port.adapter.service.resource` (inbound) | Package split: `resource/` = REST controllers (inbound); `persistence/`, `messaging/` = outbound | **Yes — reflected in package names.** | `port.adapter.service.resource.health` groups technical endpoints |
| **tim-hub/nestjs-hexagonal-example** [S-11] | low | `<feature>/domain/{inboudPorts,outboundPorts}` + `<feature>/adapters/{driver,driven}` | `adapters/driver/` + `adapters/driven/` | **Yes — explicit.** | Not addressed |

**Pattern recognition across the six:** every mature reference splits inbound from outbound at *some* granularity — some at src-root (Graca), some per use case (Sairyss), some across the Contexts/apps boundary (Codely). None of them puts inbound controllers and outbound repositories in the same `adapters/` bucket without qualifier. **The user's instinct is backed by every serious reference.**

---

## 4. Part 3 — Screaming Architecture applied at this depth

Uncle Bob's essay [S-8] regulates the **top** of `src/`:

> "When you look at the top level directory structure, and the source files in the highest level package; do they scream: Health Care System, or Accounting System, or Inventory Management System? Or do they scream: Rails, or Spring/Hibernate, or ASP?"

Uncle Bob is explicit that the principle applies to the **highest level package**. He does not specify that every sub-level must scream domain. In this codebase, the TOP level (`apps/auth/`, `apps/sender/`, `apps/parser/`, `apps/audience/`, `apps/gateway/`, `apps/notifier/`) already screams "Email Platform" — auth / sender / parser / audience / gateway / notifier are the business verbs. One level down, `domain / application / infrastructure` screams "layered system" (not "Nest project"). **SA is satisfied by the time we reach `infrastructure/`.**

Two levels down, inside `infrastructure/`, the natural cleavage is the **port direction** (Cockburn) and **adapter-vs-framework** (Uncle Bob). Three levels down (inside `inbound/`) the natural cleavage is the **transport**, because the NestJS gRPC idiom binds an entire proto service to one `@Controller()` class — the transport IS the slice. This is not "screaming Nest", it is honestly naming the port's physical shape.

**Rule:** SA binds the top of `src/`; below that, use first-principles partitioning (Cockburn port direction, Uncle Bob ring separation, Common Closure Principle).

---

## 5. Part 4 — Resolving the "gRPC controllers exception"

**The exception dissolves when we restate the rule.** v1's rule was "slice infrastructure by feature (not by layer)". Under that rule, `controllers/grpc/` looked like a "by-layer bin" and thus an exception. Under v2's rule — **split infrastructure by port direction, then within each direction cluster by the smallest honest grouping** — gRPC controllers become a natural group:

1. **Cockburn's rule:** infrastructure divides into primary (driving) and secondary (driven) adapters. [S-4]
2. **Uncle Bob's rule:** further divide "adapters that translate" from "framework glue that boots". [S-5]
3. **NestJS gRPC idiom:** a proto service's methods are decorator-bound to ONE controller class via `@GrpcMethod(Service, Method)`. ts-proto's `nestJs=true` hard-codes this. [S-15] The proto-service IS the smallest honest unit of inbound gRPC adapter.
4. **CCP / Sairyss's Common Closure Principle [S-14]:** keep files that change together close. When a proto's messages evolve, the controller + any DTO mappers change together.

Therefore: **one folder per inbound transport** (`infrastructure/inbound/grpc/`, `infrastructure/inbound/rest/`, `infrastructure/inbound/rmq/`) is the natural physical expression of the inbound-adapter partition, and within it one controller file per proto service is the atomic unit. This is exactly how Codely's `apps/mooc/backend/controllers/` [S-1] and IDDD's `port.adapter.service.resource/` [S-9] organize their inbound adapters. No exception required.

**Could we feature-slice further** (e.g., `inbound/grpc/login/` + `inbound/grpc/refresh/` with per-method sub-controllers and a composer)? In theory yes — Sairyss's per-use-case co-location [S-14] does exactly that in a REST world where Nest's per-method decorators enable it. But ts-proto's code generation forces a single class implementing the generated `XxxServiceController` interface, so splitting a proto service into N sub-controllers creates a composer-plus-shards pattern with no payoff and extra wiring. **Pragmatic stop-point: one controller file per proto service, grouped under `inbound/grpc/`.** Below that, the port direction + transport + proto-service trifecta already has zero ambiguity.

---

## 6. Part 5 — Reconcile with NestJS community idioms

- **NestJS `@Module()` per feature** [S-16] maps cleanly onto Hex's "inbound adapter for feature X" **and** onto the "outbound adapter for integration Y". Both should be packaged as modules with `index.ts` barrels — confirmed by brocoders [S-2] and Sairyss's per-module `user.module.ts` [S-14].
- **Trilon / official NestJS position** [S-17]: modular structure "directly supports DDD principles" and each feature should be "self-contained". Our v2 layout preserves this by keeping `bootstrap/health/`, `bootstrap/throttle/`, `outbound/grpc-clients/auth/`, `outbound/persistence/` each as a self-contained module.
- **Composition root shape of `{svc}.module.ts`:** `imports:` for infrastructure feature modules; `controllers:` only for inbound gRPC controllers the Nest runtime needs to instantiate at the root level (Nest does not auto-discover controllers inside imported modules unless those modules declare them — so gRPC controllers owned by `@Module` declared in `inbound/grpc/grpc.module.ts` would still be registered via that module's `controllers:`). `providers:` only for application-layer wiring (port→service, port→adapter bindings, use cases) that isn't owned by a feature module. Confirms v1's §2.5 policy unchanged.

---

## 7. Part 6 — Config + constants placement

### Config (env schema + provider)

Per Seemann [S-7], config loading is composition-root infrastructure. Per Graca [S-3] and Codely [S-1], entry-point-specific wiring lives in a `dependency-injection/` or `bootstrap/` folder under `apps/*/backend/`. Per brocoders [S-2], a src-root `config/` folder sits outside feature folders.

**Decision for this project:** `apps/{svc}/src/infrastructure/bootstrap/config/` — physically inside `infrastructure/` (because the Zod schema + config provider ARE framework-bound Nest code using `@nestjs/config`), but partitioned into the `bootstrap/` sub-bin because they are composition-root artifacts, not adapters. This is a stricter placement than v1's `infrastructure/config/` (where it sat beside `persistence/` as if it were an outbound adapter, which it isn't).

### DI token constants

Per v1's still-valid rule: a Symbol lives in the smallest folder containing every importer.

- **Feature-local tokens** (e.g., `THROTTLE_TIER`, `AUTH_GRPC_HEALTH`, `AUTH_CLIENT_GRPC`): stay in the feature (`bootstrap/throttle/throttle.constants.ts`, `outbound/grpc-clients/auth/auth-client.constants.ts` or `index.ts`).
- **Cross-folder tokens** (`LOGIN_PORT`, `USER_REPOSITORY_PORT`, `{SVC}_CONFIG`): live in `infrastructure/bootstrap/{svc}.constants.ts` — because that file IS the composition root's cross-folder token registry. No need for it to sit at `src/` root; `bootstrap/` is more honest. (Today's codebase puts them at `src/{svc}.constants.ts`; v2 proposes moving them one level deeper into `infrastructure/bootstrap/` for symmetry with the other bootstrap artifacts. This is the only movement that costs anything — see Gap Analysis.)

---

## 8. Part 7 — The refined canonical tree

```
apps/{svc}/src/
├── main.ts                                   # entry point — imports {svc}.module
├── {svc}.module.ts                           # composition root
│
├── domain/                                   # pure TS — zero framework deps
│   ├── entities/
│   ├── value-objects/
│   └── events/
│
├── application/                              # use cases + ports + services + commands
│   ├── ports/{inbound,outbound}/
│   ├── services/
│   ├── use-cases/
│   └── commands/
│
└── infrastructure/                           # framework-bound; THREE sub-bins
    │
    ├── inbound/                              # Cockburn primary / driving adapters
    │   ├── grpc/                             # (auth/sender/parser/audience)
    │   │   ├── grpc.module.ts                # declares controllers, imports app-layer deps
    │   │   └── {svc}.controller.ts           # implements proto XxxServiceController
    │   │
    │   ├── rest/                             # (gateway only — domain REST endpoints)
    │   │   ├── rest.module.ts
    │   │   └── {resource}.controller.ts
    │   │
    │   └── rmq/                              # (notifier only — event consumers)
    │       ├── rmq.module.ts
    │       └── {event}.consumer.ts
    │
    ├── outbound/                             # Cockburn secondary / driven adapters
    │   ├── persistence/                      # (gRPC services) DB repo adapters
    │   │   ├── persistence.module.ts
    │   │   ├── pg-{entity}.repository.ts
    │   │   ├── mappers/
    │   │   └── schema/
    │   │
    │   ├── grpc-clients/                     # (gateway, maybe sender->audience)
    │   │   ├── grpc-clients.module.ts        # composer
    │   │   └── {upstream}/
    │   │       ├── {upstream}-client.module.ts
    │   │       └── index.ts                  # token + module barrel
    │   │
    │   ├── http-clients/                     # (future — parser -> AppStoreSpy etc.)
    │   │   └── {upstream}/
    │   │
    │   └── publishers/                       # (future — RMQ event publishers)
    │       └── {event}.publisher.ts
    │
    └── bootstrap/                            # Uncle Bob's Ring 4: framework glue + composition-root wiring
        ├── config/
        │   ├── {svc}-env.schema.ts
        │   ├── {svc}-config.provider.ts
        │   ├── {svc}-config.module.ts        # @Global — publishes {SVC}_CONFIG
        │   └── index.ts
        │
        ├── health/                           # technical liveness/readiness — not a use case
        │   ├── health.module.ts              # wraps TerminusModule + health probes
        │   ├── health.controller.ts          # REST /health/live + /health/ready
        │   └── index.ts
        │
        ├── throttle/                         # (gateway only) rate-limit guard
        │   ├── throttle.module.ts            # wires ThrottlerModule + APP_GUARD
        │   ├── throttle.constants.ts         # THROTTLE_TIER
        │   └── index.ts
        │
        ├── logging/                          # (optional per service — if custom interceptors)
        │   └── logging.module.ts
        │
        └── {svc}.constants.ts                # CROSS-FOLDER DI Symbols (ports, config token)
```

### Per-node rules (cite source)

| Node | Belongs here | Does NOT belong | Source |
|---|---|---|---|
| `domain/` | Entities, VOs, domain events, domain services (pure TS) | Any `@nestjs/*`, `@grpc/*`, proto types, `drizzle-orm`, `pg` | Evans [S-18]; Graca Core [S-3]; CLAUDE.md Override 8 |
| `application/` | Use cases, inbound+outbound port interfaces, services, commands | Framework transports, DB types, HTTP libs | Vernon IDDD ch.4 [S-9]; Sairyss app layer [S-14] |
| `infrastructure/inbound/` | PRIMARY adapters — things that CALL the application core (controllers, consumers, CLI entry, scheduler hooks) | Anything that the core calls OUT to | Cockburn [S-4]; Graca [S-10]; Sagar/NestJS [S-6] |
| `infrastructure/outbound/` | SECONDARY adapters — things the core calls OUT to (repositories, upstream clients, publishers, mappers) | Anything that calls IN | Cockburn [S-4]; Graca [S-10] |
| `infrastructure/bootstrap/` | Framework glue + composition-root wiring: config loader, TerminusModule wrapping, APP_GUARD/APP_FILTER registration, DI token registry | Business mappers, repositories, controllers | Uncle Bob Ring 4 [S-5]; Seemann composition root [S-7] |
| `{svc}.module.ts` | `imports:` of feature modules + `providers:` for port-to-service bindings | Concrete Terminus/Throttler/proto client wiring (delegated to feature modules) | Trilon/NestJS [S-17]; brocoders [S-2] |

---

## 9. Part 8 — User's direct questions, answered

**Q1. Should `infrastructure/` have sub-partitioning to prevent mixing?**
Yes. Three sub-bins: `inbound/` (primary adapters, Cockburn), `outbound/` (secondary adapters, Cockburn), `bootstrap/` (framework glue + composition root, Uncle Bob Ring 4 + Seemann). Every reference project in §3 makes some version of this split.

**Q2. Why is (or isn't) `controllers/grpc/` placement an exception?**
It is NOT an exception once you split by port direction. Inbound gRPC controllers sit at `infrastructure/inbound/grpc/`, exactly parallel to REST controllers at `infrastructure/inbound/rest/` and RMQ consumers at `infrastructure/inbound/rmq/`. Within `inbound/`, clustering by transport is forced by the NestJS gRPC idiom (one proto service = one `@GrpcMethod`-decorated class) and endorsed by IDDD `resource/` [S-9] and Codely `apps/*/backend/controllers/` [S-1]. No exception, no hand-wave — just a natural consequence of the port's physical shape.

**Q3. What is the DDD-strict responsibility of `infrastructure/` and what does NOT belong there?**
Per Evans [S-18] and Vernon [S-9], the infrastructure layer "encapsulates technology" — it provides the technical capabilities the application and domain layers need without contaminating them. What belongs: port adapters, framework glue, persistence, transport. What does NOT belong: business rules, invariants, domain events (those are `domain/`), use-case orchestration (that is `application/`), or business-relevant error policies (those live in domain or application depending on scope). Cross-cutting concerns like rate-limiting and health reporting ARE infrastructure, but specifically **framework glue (Ring 4)**, not **adapters (Ring 3)** — hence the `bootstrap/` sub-bin.

**Q4. Does "Nest cross-cutting module" (throttle/health) belong inside `infrastructure/` at all?**
Yes, but inside `infrastructure/bootstrap/`, not beside `inbound/` or `outbound/`. Pulling them out to a sibling `framework/` or `shared/` directory would repeat the src-root structure (Graca's `Core / Infrastructure / Presentation`) but is unnecessary at this project scale — a single named sub-bin is enough to prevent mixing. A future Phase could elevate `bootstrap/` to src-root if the project grows; today, keeping everything framework-bound under `infrastructure/` is simpler and matches CLAUDE.md's existing 3-layer mapping.

**Q5. Where does config (env loader + Zod schema) live?**
`infrastructure/bootstrap/config/`. Per Seemann [S-7] config IS part of the composition root; per Graca it lives with presentation/bootstrap artifacts [S-3]. It is NOT an outbound adapter (it adapts nothing — it loads). It is NOT a domain concern. Grouping it under `bootstrap/` alongside health/throttle/logging and the cross-folder constants file is the most honest placement.

---

## 10. Part 9 — Gap analysis vs. current codebase

Counting files that move, per service:

| Service | Current layout | Moves under v2 | New files |
|---|---|---|---|
| **gateway** | `infra/{clients,config,controllers/rest,throttle}/` + `src/{health,throttle}/` empty + root `gateway.constants.ts` | `clients/` → `outbound/grpc-clients/` (≈11 files); `config/` → `bootstrap/config/` (3 files); `controllers/rest/health.controller.ts` → `bootstrap/health/health.controller.ts` (1 file + new module + barrel = 3 files); `throttle/` → `bootstrap/throttle/` (1 file); root `gateway.constants.ts` → `bootstrap/gateway.constants.ts` (1 file) | +3 (health.module.ts, index.ts × 2) |
| **auth** | `infra/{config,controllers/{grpc,rest},persistence}/` + root `auth.constants.ts` | `controllers/grpc/auth.controller.ts` → `inbound/grpc/auth.controller.ts` + new `grpc.module.ts` (2 files); `controllers/rest/health.controller.ts` → `bootstrap/health/` (1 file + 2 new); `config/` → `bootstrap/config/` (3 files); `persistence/` → `outbound/persistence/` (4 files incl. mappers/schema); root `auth.constants.ts` → `bootstrap/auth.constants.ts` | +3 per service |
| **sender** | mirror of auth | mirror of auth | +3 |
| **parser** | mirror of auth | mirror of auth | +3 |
| **audience** | mirror of auth | mirror of auth | +3 |
| **notifier** | `src/{application,domain,health,infrastructure}/` + root `notifier.constants.ts` | root `health/` → `infra/bootstrap/health/`; root `notifier.constants.ts` → `bootstrap/notifier.constants.ts`; plus future `inbound/rmq/` + `outbound/publishers/` creation when wiring actual consumers | +2 |

**Totals:**
- **File moves:** ≈ 50 files (11 gateway client files + 5 × {1 grpc + 1 rest-health + 3 config + 4 persistence} + notifier specifics). Roughly **2× v1's 28-file estimate**, because v2 also reshuffles `config/`, `clients/`, `persistence/`, and the root constants file — not just `controllers/rest/`.
- **New files:** ≈ 15–20 (per-sub-bin `.module.ts` + `index.ts` barrels for inbound/outbound/bootstrap as needed).
- **Behavior-preserving:** yes. All movements are physical + DI-registration changes. No runtime-semantic change.
- **CLAUDE.md impact:** §"NestJS↔Hexagonal Layer Mapping" locations table becomes stale (6 paths change). §"Proto visibility rules" ESLint override 9 path-pattern changes. `no-restricted-imports` layer guards in `.eslintrc.js` need new allowed-path patterns.

### Suggested atomic-commit breakdown (for the phase that will execute this)

1. `refactor(infra): introduce inbound/outbound/bootstrap split in gateway` — full restructure of one service as pilot.
2. `refactor(infra): apply v2 layout to auth` — mechanical copy of the pilot shape.
3. `refactor(infra): apply v2 layout to sender,parser,audience` — mechanical, single commit.
4. `refactor(notifier): align to v2 infra layout` — pull root `health/` into `infra/bootstrap/`.
5. `chore(lint): update no-restricted-imports paths in .eslintrc.js` — so layer rules match new tree.
6. `docs(architecture): refine CLAUDE.md §Layer-Mapping to v2 paths + expand skill with §sub-bin-rationale` — docs settle last.

Each commit passes runtime-smoke-verification (`pnpm start:native` + `/health/ready` on every service) before proceeding.

---

## 11. Part 10 — Proposed CLAUDE.md refinement

Replace the current §NestJS↔Hexagonal Layer Mapping **locations table** rows with the v2 paths, and add one new subsection:

> **Infrastructure sub-partitioning (v2, Phase 999.11.2):**
>
> `infrastructure/` is split into three sub-bins reflecting the type of framework code each holds:
>
> - **`infrastructure/inbound/`** — primary/driving adapters (Cockburn): gRPC controllers, REST controllers, RMQ consumers. Grouped by transport (`grpc/`, `rest/`, `rmq/`), one file per proto-service or resource.
> - **`infrastructure/outbound/`** — secondary/driven adapters (Cockburn): persistence repositories + mappers, upstream gRPC clients, HTTP clients, event publishers. Grouped by integration type (`persistence/`, `grpc-clients/{upstream}/`, `http-clients/{upstream}/`, `publishers/`).
> - **`infrastructure/bootstrap/`** — Uncle Bob Ring 4 framework glue + Seemann composition-root artifacts: Zod env schema + config module (`config/`), Terminus health module (`health/`), rate-limit module (`throttle/`, gateway only), logging interceptors (`logging/`, if custom), and the cross-folder DI token registry `{svc}.constants.ts`. NOT an adapter — never translates external data to domain.
>
> Proto types (`@email-platform/contracts`) and `@nestjs/microservices` imports are restricted to `infrastructure/inbound/grpc/` AND `infrastructure/outbound/grpc-clients/` — enforce via ESLint override 9.
>
> The composition root (`{svc}.module.ts`) composes feature modules from all three sub-bins through `imports:`, and wires application-layer port→service bindings through `providers:`.

(Full replacement wording can be copy-pasted during the executing phase.)

---

## 12. Refined canonical tree — one-glance version

See §8 above for the annotated tree. Reproduced here compactly:

```
apps/{svc}/src/
├── main.ts · {svc}.module.ts
├── domain/       ← pure TS
├── application/  ← ports · services · use-cases · commands
└── infrastructure/
    ├── inbound/    (grpc/ · rest/ · rmq/)         ← PRIMARY adapters (Cockburn)
    ├── outbound/   (persistence/ · grpc-clients/ · http-clients/ · publishers/)  ← SECONDARY adapters (Cockburn)
    └── bootstrap/  (config/ · health/ · throttle/ · logging/ · {svc}.constants.ts) ← Ring 4 glue + composition root (Uncle Bob + Seemann)
```

---

## 13. Recommended next GSD command

Migration size ≈ 50 files across 6 services + CLAUDE.md + ESLint rules + runtime-smoke per service. That is firmly `/gsd:insert-phase` territory (>>10 files, touches every service, invalidates a CLAUDE.md §source-of-truth table, requires runtime smoke verification per service).

```
/gsd:insert-phase 999.11.2 "refactor(infra): inbound/outbound/bootstrap sub-partitioning per DDD+Hex v2 research"
```

The phase plan should: (1) cite this research doc as authority, (2) execute the 6-commit breakdown in §10, (3) end with CLAUDE.md + `.eslintrc.js` + skill updates so subsequent phases inherit v2 paths, (4) run runtime-smoke-verification per service between major commits.

---

## 14. Sources

1. **CodelyTV/typescript-ddd-example** — GitHub repo, `src/` tree inspected via `gh api` on 2026-04-20. Shows `Contexts/<BC>/<Mod>/{domain,application,infrastructure}` + `apps/<deploy>/backend/{controllers,routes,dependency-injection}`. Evidence that inbound (controllers + DI wiring) lives in a separate top-level `apps/` hierarchy from outbound (`Contexts/*/infrastructure/persistence/`). ≈1.5k stars. https://github.com/CodelyTV/typescript-ddd-example
2. **brocoders/nestjs-boilerplate** — GitHub repo + `docs/architecture.md` inspected 2026-04-20. Feature-sliced `src/` with `infrastructure/persistence/` per feature; framework concerns (`config/`, `database/`, `utils/`) at `src/` root. 9.6k+ stars. https://github.com/brocoders/nestjs-boilerplate
3. **hgraca/explicit-architecture-php** — GitHub repo; top-level `src/Core/`, `src/Infrastructure/`, `src/Presentation/`. Reference implementation for Herberto Graca's "Explicit Architecture" blog. 1.6k+ stars. https://github.com/hgraca/explicit-architecture-php
4. **Alistair Cockburn — Hexagonal Architecture** — original paper introducing primary (driving) / secondary (driven) adapter asymmetry. https://alistair.cockburn.us/hexagonal-architecture/ (canonical) — content mirrored widely, e.g. via scalastic.io summary [S-19].
5. **Robert C. Martin — The Clean Architecture** (2012-08-13). Defines the four rings and the critical distinction between Ring 3 (Interface Adapters, which translate) and Ring 4 (Frameworks & Drivers, which are the external tools + glue). Quote: *"The outermost layer is generally composed of frameworks and tools such as the Database, the Web Framework, etc. Generally you don't write much code in this layer other than glue code that communicates to the next circle inwards."* https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
6. **Sagar Sishir Bhusal — "Mastering Hexagonal Architecture in NestJS: A Practical Guide"** (Medium, 2024). Explicitly uses `Frameworks/Primary/` + `Frameworks/Secondary/` with Guards/Filters/Interceptors/Strategies inside `Primary/`. Strong NestJS-specific endorsement of inbound/outbound split at the folder level. https://medium.com/@sagarsishir51/mastering-hexagonal-architecture-in-nestjs-a-practical-guide-ccc10ed155bf
7. **Mark Seemann — Composition Root** (ploeh blog, 2011-07-28). Defines composition root as "a unique location in an application where modules are composed together... As close as possible to the application's entry point." Classifies it as an "application infrastructure component" but strictly distinct from domain/application logic. https://blog.ploeh.dk/2011/07/28/CompositionRoot/
8. **Robert C. Martin — Screaming Architecture** (2011-09-30). Regulates the **top level** of the source tree. The essay does not prescribe that every deeper level must also scream domain. Evidence that SA is satisfied by having `apps/<bc>/src/{domain,application,infrastructure}` at the top; deeper levels may honestly reflect port direction and transport. https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html
9. **Vaughn Vernon — Implementing Domain-Driven Design (IDDD) + IDDD_Samples repo**. Infrastructure encapsulates technology; samples group inbound (REST) under `port.adapter.service.resource/` (including technical health endpoints) and outbound under `port.adapter.persistence/` / `port.adapter.messaging/`. 2.7k+ stars. https://github.com/VaughnVernon/IDDD_Samples
10. **Herberto Graca — Ports & Adapters Architecture** (The Software Architecture Chronicles, 2017-09-14). Primary/Driving vs Secondary/Driven explicit distinction. https://herbertograca.com/2017/09/14/ports-adapters-architecture/
11. **tim-hub/nestjs-hexagonal-example** — `adapters/driver/` + `adapters/driven/` folder split inside each feature. Direct evidence of the primary/secondary partition adopted in a small NestJS reference. https://github.com/tim-hub/nestjs-hexagonal-example
12. **Multiple generic references (dev.to, leapcell.io)** endorsing `adapter.in` / `adapter.out` Java/Go package naming. E.g. https://dev.to/rafaeljcamara/ports-and-adapters-hexagonal-architecture-547c , https://leapcell.io/blog/building-robust-applications-with-hexagonal-architecture-in-nestjs-and-asp-net-core
13. **Herberto Graca — Explicit Architecture #01: DDD, Hexagonal, Onion, Clean, CQRS, how I put it all together** (2017-11-16). Frameworks/tools sit outside the adapter; adapters wrap tools. https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/
14. **Sairyss/domain-driven-hexagon** — 13k stars. `src/modules/<feature>/{commands,queries,domain,database,dtos}` with controllers co-located per use-case as `*.http.controller.ts`, `*.cli.controller.ts`, `*.message.controller.ts`. Endorses Common Closure Principle, rejects strict horizontal layering. https://github.com/Sairyss/domain-driven-hexagon
15. **ts-proto `nestJs=true` flag + `@nestjs/microservices` gRPC docs**. Generates one `XxxServiceController` interface per proto service that one NestJS `@Controller()` class must implement — hardcodes 1 proto service = 1 controller file. https://github.com/stephenh/ts-proto (option) + https://docs.nestjs.com/microservices/grpc
16. **NestJS Modules docs** — each feature encapsulated as `@Module`. https://docs.nestjs.com/modules
17. **Trilon / NestJS advanced architecture course** (Kamil Mysliwiec) — teaches Hexagonal + Onion + DDD with per-feature modules. https://courses.nestjs.com
18. **Eric Evans — Domain-Driven Design** (2003). Layered architecture ch.4: infrastructure layer provides "generic technical capabilities that support the higher layers." Foundational reference.
19. **scalastic.io — Hexagonal Architecture: Kernel, Ports, Adapters** (2024 EN summary). Groups components into "Business (Core), Interface (Drivers, Primary Actors), Infrastructure (Driven, Secondary Actors)". https://scalastic.io/en/hexagonal-architecture/

---

## RESEARCH COMPLETE
