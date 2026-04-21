# NestJS Module Structure for DDD + Hexagonal (Email Platform)

**Date:** 2026-04-20
**Author:** research agent (Opus 4.7, 1M ctx)
**Scope:** canonical placement of NestJS modules/controllers/cross-cutting concerns inside `apps/{svc}/src/infrastructure/` for the 6-service monorepo (gateway REST facade + auth/sender/parser/audience gRPC services + notifier RMQ consumer)
**Question from user:** unify the two slicing strategies currently mixed inside `apps/gateway/src/infrastructure/` (by-feature `throttle/`, `clients/`, `config/` vs by-layer `controllers/rest/`) into a single consistent rule.

---

## 1. TL;DR

- **Slice `infrastructure/` by feature (vertical), not by layer.** Every cross-cutting Nest concern lives in its own folder: `infrastructure/health/`, `infrastructure/throttle/`, `infrastructure/config/`, `infrastructure/clients/{upstream}/`, `infrastructure/persistence/`. This mirrors how `brocoders/nestjs-boilerplate`, `Sairyss/domain-driven-hexagon`, and the NestJS docs all treat sibling infra concerns.
- **Every infra feature owns a `@Module()` (the "infra feature module"). It exposes the minimum: module class + any tokens it publishes + its controllers/providers. The composition root (`{svc}.module.ts`) composes feature modules, nothing else.** Direct `controllers: [...]` / `providers: [...]` arrays in the root are allowed **only for application-layer wiring (services, use cases, outbound-port bindings)** per the current Phase 999.10 convention — because those are not "infrastructure features", they are the bounded context's application guts that already live in `application/` and `domain/`.
- **Feature-internal tokens stay feature-local** (`infrastructure/throttle/throttle.constants.ts`). Only tokens that cross module boundaries (outbound-port Symbols the application depends on, cross-upstream client tokens exposed to `HealthController`) live in root `{svc}.constants.ts`. Rule: if a Symbol is imported **only** from files inside one folder, it belongs in that folder.
- **HealthController moves into `infrastructure/health/` with its own `HealthModule`.** `HealthModule` imports `TerminusModule` + all upstream client modules it probes, declares the controller, and is then imported by the composition root.
- **Refine CLAUDE.md's "One flat @Module per bounded context" rule.** That rule is about **domain/application layers** (one module per bounded context — not one per entity/use-case). It does NOT apply to infrastructure feature modules. Proposed wording: *"One `@Module({})` composition root per bounded context, wiring application + domain providers directly. Infrastructure concerns (persistence, transport clients, throttle, health, config) MUST be wrapped in their own `*.module.ts` under `infrastructure/{feature}/` and imported into the composition root — never inlined."*

---

## 2. Proposed canonical structure

```
apps/{svc}/src/
├── main.ts                               # bootstrap only (createMicroservice / createHttp)
├── {svc}.module.ts                       # composition root — see §2.5
├── {svc}.constants.ts                    # CROSS-FOLDER Symbols only (outbound ports, inbound ports)
│
├── domain/                               # (unchanged — pure TS, no @nestjs/*)
│   ├── entities/
│   ├── value-objects/
│   └── events/
│
├── application/                          # (unchanged — framework-light)
│   ├── ports/
│   │   ├── inbound/                      # our interfaces implemented by services
│   │   └── outbound/                     # our interfaces implemented by adapters
│   ├── services/                         # inbound-port implementations
│   ├── use-cases/                        # atomic @Injectable() steps
│   └── commands/                         # POJO DTOs
│
└── infrastructure/                       # framework-bound; sliced BY FEATURE
    ├── config/
    │   ├── {svc}-env.schema.ts
    │   ├── {svc}-config.module.ts        # @Global() — publishes {SVC}_CONFIG token
    │   └── index.ts                      # barrel: exports Module + GatewayEnv type
    │
    ├── persistence/                      # (gRPC services only)
    │   ├── persistence.module.ts         # composes repos + imports PersistenceModule
    │   ├── pg-user.repository.ts
    │   ├── mappers/
    │   └── schemas/
    │
    ├── clients/                          # (gateway only, or any service that calls upstreams)
    │   ├── clients.module.ts             # composer: imports all {upstream}ClientModule.forRoot()
    │   ├── auth/
    │   │   ├── auth-client.module.ts
    │   │   └── index.ts                  # exports Module + AUTH_CLIENT_GRPC + AUTH_GRPC_HEALTH
    │   ├── sender/, parser/, audience/, notifier/
    │
    ├── controllers/                      # (gRPC services only — proto-bound controllers cluster)
    │   └── grpc/
    │       └── {svc}.controller.ts       # implements proto ServiceController
    │
    ├── health/
    │   ├── health.module.ts              # imports TerminusModule + ClientsModule, declares controller
    │   ├── health.controller.ts          # REST /health/live + /health/ready
    │   └── health.constants.ts           # OPTIONAL — only if feature-local consts needed
    │
    └── throttle/                         # (gateway only — only HTTP-facing service needs it)
        ├── throttle.module.ts            # wires ThrottlerModule.forRootAsync + APP_GUARD
        └── throttle.constants.ts         # THROTTLE_TIER tokens (feature-local)
```

