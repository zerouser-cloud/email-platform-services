# Phase 4: Architecture Reference Implementation - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Auth service is restructured into correct Clean/Hexagonal layers (domain/application/infrastructure), serving as the validated reference for all other services. Only structural scaffolding — no business logic implementation.

</domain>

<decisions>
## Implementation Decisions

### Scope
- **D-01:** Create ONLY the layer directories and minimal example files — not the full entity/VO/use-case set from TARGET_ARCHITECTURE.md. Specifically: 1 entity, 1 port (inbound + outbound), 1 use-case stub, 1 adapter stub.
- **D-02:** This is scaffolding for future business logic, NOT implementation. Use-case bodies throw `NotImplementedException`. Adapter bodies throw `NotImplementedException`.
- **D-03:** Auth service is the reference because it's the simplest domain service with clear boundaries.

### Layer Structure
- **D-04:** Follow TARGET_ARCHITECTURE.md section 4 exactly:
  - `domain/` — entities, value-objects (pure TS, zero framework imports)
  - `application/` — ports/inbound/, ports/outbound/, use-cases/
  - `infrastructure/` — grpc/ (inbound adapter), persistence/ (outbound adapter)
- **D-05:** Domain layer MUST have zero NestJS imports — pure TypeScript only.
- **D-06:** Application layer depends only on domain. Infrastructure depends on application + domain.

### Validation
- **D-07:** Run `gsd-architecture-validator` agent after each plan to validate boundaries. If violations found, fix before proceeding.
- **D-08:** Validator checks: no NestJS imports in domain/, no infrastructure imports in application/, dependency direction correct.

### DI Wiring
- **D-09:** Update `auth.module.ts` to import the new layers — ports bound to adapters via NestJS providers. Module should compile and start correctly (even though handlers throw NotImplemented).

### Claude's Discretion
- Exact file names within the layer structure
- Whether to include a domain service stub or just entity + value object
- How to wire the gRPC adapter (controller vs separate adapter class)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture specification
- `docs/TARGET_ARCHITECTURE.md` — Sections 4-6: layer structure, dependency rules, example Sender layout. Auth should follow the same pattern.

### Current auth service
- `apps/auth/src/main.ts` — Bootstrap (keep as-is)
- `apps/auth/src/auth.module.ts` — DI wiring (will be updated)
- `apps/auth/src/auth.controller.ts` — Empty controller (will be restructured into infrastructure/grpc/)
- `apps/auth/src/health/` — Health module (keep as-is)

### Proto contracts (auth domain)
- `packages/contracts/proto/auth.proto` — gRPC RPC definitions for auth
- `packages/contracts/src/generated/auth.ts` — Generated TypeScript types

### Prior phase outputs
- Phase 2 config: `AppConfigModule` + `LoggingModule.forGrpcAsync()` already in auth.module
- Phase 3 errors: Global exception filters already wired

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `auth.proto` defines: Login, Register, ValidateToken, RefreshToken, RevokeToken RPCs
- `AuthProto` namespace exported from contracts package
- `AppConfigModule`, `LoggingModule.forGrpcAsync()` already imported in auth.module

### Established Patterns
- NestJS module pattern with `@Module({ imports, controllers, providers })`
- gRPC controllers use `@Controller()` + `@GrpcMethod()` decorators
- Health module is a separate NestJS module — keep isolated

### Integration Points
- `auth.module.ts` — main DI wiring point, will grow significantly
- `main.ts` — gRPC server bootstrap, no changes needed
- Proto-generated types provide the contract interface

</code_context>

<specifics>
## Specific Ideas

- Minimal scaffolding: 1 entity, 1 port pair, 1 use-case, 1 adapter — enough to validate the pattern
- Use-case/adapter bodies throw NotImplementedException
- architecture-validator runs after EACH plan (strict validation)
- Follow TARGET_ARCHITECTURE.md structure exactly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-architecture-reference-implementation*
*Context gathered: 2026-04-02*
