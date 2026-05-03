# Naming Convention

This document describes timeless naming principles. Do NOT add inventory (specific file paths beyond stable workspace roots, class names tied to a particular production service, enumerated counts of services / ports / tokens). For current-state lookups, link to a tracked config file by role, link to an enclosing directory, or provide a `grep` command. Every assertion here must survive the rename test.

One-to-one file↔class. File name, class name, and suffix are deterministic — no `*.handler.ts` or `*.processor.ts` without a semantic reason.

---

## File↔Class Table

The shape below is templated. Substitute `{svc}`, `{Feature}`, `{Entity}`, `{Aggregate}` etc. with the concrete name of the bounded context / feature / entity being introduced. For the current per-service file census of this project, see CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" — that section is the inventory source of truth.

| Type                  | File                                        | Class / Exported Symbol                       |
|-----------------------|---------------------------------------------|-----------------------------------------------|
| Controller            | `{svc}.controller.ts`                       | `{Svc}Controller`                             |
| Application Service   | `{feature}.service.ts`                      | `{Feature}Service`                            |
| Use Case              | `{operation}.use-case.ts`                   | `{Operation}UseCase`                          |
| Command               | `{feature}.command.ts`                      | `{Feature}Command`                            |
| Inbound Port          | `{feature}.port.ts`                         | `{Feature}Port`                               |
| Outbound Port         | `{entity}-repository.port.ts`               | `{Entity}RepositoryPort`                      |
| Repository (adapter)  | `pg-{entity}.repository.ts`                 | `Pg{Entity}Repository`                        |
| Mapper                | `{aggregate}.mapper.ts`                     | `{Aggregate}Mapper` (const object)            |
| Entity                | `{entity}.entity.ts`                        | `{Entity}`                                    |
| Value Object          | `{vo}.vo.ts`                                | `{ValueObject}`                               |
| Domain Service        | `{name}.ts`                                 | `{Name}` (role-named, not suffixed `Service`) |
| Domain Event          | `{event}.event.ts`                          | `{Event}Event`                                |

The last three rows (Value Object, Domain Service, Domain Event) are **optional** — introduced only when real business logic arrives.

---

## Class Name Rules

- **Controller:** no transport suffix. Template `{Svc}Controller`, not `{Svc}GrpcServer` or `{Svc}GrpcController`. Transport is visible via the file path (`infrastructure/inbound/grpc/` for gRPC controllers, `infrastructure/bootstrap/health/` for the REST HealthController) and the decorator (`@{Svc}ServiceControllerMethods()` for gRPC or `@Controller('health')` for REST probes).
- **Service:** always ends with `Service`. Application services live in `application/services/`. Domain services live in `domain/services/` and typically end with their purpose (role-named — e.g., a hasher, a validator), but may end with `Service` if that reads better.
- **Use Case:** always ends with `UseCase`. File stem is `{operation}.use-case.ts` in kebab-case.
- **Port:** always an interface (never a class). Always ends with `Port`. Inbound ports named after the feature (`{Feature}Port`); outbound ports named after the dependency (`{Entity}RepositoryPort`, `{Role}SenderPort`).
- **Command:** POJO class with `readonly` fields. Always ends with `Command`.
- **Repository adapter:** always starts with the database technology prefix (`Pg{Entity}Repository` for PostgreSQL via Drizzle; a future `Mongo{Entity}Repository` would use `Mongo`). Makes it obvious at a glance which engine this adapter targets.
- **Mapper:** plain `const {Aggregate}Mapper = { toDomain, toPersistence }` — **not** a class, **no** `@Injectable()` decorator, **no** DI. Mappers are pure functions and must stay that way.
- **Entity:** singular noun, no suffix. File stem is `{entity}.entity.ts` in kebab-case.
- **Value Object:** domain concept name. File stem uses `.vo.ts` suffix to distinguish from entities.
- **Domain Event:** always ends with `Event`. File stem uses `.event.ts` suffix.