### 2.1 Where `ThrottleModule` lives (Q1)

**`apps/gateway/src/infrastructure/throttle/throttle.module.ts`** — exactly where it is now. Endorse D-06 from Phase 999.11.1. Rationale: it is one self-contained cross-cutting concern with configuration, APP_GUARD registration, and a private enum (`THROTTLE_TIER`). Feature-slicing is what `brocoders/nestjs-boilerplate` does for `session/`, `mailer/`, `i18n/`, and the composition-root hygiene wins outweigh "one less file".

### 2.2 Where `HealthController` lives (Q2)

**Move from `infrastructure/controllers/rest/health.controller.ts` to `infrastructure/health/health.controller.ts`, and wrap it in `HealthModule`.** This is the pattern shown in the official `@nestjs/terminus` README (a dedicated `HealthModule` with `controllers: [HealthController], imports: [TerminusModule]`). The current "put controllers in a by-layer bin" is the inconsistency that triggered this research.

Why not keep `controllers/rest/`? Because that folder would have exactly **one** occupant across the entire codebase — `health.controller.ts`. gRPC controllers are already grouped under `controllers/grpc/` (correct: each gRPC service has multiple proto controllers over time), but REST controllers in this platform are *only* health endpoints. A folder with one file is a leaky abstraction; co-locate it with its module.

### 2.3 Feature-internal constants (Q3)

Rule: **a Symbol lives in the smallest folder that contains every one of its importers.**
- `USER_REPOSITORY_PORT`, `LOGIN_PORT`, `{SVC}_CONFIG` → imported by `application/` AND `infrastructure/` AND root module → must live in root `{svc}.constants.ts`. **Unchanged.**
- `THROTTLE_TIER`, `AUTH_CLIENT_GRPC`, `AUTH_GRPC_HEALTH` → imported only inside one infrastructure feature folder (throttle, or the auth-client subtree + health.controller) → belong in the feature (`throttle/throttle.constants.ts`, `clients/auth/index.ts`).

The existing no-magic-values skill says DI tokens use `Symbol()`. It does **not** mandate that every symbol live in one file. Phase 999.11.1 placed `{SVC}_CONFIG` in root because it crosses the config module boundary — that decision stands. Feature-local tokens should stay local.

### 2.4 Public API of a feature folder (Q4)

Each `infrastructure/{feature}/` folder exports through `index.ts`:
1. The module class (`HealthModule`, `ThrottleModule`, `AuthClientModule`).
2. Tokens that other folders legitimately import (e.g., `AUTH_GRPC_HEALTH` is imported by `health.controller.ts`).
3. Public TS types needed for injection (e.g., `GatewayEnv` from `config/`).

Anything else (internal factories, schemas, private providers) is **not** re-exported. This matches the `AuthClientModule` barrel already present in the codebase (`infrastructure/clients/auth/index.ts` exports `AUTH_CLIENT_GRPC` and `AUTH_GRPC_HEALTH` but not the proto typings).

### 2.5 Composition root shape (Q5)

```ts
// apps/gateway/src/gateway.module.ts
@Module({
  imports: [
    GatewayConfigModule.forRoot(),          // publishes GATEWAY_CONFIG (@Global())
    LoggingModule.forHttpAsync('gateway'),  // foundation cross-cutting
    ClientsModule,                          // composer from infrastructure/clients/
    ThrottleModule,                         // infrastructure/throttle/
    HealthModule,                           // infrastructure/health/
  ],
  providers: [GrpcToHttpExceptionFilter],   // APP_FILTER for the bounded context
})
export class GatewayModule implements OnModuleDestroy { /* ... */ }
```

