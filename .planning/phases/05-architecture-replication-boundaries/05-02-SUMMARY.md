---
phase: 05-architecture-replication-boundaries
plan: 02
subsystem: api
tags: [nestjs, grpc, rabbitmq, hexagonal-architecture, clean-architecture, audience, notifier]

# Dependency graph
requires:
  - phase: 04-auth-hexagonal-reference
    provides: Auth hexagonal reference pattern (entity/ports/use-case/repository/grpc-server/module-DI)
  - phase: 05-architecture-replication-boundaries (plan 01)
    provides: Sender and parser hexagonal scaffolding with same pattern
provides:
  - Audience hexagonal layers with all 9 gRPC RPC method stubs
  - Notifier hexagonal layers with RabbitMQ subscriber (event-consumer-only, no gRPC)
  - RabbitMQ health indicator in notifier readiness check
affects: [06-gateway-hexagonal, verification-phase]

# Tech tracking
tech-stack:
  added: []
  patterns: [event-consumer-only-service, rabbitmq-health-indicator, no-grpc-notifier]

key-files:
  created:
    - apps/audience/src/domain/entities/recipient.entity.ts
    - apps/audience/src/application/ports/inbound/import-recipients.port.ts
    - apps/audience/src/application/ports/outbound/recipient-repository.port.ts
    - apps/audience/src/application/use-cases/import-recipients.use-case.ts
    - apps/audience/src/infrastructure/grpc/audience.grpc-server.ts
    - apps/audience/src/infrastructure/persistence/mongo-recipient.repository.ts
    - apps/notifier/src/domain/entities/notification.entity.ts
    - apps/notifier/src/application/ports/inbound/handle-event.port.ts
    - apps/notifier/src/application/ports/outbound/notification-sender.port.ts
    - apps/notifier/src/application/use-cases/handle-event.use-case.ts
    - apps/notifier/src/infrastructure/messaging/rabbitmq-event.subscriber.ts
    - apps/notifier/src/infrastructure/external/telegram-notification.sender.ts
    - apps/notifier/src/health/rabbitmq-health.indicator.ts
  modified:
    - apps/audience/src/audience.module.ts
    - apps/notifier/src/notifier.module.ts
    - apps/notifier/src/health/health.module.ts
    - apps/notifier/src/health/health.controller.ts

key-decisions:
  - "Notifier is event-consumer-only: no gRPC server, no proto imports, RabbitMQ subscriber as sole inbound adapter"
  - "RabbitMQ health indicator returns healthy by default with TODO for actual connection check"
  - "Notifier health module exports RabbitMQHealthIndicator for injection into HealthController"

patterns-established:
  - "Event-consumer service pattern: RabbitMQ subscriber as inbound adapter, no gRPC server"
  - "RabbitMQ health indicator in readiness check for services with RabbitMQ dependency"

requirements-completed: [CONT-04, ARCH-02, ARCH-03]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 05 Plan 02: Audience and Notifier Hexagonal Scaffolding Summary

**Audience gRPC adapter with 9 RPC stubs and notifier event-consumer-only service with RabbitMQ subscriber and health indicator**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T14:40:20Z
- **Completed:** 2026-04-02T14:43:08Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Audience service has full hexagonal layers (domain/application/infrastructure) with all 9 gRPC RPC method stubs matching proto contract
- Notifier service has hexagonal layers with RabbitMQ subscriber as inbound adapter and Telegram sender as outbound adapter -- zero gRPC references
- RabbitMQ health indicator wired into notifier readiness check per D-08/ARCH-03
- Zero NestJS imports in domain layers, zero cross-service imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Audience service hexagonal scaffolding with all 9 gRPC stubs** - `8f91968` (feat)
2. **Task 2: Notifier service hexagonal scaffolding with RabbitMQ subscriber and health indicator** - `7f109ff` (feat)

## Files Created/Modified
- `apps/audience/src/domain/entities/recipient.entity.ts` - Recipient entity (pure TS)
- `apps/audience/src/application/ports/inbound/import-recipients.port.ts` - ImportRecipients inbound port interface
- `apps/audience/src/application/ports/outbound/recipient-repository.port.ts` - RecipientRepository outbound port interface
- `apps/audience/src/application/use-cases/import-recipients.use-case.ts` - ImportRecipients use-case stub
- `apps/audience/src/infrastructure/grpc/audience.grpc-server.ts` - gRPC inbound adapter with 9 RPC stubs
- `apps/audience/src/infrastructure/persistence/mongo-recipient.repository.ts` - MongoDB repository adapter stub
- `apps/audience/src/audience.module.ts` - Module DI wiring with string token providers
- `apps/notifier/src/domain/entities/notification.entity.ts` - Notification entity (pure TS)
- `apps/notifier/src/application/ports/inbound/handle-event.port.ts` - HandleEvent inbound port interface
- `apps/notifier/src/application/ports/outbound/notification-sender.port.ts` - NotificationSender outbound port interface
- `apps/notifier/src/application/use-cases/handle-event.use-case.ts` - HandleEvent use-case stub
- `apps/notifier/src/infrastructure/messaging/rabbitmq-event.subscriber.ts` - RabbitMQ inbound adapter (event-consumer)
- `apps/notifier/src/infrastructure/external/telegram-notification.sender.ts` - Telegram outbound adapter stub
- `apps/notifier/src/health/rabbitmq-health.indicator.ts` - RabbitMQ health indicator for terminus
- `apps/notifier/src/health/health.module.ts` - Updated with RabbitMQ health provider
- `apps/notifier/src/health/health.controller.ts` - Updated readiness check with RabbitMQ indicator
- `apps/notifier/src/notifier.module.ts` - Module DI wiring with string token providers

## Decisions Made
- Notifier is event-consumer-only: no gRPC server, no proto imports, RabbitMQ subscriber as sole inbound adapter (per D-07/ARCH-03)
- RabbitMQ health indicator returns healthy by default with TODO for actual connection check when transport is configured
- Notifier health module exports RabbitMQHealthIndicator for injection into HealthController

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
All files contain intentional stubs (NotImplementedException / throw new Error) per plan design. These are architectural scaffolding -- business logic implementation is out of scope per PROJECT.md constraints. No stubs prevent plan goals from being achieved.

## Next Phase Readiness
- All 5 domain services (auth, sender, parser, audience, notifier) now have hexagonal architecture
- Ready for gateway hexagonal scaffolding (Phase 05 Plan 03) or verification phase
- Notifier's RabbitMQ subscriber needs @EventPattern() decorators when RabbitMQ transport is configured

## Self-Check: PASSED

All 13 created files verified on disk. Both commit hashes (8f91968, 7f109ff) found in git log.

---
*Phase: 05-architecture-replication-boundaries*
*Completed: 2026-04-02*