---

## Field Naming Rules

Dependency-injected field names follow runtime identity, not architectural role. This convention applies across every gRPC microservice in the workspace (find the current list with `ls apps/*/src/infrastructure/inbound/grpc/ 2>/dev/null`).

### (a) Runtime identity principle

Three layers of naming for one injection point:

1. **Field name** — reflects **runtime identity**: what the DI container actually binds at runtime. Example (fictional): `fooService` (the concrete class is `FooService`).
2. **Type annotation** — reflects the **architectural contract**: the abstraction the injection depends on. Example: `FooPort` (the inbound port interface).
3. **DI token** — reflects the **architectural concern**: the Symbol used to bind provider to consumer. Example: `FOO_PORT`.

All three are visible at the point of injection:

```typescript
@Inject(FOO_PORT) private readonly fooService: FooPort
//      ^ token (_PORT)   ^ field (runtime)   ^ type (Port)
```

Why this split: `Port` is hexagonal jargon — it tells us "this is the boundary between application and infrastructure." That information belongs on the **type** (where we care about dependency direction) and on the **token** (where we care about DI identity). On the **field**, `Port` adds no information — the reader already sees the type. Duplicating `Port` on the field is redundant.

### (b) Canonical layer-by-layer matrix

Template shape (fictional names are placeholders — substitute the actual feature / entity / operation in your bounded context):

| Layer | Field name | Type | DI token | Runtime class |
|-------|-----------|------|----------|---------------|
| Controller → inbound port | `{feature}Service` | `{Feature}Port` | `{FEATURE}_PORT` | `{Feature}Service` |
| Controller → inbound port (collision case) | `{feature}Service` | `{Feature}Port` | `{FEATURE}_PORT` | `{Feature}Service` |
| Service → use case (atomic) | `{verbNoun}` | `{Operation}UseCase` | — (class ref) | `{Operation}UseCase` |
| Service → use case (shared across services) | `{verbNoun}` | `{Operation}UseCase` | — (class ref) | `{Operation}UseCase` |
| UseCase → outbound port (Repository) | `{entity}Repository` | `{Entity}RepositoryPort` | `{ENTITY}_REPOSITORY_PORT` | `Pg{Entity}Repository` |

**Inbound-port field suffix rule.** Every inbound port field carries the `Service` suffix, even when no method collision exists between the proto-generated method and the candidate field name. Predictable across all controllers — no case-by-case thinking.

**Service → UseCase verb+noun rule.** The field name is derived mechanically from the UseCase class stem by dropping the `UseCase` suffix and camelCasing. A shared use case retains its full name on every consumer service that composes it — if two services inject `{Operation}UseCase`, both expose it on the field `{verbNoun}`.

### (c) Domain-role vs architectural-role suffixes

Not all suffixes are Hungarian. The test: does the suffix name a **domain concept** (ubiquitous language) or an **architectural pattern** (boundary jargon)?

- **Domain-role suffixes** — these name concepts that appear in conversation with domain experts. DDD tactical patterns like `Repository`, `Factory`, `Policy`, `Specification`, and role names like `Sender`, `Validator`, `Notifier` qualify. **These ARE mirrored on the field.**
- **Architectural-role suffixes** — these name hexagonal or layering concepts that domain experts don't use. `Port`, `Adapter`, `UseCase`, `Boundary`, `Handler`. **These are NOT mirrored on the field.**

Examples (fictional names — placeholders):

```typescript
// Domain-role — `Repository` is DDD vocabulary, stays on field:
private readonly fooRepository: FooRepositoryPort

// Architectural-role — `Port` is hexagonal jargon, drops off field:
private readonly barService: BarPort
```

When a domain-role suffix like `Sender` appears in an outbound port name (e.g., a hypothetical `QuxSenderPort` abstracting some delivery channel), the field mirrors the domain-role part: `quxSender: QuxSenderPort`. `Sender` is part of the ubiquitous domain language; `Port` is not.