```ts
// apps/auth/src/auth.module.ts (gRPC service — has domain/application to wire)
@Module({
  imports: [
    AuthConfigModule.forRoot(),
    LoggingModule.forGrpcAsync('auth'),
    PersistenceModule.forRootAsync(),       // from foundation
    AuthPersistenceModule,                  // infrastructure/persistence/ — binds ports→adapters
    HealthModule,                           // infrastructure/health/
  ],
  controllers: [AuthController],            // grpc controller(s) — inbound adapters
  providers: [
    // Application-layer wiring stays here (Phase 999.10 canonical):
    { provide: LOGIN_PORT,          useClass: LoginService },
    { provide: REFRESH_TOKEN_PORT,  useClass: RefreshTokenService },
    // ... use-cases
    VerifyCredentialsUseCase, IssueTokenPairUseCase, /* ... */,
  ],
})
export class AuthModule { /* ... */ }
```

**Rule of thumb — what goes in `imports` vs inline in root:**
- `imports: [...]` — anything that IS a Nest module published by a foundation package OR an `infrastructure/{feature}/` folder.
- `controllers: [...]` — gRPC controllers (inbound transport adapters) only. REST health controllers are OWNED by `HealthModule`.
- `providers: [...]` — application-layer services/use-cases + APP_* filters/interceptors. Infrastructure providers belong inside their feature module.

This keeps the root module short, greppable, and auditable: "what cross-cutting concerns does this service have?" → read the `imports` list.

---

## 3. Rationale — each decision backed

| Decision | Source | Evidence |
|---|---|---|
| Feature-slice `infrastructure/` | `brocoders/nestjs-boilerplate` (9k+ stars) | `src/` contains sibling feature folders `auth/`, `users/`, `files/`, `mailer/`, `mail/`, `session/`, `i18n/`, `home/`, `database/` — **each an independent module**, `AppModule` imports them all. There is no `src/infrastructure/modules/` bin. [Source 1] |
| Feature-slice even for cross-cutting infra | `Sairyss/domain-driven-hexagon` (13k+ stars) | `src/libs/db/`, `src/libs/application/`, `src/libs/ports/`, `src/modules/user/`, `src/modules/wallet/`. Each feature folder has its own `*.module.ts`. [Source 2] |
| Cross-cutting Nest modules get their own `*.module.ts` | Official `@nestjs/terminus` README | Canonical example is `@Module({ controllers: [HealthController], imports: [TypeOrmModule.forRoot(...), TerminusModule] })` wrapping the controller. Not registered directly in `AppModule`. [Source 3] |
| Feature-local tokens stay local | `Sairyss/domain-driven-hexagon` | `src/modules/user/user.di-tokens.ts` holds module-scoped tokens at module root; repos+adapters inside `database/` read them. Root app module never imports them. [Source 4] |
| Domain-named, framework-hidden top-level | Uncle Bob, *Screaming Architecture* (2011-09-30) | *"Architectures are not (or should not) be about frameworks… When you look at the top level directory structure… do they scream: Health Care System, or Accounting System? Or do they scream: Rails, or Spring/Hibernate?"* Our TOP level already passes (auth/sender/parser/audience/gateway). The proposed change improves the **next** level (`infrastructure/{feature}/` is still feature-named, whereas `controllers/rest/` is framework-named — a mini-violation). [Source 5] |
| Modular > flat for non-trivial apps | Official NestJS docs / Trilon blog | *"Each feature (Users, Auth, Products, etc.) is a self-contained module with its own files… making it easy to locate code and reason about that portion of the app. This modular structure directly supports DDD principles."* [Source 6] + Kamil Mysliwiec's official "Advanced Architectural Concepts & Patterns" course explicitly covers Hexagonal+DDD with per-feature modules. [Source 7] |

Three independent sources (brocoders, Sairyss, official Terminus README) all slice by feature. None of them use a `controllers/rest/` bin for health checks. The Screaming Architecture principle reinforces: the next level under the service root should still describe **what the feature does**, not **which framework primitive it is**.

---

## 4. Compatibility with CLAUDE.md's existing rules

### 4.1 Rules that stay as-is

- **"`@email-platform/contracts` (proto) imported ONLY in `infrastructure/controllers/grpc/*.controller.ts` and `infrastructure/clients/{service}/*.module.ts`"** — unchanged; the new `infrastructure/health/` is pure Nest+Terminus, no proto leaks.
- **"`domain/` is pure TypeScript — no `@nestjs/*`"** — unchanged.
- **Phase 999.10 controller/service/use-case/port mapping** — unchanged.
- **"No magic strings for DI tokens — use `Symbol()` in `{svc}.constants.ts`"** — **refine scope**: applies to tokens that cross folders. Feature-local tokens may live in `infrastructure/{feature}/{feature}.constants.ts` (still a `*-constants.ts` file, still `Symbol()`).

