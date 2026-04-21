# Do / Don't

Ten anti-patterns common in a NestJS + Hexagonal codebase, with the right form, the rationale, and how to detect each mechanically. Detection column uses file-structure checks, compile errors, ESLint overrides (added by Phase 999.10 Plan 06; paths refreshed in 999.11.2 Plan 08), or grep. Canonical paths use the inbound/outbound/bootstrap direction split established in Phase 999.11.2.

---

### 1. Controller transport suffix

**Don't:**

```ts
export class AuthGrpcServer implements AuthProto.AuthServiceController { ... }
```

**Do:**

```ts
export class AuthController implements AuthProto.AuthServiceController { ... }
```

**Why:** D-07 — single transport-agnostic naming convention. Transport is visible via the decorator (`@AuthServiceControllerMethods()`) and the file path (`inbound/grpc/` for gRPC controllers, `bootstrap/health/` for the REST HealthController). Class name staying clean keeps a HealthController at `bootstrap/health/` and an AuthController at `inbound/grpc/` symmetric on their class names while the directory signals the transport + Ring.

**Detected by:** code review; `grep -r "class [A-Za-z]*GrpcServer" apps/` must return empty after Phase 999.10.

---

### 2. UseCase implements Port directly

**Don't:**

```ts
@Injectable()
export class LoginUseCase implements LoginPort {
  async execute(email: string, password: string): Promise<LoginResult> { ... }
}
```

**Do:**

```ts
@Injectable()
export class LoginService implements LoginPort {
  constructor(private readonly useCase: VerifyCredentialsUseCase) {}
  async execute(cmd: LoginCommand): Promise<LoginResult> { ... }
}

@Injectable()
export class VerifyCredentialsUseCase {  // no implements
  async execute(email: string, password: string): Promise<User> { ... }
}
```

**Why:** D-01..D-03 — 3-layer stack. Service is the seam for future cross-cutting (logging, transactions, events); UseCases become atomic and reusable across Services within the bounded context.

**Detected by:** code review; the file `apps/{svc}/src/application/services/*.service.ts` must exist and carry the `implements XxxPort` — if a `*.use-case.ts` file has `implements XxxPort`, that's the old 2-layer form.

---

### 3. Service implements proto interface

**Don't:**

```ts
// apps/auth/src/application/services/login.service.ts
import { AuthProto } from '@email-platform/contracts';   // ← Proto leak into application/

@Injectable()
export class LoginService implements AuthProto.AuthServiceController {
  async login(req: AuthProto.LoginRequest): Promise<AuthProto.TokenPair> { ... }
}
```

**Do:**

```ts
@Injectable()
export class LoginService implements LoginPort {          // ← our own port
  async execute(cmd: LoginCommand): Promise<LoginResult> { ... }
}
```

**Why:** D-04 — proto stays in the controller only. Controller implements the generated `AuthServiceController`; Service implements OUR `LoginPort` and works in domain types. If gRPC is replaced by REST or RMQ tomorrow, nothing in `application/` changes.

**Detected by:** ESLint Override 9 (forbids `@email-platform/contracts` in `apps/*/src/application/**`); also a compile error if the Service tries to implement a proto interface without importing proto.

---

### 4. Positional args in use case / port signature

**Don't:**

```ts
export interface LoginPort {
  execute(email: string, password: string): Promise<LoginResult>;
}

@Injectable()
export class LoginService implements LoginPort {
  async execute(email: string, password: string): Promise<LoginResult> { ... }
}
```

**Do:**

```ts
// login.command.ts
export class LoginCommand {
  constructor(public readonly email: string, public readonly password: string) {}
}

// login.port.ts
export interface LoginPort {
  execute(cmd: LoginCommand): Promise<LoginResult>;
}
```

**Why:** D-20 — scalable signature. Adding a new field (e.g., `deviceId`) does not break existing call sites. Foundation for future `class-validator` decorators on Command fields when validation arrives.

**Detected by:** review; `grep -nE "execute\((email|password|id|name)" apps/*/src/application/ports/inbound/*.port.ts` must return empty.

---

### 5. `@Injectable()` or `@Inject()` in domain

**Don't:**

```ts
// apps/auth/src/domain/entities/user.entity.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class User {
  constructor(public readonly id: string, public readonly email: string) {}
}
```

**Do:**

```ts
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly role: string,
    public readonly organization: string,
    public readonly team: string,
  ) {}
}
```

**Why:** D-06 — domain is pure TypeScript. Zero framework imports. The domain layer must compile with NestJS deleted. Entities are POJOs, value objects are immutable classes, domain services are plain classes (exception: a domain service may be `@Injectable()` ONLY when it truly needs NestJS DI to compose an adapter, and even then the decorator is wiring, not domain logic).

**Detected by:** ESLint Override 8 (forbids `@nestjs/*` imports in `apps/*/src/domain/**`).

