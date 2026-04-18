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

## Folder↔Convention Rules

- **Hexagonal layout, not NestJS flat layout (D-08).** There are no root `src/controllers/`, `src/services/`, `src/dto/`, `src/entities/` folders. They are absorbed into `infrastructure/`, `application/`, `domain/` per the canonical tree in `LAYERS.md`.
- **Transport explicit in path (D-09).** `infrastructure/controllers/grpc/` vs `infrastructure/controllers/rest/`. Adding a REST endpoint to a gRPC service goes into `rest/` next to the health controller.
- **Health always REST (D-10).** `infrastructure/controllers/rest/health.controller.ts`, never `src/health/health.controller.ts`.
- **One module per bounded context (D-11).** One `{svc}.module.ts` per service, flat. No `LoginModule` / `RegisterModule` feature submodules. Submodules are reserved for shared infrastructure from foundation (`PersistenceModule`, `LoggingModule`, `AppConfigModule`).
- **Mappers in a subfolder (D-21).** `infrastructure/persistence/mappers/` — always, from day one, even if only one mapper exists today. Scales predictably.
- **Per-service DI tokens (no cross-service sharing).** `apps/{svc}/src/{svc}.constants.ts` owns every Symbol used inside that bounded context. Two services never share a token file.
