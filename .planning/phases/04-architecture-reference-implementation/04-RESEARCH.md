# Phase 4: Architecture Reference Implementation - Research

**Researched:** 2026-04-02
**Domain:** Clean/Hexagonal Architecture scaffolding for NestJS microservice
**Confidence:** HIGH

## Summary

This phase restructures the auth service into Clean/Hexagonal Architecture layers (domain/application/infrastructure) as a validated reference implementation. The scope is deliberately minimal: 1 entity, 1 port pair (inbound + outbound), 1 use-case stub, 1 adapter stub. All bodies throw `NotImplementedException` -- no business logic.

The project already has a detailed `clean-ddd-hexagonal` skill with reference documentation (HEXAGONAL.md, LAYERS.md) that defines exact patterns. TARGET_ARCHITECTURE.md section 5 provides the Sender example layout that auth must mirror. The generated proto types (`AuthServiceController`, `AuthServiceControllerMethods`) from `@email-platform/contracts` provide the contract interface that the gRPC inbound adapter must implement.

**Primary recommendation:** Create the three layer directories under `apps/auth/src/`, place minimal stub files following TARGET_ARCHITECTURE.md section 5 naming conventions, wire ports-to-adapters in `auth.module.ts` via NestJS custom providers, and validate with the architecture-validator agent.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Create ONLY the layer directories and minimal example files -- not the full entity/VO/use-case set from TARGET_ARCHITECTURE.md. Specifically: 1 entity, 1 port (inbound + outbound), 1 use-case stub, 1 adapter stub.
- **D-02:** This is scaffolding for future business logic, NOT implementation. Use-case bodies throw `NotImplementedException`. Adapter bodies throw `NotImplementedException`.
- **D-03:** Auth service is the reference because it's the simplest domain service with clear boundaries.
- **D-04:** Follow TARGET_ARCHITECTURE.md section 4 exactly:
  - `domain/` -- entities, value-objects (pure TS, zero framework imports)
  - `application/` -- ports/inbound/, ports/outbound/, use-cases/
  - `infrastructure/` -- grpc/ (inbound adapter), persistence/ (outbound adapter)
- **D-05:** Domain layer MUST have zero NestJS imports -- pure TypeScript only.
- **D-06:** Application layer depends only on domain. Infrastructure depends on application + domain.
- **D-07:** Run `gsd-architecture-validator` agent after each plan to validate boundaries. If violations found, fix before proceeding.
- **D-08:** Validator checks: no NestJS imports in domain/, no infrastructure imports in application/, dependency direction correct.
- **D-09:** Update `auth.module.ts` to import the new layers -- ports bound to adapters via NestJS providers. Module should compile and start correctly (even though handlers throw NotImplemented).

