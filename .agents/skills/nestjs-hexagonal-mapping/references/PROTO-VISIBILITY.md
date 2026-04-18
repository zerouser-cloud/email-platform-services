# Proto Visibility

This table answers "does this file type import `@email-platform/contracts` (proto) / `@nestjs/microservices` / Drizzle / NestJS DI?" The short answer: only `infrastructure/controllers/grpc/*.controller.ts` sees proto types; application and domain layers are proto-free.

Reference: Phase 999.10 `999.10-RESEARCH.md` §"Proto Visibility Rules".

---

## Visibility Table

| Layer / File type                                            | Sees `@email-platform/contracts` (proto)? | Sees `@nestjs/microservices`?             | Sees Drizzle?                                        | Sees NestJS DI (`@Injectable`/`@Inject`)? |
| ------------------------------------------------------------ | :---------------------------------------: | :---------------------------------------: | :--------------------------------------------------: | :---------------------------------------: |
| `infrastructure/controllers/grpc/*.controller.ts`            | ✓                                         | ✓ (via `@XxxServiceControllerMethods()`)  | ✗                                                    | ✓ (`@Controller()`, `@Inject()`)          |
| `infrastructure/controllers/rest/health.controller.ts`       | ✗                                         | ✗                                         | ✗                                                    | ✓ (`@Controller`, `@Get`, `@Inject`)      |
| `infrastructure/persistence/pg-*.repository.ts`              | ✗                                         | ✗                                         | ✓                                                    | ✓ (`@Injectable`, `@Inject(DRIZZLE)`)     |
| `infrastructure/persistence/mappers/*.mapper.ts`             | ✗                                         | ✗                                         | ✓ (schema types via `$inferSelect` / `$inferInsert`) | ✗ (plain const object)                    |
| `infrastructure/persistence/schema/*.schema.ts`              | ✗                                         | ✗                                         | ✓ (`pgSchema`, column types)                         | ✗                                         |
| `infrastructure/config/*-env.schema.ts`                      | ✗                                         | ✗                                         | ✗                                                    | ✗                                         |
| `infrastructure/clients/*/*.module.ts`                       | ✓ (proto types passed to `defineGrpcClient<T>()`) | ✗ (foundation handles internally) | ✗                                                    | ✓                                         |
| `application/services/*.service.ts`                          | ✗ (D-04)                                  | ✗ (Override 9)                            | ✗                                                    | ✓                                         |
| `application/use-cases/*.use-case.ts`                        | ✗                                         | ✗                                         | ✗                                                    | ✓                                         |
| `application/commands/*.command.ts`                          | ✗                                         | ✗                                         | ✗                                                    | ✗ (pure POJO)                             |
| `application/ports/inbound/*.port.ts`                        | ✗ (D-05)                                  | ✗                                         | ✗                                                    | ✗ (interface + types only)                |
| `application/ports/outbound/*.port.ts`                       | ✗                                         | ✗                                         | ✗                                                    | ✗                                         |
| `domain/entities/*.entity.ts`                                | ✗ (D-06)                                  | ✗                                         | ✗                                                    | ✗                                         |
| `{svc}.module.ts` (composition root)                         | ✗                                         | ✗                                         | ✗                                                    | ✓ (`@Module`)                             |
| `{svc}.constants.ts`                                         | ✗                                         | ✗                                         | ✗                                                    | ✗ (Symbol declarations)                   |
| `main.ts`                                                    | ✓ (indirect via `SERVICE.auth.grpc`)      | ✓ (Transport.GRPC via `createGrpcServerOptions`) | ✗                                               | ✗ (NestFactory, not Inject)               |

---

## Enforcement

Override 8 (domain row) and Override 9 (application rows) in `.eslintrc.js` cover the critical invariants mechanically. Other rows (`persistence`, `infrastructure/clients`, `main.ts`) are isolated by the hexagonal file structure — adding ESLint rules for them is out of scope per D-18 ("Plan 6 adds domain + application only").

Reference: the ESLint overrides are added in Phase 999.10 Plan 06. This skill does NOT embed the JS config — see `.eslintrc.js` for the authoritative source (D-17: single source of truth).

---

## Why This Matters

- **Proto is a transport contract** — it can change without affecting domain. Keeping proto imports out of `application/` and `domain/` means swapping gRPC for REST or RabbitMQ touches only `infrastructure/controllers/`.
- **Drizzle is an ORM detail** — may be replaced by another ORM or raw SQL. Keeping it in `infrastructure/persistence/` means domain entities never know about row shapes.
- **NestJS is a framework choice** — the domain layer must compile with zero framework imports so it could theoretically run under any DI container or no DI at all.
- Keeping these concerns at the infrastructure boundary means domain + application survive re-framework / re-ORM / re-transport changes with no code edits — only the outer ring rewires.
