# Call Flow

How a gRPC request traverses the Controller → Service → UseCase → Outbound Port → Adapter → Domain stack and back. Reference: Phase 999.10 auth pilot (`apps/auth/src/` after Plan 02). Every service in the codebase follows this shape — the only thing that varies is how many use cases a Service composes.

---

## Canonical Flow (Login Example)

```
gRPC request (proto types)
  → AuthController.login(req)                    [Controller — implements AuthServiceController]
       │ proto LoginRequest → LoginCommand (domain)
       ▼
  → loginPort.execute(cmd)                       [Inbound port — domain types]
       ▼
  → LoginService.execute(cmd)                    [Application Service — implements LoginPort]
       │ orchestration (even if today pure delegation to ONE use case)
       ▼
  → VerifyCredentialsUseCase.execute(...)        [Use Case — atomic operation]
       │
       ├─ userRepoPort.findByEmail(email)        [Outbound port — domain types]
       │     ▼
       │   PgUserRepository.findByEmail(email)   [Outbound adapter — implements port]
       │     → drizzle SELECT
       │     → UserMapper.toDomain(row)          [Drizzle row → User entity]
       │     ◀ User
       │
       └─ password.matches(stored)               [Domain logic]
       ◀ LoginResult (domain types)
       │
  ← AuthController formats LoginResult → TokenPair (proto)
```

Source: `.planning/phases/999.10-*/999.10-NOTES.md` §"Call flow (canonical)".

Read top-to-bottom: the request enters as proto types at the Controller. The Controller constructs a `LoginCommand` (domain type) and calls the inbound port. The Service orchestrates one or more atomic use cases. A use case calls an outbound port to fetch data; the PostgreSQL adapter runs a Drizzle query and uses a Mapper to yield a domain Entity. The Service assembles a `LoginResult` and returns it up. The Controller projects that result into a proto `TokenPair` response.

---

## Transport Boundary

Proto types cross the domain boundary **exactly twice** per request:

1. **Inbound crossing:** in the Controller method body — `new LoginCommand(req.email, req.password)` converts a proto `LoginRequest` into a domain `LoginCommand`.
2. **Outbound crossing:** in the same Controller method body — `return { accessToken: result.accessToken, ... }` converts a domain `LoginResult` into a proto `TokenPair`.

Everywhere else in the call chain — the Service, every UseCase, every Outbound Port, the Repository adapter, the Mapper, the Entity — sees only domain types. If gRPC is ever replaced by REST or RabbitMQ, nothing below the Controller changes.

---

## Composition Variants

The Service layer is **always present** (D-01 — uniformity over YAGNI), but its body varies based on how many atomic use cases a given RPC decomposes into.

### Pure Delegation

When the D-23 use case audit concludes that one atomic use case suffices for an RPC, the Service is pure delegation today but remains the seam for future cross-cutting (logging, transactions, event emission).

```
Controller
  ▼
LoginService.execute(cmd)     ← implements LoginPort
  │ return this.useCase.execute(cmd)
  ▼
LoginUseCase.execute(cmd)     ← @Injectable() plain class, no implements
  ▼
outbound port(s)
```

One Service, one UseCase, one inbound port. The Service looks trivial — that's acceptable per D-01. Do not skip the layer.

### Composite Service

When an RPC decomposes into multiple atomic operations, the Service composes them — either in sequence or with branching.

```
Controller
  ▼
LoginService.execute(cmd)                         ← implements LoginPort
  │ const user = await this.verifyCredentials.execute(cmd.email, cmd.password)
  │ return this.issueTokenPair.execute(user)
  ▼
  ├─ VerifyCredentialsUseCase.execute(...)        ← @Injectable(), no implements
  │     ▼
  │   UserRepositoryPort.findByEmail
  │
  └─ IssueTokenPairUseCase.execute(user)          ← @Injectable(), no implements
        ▼
      (domain logic + outbound ports)
```

Each use case is independently testable and potentially reusable.

### Use Case Reuse

A single atomic use case can be injected into multiple Services within the **same bounded context** (same `{svc}.module.ts`). Reuse across bounded contexts is forbidden per D-03.

```
AuthModule
  ├── LoginService
  │     └─ uses IssueTokenPairUseCase
  │
  └── RefreshTokenService
        └─ uses IssueTokenPairUseCase     ← same instance, same module
```

Both Services inject the use case as a constructor parameter. Both hit the same instance because NestJS DI resolves to the single provider registered in `AuthModule.providers`.

---

## Error Handling on the Boundary

The Controller may catch domain-layer errors and map them to gRPC-appropriate exceptions (`RpcException`, `NotImplementedException`, etc.) at the transport boundary. The Service and UseCases throw **domain errors** (plain `Error` subclasses, or typed domain error classes once business logic arrives) — they never touch proto or gRPC types.

During Phase 999.10 (no business logic), every method body is a stub:

```ts
throw new NotImplementedException('login not yet implemented');
```

Full error-handling strategy (typed errors, mapping tables, idempotency) is deferred to a future phase when business logic arrives.
