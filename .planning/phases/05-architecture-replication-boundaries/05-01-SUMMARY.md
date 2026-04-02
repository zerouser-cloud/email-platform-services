---
phase: 05-architecture-replication-boundaries
plan: 01
subsystem: api
tags: [nestjs, grpc, hexagonal-architecture, clean-architecture, dependency-injection]

requires:
  - phase: 04-auth-hexagonal-reference
    provides: Auth service Clean/Hexagonal reference pattern (entity, ports, use-case, repository, gRPC server, module DI)
provides:
  - Sender hexagonal structure with domain/application/infrastructure layers
  - Parser hexagonal structure with domain/application/infrastructure layers
  - SenderGrpcServer with all 11 proto RPC method stubs
  - ParserGrpcServer with all 6 proto RPC method stubs
  - String token DI wiring for both services
affects: [05-02-PLAN, 05-03-PLAN, business-logic-implementation]

tech-stack:
  added: []
  patterns:
    - "Hexagonal architecture replicated from auth reference to sender and parser"
    - "String token providers (CampaignRepositoryPort, CreateCampaignPort, ParserTaskRepositoryPort, StartParsingPort)"
    - "gRPC server as NestJS controller with proto-generated decorator and interface"

key-files:
  created:
    - apps/sender/src/domain/entities/campaign.entity.ts
    - apps/sender/src/application/ports/inbound/create-campaign.port.ts
    - apps/sender/src/application/ports/outbound/campaign-repository.port.ts
    - apps/sender/src/application/use-cases/create-campaign.use-case.ts
    - apps/sender/src/infrastructure/grpc/sender.grpc-server.ts
    - apps/sender/src/infrastructure/persistence/mongo-campaign.repository.ts
    - apps/parser/src/domain/entities/parser-task.entity.ts
    - apps/parser/src/application/ports/inbound/start-parsing.port.ts
    - apps/parser/src/application/ports/outbound/parser-task-repository.port.ts
    - apps/parser/src/application/use-cases/start-parsing.use-case.ts
    - apps/parser/src/infrastructure/grpc/parser.grpc-server.ts
    - apps/parser/src/infrastructure/persistence/mongo-parser-task.repository.ts
  modified:
    - apps/sender/src/sender.module.ts
    - apps/parser/src/parser.module.ts

key-decisions:
  - "Replicated exact auth pattern: entity/ports/use-case/repository/grpc-server/module-DI"
  - "Domain entities remain pure TS with zero framework imports"
  - "Use-case stubs throw plain Error; infrastructure stubs throw NotImplementedException"

patterns-established:
  - "Hexagonal replication pattern: copy auth layer structure, adapt entity/port names, implement all proto RPCs"
  - "gRPC server implements full proto interface with NotImplementedException stubs"

requirements-completed: [CONT-04, ARCH-02]

duration: 2min
completed: 2026-04-02
---

# Phase 05 Plan 01: Sender and Parser Hexagonal Scaffolding Summary

**Sender and parser services gain Clean/Hexagonal structure replicating auth reference: domain entities, ports, use-cases, repository adapters, and gRPC servers with all 17 proto RPC method stubs (11 sender + 6 parser)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T14:36:07Z
- **Completed:** 2026-04-02T14:38:23Z
- **Tasks:** 2
- **Files modified:** 14 (12 created, 2 modified)

## Accomplishments
- Sender service: Campaign entity, CreateCampaign port/use-case, MongoCampaignRepository, SenderGrpcServer with all 11 RPC stubs, module DI wired
- Parser service: ParserTask entity, StartParsing port/use-case, MongoParserTaskRepository, ParserGrpcServer with all 6 RPC stubs, module DI wired
- Zero NestJS imports in domain layers; zero NestJS imports in application port interfaces
- Old empty controllers deleted; gRPC servers registered as NestJS controllers
- TypeScript compiles clean for both services

## Task Commits

Each task was committed atomically:

1. **Task 1: Sender service hexagonal scaffolding with all 11 gRPC stubs** - `8e570e7` (feat)
2. **Task 2: Parser service hexagonal scaffolding with all 6 gRPC stubs** - `39448bc` (feat)

## Files Created/Modified
- `apps/sender/src/domain/entities/campaign.entity.ts` - Campaign entity (pure TS)
- `apps/sender/src/application/ports/inbound/create-campaign.port.ts` - CreateCampaignPort interface
- `apps/sender/src/application/ports/outbound/campaign-repository.port.ts` - CampaignRepositoryPort interface
- `apps/sender/src/application/use-cases/create-campaign.use-case.ts` - CreateCampaignUseCase stub
- `apps/sender/src/infrastructure/grpc/sender.grpc-server.ts` - SenderGrpcServer with 11 RPC stubs
- `apps/sender/src/infrastructure/persistence/mongo-campaign.repository.ts` - MongoCampaignRepository adapter
- `apps/sender/src/sender.module.ts` - Updated DI wiring with string token providers
- `apps/parser/src/domain/entities/parser-task.entity.ts` - ParserTask entity (pure TS)
- `apps/parser/src/application/ports/inbound/start-parsing.port.ts` - StartParsingPort interface
- `apps/parser/src/application/ports/outbound/parser-task-repository.port.ts` - ParserTaskRepositoryPort interface
- `apps/parser/src/application/use-cases/start-parsing.use-case.ts` - StartParsingUseCase stub
- `apps/parser/src/infrastructure/grpc/parser.grpc-server.ts` - ParserGrpcServer with 6 RPC stubs
- `apps/parser/src/infrastructure/persistence/mongo-parser-task.repository.ts` - MongoParserTaskRepository adapter
- `apps/parser/src/parser.module.ts` - Updated DI wiring with string token providers

## Decisions Made
- Replicated exact auth pattern structure -- consistency across all gRPC services
- Domain entities are pure TypeScript classes with zero framework imports per D-04/D-05
- Use-case stubs throw plain `Error` (application layer stays framework-minimal per Phase 4 decision)
- Infrastructure stubs throw `NotImplementedException` (NestJS exceptions OK in infrastructure layer)
- String token providers (`'CampaignRepositoryPort'`, `'CreateCampaignPort'`, etc.) for DI decoupling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs

All files are intentional architectural stubs per project constraints (no business logic, only structural scaffolding). Each gRPC method and use-case will be implemented in future business logic phases.

## Next Phase Readiness
- Sender and parser have correct hexagonal structure ready for audience and notifier replication (05-02, 05-03)
- All proto RPC methods are type-safe stubs ready for business logic implementation
- No blockers

## Self-Check: PASSED

All 12 created files verified present. Both commit hashes (8e570e7, 39448bc) confirmed in git log.

---
*Phase: 05-architecture-replication-boundaries*
*Completed: 2026-04-02*
