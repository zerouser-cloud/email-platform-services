# Examples

All snippets derived from Phase 999.10 auth pilot (Plan 02). Method bodies stay as stubs per PROJECT.md constraint **"каркас, без бизнес-логики"** — real implementation arrives in a later milestone. The skill demonstrates the *shape* of each layer, not business behaviour.

---

## Example 1 — Composite Service (LoginService)

`LoginService` composes two atomic use cases: `VerifyCredentialsUseCase` and `IssueTokenPairUseCase`. This is the multi-use-case variant per D-23 — when the use case audit concludes that one RPC decomposes into N atomic steps.

```typescript
// 1. Controller (apps/auth/src/infrastructure/controllers/grpc/auth.controller.ts)
@Controller()
@AuthProto.AuthServiceControllerMethods()
export class AuthController implements AuthProto.AuthServiceController {
  constructor(@Inject(LOGIN_PORT) private readonly loginPort: LoginPort) {}

  async login(req: AuthProto.LoginRequest): Promise<AuthProto.TokenPair> {
    const cmd = new LoginCommand(req.email, req.password);          // proto → command
    const result = await this.loginPort.execute(cmd);               // cross boundary
    return {                                                        // domain → proto
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    };
  }
}

// 2. Inbound port (apps/auth/src/application/ports/inbound/login.port.ts)
export interface LoginPort {
  execute(cmd: LoginCommand): Promise<LoginResult>;
}
export interface LoginResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

// 3. Command (apps/auth/src/application/commands/login.command.ts)
export class LoginCommand {
  constructor(public readonly email: string, public readonly password: string) {}
}

// 4. Service (apps/auth/src/application/services/login.service.ts)
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

// 5. Use case — atomic step (apps/auth/src/application/use-cases/verify-credentials.use-case.ts)
@Injectable()
export class VerifyCredentialsUseCase {
  constructor(@Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort) {}
  async execute(email: string, password: string): Promise<User> {
    throw new Error('VerifyCredentialsUseCase not yet implemented'); // D-stub
  }
}

// 6. Outbound port (apps/auth/src/application/ports/outbound/user-repository.port.ts)
export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

Key observations:
- **Controller is the only layer that imports `@email-platform/contracts`** (proto types). Everything below works in domain types.
- **Service `implements LoginPort`** — our own interface, not the generated `AuthServiceController`.
- **UseCase does NOT `implements LoginPort`** — it's a plain `@Injectable()` class. The Service owns the port contract; the UseCase is an atomic step the Service composes.
- **Use cases are injected by class reference**, not by Symbol token. Outbound ports are injected by Symbol token (`USER_REPOSITORY_PORT`).

---

## Example 2 — Pure Delegation (CreateCampaignService)

When the D-23 audit concludes one atomic use case suffices for an RPC, the Service layer still exists per D-01 (uniformity: future cross-cutting fits here without restructuring).

```typescript
// apps/sender/src/application/services/create-campaign.service.ts
@Injectable()
export class CreateCampaignService implements CreateCampaignPort {
  constructor(private readonly useCase: CreateCampaignUseCase) {}

  async execute(cmd: CreateCampaignCommand): Promise<CreateCampaignResult> {
    return this.useCase.execute(cmd);
  }
}
```

The Service looks trivial today. That is acceptable and expected. Tomorrow this file may add:
- Transaction wrapping (`await this.tx.run(() => this.useCase.execute(cmd))`)
- Event emission (`this.events.publish(new CampaignCreatedEvent(result))`)
- Retry/circuit-breaker policy
- Cross-cutting logging with domain-specific context

All of those land in the Service layer without touching the Controller above or the UseCase below. Removing the layer to "save code" means every one of those future additions requires restructuring — the opposite of uniformity.

---

## Example 3 — Controller Proto↔Command Mapping

The Controller owns the proto↔domain boundary. The Command DTO is constructed from the proto request; the Result is projected back to the proto response. **No business logic in the Controller.**

```typescript
async login(req: AuthProto.LoginRequest): Promise<AuthProto.TokenPair> {
  const cmd = new LoginCommand(req.email, req.password);   // proto → command
  const result = await this.loginPort.execute(cmd);        // cross port boundary
  return {                                                  // domain → proto
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
  };
}
```

Three-line method body, three concerns:
1. **Line 1 — Build Command:** proto request fields become Command fields. This is the only place `req.email`, `req.password` (proto types) appear.
2. **Line 2 — Cross boundary:** call the inbound port with the Command. Await the domain Result.
3. **Line 3 — Project Response:** Result fields become proto response fields. This is the only place proto response types are constructed.

No conditionals, no validation, no orchestration. If something more complex needs to happen (e.g., different commands based on request shape), it belongs in the Service, not in the Controller.

---

## Before / After — 2-layer vs 3-layer

Phase 999.10 replaces the pre-existing 2-layer stack (`Controller → UseCase implements Port`) with the canonical 3-layer stack (`Controller → Service implements Port → UseCase`).

### Before (Phase 4 pattern, pre-999.10)

```typescript
// apps/auth/src/application/use-cases/login.use-case.ts (CURRENT)
import { Inject, Injectable } from '@nestjs/common';
import { LoginPort, LoginResult } from '../ports/inbound/login.port';
import { UserRepositoryPort } from '../ports/outbound/user-repository.port';
import { USER_REPOSITORY_PORT } from '../../auth.constants';

@Injectable()
export class LoginUseCase implements LoginPort {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    throw new Error('LoginUseCase not yet implemented');
  }
}
```

Characteristics:
- UseCase `implements LoginPort` directly — 2-layer stack.
- Port signature uses positional args: `execute(email, password)`.
- No Command DTO.
- No Service layer — Controller injects `LOGIN_PORT`, which resolves to `LoginUseCase`.

### After (999.10 pattern)

```typescript
// apps/auth/src/application/services/login.service.ts (NEW)
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

// apps/auth/src/application/use-cases/verify-credentials.use-case.ts (NEW — split from LoginUseCase)
@Injectable()
export class VerifyCredentialsUseCase {
  constructor(@Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort) {}
  async execute(email: string, password: string): Promise<User> {
    throw new Error('VerifyCredentialsUseCase not yet implemented');
  }
}

// apps/auth/src/application/ports/inbound/login.port.ts (UPDATED signature)
export interface LoginPort {
  execute(cmd: LoginCommand): Promise<LoginResult>;
}
```

Characteristics:
- Service `implements LoginPort`; UseCase is plain `@Injectable()` — 3-layer stack.
- Port signature uses Command DTO: `execute(cmd: LoginCommand)`.
- `LOGIN_PORT` in `auth.module.ts` provider map resolves to `LoginService` (not `LoginUseCase`).
- Original `LoginUseCase` is decomposed into atomic use cases that `LoginService` composes.

### Why

- **Seam for future cross-cutting.** Transactions, events, retry, logging fit in the Service without touching the Controller or the UseCase.
- **Use case reuse.** `IssueTokenPairUseCase` can be composed by both `LoginService` and `RefreshTokenService` within the same bounded context.
- **Uniform look across services.** Every gRPC microservice has the same 3-layer shape whether today's Service is composite or pure delegation. A developer adding a new RPC mechanically follows the same 8-step decision tree (see `SKILL.md` §"Decision Tree").
- **Scalable Command signature.** Adding a new field to a Command does not break existing call sites; positional arguments would.
