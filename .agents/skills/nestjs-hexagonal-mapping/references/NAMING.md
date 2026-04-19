# Naming Convention

One-to-one file↔class per D-12 (`.planning/phases/999.10-*/999.10-CONTEXT.md`). File name, class name, and suffix are deterministic — no `*.handler.ts` or `*.processor.ts` without a semantic reason.

---

## File↔Class Table

| Type                  | File                                  | Class / Exported Symbol               |
|-----------------------|---------------------------------------|---------------------------------------|
| Controller            | `auth.controller.ts`                  | `AuthController`                      |
| Application Service   | `login.service.ts`                    | `LoginService`                        |
| Use Case              | `verify-credentials.use-case.ts`      | `VerifyCredentialsUseCase`            |
| Command               | `login.command.ts`                    | `LoginCommand`                        |
| Inbound Port          | `login.port.ts`                       | `LoginPort`                           |
| Outbound Port         | `user-repository.port.ts`             | `UserRepositoryPort`                  |
| Repository (adapter)  | `pg-user.repository.ts`               | `PgUserRepository`                    |
| Mapper                | `user.mapper.ts`                      | `UserMapper` (const object)           |
| Entity                | `user.entity.ts`                      | `User`                                |
| Value Object          | `email.vo.ts`                         | `Email`                               |
| Domain Service        | `password-hasher.ts`                  | `PasswordHasher`                      |
| Domain Event          | `user-registered.event.ts`            | `UserRegisteredEvent`                 |

The last three rows (Value Object, Domain Service, Domain Event) are **optional per D-19** — introduced only when real business logic arrives. Phase 999.10 does not create them.

---

## Class Name Rules

- **Controller:** no transport suffix. `AuthController`, not `AuthGrpcServer` or `AuthGrpcController`. Transport is visible via the file path (`controllers/grpc/` vs `controllers/rest/`) and the decorator (`@XxxServiceControllerMethods()` or `@Controller('health')`).
- **Service:** always ends with `Service`. Application services live in `application/services/`. Domain services live in `domain/services/` and typically end with their purpose (`PasswordHasher`), but may end with `Service` if that reads better.
- **Use Case:** always ends with `UseCase`. File stem is `{operation}.use-case.ts` in kebab-case.
- **Port:** always an interface (never a class). Always ends with `Port`. Inbound ports named after the feature (`LoginPort`, `RegisterPort`); outbound ports named after the dependency (`UserRepositoryPort`, `EmailSenderPort`).
- **Command:** POJO class with `readonly` fields. Always ends with `Command`.
- **Repository adapter:** always starts with the database technology prefix (`PgUserRepository` for PostgreSQL via Drizzle; future `MongoUserRepository` would use `Mongo`). Makes it obvious at a glance which engine this adapter targets.
- **Mapper:** plain `const XxxMapper = { toDomain, toPersistence }` — **not** a class, **no** `@Injectable()` decorator, **no** DI. Mappers are pure functions and must stay that way.
- **Entity:** singular noun, no suffix. `User`, `Campaign`, `Recipient`. File stem is `{entity}.entity.ts` in kebab-case.
- **Value Object:** domain concept name. File stem uses `.vo.ts` suffix to distinguish from entities.
- **Domain Event:** always ends with `Event`. File stem uses `.event.ts` suffix.

---

## Field Naming Rules (Phase 999.10.1)

Dependency-injected field names follow runtime identity, not architectural role. This section captures the conventions locked in Phase 999.10.1 and applied across all 4 gRPC microservices (auth, sender, parser, audience).

### (a) Runtime identity principle

Three layers of naming for one injection point:

1. **Field name** — reflects **runtime identity**: what the DI container actually binds at runtime. Example: `listGroupsService` (the concrete class is `ListGroupsService`).
2. **Type annotation** — reflects the **architectural contract**: the abstraction the injection depends on. Example: `ListGroupsPort` (the inbound port interface).
3. **DI token** — reflects the **architectural concern**: the Symbol used to bind provider to consumer. Example: `LIST_GROUPS_PORT`.

All three are visible at the point of injection:

```typescript
@Inject(LIST_GROUPS_PORT) private readonly listGroupsService: ListGroupsPort
//      ^ token (_PORT)     ^ field (runtime)    ^ type (Port)
```

Why this split: `Port` is hexagonal jargon — it tells us "this is the boundary between application and infrastructure." That information belongs on the **type** (where we care about dependency direction) and on the **token** (where we care about DI identity). On the **field**, `Port` adds no information — the reader already sees the type. Duplicating `Port` on the field is redundant.

