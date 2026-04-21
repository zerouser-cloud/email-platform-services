---
name: nestjs-hexagonal-mapping
description: Server-side NestJS↔Hexagonal layer mapping for gRPC microservices. Apply when building or refactoring the Controller → Service → UseCase stack inside apps/*/src/ — adding a new RPC method, creating a new microservice, or reviewing layer violations. Controller implements proto interface (ts-proto's XxxServiceController); Service implements our own inbound Port; UseCase is atomic and reusable; Domain is pure TypeScript. Proto types live only in infrastructure/inbound/grpc/ (server-side inbound adapter) + infrastructure/outbound/grpc-clients/ (client-side outbound adapter). Triggers: grpc controller, service layer, use case, inbound port, outbound port, application service, command DTO, hexagonal nestjs, ts-proto controller, proto mapping, layer boundary. Reference: Phase 999.10, refined in 999.11.2 (inbound/outbound/bootstrap direction split). Paired skills: clean-ddd-hexagonal (general hexagonal), infrastructure-client-layering (client-side gRPC from 999.7.x + 999.11.2 bootstrap/config refinement) — this skill is the server-side counterpart.
---

# NestJS↔Hexagonal Mapping (Server-Side)

Server-side peer of `infrastructure-client-layering`. Where the client-side skill places gRPC/HTTP/RMQ **clients** across catalog/foundation/apps, this skill places **Controller / Service / UseCase / Port / Adapter / Domain** inside `apps/*/src/` for gRPC microservices. Reference implementation: Phase 999.10 (auth pilot in Plan 02 + sweep of sender/parser/audience in Plans 03-05), refined in Phase 999.11.2 which canonicalised `infrastructure/` into three direction sub-bins: `infrastructure/inbound/`, `infrastructure/outbound/`, `infrastructure/bootstrap/` (see `references/LAYERS.md` §Canonical Tree).

**Why it exists:** NestJS gives you `@Module` / `@Controller` / `@Injectable` primitives. Hexagonal gives you layer boundaries. This skill is the one-to-one mapping — which NestJS primitive goes in which Hexagonal slot, with zero guesswork.

## The Three-Layer Server Stack

```
gRPC request (proto types)
  ─→ {Service}Controller.method(req)              [infrastructure/inbound/grpc/]
       │ proto → Command DTO (domain types)
       ▼
  ─→ {Feature}Port (interface — our own, not proto)  [application/ports/inbound/]
       ▼
  ─→ {Feature}Service implements {Feature}Port     [application/services/]
       │ composition (even if pure delegation today)
       ▼
  ─→ {Operation}UseCase (atomic step)              [application/use-cases/]
       │ may call outbound port
       ▼
  ─→ {Entity}RepositoryPort (outbound interface)   [application/ports/outbound/]
       ▼
  ─→ Pg{Aggregate}Repository implements port       [infrastructure/outbound/persistence/{aggregate}/]
       │ Drizzle query + {Aggregate}Mapper.toDomain
       ▼
  Domain Entity (pure POJO — no framework)
