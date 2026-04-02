# Phase 5: Architecture Replication & Boundaries - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

All remaining services (sender, parser, audience, notifier, gateway) follow the validated auth reference pattern. Strict isolation between services enforced — no cross-service imports. Controller stubs match proto RPC definitions. Notifier is event-consumer-only with RabbitMQ health check.

</domain>

<decisions>
## Implementation Decisions

### Scope per Service
- **D-01:** Same minimal scaffolding as auth: layer directories + 1 entity, 1 port pair (inbound + outbound), 1 use-case stub, 1 adapter stub per service.
- **D-02:** Bodies throw NotImplementedException/Error — no business logic.

### Domain Services (sender, parser, audience)
- **D-03:** Follow auth reference exactly: domain/ → application/ → infrastructure/ with gRPC inbound adapter using `@*ServiceControllerMethods()` decorator from proto-generated types.
- **D-04:** Each service gets entity/port/use-case/adapter based on its primary domain per TARGET_ARCHITECTURE.md:
  - Sender: Campaign entity, CreateCampaign port/use-case, MongoCampaignRepository adapter
  - Parser: ParserTask entity, StartParsing port/use-case, MongoParserTaskRepository adapter
  - Audience: Recipient entity, ImportRecipients port/use-case, MongoRecipientRepository adapter
- **D-05:** Controller stubs must include `@GrpcMethod` decorators for ALL RPC methods defined in their proto files (CONT-04 requirement).

### Notifier (event-consumer-only)
- **D-06:** Has domain/application/infrastructure layers BUT inbound adapter is RabbitMQ subscriber, NOT gRPC server.
- **D-07:** No proto, no gRPC controller. Inbound port handles event consumption.
- **D-08:** Add RabbitMQ health check to replace gRPC health check. Use `@nestjs/terminus` with custom RabbitMQ health indicator.
- **D-09:** Notifier entity: Notification. Port: HandleEvent (inbound), NotificationSender (outbound). Adapter: RabbitMQEventSubscriber (inbound), TelegramNotificationSender (outbound stub).

### Gateway (REST facade)
- **D-10:** Gateway gets infrastructure/ layer (for gRPC client adapters) but NO domain/ or application/ layers — it has no business logic, it's a routing/translation layer.
- **D-11:** Existing controllers/throttle/health stay in their current locations. Add infrastructure/clients/ for gRPC client organization.

### Cross-Service Boundaries
- **D-12:** Verify NO cross-service imports between apps/ (e.g., auth cannot import from sender). All shared code must be in packages/.
- **D-13:** Architecture-validator runs after each plan (carried from Phase 4).

### Claude's Discretion
- Exact file names within each service's layer structure
- Whether to split plans by service or by layer
- Order of service processing (recommendation: sender → parser → audience → notifier → gateway by complexity)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture reference
- `docs/TARGET_ARCHITECTURE.md` — Sections 2, 4-6: service responsibilities, layer structure, Sender example
- `apps/auth/src/` — Phase 4 reference implementation to replicate

### Proto contracts per service
- `packages/contracts/proto/sender.proto` — Sender RPC definitions
- `packages/contracts/proto/parser.proto` — Parser RPC definitions
- `packages/contracts/proto/audience.proto` — Audience RPC definitions
- `packages/contracts/src/generated/sender.ts` — Generated Sender types
- `packages/contracts/src/generated/parser.ts` — Generated Parser types
- `packages/contracts/src/generated/audience.ts` — Generated Audience types

### Current service files (to be restructured)
- `apps/sender/src/sender.controller.ts` — Empty stub, will be replaced by gRPC adapter
- `apps/parser/src/parser.controller.ts` — Empty stub
- `apps/audience/src/audience.controller.ts` — Empty stub
- `apps/notifier/src/notifier.module.ts` — No controller (event-consumer)
- `apps/gateway/src/gateway.module.ts` — REST facade module

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Auth reference: `apps/auth/src/{domain,application,infrastructure}/` — exact pattern to replicate
- `createGrpcServerOptions()` from foundation — used in all main.ts for gRPC setup
- `@*ServiceControllerMethods()` decorators from proto-generated types
- NestJS string-token DI pattern from auth (provide/useClass)

### Established Patterns
- Phase 4 auth pattern: entity (pure TS) → ports (interfaces) → use-case (DI stub) → adapters (NestJS impl)
- `AppConfigModule` + `LoggingModule.forGrpcAsync()` in every module
- Health module is separate and stays unchanged

### Integration Points
- Each service's `*.module.ts` — DI wiring (will be updated like auth was)
- Each service's `main.ts` — bootstrap stays unchanged
- Proto-generated types provide the contract interface for gRPC adapters

</code_context>

<specifics>
## Specific Ideas

- Replicate auth pattern mechanically — same structure, different domain names
- Notifier: RabbitMQ subscriber as inbound adapter, Telegram as outbound adapter stub
- Gateway: only infrastructure/ layer (gRPC clients), no domain/application
- Verify zero cross-service imports after all changes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-architecture-replication-boundaries*
*Context gathered: 2026-04-02*