### (b) Canonical layer-by-layer matrix

| Layer | Field name | Type | DI token | Runtime class |
|-------|-----------|------|----------|---------------|
| Controller → inbound port | `listGroupsService` | `ListGroupsPort` | `LIST_GROUPS_PORT` | `ListGroupsService` |
| Controller → inbound port (collision case) | `loginService` | `LoginPort` | `LOGIN_PORT` | `LoginService` |
| Service → use case (atomic) | `verifyCredentials` | `VerifyCredentialsUseCase` | — (class ref) | `VerifyCredentialsUseCase` |
| Service → use case (shared) | `transitionCampaignStatus` | `TransitionCampaignStatusUseCase` | — (class ref) | `TransitionCampaignStatusUseCase` |
| UseCase → outbound port (Repository) | `userRepository` | `UserRepositoryPort` | `USER_REPOSITORY_PORT` | `PgUserRepository` |

**D-16 universal rule:** every inbound port field carries the `Service` suffix, even when no method collision exists. Predictable across all 4 controllers; no case-by-case thinking.

**D-19 strict verb+noun rule (Service → UseCase):** field name is derived mechanically from the UseCase class stem by dropping the `UseCase` suffix and camelCasing. Shared use cases retain their full name on both consumer services — for example, `TransitionCampaignStatusUseCase` is injected as `transitionCampaignStatus` in BOTH `PauseCampaignService` and `ResumeCampaignService`.

### (c) Domain-role vs architectural-role suffixes

Not all suffixes are Hungarian. The test: does the suffix name a **domain concept** (ubiquitous language) or an **architectural pattern** (boundary jargon)?

- **Domain-role suffixes** — these name concepts that appear in conversation with domain experts. DDD tactical patterns like `Repository`, `Factory`, `Policy`, `Specification`, and role names like `Sender`, `Validator`, `Notifier` qualify. **These ARE mirrored on the field.**
- **Architectural-role suffixes** — these name hexagonal or layering concepts that domain experts don't use. `Port`, `Adapter`, `UseCase`, `Boundary`, `Handler`. **These are NOT mirrored on the field.**

Examples:

```typescript
// Domain-role — `Repository` is DDD vocabulary, stays on field:
private readonly userRepository: UserRepositoryPort

// Architectural-role — `Port` is hexagonal jargon, drops off field:
private readonly loginService: LoginPort
```

**Future candidate:** `NotificationSenderPort` in notifier — `Sender` here is a domain-role suffix (email sender, SMS sender, telegram sender concept). When notifier enters D-04 scope in a future phase, the field would be `notificationSender: NotificationSenderPort` (mirror the domain-role part).

### (d) Hungarian notation anti-pattern (Clean Code ch.2)

> "Hungarian Notation and other forms of type encoding are simply impediments today... People quickly learn to ignore the prefix (or suffix)."
> — Robert C. Martin, *Clean Code*, ch.2 "Meaningful Names"

The rejected pattern:

```typescript
// ANTI-PATTERN: triple-suffix Hungarian
@Inject(LIST_GROUPS_PORT) private readonly listGroupsPort: ListGroupsPort
//                                          ^ field ends in Port
//                                                              ^ type ends in Port
//         ^ token ends in _PORT
```

Three copies of `Port` on one injection point, two of which (field + type) sit side-by-side. Readers start ignoring the `Port` suffix — which defeats its purpose when it DOES matter (on the type).

The rule: put the architectural marker where it carries information (type + token). Leave the field to carry runtime identity.

### (e) Worked examples

**Example A — Controller collision case (audience)**

```typescript
// apps/audience/src/infrastructure/controllers/grpc/audience.controller.ts
@Controller()
@AudienceProto.AudienceServiceControllerMethods()
export class AudienceController implements AudienceProto.AudienceServiceController {
  constructor(
    @Inject(LIST_GROUPS_PORT) private readonly listGroupsService: ListGroupsPort,
    // ... 7 more fields
  ) {}

  async listGroups(req: AudienceProto.ListGroupsRequest): Promise<AudienceProto.GroupList> {
    const cmd = new ListGroupsCommand(/* ... */);
    return this.listGroupsService.execute(cmd);  // ← field access; no collision with method name above
  }
}
```

The proto method `listGroups()` would collide with a hypothetical field named `listGroups`. D-16 universal rule resolves this by requiring `Service` suffix on ALL inbound port fields — collision or not.

**Example B — Service composition (auth LoginService)**