### 4.2 Rules that need refinement

**Current rule** (§NestJS↔Hexagonal Layer Mapping): *"One flat `@Module({})` per bounded context — no feature submodules. Shared infrastructure only from foundation (`PersistenceModule`, `LoggingModule`, `AppConfigModule`)."*

**Proposed wording:**

> **One `@Module({})` composition root per bounded context** — the `{svc}.module.ts` is the single place where application services, use cases, and outbound-port→adapter bindings are declared. Domain/application layers do NOT get feature submodules.
>
> **Infrastructure concerns ARE wrapped in feature modules** under `infrastructure/{feature}/{feature}.module.ts`. Canonical features: `config/`, `persistence/`, `clients/`, `health/`, `throttle/`. Each exposes its module class + its public tokens through `index.ts`. The composition root imports these modules — it never inlines Terminus, ThrottlerModule, gRPC client factories, or health controllers.
>
> **Shared cross-cutting modules** still come from `@email-platform/foundation` (`PersistenceModule`, `LoggingModule`, `AppConfigModule`). The per-service `infrastructure/{feature}/` modules are the **assembly** layer on top of those foundation primitives (Phase 999.7.x rule: *Assembly + naming → apps*).

This preserves the spirit of the original rule (the business logic lives flat in one module, not fragmented into a Users/Accounts/Billing submodule hierarchy) while naming the exception that was already unstated-but-true in practice (`GatewayConfigModule`, `GrpcClientsModule`, `ThrottleModule` all exist today).

### 4.3 Asymmetry note — why `clients/` is by-feature but `controllers/grpc/` is by-layer (D-06 reconciliation)

`infrastructure/clients/` groups *outbound* adapters (one folder per upstream service) — correct because each upstream is an independent integration with its own lifecycle, health indicator, config, and proto surface.

`infrastructure/controllers/grpc/` groups *inbound* adapters by protocol — correct because a gRPC service typically exposes **multiple controllers** that all implement pieces of the same proto package (one service, many methods, sometimes split over `auth.controller.ts` + `admin.controller.ts`). The protocol is the common factor. In contrast, REST controllers in this platform are exclusively health endpoints — they don't form a cluster worth a protocol-named bin. Hence `controllers/grpc/` stays, `controllers/rest/` dissolves into `infrastructure/health/`.

---

## 5. Gap analysis — what current codebase violates

### Files/folders to move or create

| Current | Proposed | Notes |
|---|---|---|
| `apps/gateway/src/infrastructure/controllers/rest/health.controller.ts` | `apps/gateway/src/infrastructure/health/health.controller.ts` | move |
| *(no file)* | `apps/gateway/src/infrastructure/health/health.module.ts` | new — wraps Terminus + clients + controller |
| *(no file)* | `apps/gateway/src/infrastructure/health/index.ts` | new — barrel re-exporting `HealthModule` |
| `apps/gateway/src/infrastructure/controllers/` (empty after move) | — | remove directory |
| `apps/{auth,sender,parser,audience}/src/infrastructure/controllers/rest/health.controller.ts` | `apps/{svc}/src/infrastructure/health/health.controller.ts` + `health.module.ts` | repeat × 4 services |
| `apps/gateway/src/gateway.module.ts` | swap `controllers: [HealthController]` → `imports: [..., HealthModule]` | trivial edit |
| `apps/{auth,sender,parser,audience}/src/{svc}.module.ts` | same swap | × 4 |
| `apps/gateway/src/infrastructure/throttle/throttle.module.ts` | *(no change)* | endorse current placement; optionally extract `THROTTLE_TIER` to `throttle.constants.ts` for no-magic-values consistency |
| `.agents/skills/nestjs-hexagonal-mapping/SKILL.md` | add §"Infrastructure feature modules" with the refined rule + the canonical tree from §2 above | skill update |
| `CLAUDE.md` §NestJS↔Hexagonal Layer Mapping | replace the "One flat @Module per bounded context" sentence with §4.2 wording | CLAUDE.md edit |

### Rough migration size