---

### 6. Proto import inside application/

**Don't:**

```ts
// apps/auth/src/application/services/login.service.ts
import { AuthProto } from '@email-platform/contracts';   // ← layer violation

@Injectable()
export class LoginService implements LoginPort {
  async execute(cmd: LoginCommand): Promise<LoginResult> {
    const proto: AuthProto.LoginRequest = ...;   // ← proto type in application layer
    // ...
  }
}
```

**Do:**

```ts
// apps/auth/src/infrastructure/inbound/grpc/auth.controller.ts
async login(req: AuthProto.LoginRequest): Promise<AuthProto.TokenPair> {
  const cmd = new LoginCommand(req.email, req.password);   // boundary mapping here
  const result = await this.loginPort.execute(cmd);
  return { accessToken: result.accessToken, ... };
}

// apps/auth/src/application/services/login.service.ts (no proto import)
@Injectable()
export class LoginService implements LoginPort { ... }
```

**Why:** D-04 — transport boundary at the controller. Proto types are a transport concern; they must not leak past `infrastructure/inbound/grpc/`.

**Detected by:** ESLint Override 9 (forbids `@email-platform/contracts` imports in `apps/*/src/application/**`).

---

### 7. HealthController at `src/health/`

**Don't:**

```
apps/auth/src/
├── health/
│   └── health.controller.ts        ← outlier: not in hexagonal layout
├── application/
├── domain/
└── infrastructure/
```

**Do:**

```
apps/auth/src/
├── application/
├── domain/
└── infrastructure/
    ├── bootstrap/
    │   └── health/
    │       └── health.controller.ts
    ├── inbound/
    │   └── grpc/
    │       └── auth.controller.ts
    └── outbound/
```

**Why:** D-10 (hexagonal layout) + D-08 from Phase 999.11.2 (bootstrap sub-bin). Health is Ring-4 framework glue (composition-root concern), not a business-feature inbound adapter — it reports process liveness/readiness to the orchestrator and shares its DI wiring with Terminus + the infra-health indicators. Placing it under `bootstrap/health/` keeps `inbound/rest/` reserved for future feature-REST endpoints (gateway auth-login, campaigns API) without mixing the two concerns. Before 999.11.2 HealthController lived in `controllers/rest/` (4 services) or the anti-pattern `src/health/` (gateway, notifier) — now uniformly in `bootstrap/health/` across all 6 services.

**Detected by:**
- `find apps/{auth,sender,parser,audience,gateway,notifier} -path "*/src/health" -type d` must return empty.
- `find apps -path "*/infrastructure/bootstrap/health/health.controller.ts" | wc -l` must return `6` (all services).
- `find apps -path "*/infrastructure/inbound/rest/health.controller.ts" | wc -l` must return `0` (D-04 from 999.11.2).

---

### 8. Mappers flat in persistence/

**Don't:**

```
apps/auth/src/infrastructure/persistence/
├── pg-user.repository.ts
└── user.mapper.ts              ← flat, no subfolder
```

**Do:**

```
apps/auth/src/infrastructure/outbound/persistence/
├── persistence.module.ts                           ← category composer (imports per-aggregate modules)
└── user/                                           ← one folder per aggregate (D-02 from 999.11.2)
    ├── user.module.ts                              ← per-aggregate DynamicModule (binds USER_REPOSITORY_PORT)
    ├── pg-user.repository.ts
    ├── mappers/
    │   └── user.mapper.ts
    └── schema/
        └── users.schema.ts
```

**Why:** D-21 (predictable subfolder structure) + D-02 from Phase 999.11.2 (per-aggregate feature slicing). Every aggregate in a service gets its own slice with the `{aggregate}.module.ts` + `pg-{aggregate}.repository.ts` + `mappers/{aggregate}.mapper.ts` + `schema/{aggregates}.schema.ts` shape. Scales to multi-aggregate services naturally (see `apps/audience/src/infrastructure/outbound/persistence/{group,recipient}/` for the 2-aggregate case). Stub repositories without a real Drizzle translation may omit `mappers/` until real persistence lands (see `apps/audience/src/infrastructure/outbound/persistence/group/` — stub repo, no `mappers/` yet — as the canonical stub shape).

**Detected by:**
- `find apps/*/src/infrastructure/outbound/persistence -maxdepth 2 -name "*.mapper.ts"` must return empty (mappers must live one level deeper, in `{aggregate}/mappers/`, not directly under `outbound/persistence/` or under `outbound/persistence/{aggregate}/`).
- `find apps -path '*/outbound/persistence/*/pg-*.repository.ts' | wc -l` matches aggregate count (5 aggregates total across 4 services — auth/user, sender/campaign, parser/parser-task, audience/group + audience/recipient).
- Legacy flat layout check: `find apps/*/src -type d -name persistence -not -path '*/outbound/*'` must return empty (pre-999.11.2 `infrastructure/persistence/` without the `outbound/` parent is gone).

