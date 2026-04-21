# Proto Visibility

This table answers "does this file type import `@email-platform/contracts` (proto) / `@nestjs/microservices` / Drizzle / NestJS DI?" The short answer: only `infrastructure/inbound/grpc/*.controller.ts` (server-side inbound adapter) and `infrastructure/outbound/grpc-clients/{upstream}/*-client.module.ts` (client-side outbound adapter) see proto types; application and domain layers are proto-free.

Reference: Phase 999.10 `999.10-RESEARCH.md` §"Proto Visibility Rules"; canonical paths refreshed per Phase 999.11.2 inbound/outbound/bootstrap direction split.

---

## Visibility Table

| Layer / File type                                                                     | Sees `@email-platform/contracts` (proto)?        | Sees `@nestjs/microservices`?                | Sees Drizzle?                                        | Sees NestJS DI (`@Injectable`/`@Inject`)? |
| ------------------------------------------------------------------------------------- | :----------------------------------------------: | :------------------------------------------: | :--------------------------------------------------: | :---------------------------------------: |
| `infrastructure/inbound/grpc/*.controller.ts`                                         | ✓                                                | ✓ (via `@XxxServiceControllerMethods()`)     | ✗                                                    | ✓ (`@Controller()`, `@Inject()`)          |
| `infrastructure/inbound/grpc/grpc.module.ts`                                          | ✗ (composer binds ports; no proto types)         | ✗                                            | ✗                                                    | ✓ (`@Module`)                             |
| `infrastructure/inbound/rmq/*.consumer.ts`                                            | ✓ (event payload types from contracts)           | ✓ (via `@EventPattern()`)                    | ✗                                                    | ✓                                         |
| `infrastructure/inbound/rmq/rmq.module.ts`                                            | ✗                                                | ✗                                            | ✗                                                    | ✓ (`@Module`)                             |
| `infrastructure/outbound/persistence/{aggregate}/pg-*.repository.ts`                  | ✗                                                | ✗                                            | ✓                                                    | ✓ (`@Injectable`, `@Inject(DRIZZLE)`)     |
| `infrastructure/outbound/persistence/{aggregate}/mappers/*.mapper.ts`                 | ✗                                                | ✗                                            | ✓ (schema types via `$inferSelect` / `$inferInsert`) | ✗ (plain const object)                    |
| `infrastructure/outbound/persistence/{aggregate}/schema/*.schema.ts`                  | ✗                                                | ✗                                            | ✓ (`pgSchema`, column types)                         | ✗                                         |
| `infrastructure/outbound/persistence/{aggregate}/{aggregate}.module.ts`               | ✗                                                | ✗                                            | ✗                                                    | ✓ (`@Module`)                             |
| `infrastructure/outbound/persistence/persistence.module.ts` (composer)                | ✗                                                | ✗                                            | ✗                                                    | ✓ (`@Module`)                             |
| `infrastructure/outbound/grpc-clients/{upstream}/{upstream}-client.module.ts`         | ✓ (proto type passed to `defineGrpcClient<T>()`) | ✗ (foundation handles internally)            | ✗                                                    | ✓                                         |
| `infrastructure/outbound/http-clients/{vendor}/*.client.ts`                           | ✗ (external API — no proto)                      | ✗                                            | ✗                                                    | ✓ (may `@Injectable` when not useFactory) |
| `infrastructure/outbound/http-clients/{vendor}/*-notification.adapter.ts` (notifier)  | ✓ (notification event types from contracts)     | ✗                                            | ✗                                                    | ✓                                         |
| `infrastructure/outbound/storage/{slice}/*.module.ts`                                 | ✗                                                | ✗                                            | ✗                                                    | ✓                                         |
| `infrastructure/bootstrap/config/*-config.module.ts`                                  | ✗                                                | ✗                                            | ✗                                                    | ✓ (`@Module`, `@Global`)                  |
| `infrastructure/bootstrap/config/*-env.schema.ts`                                     | ✗                                                | ✗                                            | ✗                                                    | ✗ (Zod only)                              |
| `infrastructure/bootstrap/health/health.controller.ts`                                | ✗                                                | ✗                                            | ✗                                                    | ✓ (`@Controller`, `@Get`, `@Inject`)      |
| `infrastructure/bootstrap/health/health.module.ts`                                    | ✗                                                | ✗                                            | ✗                                                    | ✓ (`@Module`)                             |
| `infrastructure/bootstrap/throttle/throttle.module.ts` (gateway only)                 | ✗                                                | ✗                                            | ✗                                                    | ✓                                         |
| `application/services/*.service.ts`                                                   | ✗ (D-04)                                         | ✗ (Override 9)                               | ✗                                                    | ✓                                         |
| `application/use-cases/*.use-case.ts`                                                 | ✗                                                | ✗                                            | ✗                                                    | ✓                                         |
| `application/commands/*.command.ts`                                                   | ✗                                                | ✗                                            | ✗                                                    | ✗ (pure POJO)                             |
| `application/ports/inbound/*.port.ts`                                                 | ✗ (D-05)                                         | ✗                                            | ✗                                                    | ✗ (interface + types only)                |
| `application/ports/outbound/*.port.ts`                                                | ✗                                                | ✗                                            | ✗                                                    | ✗                                         |
| `domain/entities/*.entity.ts`                                                         | ✗ (D-06)                                         | ✗                                            | ✗                                                    | ✗                                         |
| `{svc}.module.ts` (composition root)                                                  | ✗                                                | ✗                                            | ✗                                                    | ✓ (`@Module`)                             |
| `{svc}.constants.ts` (5 services; gateway has no such file per D-11a)                 | ✗                                                | ✗                                            | ✗                                                    | ✗ (Symbol declarations)                   |
| `main.ts`                                                                             | ✓ (indirect via `SERVICE.{svc}.grpc`)            | ✓ (Transport.GRPC via `createGrpcServerOptions`) | ✗                                               | ✗ (NestFactory, not Inject)               |

