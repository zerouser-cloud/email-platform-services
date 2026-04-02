# Phase 5: Architecture Replication & Boundaries - Research

**Researched:** 2026-04-02
**Domain:** NestJS hexagonal architecture scaffolding, gRPC service stubs, event-consumer patterns
**Confidence:** HIGH

## Summary

Phase 5 is a mechanical replication of the validated auth reference (Phase 4) across five remaining services: sender, parser, audience (gRPC domain services), notifier (RabbitMQ event-consumer), and gateway (REST facade). Each service currently has a flat structure with an empty controller stub and module. The target is the hexagonal layer structure with domain entities, ports, use-cases, and infrastructure adapters -- all throwing NotImplementedException/Error stubs with no business logic.

The auth reference implementation is complete and well-defined: pure entity class, inbound/outbound port interfaces, use-case with DI via string tokens, MongoDB repository adapter, and gRPC server implementing the proto-generated `*ServiceController` interface with the `*ServiceControllerMethods()` decorator. The three gRPC services (sender, parser, audience) follow this pattern exactly. Notifier diverges by using RabbitMQ subscriber as inbound adapter instead of gRPC. Gateway only gets an infrastructure layer (gRPC client stubs).

**Primary recommendation:** Process services in order sender -> parser -> audience -> notifier -> gateway. For each gRPC service, create domain/application/infrastructure directories with exactly 1 entity, 1 inbound port, 1 outbound port, 1 use-case, 1 repository adapter, and 1 gRPC server implementing ALL proto RPC methods. Delete old empty controllers. Update module DI wiring to match auth pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Same minimal scaffolding as auth: layer directories + 1 entity, 1 port pair (inbound + outbound), 1 use-case stub, 1 adapter stub per service.
- **D-02:** Bodies throw NotImplementedException/Error -- no business logic.
- **D-03:** Follow auth reference exactly: domain/ -> application/ -> infrastructure/ with gRPC inbound adapter using `@*ServiceControllerMethods()` decorator from proto-generated types.
- **D-04:** Each service gets entity/port/use-case/adapter based on its primary domain per TARGET_ARCHITECTURE.md:
  - Sender: Campaign entity, CreateCampaign port/use-case, MongoCampaignRepository adapter
  - Parser: ParserTask entity, StartParsing port/use-case, MongoParserTaskRepository adapter
  - Audience: Recipient entity, ImportRecipients port/use-case, MongoRecipientRepository adapter
- **D-05:** Controller stubs must include `@GrpcMethod` decorators for ALL RPC methods defined in their proto files (CONT-04 requirement).
- **D-06:** Notifier has domain/application/infrastructure layers BUT inbound adapter is RabbitMQ subscriber, NOT gRPC server.
- **D-07:** No proto, no gRPC controller for Notifier. Inbound port handles event consumption.
- **D-08:** Add RabbitMQ health check to replace gRPC health check. Use `@nestjs/terminus` with custom RabbitMQ health indicator.
- **D-09:** Notifier entity: Notification. Port: HandleEvent (inbound), NotificationSender (outbound). Adapter: RabbitMQEventSubscriber (inbound), TelegramNotificationSender (outbound stub).
- **D-10:** Gateway gets infrastructure/ layer (for gRPC client adapters) but NO domain/ or application/ layers.
- **D-11:** Existing controllers/throttle/health stay in their current locations. Add infrastructure/clients/ for gRPC client organization.
- **D-12:** Verify NO cross-service imports between apps/. All shared code must be in packages/.
- **D-13:** Architecture-validator runs after each plan.

### Claude's Discretion
- Exact file names within each service's layer structure
- Whether to split plans by service or by layer
- Order of service processing (recommendation: sender -> parser -> audience -> notifier -> gateway by complexity)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-02 | Shared code in packages/, service-specific in apps/. No cross-service imports between apps/ | Grep audit confirms zero cross-service imports exist today. Phase must verify this holds after restructuring. |
| ARCH-03 | Notifier is event-consumer-only with RabbitMQ health check (no gRPC) | Notifier currently uses HTTP bootstrap (NestFactory.create, not connectMicroservice). Needs RabbitMQ health indicator stub via @nestjs/terminus. |
| CONT-04 | Controller stubs in sender, parser, audience contain @GrpcMethod decorators matching proto RPC methods | Proto-generated types provide SenderServiceControllerMethods(), ParserServiceControllerMethods(), AudienceServiceControllerMethods() decorators. Each implements *ServiceController interface with all RPC methods. |
</phase_requirements>

## Architecture Patterns

