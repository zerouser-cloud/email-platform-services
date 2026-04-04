# Architecture

**Analysis Date:** 2026-04-02

## Pattern Overview

**Overall:** Microservices monorepo with Clean/Hexagonal Architecture

**Key Characteristics:**
- Multiple NestJS-based domain services communicating via gRPC
- Single REST gateway translating HTTP to gRPC (facade pattern)
- Asynchronous event-driven communication via RabbitMQ
- PostgreSQL for persistence across services (via Drizzle ORM with pgSchema per service)
- Dependency Inversion: infrastructure → application → domain
- Proto-based contracts enforce service boundaries

## System Architecture

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ HTTPS :443
       │
┌──────▼──────────┐
│ Nginx / SSL     │
│ termination     │
└──────┬──────────┘
       │ HTTP :3000
       │
┌──────▼────────────────────────────────────────────────┐
│                  Gateway (REST)                        │
│              Routing + gRPC clients                    │
└──────┬────────────────────────────────────────────────┘
       │
       ├─ gRPC :50051──> ┌──────────┐
       │                 │   Auth   │
       │                 └──────────┘
       │
       ├─ gRPC :50052──> ┌──────────┐
       │                 │  Sender  │
       │                 └──────────┘
       │
       ├─ gRPC :50053──> ┌──────────┐
       │                 │  Parser  │
       │                 └──────────┘
       │
       └─ gRPC :50054──> ┌──────────┐
                         │ Audience │
                         └──────────┘

┌─────────────────────────────────────────────────────────┐
│           Asynchronous Layer (RabbitMQ)                 │
│  Sender → Audience → Parser → Notifier (events)        │
└─────────────────────────────────────────────────────────┘