- **~10 file moves** (5 services × health.controller.ts) + **~5 new module files** + **~5 new barrels** + **~6 module-file edits** (composition roots) + **2 doc edits** (CLAUDE.md + skill) ≈ **~28 files touched**.
- Behavior-preserving — no logic changes, no runtime semantics changes. All of it is framework wiring.

### Suggested atomic-commit breakdown (for `/gsd:insert-phase 999.11.2`)

1. `refactor(infra): introduce HealthModule in gateway` — move + new module + root import swap, one service only; verify smoke.
2. `refactor(infra): migrate {auth,sender,parser,audience} HealthController to HealthModule` — four services in one commit (same mechanical move), one atomic commit so rollback is trivial.
3. `refactor(infra): extract THROTTLE_TIER to throttle.constants.ts` — minor no-magic-values polish (optional).
4. `docs(architecture): refine "one flat module per BC" rule + document infra feature modules` — CLAUDE.md + `nestjs-hexagonal-mapping` SKILL update.
5. `chore(gateway): delete empty infrastructure/controllers/` — cleanup; separate commit so the rename is not lost in git blame noise.

---

## 6. What to do next — recommendation

**Open `/gsd:insert-phase 999.11.2 "infrastructure feature module canonicalisation"`.**

Reasoning: this is not a pure docs update (§5 shows 28 files of actual code movement across all 5 services). It is not a `/gsd:fast` because it touches every service and must pass the runtime-smoke-verification loop (`pnpm start:native` + `/health/ready` on every service) to prove no wiring broke. It is bigger than `/gsd:quick`'s single-atomic-commit charter. A decimal phase inserted after 999.11.1 keeps the roadmap coherent (the D-06/D-09/D-10 decisions from 999.11.1 are *refined* rather than overturned — this phase is the natural follow-up).

The phase plan should: (1) cite this research doc, (2) execute the 5-commit breakdown in §5 serially, (3) end with CLAUDE.md + skill edits so all future phases inherit the refined rule.

---

## 7. Sources

1. **brocoders/nestjs-boilerplate** — GitHub repo, `src/` tree inspected via `gh api repos/brocoders/nestjs-boilerplate/contents/src` on 2026-04-20. Shows sibling feature folders (`mailer/`, `session/`, `i18n/`, `mail/`, `home/`) each with own `*.module.ts`, all imported in `AppModule`. 9.6k+ stars. https://github.com/brocoders/nestjs-boilerplate
2. **Sairyss/domain-driven-hexagon** — GitHub repo, `src/` tree inspected via `gh api` on 2026-04-20. `src/modules/user/` has `user.module.ts` + `user.di-tokens.ts` + `database/` + `domain/` + `commands/` — module-local tokens, feature-sliced infrastructure. 13k+ stars. https://github.com/Sairyss/domain-driven-hexagon
3. **@nestjs/terminus README** — official NestJS health-check package. Canonical example shows `HealthModule` wrapping `HealthController` + `TerminusModule`, not root-module registration. https://github.com/nestjs/terminus
4. **Sairyss/domain-driven-hexagon user module** — `src/modules/user/user.di-tokens.ts`, retrieved 2026-04-20. Direct evidence that feature-internal tokens live inside the feature folder. https://github.com/Sairyss/domain-driven-hexagon/blob/master/src/modules/user/user.di-tokens.ts
5. **Robert C. Martin, "Screaming Architecture"** — 2011-09-30. *"Architectures are not (or should not) be about frameworks. Architectures should not be supplied by frameworks."* https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html
6. **NestJS official docs — Modules** — https://docs.nestjs.com/modules — feature-module-per-domain is the documented default.
7. **Trilon / NestJS Official Courses** — Kamil Mysliwiec's "Advanced Architectural Concepts & Patterns" explicitly teaches Hexagonal + Onion + DDD with per-feature modules. https://courses.nestjs.com
8. **brocoders nestjs-boilerplate architecture doc** — *"infrastructure folder — contains all the infrastructure-related components such as persistence, uploader, senders, etc."* Endorses feature-sliced `infrastructure/` subtree per module. https://github.com/brocoders/nestjs-boilerplate/blob/main/docs/architecture.md
9. **dev.to — Bendix, "Applying Domain-Driven Design principles to a Nest.js project"** — https://dev.to/bendix/applying-domain-driven-design-principles-to-a-nest-js-project-5f7b — counter-example (by-layer `/API /Database /Domain`). Cited to acknowledge the competing view; rejected because brocoders + Sairyss + Terminus are more widely adopted and the by-layer approach doesn't scale past a single monolith.

---

## RESEARCH COMPLETE