### Auth Reference Structure (to replicate)
```
apps/{service}/src/
├── domain/
│   └── entities/
│       └── {entity}.entity.ts          # Pure TS class, zero imports
├── application/
│   ├── ports/
│   │   ├── inbound/
│   │   │   └── {use-case}.port.ts      # Interface + result type
│   │   └── outbound/
│   │       └── {entity}-repository.port.ts  # Interface importing entity
│   └── use-cases/
│       └── {use-case}.use-case.ts      # @Injectable, implements inbound port, DI via string token
├── infrastructure/
│   ├── grpc/
│   │   └── {service}.grpc-server.ts    # @Controller + @*ServiceControllerMethods(), implements *ServiceController
│   └── persistence/
│       └── mongo-{entity}.repository.ts  # @Injectable, implements outbound port
├── health/                             # Unchanged
│   ├── health.controller.ts
│   └── health.module.ts
├── {service}.module.ts                 # DI wiring with string token providers
└── main.ts                            # Unchanged
```

### Pattern: gRPC Server Adapter (Sender/Parser/Audience)

The `@*ServiceControllerMethods()` decorator auto-registers all gRPC methods. The class implements the `*ServiceController` interface for type safety. Every RPC method must be implemented as an async method throwing `NotImplementedException`.

```typescript
// Source: apps/auth/src/infrastructure/grpc/auth.grpc-server.ts (reference)
import { Controller, Inject, NotImplementedException } from '@nestjs/common';
import { SenderProto, CommonProto } from '@email-platform/contracts';
import { CreateCampaignPort } from '../../application/ports/inbound/create-campaign.port';

@Controller()
@SenderProto.SenderServiceControllerMethods()
export class SenderGrpcServer implements SenderProto.SenderServiceController {
  constructor(
    @Inject('CreateCampaignPort') private readonly createCampaignPort: CreateCampaignPort,
  ) {}

  async healthCheck(_request: CommonProto.Empty): Promise<CommonProto.HealthStatus> {
    throw new NotImplementedException('healthCheck not yet implemented');
  }
  // ... all other RPC methods
}
```

### Pattern: Module DI Wiring

```typescript
// Source: apps/auth/src/auth.module.ts (reference)
export const CAMPAIGN_REPOSITORY_PORT = 'CampaignRepositoryPort';
export const CREATE_CAMPAIGN_PORT = 'CreateCampaignPort';

@Module({
  imports: [AppConfigModule, LoggingModule.forGrpcAsync(), HealthModule],
  controllers: [SenderGrpcServer],
  providers: [
    { provide: CAMPAIGN_REPOSITORY_PORT, useClass: MongoCampaignRepository },
    { provide: CREATE_CAMPAIGN_PORT, useClass: CreateCampaignUseCase },
  ],
})
export class SenderModule {}
```

### Pattern: Domain Entity (pure TS)

```typescript
// Source: apps/auth/src/domain/entities/user.entity.ts (reference)
export class Campaign {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly status: string,
    // ... domain-relevant fields only
  ) {}
}
```

### Pattern: Use-Case Stub

```typescript
// Source: apps/auth/src/application/use-cases/login.use-case.ts (reference)
@Injectable()
export class CreateCampaignUseCase implements CreateCampaignPort {
  constructor(
    @Inject('CampaignRepositoryPort')
    private readonly campaignRepository: CampaignRepositoryPort,
  ) {}

  async execute(/* params */): Promise</* result */> {
    throw new Error('CreateCampaignUseCase not yet implemented');
  }
}
```

**Key detail from Phase 4 decisions:** Use-case stubs throw plain `Error` (not NestJS `NotImplementedException`) to keep application layer framework-minimal. Infrastructure adapters (repositories, gRPC servers) use `NotImplementedException` from NestJS.

### Pattern: Notifier (Event-Consumer, No gRPC)

Notifier has the same layer structure but different inbound adapter:
- **No gRPC server**, no proto, no `*ServiceControllerMethods()`
- Inbound adapter: `RabbitMQEventSubscriber` in `infrastructure/messaging/`
- Outbound adapter: `TelegramNotificationSender` in `infrastructure/external/`
- Entity: `Notification`
- Ports: `HandleEventPort` (inbound), `NotificationSenderPort` (outbound)
- Health: RabbitMQ health indicator stub instead of gRPC health

Notifier currently uses `LoggingModule.forHttpAsync()` -- this stays (it is an HTTP app, not gRPC).

### Pattern: Gateway (REST Facade Only)

Gateway gets only `infrastructure/clients/` directory for gRPC client organization:
```
apps/gateway/src/
├── infrastructure/
│   └── clients/          # NEW: gRPC client stubs
├── health/               # Existing, unchanged
├── throttle/             # Existing, unchanged
├── gateway.module.ts     # Update to import client module
└── main.ts               # Unchanged
```

No domain/ or application/ layers. Gateway is pure routing/translation.