┌──────────┐  ┌────────┐  ┌─────────┐  ┌───────────┐
│PostgreSQL│  │ Redis  │  │RabbitMQ │  │ MinIO/S3  │
│(persist) │  │(cache) │  │(events) │  │(files)    │
└──────────┘  └────────┘  └─────────┘  └───────────┘
```

## Layers

**Infrastructure Layer (Adapters):**
- Purpose: Framework integrations and external communication
- Location: `apps/*/src/infrastructure/`, `packages/foundation/`
- Contains: gRPC servers/clients, PostgreSQL repositories (Drizzle), RabbitMQ publishers, REST controllers, external API clients
- Depends on: Application, Domain
- Used by: Nothing depends on this layer (inverted)

**Application Layer (Use Cases & Ports):**
- Purpose: Business logic orchestration and port definitions
- Location: `apps/*/src/application/`
- Contains: Use case implementations, inbound ports (interfaces), outbound ports (interfaces)
- Depends on: Domain
- Used by: Infrastructure adapters

**Domain Layer (Core Business Logic):**
- Purpose: Pure business logic, zero external dependencies
- Location: `apps/*/src/domain/`
- Contains: Entities, Value Objects, Domain Events, Domain Services
- Depends on: Nothing
- Used by: Application layer

## Data Flow

**Authentication Flow:**

1. Frontend sends `POST /auth/login {email, password}` to Gateway
2. Gateway calls `AuthService.Login(gRPC)` via `apps/auth/src/auth.controller.ts`
3. Auth service verifies credentials against PostgreSQL and signs JWT
4. Gateway returns `TokenPair {accessToken, refreshToken}` to Frontend
5. For protected endpoints: Gateway calls `AuthService.ValidateToken(gRPC)` to extract UserContext
6. UserContext passed down to domain service calls

**Email Campaign Flow:**

1. Frontend creates campaign: `POST /sender/campaigns {name, messageId, runnerId, groupId}`
2. Gateway calls `SenderService.CreateCampaign(gRPC)` from `apps/sender/src/sender.controller.ts`
3. Sender saves Campaign to PostgreSQL in `sender.campaigns` table
4. Cron scheduler in Sender service wakes every 3 minutes
5. Sender calls `AudienceService.GetRecipientsByGroup(gRPC)` to fetch recipients
6. For each recipient, Sender calls proxy endpoint via HTTP to send email
7. Sender calls `AudienceService.MarkAsSent(gRPC)` to update recipient status
8. When complete, Sender publishes `sender.campaign.completed` event to RabbitMQ
9. Notifier service consumes event and sends Telegram alert

**Parsing Contacts Flow:**

1. Frontend creates parser task: `POST /parser/tasks {category, dateRange}`
2. Gateway calls `ParserService.CreateTask(gRPC)` from `apps/parser/src/parser.controller.ts`
3. Cron in Parser wakes every minute, fetches apps from AppStoreSpy API
4. Parser uploads CSV results to MinIO/S3
5. Parser publishes `parser.batch.ready` event with recipients array and CSV URL
6. Audience service consumes event, deduplicates, saves to PostgreSQL `audience.recipients` table
7. Audience publishes `recipients.imported` event with count
8. Notifier consumes events and sends Telegram notification with file

**State Management:**

- **Transactional State:** PostgreSQL (users, campaigns, recipients, parser tasks)
- **Cache:** Redis for temporary session/performance data (if used)
- **Async Coordination:** RabbitMQ events ensure loose coupling between services
- **In-Process:** NestJS providers and modules handle DI

## Key Abstractions

**Service:**
- Purpose: Each microservice is autonomous and specializes in one domain
- Examples: `apps/auth/`, `apps/sender/`, `apps/parser/`, `apps/audience/`, `apps/notifier/`
- Pattern: NestJS module system with gRPC transport (except Gateway which uses REST)

**Port:**
- Purpose: Define boundaries between layers (Inbound for API entry points, Outbound for dependencies)
- Examples: Would be in `apps/*/src/application/ports/` (currently in progress)
- Pattern: TypeScript interfaces describing service contracts

**Proto Service:**
- Purpose: gRPC service definition enforcing type safety between microservices
- Examples: `packages/contracts/proto/auth.proto`, `packages/contracts/proto/sender.proto`
- Pattern: `.proto` files compiled to TypeScript via protoc-gen-ts_proto

**Repository:**
- Purpose: Data access abstraction implementing outbound port
- Examples: PostgreSQL repository adapter for each service (Drizzle ORM with pgSchema isolation)
- Pattern: Would implement port interfaces, currently implicit in controllers

**Event:**
- Purpose: Asynchronous communication between services
- Examples: `sender.campaign.completed`, `parser.batch.ready`, `recipients.imported`
- Pattern: Published to RabbitMQ topic exchange with routing keys

## Entry Points

**Gateway HTTP (REST to gRPC facade):**
- Location: `apps/gateway/src/main.ts`, `apps/gateway/src/gateway.module.ts`
- Triggers: HTTP requests from frontend
- Responsibilities: CORS, validation, helmet, throttling, token validation, gRPC client invocation

**Auth Service (gRPC):**
- Location: `apps/auth/src/main.ts`, `apps/auth/src/auth.controller.ts`
- Triggers: gRPC calls from Gateway
- Responsibilities: User login, token refresh/validate/revoke, user creation, token signing

**Sender Service (gRPC):**
- Location: `apps/sender/src/main.ts`, `apps/sender/src/sender.controller.ts`
- Triggers: gRPC calls from Gateway, cron scheduler
- Responsibilities: Campaign CRUD, email sending orchestration, runner management

**Parser Service (gRPC):**
- Location: `apps/parser/src/main.ts`, `apps/parser/src/parser.controller.ts`
- Triggers: gRPC calls from Gateway, cron scheduler
- Responsibilities: Contact parsing, external API integration, CSV generation

**Audience Service (gRPC):**
- Location: `apps/audience/src/main.ts`, `apps/audience/src/audience.controller.ts`
- Triggers: gRPC calls from Gateway/Sender, RabbitMQ event subscription
- Responsibilities: Recipient and group management, import/export

**Notifier Service (Message Subscriber):**
- Location: `apps/notifier/src/main.ts`, `apps/notifier/src/notifier.module.ts`
- Triggers: RabbitMQ event consumption (no REST/gRPC)
- Responsibilities: Telegram/email notifications, file delivery

## Error Handling

**Strategy:** Errors converted from domain to gRPC status codes, then to HTTP responses

**Patterns:**
- `GrpcToHttpExceptionFilter` in `packages/foundation/src/errors/` transforms gRPC errors to HTTP status codes
- Validation errors caught by NestJS `ValidationPipe` and converted to 400 Bad Request
- Domain business logic returns error states via result types (if implemented)
- Uncaught exceptions trigger 500 Internal Server Error

## Cross-Cutting Concerns

**Logging:** 
- Framework: `nestjs-pino` with `pino` transport
- Configuration: `packages/foundation/src/logging/` - separate config for HTTP vs gRPC
- Example: `LoggingModule.forHttp()` and `LoggingModule.forGrpc()` imported in each service

**Validation:**
- NestJS `ValidationPipe` on Gateway for input validation
- Proto message validation at compile time (type safety)
- No additional validation layer visible (should be in domain use cases)

**Authentication:**
- Gateway requires Bearer token on protected routes
- Calls `AuthService.ValidateToken(gRPC)` to extract UserContext
- UserContext passed via gRPC request context to domain services
- Token format: JWT issued by Auth service, stored by frontend

**Configuration:**
- Centralized loading via `packages/config/src/config-loader.ts`
- Environment variables validated against schema in `packages/config/src/env-schema.ts`
- `@email-platform/config` package exports `AppConfigModule` and `loadGlobalConfig()`
- Each service imports `AppConfigModule` at module level

## Service Dependencies

**Gateway → All Services (gRPC clients):**
- Calls Auth to validate tokens
- Calls Sender/Parser/Audience for domain operations
- No direct database access

**Sender ↔ Audience (gRPC):**
- Sender calls `GetRecipientsByGroup()` to fetch email list
- Sender calls `MarkAsSent()` to update recipient status after email sent

**Sender → RabbitMQ (Publisher):**
- Publishes `sender.campaign.completed`, `sender.email.failed`, `sender.campaign.progress`

**Parser → RabbitMQ (Publisher):**
- Publishes `parser.batch.ready`, `parser.task.completed`

**Audience → RabbitMQ (Subscriber):**
- Consumes `parser.batch.ready` to import recipients
- Publishes `recipients.imported` when done

**Notifier → RabbitMQ (Subscriber only):**
- Consumes all event topics: `sender.campaign.completed`, `parser.task.completed`, `email.failed`, `recipients.imported`

**External Integrations:**
- **Parser → AppStoreSpy API:** HTTP GET requests for app/email data
- **Sender → Google Cloud Proxy Functions:** HTTP POST to send emails
- **Notifier → Telegram Bot API:** HTTP POST to send alerts
- **Parser/Notifier → MinIO/S3:** S3-compatible API for file storage

---

*Architecture analysis: 2026-04-02*