```typescript
// apps/auth/src/application/services/login.service.ts
@Injectable()
export class LoginService implements LoginPort {
  constructor(
    private readonly verifyCredentials: VerifyCredentialsUseCase,
    private readonly issueTokenPair: IssueTokenPairUseCase,
  ) {}

  async execute(cmd: LoginCommand): Promise<LoginResult> {
    const user = await this.verifyCredentials.execute(cmd.email, cmd.password);
    return this.issueTokenPair.execute(user);
  }
}
```

Service fields use action-verb names derived mechanically from the UseCase class stem. Two fields, two use cases, zero generic `useCase:` labels. No `@Inject` needed — UseCase is plain class reference per D-17.

**Example C — UseCase outbound Repository (auth VerifyCredentialsUseCase)**

```typescript
// apps/auth/src/application/use-cases/verify-credentials.use-case.ts
@Injectable()
export class VerifyCredentialsUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    // ... domain logic ...
  }
}
```

Contrast with the anti-pattern:

```typescript
// DO NOT WRITE:
private readonly userRepositoryPort: UserRepositoryPort  // triple-suffix Hungarian
// or:
private readonly users: UserRepositoryPort  // collection name — loses domain-role signal
```

`Repository` is DDD ubiquitous language → mirror on field per D-04. Full prefix `user` matches the type stem (`UserRepositoryPort` → `userRepository`, NOT abbreviated).

### (f) Reference split across authors

| Author | Position | Our adoption |
|--------|----------|--------------|
| Alistair Cockburn (original Hexagonal paper) | `For<Verb><Noun>` port names, no `Port` suffix on types | Rejected — we keep `Port` suffix on TYPES for 999.10 consistency |
| Vaughn Vernon (*IDDD_Samples*) | `userRepository` on field, domain-role mirror | Adopted — D-04 domain-role suffix rule |
| Tom Hombergs (*buckpal* / reflectoring.io) | `loadAccountPort: LoadAccountPort` triple-suffix | Rejected — Hungarian anti-pattern |
| Robert C. Martin (*Clean Code* ch.2) | No Hungarian notation / type encoding | Adopted — authoritative reference |
| Mark Seemann (*DI Revisited*) | Field ≈ camelCase(type), minimal redundancy | Adopted — D-01 runtime-identity rule |
| Juan Manuel Garrido-Paz (*Hexagonal Me* ch.2) | Field = camelCase(type), no redundancy | Adopted (via Seemann) |

**Synthesis:** our project uses **Seemann+Vernon hybrid** — type retains `Port` suffix (999.10 consistency), field drops it (runtime identity), domain-role suffixes mirror (Vernon).

### (g) NotificationSenderPort — future candidate note

The notifier service has `NotificationSenderPort` (email/SMS/telegram sender abstraction). `Sender` here is a domain-role suffix, not a hexagonal one — domain experts talk about "the sender." When notifier enters D-04 scope in a future phase (notifier is out of 999.10.1 scope per CONTEXT.md §Deferred Ideas), the field would mirror the domain-role per Repository-style rule:

```typescript
// Future (notifier phase):
@Inject(NOTIFICATION_SENDER_PORT)
private readonly notificationSender: NotificationSenderPort
```

This extends D-18 (currently Repository-only) to include `Sender` when notifier is in scope.

---

## Folder↔Convention Rules

- **Hexagonal layout, not NestJS flat layout (D-08).** There are no root `src/controllers/`, `src/services/`, `src/dto/`, `src/entities/` folders. They are absorbed into `infrastructure/`, `application/`, `domain/` per the canonical tree in `LAYERS.md`.
- **Transport explicit in path (D-09).** `infrastructure/controllers/grpc/` vs `infrastructure/controllers/rest/`. Adding a REST endpoint to a gRPC service goes into `rest/` next to the health controller.
- **Health always REST (D-10).** `infrastructure/controllers/rest/health.controller.ts`, never `src/health/health.controller.ts`.
- **One module per bounded context (D-11).** One `{svc}.module.ts` per service, flat. No `LoginModule` / `RegisterModule` feature submodules. Submodules are reserved for shared infrastructure from foundation (`PersistenceModule`, `LoggingModule`, `AppConfigModule`).
- **Mappers in a subfolder (D-21).** `infrastructure/persistence/mappers/` — always, from day one, even if only one mapper exists today. Scales predictably.
- **Per-service DI tokens (no cross-service sharing).** `apps/{svc}/src/{svc}.constants.ts` owns every Symbol used inside that bounded context. Two services never share a token file.