```

Read top-to-bottom: a proto request enters at the controller, is translated into a domain-typed **Command**, crosses the inbound port boundary, is orchestrated by the application **Service**, delegated to one or more **UseCases**, which call outbound ports implemented by infrastructure adapters, which materialise a **domain Entity** via a Mapper. The response reverses the path — the controller projects a domain **Result** back to a proto message at the same boundary.

## When to Use (and When NOT to)

| Use When | Skip When |
|---|---|
| Adding a new RPC method to an existing gRPC microservice | Gateway (REST facade without proto controller) — separate future phase |
| Creating a new gRPC microservice (auth/sender/parser/audience shape) | Notifier (RMQ consumer without gRPC server) — merges with Phase 25 (EventModule) |
| Reviewing a PR that touches `apps/*/src/application/`, `apps/*/src/domain/`, or `apps/*/src/infrastructure/inbound/grpc/` | Packages layer (`packages/foundation`, `packages/contracts`, `packages/config`) — utility libraries, not DDD |
| Refactoring a 2-layer `UseCase implements Port` stack into the 3-layer `Controller → Service → UseCase` canonical form | Client-side gRPC (outbound) — use `infrastructure-client-layering` instead |

## Decision Tree — Adding a New RPC Method

```
New RPC method in a proto file?
|
+-- Step 1: Regenerate contracts (`pnpm generate:contracts`)
|   +-- XxxServiceController interface gets new method automatically
|
+-- Step 2: Create Command DTO
|   +-- apps/{svc}/src/application/commands/{feature}.command.ts
|   +-- export class {Feature}Command { constructor(public readonly ...) {} }
|
+-- Step 3: Create Inbound Port
|   +-- apps/{svc}/src/application/ports/inbound/{feature}.port.ts
|   +-- export interface {Feature}Port { execute(cmd: {Feature}Command): Promise<{Feature}Result> }
|   +-- export interface {Feature}Result { readonly ... }
|
+-- Step 4: Add Symbol DI token
|   +-- apps/{svc}/src/{svc}.constants.ts
|   +-- export const {FEATURE}_PORT = Symbol('{Feature}Port');
|
+-- Step 5: Create UseCase(s) (atomic — may be >1 per RPC)
|   +-- apps/{svc}/src/application/use-cases/{operation}.use-case.ts
|   +-- @Injectable() — plain class, no implements (service implements port, not use case)
|
+-- Step 6: Create Service
|   +-- apps/{svc}/src/application/services/{feature}.service.ts
|   +-- @Injectable() export class {Feature}Service implements {Feature}Port { execute(cmd) }
|   +-- Field injecting UseCase uses action-verb name (see references/NAMING.md §Field Naming Rules)
|
+-- Step 7: Wire Controller method
|   +-- Inject {FEATURE}_PORT in controller constructor
|   +-- method body: new {Feature}Command(req.x, req.y) → port.execute(cmd) → proto response
|
+-- Step 8: Update module composition root
|   +-- providers: add { provide: {FEATURE}_PORT, useClass: {Feature}Service } + every use case as plain provider
```

Steps 2-6 are file-creation; Step 7 wires the controller; Step 8 wires DI. Atomic commit covers the whole chain.

## Proto Visibility (critical)

**Only `apps/*/src/infrastructure/inbound/grpc/` (server-side inbound adapter) and `apps/*/src/infrastructure/outbound/grpc-clients/` (client-side outbound adapter) import `@email-platform/contracts`.** Domain and `application/**` never see proto types. This is the transport boundary — if gRPC is ever replaced by REST or RabbitMQ, nothing below the controller changes.

Enforced mechanically by ESLint Override 8 (domain isolation) and Override 9 (application isolation) in `.eslintrc.js` (added in Phase 999.10 Plan 06; paths refreshed in 999.11.2 Plan 08). See `references/PROTO-VISIBILITY.md` for the full file-type visibility matrix.

## Anti-Patterns

1. **Controller class named with transport suffix** — `AuthGrpcServer` instead of `AuthController`. Transport is visible via decorators (`@XxxServiceControllerMethods`) and file path (`infrastructure/inbound/grpc/`), not via class name.
2. **UseCase `implements Port` directly** — the pre-999.10 2-layer form. Service now implements Port; UseCase is a plain `@Injectable()`.
3. **Service `implements XxxServiceController`** (proto interface) — wrong. Controller implements proto; Service implements OUR port.
4. **Positional args in use case signature** — `execute(email, password)`. Use a Command DTO instead: `execute(cmd: LoginCommand)`.
5. **`@Injectable()` or `@Inject()` decorators inside `domain/`** — domain is pure TypeScript, zero framework imports.
6. **Proto import (`@email-platform/contracts`) inside `application/`** — only controllers see proto.
7. **HealthController at `apps/{svc}/src/health/`** — must be at `apps/{svc}/src/infrastructure/bootstrap/health/` (bootstrap is Ring-4 framework glue; health is not a business feature).
8. **Mappers flat in `infrastructure/outbound/persistence/{aggregate}/`** — must be in `infrastructure/outbound/persistence/{aggregate}/mappers/` once a real Drizzle row→entity translation exists; stub repositories without real persistence may omit `mappers/` until it lands.
9. **Feature submodules** (`LoginModule`, `RegisterModule`) — one flat module per bounded context; submodules only for shared infrastructure from foundation.
10. **Hungarian notation on DI field names** — field should reflect runtime identity (`xxxService`, `userRepository`), not repeat the `Port` type suffix (`xxxPort: XxxPort`). See `references/NAMING.md` §Field Naming Rules.

Full Don't / Do / Why / Detected-by block for each in `references/DO-DONT.md`.

## See Also

- `.agents/skills/clean-ddd-hexagonal/SKILL.md` — general Hexagonal philosophy + DDD tactical patterns (language-agnostic).
- `.agents/skills/infrastructure-client-layering/SKILL.md` — paired skill (client-side gRPC layering across catalog/foundation/apps) + §Config subsection with Phase 999.11.2 refinement for `bootstrap/config/` placement. References: Phase 999.7.x, 999.11.1, 999.11.2.
- `.agents/skills/composition-over-inheritance/SKILL.md` — services compose use cases, they do not extend them.
- `.agents/skills/no-magic-values/SKILL.md` — Symbol DI tokens (never string tokens); every inbound/outbound port gets a `Symbol('XxxPort')`.

## References

- `references/LAYERS.md` — per-layer (`infrastructure/`, `application/`, `domain/`) subfolder definitions with allowed imports and canonical file names.
- `references/CALL-FLOW.md` — canonical ASCII call flow (Login example) plus variants: pure delegation, composite service, use-case reuse.
- `references/NAMING.md` — one-to-one file↔class table (D-12) plus class-name rules (Controller/Service/UseCase/Port/Command/Mapper/Entity) plus **field-naming rules (Phase 999.10.1)**.
- `references/EXAMPLES.md` — three worked examples (composite service, pure delegation, proto↔command mapping) plus 2-layer-to-3-layer before/after.
- `references/PROTO-VISIBILITY.md` — 17-row table: who sees `@email-platform/contracts` / `@nestjs/microservices` / Drizzle / NestJS DI per file type.
- `references/DO-DONT.md` — 9 anti-patterns in Don't / Do / Why / Detected-by format.