### (d) Hungarian notation anti-pattern (Clean Code ch.2)

> "Hungarian Notation and other forms of type encoding are simply impediments today... People quickly learn to ignore the prefix (or suffix)."
> — Robert C. Martin, *Clean Code*, ch.2 "Meaningful Names"

The rejected pattern (fictional names):

```typescript
// ANTI-PATTERN: triple-suffix Hungarian
@Inject(FOO_PORT) private readonly fooPort: FooPort
//                                  ^ field ends in Port
//                                           ^ type ends in Port
//         ^ token ends in _PORT
```

Three copies of `Port` on one injection point, two of which (field + type) sit side-by-side. Readers start ignoring the `Port` suffix — which defeats its purpose when it DOES matter (on the type).

The rule: put the architectural marker where it carries information (type + token). Leave the field to carry runtime identity.

### (e) Worked example

A single fictional example covers the three most common injection shapes (controller → inbound port, service → use case, use case → outbound port). Substitute concrete names from your bounded context.

**Controller → inbound port (fictional `FooController` + `FooService`).** Controller implements the proto-generated `{Svc}ServiceController` interface and composes application services by inbound-port Symbol:

```typescript
// apps/{svc}/src/infrastructure/inbound/grpc/{svc}.controller.ts
@Controller()
@FooProto.FooServiceControllerMethods()
export class FooController implements FooProto.FooServiceController {
  constructor(
    @Inject(FOO_PORT) private readonly fooService: FooPort,
    // ... one field per RPC method
  ) {}

  async foo(req: FooProto.FooRequest): Promise<FooProto.FooResponse> {
    const cmd = new FooCommand(/* ... */);
    return this.fooService.execute(cmd);
  }
}
```

Notes: the proto method name (e.g., `foo()`) can collide with a hypothetical field named `foo`. The inbound-port field suffix rule resolves this by requiring `Service` suffix on ALL inbound port fields — collision or not.

**Service → use cases (fictional `FooService` composing two use cases).** Application service implements the inbound port and composes atomic use cases by plain class reference:

```typescript
// apps/{svc}/src/application/services/{feature}.service.ts
@Injectable()
export class FooService implements FooPort {
  constructor(
    private readonly doFirstThing: DoFirstThingUseCase,
    private readonly doSecondThing: DoSecondThingUseCase,
  ) {}

  async execute(cmd: FooCommand): Promise<FooResult> {
    const interim = await this.doFirstThing.execute(cmd.input);
    return this.doSecondThing.execute(interim);
  }
}
```

Service fields use action-verb names derived mechanically from the UseCase class stem (`DoFirstThingUseCase` → `doFirstThing`). No `@Inject` needed — UseCase is a plain class reference.

**UseCase → outbound Repository (fictional `DoFirstThingUseCase` + `BarRepositoryPort`).** Use case injects outbound port by Symbol token; field mirrors the domain-role (`Repository`), type and token carry the architectural-role (`Port` / `_PORT`):

```typescript
// apps/{svc}/src/application/use-cases/{operation}.use-case.ts
@Injectable()
export class DoFirstThingUseCase {
  constructor(
    @Inject(BAR_REPOSITORY_PORT)
    private readonly barRepository: BarRepositoryPort,
  ) {}

  async execute(input: FooInput): Promise<FooInterim> {
    const bar = await this.barRepository.findBy(/* ... */);
    // ... domain logic ...
  }
}
```

Contrast with the anti-pattern:

```typescript
// DO NOT WRITE:
private readonly barRepositoryPort: BarRepositoryPort  // triple-suffix Hungarian
// or:
private readonly bars: BarRepositoryPort               // collection name — loses domain-role signal
```

`Repository` is DDD ubiquitous language → mirror on field. Full prefix `bar` matches the type stem (`BarRepositoryPort` → `barRepository`, NOT abbreviated).

### (f) Reference split across authors