### Anti-Patterns to Avoid
- **Importing between apps/**: All shared code MUST be in packages/. No `apps/sender` importing from `apps/audience`.
- **Business logic in stubs**: Bodies throw errors, nothing more. No partial implementations.
- **Framework imports in domain layer**: Domain entities and value objects have zero NestJS imports.
- **Skipping ports**: gRPC server must inject use-case port, not repository directly.

## Service-Specific RPC Method Inventory

### Sender Service (11 methods)
From `SenderServiceController` interface:
1. `healthCheck(Empty) -> HealthStatus`
2. `listCampaigns(ListCampaignsRequest) -> CampaignList`
3. `getCampaign(CampaignIdRequest) -> Campaign`
4. `createCampaign(CreateCampaignRequest) -> Campaign`
5. `pauseCampaign(CampaignIdRequest) -> Campaign`
6. `resumeCampaign(CampaignIdRequest) -> Campaign`
7. `listRunners(ListRunnersRequest) -> RunnerList`
8. `createRunner(CreateRunnerRequest) -> Runner`
9. `listMessages(ListMessagesRequest) -> MessageList`
10. `createMessage(CreateMessageRequest) -> Message`
11. `listMacros(ListMacrosRequest) -> MacrosList`

### Parser Service (6 methods)
From `ParserServiceController` interface:
1. `healthCheck(Empty) -> HealthStatus`
2. `createTask(CreateParserTaskRequest) -> ParserTask`
3. `listTasks(ListParserTasksRequest) -> ParserTaskList`
4. `getTask(ParserTaskIdRequest) -> ParserTask`
5. `getSettings(Empty) -> ParserSettings`
6. `updateSettings(UpdateParserSettingsRequest) -> ParserSettings`

### Audience Service (9 methods)
From `AudienceServiceController` interface:
1. `healthCheck(Empty) -> HealthStatus`
2. `listGroups(ListGroupsRequest) -> GroupList`
3. `createGroup(CreateGroupRequest) -> Group`
4. `deleteGroup(GroupIdRequest) -> Empty`
5. `listRecipients(ListRecipientsRequest) -> RecipientList`
6. `getRecipientsByGroup(GetByGroupRequest) -> RecipientList`
7. `importRecipients(ImportRecipientsRequest) -> ImportResult`
8. `markAsSent(MarkSentRequest) -> Empty`
9. `resetSendStatus(ResetStatusRequest) -> Empty`

## Current State of Each Service

### Files to Delete (replaced by new structure)
| Service | File | Reason |
|---------|------|--------|
| Sender | `sender.controller.ts` | Empty stub, replaced by `infrastructure/grpc/sender.grpc-server.ts` |
| Parser | `parser.controller.ts` | Empty stub, replaced by `infrastructure/grpc/parser.grpc-server.ts` |
| Audience | `audience.controller.ts` | Empty stub, replaced by `infrastructure/grpc/audience.grpc-server.ts` |

### Files to Modify
| Service | File | Change |
|---------|------|--------|
| Sender | `sender.module.ts` | Replace SenderController with SenderGrpcServer, add DI providers |
| Parser | `parser.module.ts` | Replace ParserController with ParserGrpcServer, add DI providers |
| Audience | `audience.module.ts` | Replace AudienceController with AudienceGrpcServer, add DI providers |
| Notifier | `notifier.module.ts` | Add DI providers for ports/use-cases/adapters |
| Gateway | `gateway.module.ts` | Import gRPC client infrastructure |

### Files Unchanged
- All `main.ts` files (bootstrap already correct)
- All `health/` directories (already working)
- Gateway `throttle/` directory

## Import Patterns

### Proto types import (gRPC services)
```typescript
import { SenderProto, CommonProto } from '@email-platform/contracts';
// Use: SenderProto.SenderServiceController, SenderProto.SenderServiceControllerMethods()
// Use: SenderProto.Campaign, SenderProto.CreateCampaignRequest, etc.
// Use: CommonProto.Empty, CommonProto.HealthStatus
```

### Package namespaces available
- `AuthProto` -- already used by auth
- `SenderProto` -- for sender gRPC server
- `ParserProto` -- for parser gRPC server
- `AudienceProto` -- for audience gRPC server
- `CommonProto` -- for Empty and HealthStatus types

## Common Pitfalls

### Pitfall 1: Missing RPC Methods
**What goes wrong:** The `*ServiceControllerMethods()` decorator registers ALL methods from the proto. If the class is missing any method, gRPC calls to that method will fail silently or throw cryptic errors at runtime.
**Why it happens:** Forgetting a method from the proto definition when writing the stub class.
**How to avoid:** Implement the `*ServiceController` interface (TypeScript will enforce all methods). Cross-check against the RPC inventory above.
**Warning signs:** TypeScript compilation errors about missing interface members.

### Pitfall 2: Wrong Error Type in Layers
**What goes wrong:** Using NestJS `NotImplementedException` in application/domain layers leaks framework dependencies.
**Why it happens:** Copy-paste from infrastructure layer.
**How to avoid:** Domain and application layers throw plain `Error`. Infrastructure layer (gRPC server, repositories) throws `NotImplementedException`.
**Warning signs:** NestJS import in application/ or domain/ files.

### Pitfall 3: Forgetting to Delete Old Controllers
**What goes wrong:** Old empty controller remains alongside new gRPC server. NestJS registers both, causing route conflicts.
**Why it happens:** Adding new files without removing old ones.
**How to avoid:** Each plan task that creates the new gRPC server must also delete the old controller file and update the module.

### Pitfall 4: Notifier Using gRPC Patterns
**What goes wrong:** Applying gRPC patterns (proto imports, `*ServiceControllerMethods()`) to notifier.
**Why it happens:** Mechanical copy-paste from other services.
**How to avoid:** Notifier has NO proto, NO gRPC controller. Its inbound adapter is RabbitMQ subscriber. Keep notifier separate from the gRPC service template.

### Pitfall 5: Gateway Getting Domain/Application Layers
**What goes wrong:** Creating domain/ and application/ directories in gateway.
**Why it happens:** Applying full hexagonal pattern uniformly.
**How to avoid:** Gateway only gets infrastructure/clients/. It is a facade, not a domain service.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| gRPC method registration | Manual `@GrpcMethod()` on each method | `@*ServiceControllerMethods()` class decorator | Auto-registers all proto methods, stays in sync with proto changes |
| Controller interface type safety | Custom interface definitions | `implements *ServiceController` from generated types | Proto-generated, guaranteed to match proto definition |
| DI token constants | Magic strings inline | Exported `const TOKEN = 'TokenName'` from module file | Single source of truth, refactoring-safe |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework installed (out of scope per REQUIREMENTS.md) |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-02 | No cross-service imports | static analysis | `grep -r "from.*apps/" apps/ --include="*.ts"` | N/A -- grep command |
| ARCH-03 | Notifier is event-consumer-only | manual review | Check notifier has no gRPC imports | N/A |
| CONT-04 | Controller stubs match proto RPCs | compilation | `pnpm build` (TypeScript will catch missing interface methods) | N/A |

### Sampling Rate
- **Per task commit:** `pnpm build` to verify TypeScript compilation
- **Per wave merge:** Architecture-validator agent check (D-13)
- **Phase gate:** Full build green + no cross-service imports verified

### Wave 0 Gaps
None -- no test infrastructure needed. TypeScript compilation and grep-based static analysis serve as validation.

## Cross-Service Import Verification

Current state: CLEAN. Grep of all `apps/` TypeScript files shows imports only from:
- `@email-platform/config`
- `@email-platform/foundation`
- `@email-platform/contracts`
- Local relative imports within the same service

No `apps/X` imports `apps/Y`. This must remain true after Phase 5.

## Project Constraints (from CLAUDE.md)

- Architecture apps/: Clean/DDD/Hexagonal -- validated through architecture-validator agent
- Architecture packages/: Simple utilitarian structure, no DDD
- No business logic: Only structural scaffolding (ports, adapters, use cases) -- implementation later
- No tests: Testing is a separate next stage
- Tech stack: NestJS 11, TypeScript, gRPC, MongoDB, RabbitMQ, Redis -- do not change
- Naming: Controllers `*.controller.ts`, Modules `*.module.ts`, but gRPC servers use `*.grpc-server.ts` (established in Phase 4)
- ESLint enforces layered architecture in `.eslintrc.js` -- layer order: contracts (leaf) -> config -> foundation -> apps
- Apps cannot import other apps

## Sources

### Primary (HIGH confidence)
- `apps/auth/src/` -- Complete reference implementation from Phase 4
- `packages/contracts/src/generated/sender.ts` -- SenderServiceController interface (11 methods)
- `packages/contracts/src/generated/parser.ts` -- ParserServiceController interface (6 methods)
- `packages/contracts/src/generated/audience.ts` -- AudienceServiceController interface (9 methods)
- `packages/contracts/src/index.ts` -- Namespace exports (SenderProto, ParserProto, AudienceProto, CommonProto)
- `docs/TARGET_ARCHITECTURE.md` -- Layer structure, service responsibilities, Sender example

### Secondary (MEDIUM confidence)
- `.claude/skills/clean-ddd-hexagonal/SKILL.md` -- Architecture validation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- replicating existing validated pattern, no new dependencies
- Architecture: HIGH -- auth reference implementation is complete and inspected line-by-line
- Pitfalls: HIGH -- derived from concrete code analysis, not theoretical

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- internal project patterns, no external dependency changes)