27 rows total (expanded from the pre-999.11.2 17-row table). The extra 10 rows cover the `bootstrap/` sub-bin (`config/` + `health/` + `throttle/`), the per-aggregate persistence feature slicing (`{aggregate}.module.ts`, `persistence.module.ts` composer), the grpc-clients↔http-clients direction split (incl. notifier `*-notification.adapter.ts` which crosses the proto boundary for event payloads), and the `inbound/rmq/` adapter family.

---

## Enforcement

Override 8 (domain row) and Override 9 (application rows) in `.eslintrc.js` cover the critical invariants mechanically. Other rows (`outbound/persistence/`, `outbound/grpc-clients/`, `outbound/http-clients/`, `bootstrap/`, `main.ts`) are isolated by the hexagonal file structure — adding ESLint rules for them is out of scope per D-18 ("Plan 6 adds domain + application only").

Reference: the ESLint overrides are added in Phase 999.10 Plan 06 and their paths are refreshed to canonical `inbound/grpc/`, `outbound/grpc-clients/`, `outbound/persistence/` shape in Phase 999.11.2 Plan 08. This skill does NOT embed the JS config — see `.eslintrc.js` for the authoritative source (D-17: single source of truth).

---

## Why This Matters

- **Proto is a transport contract** — it can change without affecting domain. Keeping proto imports out of `application/` and `domain/` means swapping gRPC for REST or RabbitMQ touches only `infrastructure/inbound/` (server-side) and `infrastructure/outbound/grpc-clients/` (client-side).
- **Drizzle is an ORM detail** — may be replaced by another ORM or raw SQL. Keeping it in `infrastructure/outbound/persistence/{aggregate}/` means domain entities never know about row shapes, and per-aggregate feature slicing keeps the blast radius local when the ORM changes for one aggregate.
- **NestJS is a framework choice** — the domain layer must compile with zero framework imports so it could theoretically run under any DI container or no DI at all.
- **Bootstrap is Ring-4 framework glue** (per Uncle Bob + Seemann composition-root). Bootstrap artifacts — config, health, throttle — are not adapters; they wire the framework itself, which is why they sit outside both inbound/ and outbound/.
- Keeping these concerns at the infrastructure boundary means domain + application survive re-framework / re-ORM / re-transport changes with no code edits — only the outer ring rewires.