| Author | Position | Our adoption |
|--------|----------|--------------|
| Alistair Cockburn (original Hexagonal paper) | `For<Verb><Noun>` port names, no `Port` suffix on types | Rejected — we keep `Port` suffix on TYPES for consistency |
| Vaughn Vernon (*IDDD_Samples*) | `userRepository` on field, domain-role mirror | Adopted — domain-role suffix rule |
| Tom Hombergs (*buckpal* / reflectoring.io) | `loadAccountPort: LoadAccountPort` triple-suffix | Rejected — Hungarian anti-pattern |
| Robert C. Martin (*Clean Code* ch.2) | No Hungarian notation / type encoding | Adopted — authoritative reference |
| Mark Seemann (*DI Revisited*) | Field ≈ camelCase(type), minimal redundancy | Adopted — runtime-identity rule |
| Juan Manuel Garrido-Paz (*Hexagonal Me* ch.2) | Field = camelCase(type), no redundancy | Adopted (via Seemann) |

**Synthesis:** our project uses a **Seemann+Vernon hybrid** — type retains `Port` suffix (workspace consistency), field drops it (runtime identity), domain-role suffixes mirror (Vernon).

Historical note: the field-naming convention described above was locked during the project's first gRPC-microservice slice; the decision record lives under `.planning/phases/` — search for the phase that introduced the inbound-port field suffix rule.

---

## Folder↔Convention Rules

- **Hexagonal layout, not NestJS flat layout.** There are no root `src/controllers/`, `src/services/`, `src/dto/`, `src/entities/` folders. They are absorbed into `infrastructure/`, `application/`, `domain/` per the canonical tree in `references/LAYERS.md`.
- **Transport + direction explicit in path.** `infrastructure/inbound/grpc/` for server-side gRPC controllers; `infrastructure/inbound/rmq/` for RabbitMQ consumers; `infrastructure/inbound/rest/{feature}/` reserved for future feature-REST endpoints. Adding a REST business feature to an existing service creates `inbound/rest/{feature}/`; the HealthController stays in `bootstrap/health/` (see next rule).
- **Health in bootstrap.** `infrastructure/bootstrap/health/health.controller.ts`, never `src/health/health.controller.ts` and never `infrastructure/inbound/rest/health.controller.ts`. Health is Ring-4 framework glue — it lives with the other composition-root artefacts (`bootstrap/config/`, `bootstrap/throttle/`), not with business-feature inbound adapters.
- **One flat module per bounded context.** One `{svc}.module.ts` per service, flat. No per-feature submodules (no `{Feature}Module` for each RPC method). Submodules are reserved for category composers inside each infrastructure direction bin (e.g., a composer inside `inbound/grpc/`, a composer inside `outbound/persistence/`, one per outbound integration category) and for shared infrastructure from foundation (`LoggingModule`, `PersistenceModule`).
- **Mappers in a subfolder when a Drizzle row→entity translation exists.** `infrastructure/outbound/persistence/{aggregate}/mappers/{aggregate}.mapper.ts` is the canonical location once real persistence lands. Stub repositories without a real Drizzle translation may omit `mappers/` until the translation exists. Once a mapper is introduced, it lives in `mappers/` from day one of that aggregate's real-persistence phase.
- **Per-service DI tokens (no cross-service sharing).** `apps/{svc}/src/{svc}.constants.ts` owns every cross-folder domain-port Symbol used inside that bounded context, in every service that owns at least one such Symbol. A service whose composition root owns no cross-folder domain-port Symbols (for example, a REST facade that forwards to outbound gRPC without any application ports of its own) has no root `{svc}.constants.ts`. Two services never share a token file.

---

## See Also

- CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" — project-level authoritative file-path matrix and paired doc.
- `references/LAYERS.md` — layer-by-layer artefact-role descriptions referenced throughout this document.
- `.claude/skills/no-magic-values/SKILL.md` — Symbol DI token rule referenced in the Class Name Rules section.