---

### 9. Feature submodules

**Don't:**

```ts
// apps/auth/src/auth.module.ts
@Module({
  imports: [LoginModule, RegisterModule, RefreshTokenModule, ...],   // ← feature split
})
export class AuthModule {}

// apps/auth/src/login/login.module.ts
@Module({ controllers: [LoginController], providers: [LoginService, ...] })
export class LoginModule {}
```

**Do:**

```ts
// apps/auth/src/auth.module.ts — one flat composition root per bounded context
@Module({
  imports: [
    AuthConfigModule.forRoot(),           // bootstrap/config/ — FIRST per 999.11.1 Canonical Config Access Contract
    HealthModule,                         // bootstrap/health/
    LoggingModule.forGrpcAsync('auth'),   // foundation
    PersistenceModule,                    // outbound/persistence/ composer — imports per-aggregate modules
    GrpcModule,                           // inbound/grpc/ — declares AuthController, binds inbound-port Symbols
  ],
  providers: [
    // Zone 1: outbound domain-port bindings (may live in PersistenceModule instead)
    { provide: USER_REPOSITORY_PORT, useClass: PgUserRepository },
    // Zone 2: inbound domain-port bindings (may live in GrpcModule instead)
    { provide: LOGIN_PORT,    useClass: LoginService },
    { provide: REGISTER_PORT, useClass: RegisterService },
    // Zone 3: atomic use-case providers (plain class references)
    VerifyCredentialsUseCase,
    IssueTokenPairUseCase,
  ],
  // controllers: []  ← empty; controllers live inside GrpcModule per 999.11.2 Plan 10 Option A
})
export class AuthModule {}
```

**Why:** D-11 — one flat module per bounded context. Submodules are reserved for category composers (feature-slicing machinery introduced in 999.11.2: `GrpcModule`, `PersistenceModule`, `GrpcClientsModule`, `HttpClientsModule`, `StorageModule`, `RmqModule`) and for shared infrastructure from foundation. Feature-business submodules (`LoginModule`, `RegisterModule`) add nesting with no architectural benefit — the bounded context is already the `apps/{svc}/` directory.

**Gateway exception (D-11a, Phase 999.11.2):** Gateway has NO root `apps/gateway/src/gateway.constants.ts` — the file was deleted after `GATEWAY_CONFIG` moved to `bootstrap/config/` and no cross-folder domain-port Symbols remained (gateway is a REST facade forwarding via outbound gRPC; it has no application ports today). References in this skill to `{svc}.constants.ts` therefore read as "all services except gateway."

**Detected by:**
- `find apps/{auth,sender,parser,audience,notifier}/src -maxdepth 2 -name "*.module.ts"` lists only the root `{svc}.module.ts` — category composer modules live deeper under `infrastructure/{inbound,outbound,bootstrap}/` sub-bins.
- `find apps/gateway/src -maxdepth 2 -name "*.module.ts"` lists only `gateway.module.ts` (gateway has no `inbound/` composer per D-GATEWAY-02).
- Legacy feature-submodule check: `find apps/*/src -maxdepth 2 -type d \( -name login -o -name register -o -name refresh-token \)` must return empty (no `LoginModule`-shaped feature submodules).

---

### 10. Hungarian notation in DI field names

**Don't:**

```ts
@Inject(LIST_GROUPS_PORT) private readonly listGroupsPort: ListGroupsPort
@Inject(USER_REPOSITORY_PORT) private readonly userRepositoryPort: UserRepositoryPort
```

**Do:**

```ts
@Inject(LIST_GROUPS_PORT) private readonly listGroupsService: ListGroupsPort
@Inject(USER_REPOSITORY_PORT) private readonly userRepository: UserRepositoryPort
```

**Why:** Phase 999.10.1 D-01..D-05 — field name reflects **runtime identity** (what DI actually injects), type retains `Port` as the **architectural contract**, DI token retains `_PORT` as the **architectural artifact**. Duplicating `Port` on the field is Hungarian type encoding, which Clean Code ch.2 calls "impediments today" — readers learn to ignore the suffix and it becomes noise. Domain-role suffixes like `Repository` ARE mirrored on the field (per D-04, DDD ubiquitous language); architectural-role suffixes like `Port`/`Adapter`/`UseCase` are NOT.

**Detected by:** code review; grep invariant:

```bash
grep -rE "private readonly \w+Port: \w+Port" apps/*/src/infrastructure/inbound/grpc/
```

Returns empty after Phase 999.10.1 — any match is a regression.

**See also:** `.agents/skills/nestjs-hexagonal-mapping/references/NAMING.md` §"Field Naming Rules (Phase 999.10.1)".
