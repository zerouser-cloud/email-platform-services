# Do / Don't

Nine anti-patterns common in a NestJS + Hexagonal codebase, with the right form, the rationale, and how to detect each mechanically. Detection column uses file-structure checks, compile errors, ESLint overrides (added by Phase 999.10 Plan 06), or grep.

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

**Why:** D-07 — single transport-agnostic naming convention. Transport is visible via the decorator (`@AuthServiceControllerMethods()`) and the file path (`controllers/grpc/` vs `controllers/rest/`). Class name staying clean keeps a HealthController at `controllers/rest/` and an AuthController at `controllers/grpc/` symmetric.

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
// apps/auth/src/infrastructure/controllers/grpc/auth.controller.ts
async login(req: AuthProto.LoginRequest): Promise<AuthProto.TokenPair> {
  const cmd = new LoginCommand(req.email, req.password);   // boundary mapping here
  const result = await this.loginPort.execute(cmd);
  return { accessToken: result.accessToken, ... };
}

// apps/auth/src/application/services/login.service.ts (no proto import)
@Injectable()
export class LoginService implements LoginPort { ... }
```

**Why:** D-04 — transport boundary at the controller. Proto types are a transport concern; they must not leak past `infrastructure/controllers/grpc/`.

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
    └── controllers/
        └── rest/
            └── health.controller.ts
```

**Why:** D-10 — hexagonal layout; transport location signals transport kind. REST endpoints go in `infrastructure/controllers/rest/`, gRPC endpoints in `infrastructure/controllers/grpc/`. A `src/health/` outlier breaks symmetry and obscures where to add a second REST endpoint.

**Detected by:** `find apps/{auth,sender,parser,audience} -path "*/src/health" -type d` must return empty.

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
apps/auth/src/infrastructure/persistence/
├── pg-user.repository.ts
├── mappers/
│   └── user.mapper.ts
└── schema/
    └── users.schema.ts
```

**Why:** D-21 — predictable subfolder structure. Scales to multi-entity services. Every service follows the same `persistence/{repositories, mappers/, schema/}` tri-split regardless of mapper count today.

**Detected by:** `find apps/*/src/infrastructure/persistence -maxdepth 1 -name "*.mapper.ts"` must return empty (mappers must be one level deeper, in `mappers/`).

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
// apps/auth/src/auth.module.ts — one flat module per bounded context
@Module({
  imports: [AppConfigModule.forRoot(AuthEnvSchema), PersistenceModule.forRootAsync(), LoggingModule.forGrpcAsync('auth')],
  controllers: [AuthController, HealthController],
  providers: [
    { provide: USER_REPOSITORY_PORT, useClass: PgUserRepository },
    { provide: LOGIN_PORT,    useClass: LoginService },
    { provide: REGISTER_PORT, useClass: RegisterService },
    VerifyCredentialsUseCase,
    IssueTokenPairUseCase,
  ],
})
export class AuthModule {}
```

**Why:** D-11 — one module per bounded context. Submodules are reserved for shared infrastructure from foundation (`PersistenceModule`, `LoggingModule`, `AppConfigModule`). Feature submodules add nesting with no architectural benefit — the bounded context is already the `apps/{svc}/` directory.

**Detected by:** `find apps/{auth,sender,parser,audience}/src -name "*.module.ts"` should return exactly one file per service (plus whatever foundation compat shims exist in `infrastructure/clients/`).