### Claude's Discretion
- Exact file names within the layer structure
- Whether to include a domain service stub or just entity + value object
- How to wire the gRPC adapter (controller vs separate adapter class)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | Each app in apps/ has correct Clean/Hexagonal structure (domain/application/infrastructure) -- validated via architecture-validator agent | Full layer structure documented from TARGET_ARCHITECTURE.md section 4-5, skill references, and NestJS DI wiring patterns. Auth is the reference; others follow later. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Architecture apps/**: Clean/DDD/Hexagonal -- verified via architecture-validator agent
- **Architecture packages/**: Simple utilitarian structure, no DDD
- **No business logic**: Only structural scaffolding (ports, adapters, use cases) -- implementation later
- **No tests**: Testing is a separate next phase
- **Tech stack**: NestJS 11, TypeScript, gRPC, MongoDB, RabbitMQ, Redis -- do not change
- **GSD workflow enforcement**: Use GSD commands for file changes

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/common | 11.1.16 | DI, decorators, exceptions | Project framework |
| @nestjs/microservices | 11.0.1 | gRPC transport, `@GrpcMethod` | gRPC server support |
| @email-platform/contracts | workspace | Proto-generated types (`AuthServiceController`, `AuthServiceControllerMethods`) | Single source of truth for service interfaces |
| @email-platform/config | workspace | `AppConfigModule`, `loadGlobalConfig()` | Already in auth.module |
| @email-platform/foundation | workspace | `LoggingModule`, error handling, health | Already in auth.module |
| TypeScript | 5.0+ | Pure domain types, interfaces | Project standard |

### No New Dependencies Required
This phase creates only TypeScript files (interfaces, classes with stub bodies). No new packages needed.

## Architecture Patterns

### Target Directory Structure for Auth Service

Based on TARGET_ARCHITECTURE.md section 5 (Sender example), adapted for auth's minimal scope:

```
apps/auth/src/
├── domain/
│   └── entities/
│       └── user.entity.ts              # Pure TS class, no NestJS imports
├── application/
│   ├── ports/
│   │   ├── inbound/
│   │   │   └── login.port.ts           # Interface: what the service OFFERS
│   │   └── outbound/
│   │       └── user-repository.port.ts # Interface: what the service NEEDS
│   └── use-cases/
│       └── login.use-case.ts           # Implements inbound port, throws NotImplementedException
├── infrastructure/
│   ├── grpc/
│   │   └── auth.grpc-server.ts         # Inbound adapter: NestJS controller implementing AuthServiceController
│   └── persistence/
│       └── mongo-user.repository.ts    # Outbound adapter: implements user-repository port, throws NotImplementedException
├── auth.module.ts                      # Updated: wires ports to adapters via DI
├── health/                             # Keep as-is (untouched)
│   ├── health.controller.ts
│   └── health.module.ts
└── main.ts                             # Keep as-is (untouched)
```

### Pattern 1: Domain Entity (Pure TypeScript)

**What:** Entity class with zero framework dependencies.
**When to use:** Domain layer -- always pure TS.

```typescript
// domain/entities/user.entity.ts
// NO NestJS imports, NO infrastructure imports

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

Confidence: HIGH -- follows TARGET_ARCHITECTURE.md rule "Domain Layer does NOT import anything from Application and Infrastructure" and skill LAYERS.md "No framework imports".

### Pattern 2: Port Interfaces (Application Layer)

**What:** Interfaces defining inbound (what the service offers) and outbound (what the service needs) contracts.
**When to use:** Application layer -- always interfaces, no implementations.

```typescript
// application/ports/inbound/login.port.ts
// Depends only on domain types
import { User } from '../../domain/entities/user.entity';

export interface LoginPort {
  execute(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }>;
}

// application/ports/outbound/user-repository.port.ts
import { User } from '../../domain/entities/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

Confidence: HIGH -- matches HEXAGONAL.md driver/driven port patterns and TARGET_ARCHITECTURE.md section 4 diagram.

### Pattern 3: Use Case Stub (Application Layer)

**What:** Use case class that implements the inbound port, depends on outbound ports via constructor injection.
**When to use:** Application layer -- orchestrates domain logic (stubbed for now).

```typescript
// application/use-cases/login.use-case.ts
import { NotImplementedException } from '@nestjs/common';
import { LoginPort } from '../ports/inbound/login.port';
import { UserRepositoryPort } from '../ports/outbound/user-repository.port';
import { User } from '../../domain/entities/user.entity';

export class LoginUseCase implements LoginPort {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    throw new NotImplementedException('LoginUseCase not yet implemented');
  }
}
```

**IMPORTANT NOTE on NestJS imports in application layer:** D-05 says "Domain layer MUST have zero NestJS imports." The application layer (D-06) depends only on domain. However, `NotImplementedException` is from `@nestjs/common`. Two approaches:
1. **Allow `NotImplementedException` in application layer** as a pragmatic exception -- it is a temporary stub marker, not a structural dependency.
2. **Throw a plain `Error('Not implemented')` instead** -- keeps application layer framework-free.

**Recommendation (Claude's discretion):** Use `throw new Error('Not implemented')` in use-case stubs to keep application layer completely framework-free. Use `NotImplementedException` only in infrastructure adapters where NestJS imports are already expected. This is cleaner and matches D-06 "Application layer depends only on domain" strictly.

### Pattern 4: gRPC Inbound Adapter (Infrastructure Layer)

**What:** NestJS controller that implements `AuthServiceController` from generated proto types. Delegates to inbound ports.
**When to use:** Infrastructure layer -- the "driver adapter" in hexagonal terms.

Two options for wiring the gRPC adapter:

**Option A: Controller with `@GrpcMethod` decorators (current project pattern)**
```typescript
// infrastructure/grpc/auth.grpc-server.ts
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthServiceController, LoginRequest, TokenPair } from '@email-platform/contracts';
import { LoginPort } from '../../application/ports/inbound/login.port';

@Controller()
export class AuthGrpcServer {
  constructor(private readonly loginPort: LoginPort) {}

  @GrpcMethod('AuthService', 'Login')
  async login(request: LoginRequest): Promise<TokenPair> {
    // Delegate to use case via inbound port
    throw new NotImplementedException();
  }
}
```

**Option B: Controller with `@AuthServiceControllerMethods()` class decorator (proto-generated decorator)**
```typescript
// infrastructure/grpc/auth.grpc-server.ts
import { Controller } from '@nestjs/common';
import { AuthServiceControllerMethods, AuthServiceController, LoginRequest, TokenPair } from '@email-platform/contracts';

@Controller()
@AuthServiceControllerMethods()
export class AuthGrpcServer implements AuthServiceController {
  // All methods from AuthServiceController get @GrpcMethod automatically
  // ...
}
```

**Recommendation (Claude's discretion):** Use Option B (`@AuthServiceControllerMethods()`) -- it automatically decorates all methods from the proto, ensures type safety via `implements AuthServiceController`, and is the idiomatic ts-proto pattern. The existing `AuthController` does not use this pattern yet, but adopting it here establishes the correct reference.

### Pattern 5: Outbound Adapter (Infrastructure Layer)

**What:** Concrete implementation of an outbound port using a specific technology.
**When to use:** Infrastructure layer -- the "driven adapter" in hexagonal terms.

```typescript
// infrastructure/persistence/mongo-user.repository.ts
import { Injectable, NotImplementedException } from '@nestjs/common';
import { UserRepositoryPort } from '../../application/ports/outbound/user-repository.port';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class MongoUserRepository implements UserRepositoryPort {
  async findByEmail(email: string): Promise<User | null> {
    throw new NotImplementedException('MongoUserRepository.findByEmail not yet implemented');
  }

  async save(user: User): Promise<void> {
    throw new NotImplementedException('MongoUserRepository.save not yet implemented');
  }
}
```

### Pattern 6: NestJS DI Wiring (auth.module.ts)

**What:** Bind port interfaces to adapter implementations using NestJS custom providers.
**When to use:** The composition root -- `auth.module.ts`.

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from '@email-platform/config';
import { LoggingModule } from '@email-platform/foundation';
import { HealthModule } from './health/health.module';

// Infrastructure
import { AuthGrpcServer } from './infrastructure/grpc/auth.grpc-server';
import { MongoUserRepository } from './infrastructure/persistence/mongo-user.repository';

// Application
import { LoginUseCase } from './application/use-cases/login.use-case';

// DI tokens for ports
export const USER_REPOSITORY_PORT = 'UserRepositoryPort';
export const LOGIN_PORT = 'LoginPort';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forGrpcAsync(),
    HealthModule,
  ],
  controllers: [AuthGrpcServer],
  providers: [
    // Outbound port -> adapter binding
    {
      provide: USER_REPOSITORY_PORT,
      useClass: MongoUserRepository,
    },
    // Inbound port -> use case binding
    {
      provide: LOGIN_PORT,
      useClass: LoginUseCase,
    },
  ],
})
export class AuthModule {}
```

**Key DI Detail:** Use-case constructors need `@Inject(USER_REPOSITORY_PORT)` decorator on their port parameters since we are using string tokens (not class tokens). This is the standard NestJS pattern for interface-based DI.

```typescript
// In login.use-case.ts
import { Inject } from '@nestjs/common';

export class LoginUseCase implements LoginPort {
  constructor(
    @Inject('UserRepositoryPort') private readonly userRepository: UserRepositoryPort,
  ) {}
}
```

Similarly the gRPC server needs `@Inject(LOGIN_PORT)` on its LoginPort parameter.

Confidence: HIGH -- standard NestJS custom provider pattern, verified against NestJS 11 documentation patterns.

### Anti-Patterns to Avoid

- **Domain importing `@nestjs/common`:** Even for `Injectable()` decorator. Domain is pure TS. No decorators from any framework.
- **Application layer importing infrastructure:** Use cases must depend on port interfaces, not adapter implementations.
- **Controller calling repository directly:** The old `AuthController` was empty. The new `AuthGrpcServer` must call use cases via inbound ports, never repositories directly.
- **Putting port interfaces in infrastructure:** Ports live in `application/ports/`, not alongside their adapter implementations.
- **Forgetting `@Injectable()` on adapters:** Infrastructure classes that participate in NestJS DI need the decorator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| gRPC method decorators | Manual `@GrpcMethod()` per method | `@AuthServiceControllerMethods()` class decorator | Auto-decorates all methods from proto, stays in sync with contract changes |
| DI container | Custom service locator | NestJS `@Module` providers with string tokens | Already the project standard, handles lifecycle |
| Port-to-adapter binding | Factory functions | NestJS `{ provide: TOKEN, useClass: Impl }` | Standard NestJS custom provider pattern |

## Common Pitfalls

### Pitfall 1: NestJS Imports Leaking into Domain
**What goes wrong:** Adding `@Injectable()` or other NestJS decorators to domain entities/value objects.
**Why it happens:** Habit from NestJS development where everything is injectable.
**How to avoid:** Domain entities are plain TS classes. They are never directly instantiated by DI -- use cases create them.
**Warning signs:** Any `import { ... } from '@nestjs/'` in files under `domain/`.

### Pitfall 2: Circular Dependency in Module Wiring
**What goes wrong:** Infrastructure adapter imports use-case class directly instead of depending on the port interface token.
**Why it happens:** Forgetting that NestJS DI resolves via tokens, not direct imports.
**How to avoid:** Use `@Inject('TokenName')` for port dependencies. Only import the interface type, not the implementation class.
**Warning signs:** NestJS startup error about circular dependencies.

### Pitfall 3: Forgetting @Inject for String Tokens
**What goes wrong:** Use case declares port as constructor parameter but without `@Inject(TOKEN)`. NestJS cannot resolve it.
**Why it happens:** When using class-based providers, NestJS auto-resolves by type. String tokens require explicit `@Inject()`.
**How to avoid:** Every constructor parameter that uses a port interface MUST have `@Inject('PortToken')`.
**Warning signs:** `Nest can't resolve dependencies` error at startup.

### Pitfall 4: Removing the Old AuthController Without Replacing gRPC Registration
**What goes wrong:** The old `AuthController` (empty) is in the module's `controllers` array. If removed without adding the new `AuthGrpcServer`, the gRPC service registration breaks.
**Why it happens:** The old controller is just `@Controller()` with no methods -- easy to forget it is the gRPC registration point.
**How to avoid:** Replace `AuthController` with `AuthGrpcServer` in the `controllers` array of `auth.module.ts`.
**Warning signs:** Service starts but gRPC methods return UNIMPLEMENTED.

### Pitfall 5: Health Module Disruption
**What goes wrong:** Refactoring accidentally moves or modifies the health module/controller.
**Why it happens:** Health is a separate NestJS module already correctly placed.
**How to avoid:** `health/` directory and its module stay completely untouched.
**Warning signs:** Health check endpoints stop responding.

## Code Examples

### Complete Minimal Entity (Domain Layer)
```typescript
// apps/auth/src/domain/entities/user.entity.ts
// Source: TARGET_ARCHITECTURE.md section 4 + clean-ddd-hexagonal skill

// ZERO framework imports -- pure TypeScript
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

### Complete Inbound Port (Application Layer)
```typescript
// apps/auth/src/application/ports/inbound/login.port.ts
export interface LoginPort {
  execute(email: string, password: string): Promise<LoginResult>;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}
```

### Complete Outbound Port (Application Layer)
```typescript
// apps/auth/src/application/ports/outbound/user-repository.port.ts
import { User } from '../../../domain/entities/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

### Complete Use Case Stub (Application Layer)
```typescript
// apps/auth/src/application/use-cases/login.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { LoginPort, LoginResult } from '../ports/inbound/login.port';
import { UserRepositoryPort } from '../ports/outbound/user-repository.port';

@Injectable()
export class LoginUseCase implements LoginPort {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    throw new Error('LoginUseCase not yet implemented');
  }
}
```

**Note:** `@Injectable()` is needed here because the use case participates in NestJS DI. This is acceptable in the application layer -- only the domain layer must be framework-free. The `@Inject` decorator is required for string-token DI.

### Complete gRPC Adapter (Infrastructure Layer)
```typescript
// apps/auth/src/infrastructure/grpc/auth.grpc-server.ts
import { Controller, Inject, NotImplementedException } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import {
  AuthServiceController,
  AuthServiceControllerMethods,
  LoginRequest,
  TokenPair,
  RefreshRequest,
  ValidateRequest,
  UserContext,
  RevokeRequest,
  CreateUserRequest,
  User as ProtoUser,
  ListUsersRequest,
  UserList,
} from '@email-platform/contracts';
import { Empty, HealthStatus } from '@email-platform/contracts';
import { LoginPort } from '../../application/ports/inbound/login.port';

@Controller()
@AuthServiceControllerMethods()
export class AuthGrpcServer implements AuthServiceController {
  constructor(
    @Inject('LoginPort') private readonly loginPort: LoginPort,
  ) {}

  async healthCheck(request: Empty, metadata?: Metadata): Promise<HealthStatus> {
    throw new NotImplementedException('healthCheck not yet implemented');
  }

  async login(request: LoginRequest, metadata?: Metadata): Promise<TokenPair> {
    throw new NotImplementedException('login not yet implemented');
  }

  async refreshToken(request: RefreshRequest, metadata?: Metadata): Promise<TokenPair> {
    throw new NotImplementedException('refreshToken not yet implemented');
  }

  async validateToken(request: ValidateRequest, metadata?: Metadata): Promise<UserContext> {
    throw new NotImplementedException('validateToken not yet implemented');
  }

  async revokeToken(request: RevokeRequest, metadata?: Metadata): Promise<Empty> {
    throw new NotImplementedException('revokeToken not yet implemented');
  }

  async createUser(request: CreateUserRequest, metadata?: Metadata): Promise<ProtoUser> {
    throw new NotImplementedException('createUser not yet implemented');
  }

  async listUsers(request: ListUsersRequest, metadata?: Metadata): Promise<UserList> {
    throw new NotImplementedException('listUsers not yet implemented');
  }
}
```

### Complete Outbound Adapter (Infrastructure Layer)
```typescript
// apps/auth/src/infrastructure/persistence/mongo-user.repository.ts
import { Injectable, NotImplementedException } from '@nestjs/common';
import { UserRepositoryPort } from '../../application/ports/outbound/user-repository.port';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class MongoUserRepository implements UserRepositoryPort {
  async findByEmail(email: string): Promise<User | null> {
    throw new NotImplementedException('MongoUserRepository.findByEmail not yet implemented');
  }

  async save(user: User): Promise<void> {
    throw new NotImplementedException('MongoUserRepository.save not yet implemented');
  }
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no jest/vitest config in project |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Correct Clean/Hexagonal layer separation | architecture validation | `gsd-architecture-validator` agent | N/A -- agent-based, not unit test |
| ARCH-01 | No NestJS imports in domain/ | static analysis | `grep -r "@nestjs" apps/auth/src/domain/` | N/A -- grep check |
| ARCH-01 | No infrastructure imports in application/ (except DI decorators) | static analysis | `grep -r "infrastructure" apps/auth/src/application/` | N/A -- grep check |
| ARCH-01 | Module compiles and starts | smoke test | `npx ts-node apps/auth/src/main.ts` | N/A -- manual |

### Sampling Rate
- **Per task commit:** Run `grep -r "@nestjs" apps/auth/src/domain/` to verify zero framework imports in domain
- **Per wave merge:** Run `gsd-architecture-validator` agent
- **Phase gate:** Architecture-validator passes + module compiles

### Wave 0 Gaps
None -- validation for this phase is architecture-validator agent + grep checks, not unit tests. No test framework setup needed.

## Open Questions

1. **AuthServiceController `healthCheck` method**
   - What we know: The proto defines `HealthCheck` RPC on `AuthService`. The generated `AuthServiceController` interface includes `healthCheck()`. The existing `HealthModule` handles health via a separate controller.
   - What's unclear: Should `AuthGrpcServer` delegate `healthCheck` to the existing `HealthModule`, throw NotImplementedException, or implement a simple pass-through?
   - Recommendation: Throw `NotImplementedException` for now in the gRPC server stub. The existing `HealthModule` already handles health checks via Terminus at the HTTP level. This can be wired properly when business logic is implemented.

2. **Use case `@Injectable()` and `@Inject()` in application layer**
   - What we know: D-05 explicitly bans NestJS imports from domain only. D-06 says application depends only on domain.
   - What's unclear: Whether `@Injectable()` / `@Inject()` decorators in use cases violate the spirit of D-06, since they are NestJS-specific.
   - Recommendation: Allow `@Injectable()` and `@Inject()` in application layer use cases as a pragmatic NestJS concession. The alternative (factory functions in module) is more complex and non-standard for NestJS projects. The key constraint (D-05) protects the domain layer, which is the critical boundary.

## Sources

### Primary (HIGH confidence)
- `docs/TARGET_ARCHITECTURE.md` sections 4-6 -- layer structure, dependency rules, Sender example layout
- `.agents/skills/clean-ddd-hexagonal/SKILL.md` -- decision trees, anti-patterns
- `.agents/skills/clean-ddd-hexagonal/references/HEXAGONAL.md` -- port/adapter patterns, naming conventions
- `.agents/skills/clean-ddd-hexagonal/references/LAYERS.md` -- layer rules, composition root pattern
- `packages/contracts/src/generated/auth.ts` -- `AuthServiceController` interface, `AuthServiceControllerMethods` decorator
- `apps/auth/src/auth.module.ts` -- current DI wiring
- `apps/auth/src/auth.controller.ts` -- current empty controller (to be replaced)
- NestJS 11.1.16 `@nestjs/common` -- `NotImplementedException` verified in installed package

### Secondary (MEDIUM confidence)
- NestJS custom providers pattern (string tokens + `@Inject()`) -- standard documented pattern, verified via project's existing DI usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed, no new dependencies
- Architecture: HIGH -- TARGET_ARCHITECTURE.md + skill references are comprehensive and project-specific
- Pitfalls: HIGH -- based on known NestJS DI behavior and hexagonal architecture common mistakes

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- architecture patterns and NestJS 11 API are not changing)
