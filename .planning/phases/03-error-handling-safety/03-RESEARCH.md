# Phase 3: Error Handling & Safety - Research

**Researched:** 2026-04-02
**Domain:** NestJS exception filters, gRPC error mapping, request correlation
**Confidence:** HIGH

## Summary

Phase 3 addresses three concrete bugs/gaps in the error handling infrastructure of `@email-platform/foundation`: (1) an unsafe array access in the logging module's gRPC correlation ID extraction, (2) direct exposure of internal gRPC error messages to HTTP clients, and (3) absence of `correlationId` in the unified error response shape.

All changes are localized to `packages/foundation/src/` (primarily `errors/` and `logging/`) with one consumer in `apps/gateway/`. The existing code provides strong foundations -- `GRPC_TO_HTTP` mapping is complete, `ERROR_MESSAGE` constants exist for 7 codes, `ClsModule` already generates correlation IDs globally. The work is surgical: fix the optional chaining bug, replace `extractMessage()` logic with code-based mapping, expand `ERROR_MESSAGE`, inject `ClsService`, and reshape error responses.

No new libraries are needed. No architectural changes required. All decisions are locked in CONTEXT.md with specific line numbers and approaches.

**Primary recommendation:** Execute decisions D-01 through D-07 as specified -- they are precise, low-risk, and require no further research.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Fix `metadata.get(HEADER.CORRELATION_ID)[0]` in `logging.module.ts` line 68. Add optional chaining: `metadata.get(HEADER.CORRELATION_ID)?.[0]`. Fallback to `crypto.randomUUID()` (already on line 69, just needs the safe access).
- **D-02:** Map errors to safe messages BY gRPC STATUS CODE, not by message content. `extractMessage()` in `GrpcToHttpExceptionFilter` must NOT return `exception.message` directly. Instead, map `grpcCode` -> safe message from `ERROR_MESSAGE` constant.
- **D-03:** Log the original error message server-side (already done on line 46 via `this.logger.warn`), but return only the safe message to the client.
- **D-04:** Expand `ERROR_MESSAGE` constant to cover all gRPC status codes used in `GRPC_TO_HTTP` mapping (currently missing: FAILED_PRECONDITION, OUT_OF_RANGE, ABORTED, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, DATA_LOSS, CANCELLED).
- **D-05:** Add `correlationId` to all error responses. Source: `ClsService.getId()` from `nestjs-cls` (already available in every request context). Final shape: `{ statusCode, message, error, correlationId }`.
- **D-06:** Inject `ClsService` into `GrpcToHttpExceptionFilter`. The filter already has `PinoLogger` injected via constructor -- add `ClsService` the same way.
- **D-07:** Update the `HttpException` passthrough path (line 31-36) to also include `correlationId` in its response, not just forward raw `exception.getResponse()`.

### Claude's Discretion
- Whether to add `timestamp` to error responses (standard practice, low effort)
- Exact wording of new ERROR_MESSAGE entries
- Whether `AllRpcExceptionsFilter` needs similar changes (it's for gRPC-to-gRPC, not client-facing)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ERR-01 | Metadata array access in logging module uses optional chaining with fallback to `crypto.randomUUID()` | Decision D-01. Bug at line 68 in `logging.module.ts` -- same pattern appears at line 150 in `forGrpcAsync()`. Both need fixing. |
| ERR-02 | gRPC error messages mapped to safe client messages, originals logged server-side | Decisions D-02, D-03, D-04. Replace `extractMessage()` with code-based lookup into expanded `ERROR_MESSAGE` constant. Server-side logging already exists on line 46. |
| ERR-03 | All services return errors in unified format `{ statusCode, message, error, correlationId }` | Decisions D-05, D-06, D-07. Inject `ClsService`, add `correlationId` to both gRPC and HttpException response paths. |
</phase_requirements>

## Standard Stack

No new libraries needed. All dependencies already installed:

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nestjs-cls | 6.2.0 | Request-scoped correlation ID storage | Already configured globally with `generateId: true` |
| nestjs-pino | 4.6.0 | Structured logging | Already injected in both exception filters |
| @grpc/grpc-js | 1.14.3 | gRPC status codes enum | Source of truth for status code mapping |
| @nestjs/common | 11.0.1 | HttpStatus enum, ExceptionFilter | Framework core |

**Installation:** None needed -- all packages present.

## Architecture Patterns

### Files to Modify
```
packages/foundation/src/
  errors/
    error-messages.ts        # Expand ERROR_MESSAGE (D-04)
    grpc-to-http.filter.ts   # Sanitize messages (D-02), add correlationId (D-05/D-06/D-07)
  logging/
    logging.module.ts        # Fix optional chaining (D-01) -- TWO locations
```

### Pattern 1: Error Message Mapping by gRPC Code

**What:** Replace direct message extraction with a lookup from gRPC status code to safe message constant.
**When to use:** Every time a gRPC error is translated to HTTP response.

Current (UNSAFE -- exposes internals):
```typescript
// grpc-to-http.filter.ts line 67-88
private extractMessage(exception: unknown): string {
  if (exception instanceof Error) {
    return exception.message; // LEAKS internal details like DB errors, stack info
  }
  // ... more message extraction that leaks
}
```

Required (SAFE -- code-based lookup):
```typescript
// Map gRPC code to safe message, never expose raw message
const ERROR_CODE_TO_MESSAGE: Record<number, string> = {
  [GrpcStatus.INVALID_ARGUMENT]: ERROR_MESSAGE.INVALID_ARGUMENT,
  [GrpcStatus.FAILED_PRECONDITION]: ERROR_MESSAGE.FAILED_PRECONDITION,
  [GrpcStatus.OUT_OF_RANGE]: ERROR_MESSAGE.OUT_OF_RANGE,
  [GrpcStatus.NOT_FOUND]: ERROR_MESSAGE.NOT_FOUND,
  [GrpcStatus.ALREADY_EXISTS]: ERROR_MESSAGE.ALREADY_EXISTS,
  [GrpcStatus.ABORTED]: ERROR_MESSAGE.ABORTED,
  [GrpcStatus.PERMISSION_DENIED]: ERROR_MESSAGE.PERMISSION_DENIED,
  [GrpcStatus.UNAUTHENTICATED]: ERROR_MESSAGE.UNAUTHENTICATED,
  [GrpcStatus.UNAVAILABLE]: ERROR_MESSAGE.UNAVAILABLE,
  [GrpcStatus.DEADLINE_EXCEEDED]: ERROR_MESSAGE.DEADLINE_EXCEEDED,
  [GrpcStatus.RESOURCE_EXHAUSTED]: ERROR_MESSAGE.RESOURCE_EXHAUSTED,
  [GrpcStatus.UNIMPLEMENTED]: ERROR_MESSAGE.UNIMPLEMENTED,
  [GrpcStatus.INTERNAL]: ERROR_MESSAGE.INTERNAL,
  [GrpcStatus.UNKNOWN]: ERROR_MESSAGE.INTERNAL,
  [GrpcStatus.DATA_LOSS]: ERROR_MESSAGE.DATA_LOSS,
  [GrpcStatus.CANCELLED]: ERROR_MESSAGE.CANCELLED,
};
```

### Pattern 2: ClsService Injection in Exception Filters

**What:** Add `ClsService` to the filter constructor alongside existing `PinoLogger`.
**When to use:** When correlation ID needed in error responses.

```typescript
import { ClsService } from 'nestjs-cls';

@Catch()
export class GrpcToHttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly cls: ClsService,
  ) {}
  // cls.getId() returns the correlation ID set by ClsModule
}
```

This works because:
- `GrpcToHttpExceptionFilter` is registered as a provider in `GatewayModule` (not via `APP_FILTER` token)
- It is retrieved via `app.get(GrpcToHttpExceptionFilter)` in `main.ts`
- NestJS DI resolves `ClsService` automatically since `ClsModule` is global

### Pattern 3: Unified Error Response Shape

**What:** Every HTTP error response includes `{ statusCode, message, error, correlationId }`.

```typescript
response.status(httpStatus).json({
  statusCode: httpStatus,
  message: safeMessage,
  error: HttpStatus[httpStatus] ?? 'Internal Server Error',
  correlationId: this.cls.getId(),
});
```

For `HttpException` passthrough (line 31-36), the existing code does:
```typescript
response.status(status).json(exception.getResponse());
```

This must be changed to merge in `correlationId`:
```typescript
const body = exception.getResponse();
const responseBody = typeof body === 'object'
  ? { ...body, correlationId: this.cls.getId() }
  : { statusCode: status, message: body, error: HttpStatus[status], correlationId: this.cls.getId() };
response.status(status).json(responseBody);
```

Note: `exception.getResponse()` can return either a string or an object. Both cases must be handled.

### Anti-Patterns to Avoid
- **Message-based sanitization:** Never whitelist/blacklist error messages by content. Map by gRPC status code only.
- **Exposing stack traces:** Never include `stack` in client-facing responses. Log server-side only.
- **Forgetting HttpException path:** The filter has TWO paths (gRPC errors AND HttpException passthrough). Both must include `correlationId`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Correlation IDs | Custom request ID middleware | `ClsService.getId()` from `nestjs-cls` | Already configured, globally available, thread-safe via AsyncLocalStorage |
| Error code mapping | Dynamic message parsing | Static `Record<number, string>` mapping | Deterministic, no regex, no string matching |

## Common Pitfalls

### Pitfall 1: Two Identical Bugs in logging.module.ts
**What goes wrong:** Fixing line 68 (`forGrpc`) but missing line 150 (`forGrpcAsync`) -- they have the exact same unsafe access pattern.
**Why it happens:** The module has 4 static methods; `forGrpc` and `forGrpcAsync` both have the metadata access bug.
**How to avoid:** Fix BOTH line 68 and line 150: `metadata.get(HEADER.CORRELATION_ID)?.[0]`
**Warning signs:** grep for `metadata.get(HEADER.CORRELATION_ID)[0]` -- should return 0 results after fix.

### Pitfall 2: HttpException.getResponse() Return Type
**What goes wrong:** Assuming `exception.getResponse()` always returns an object. It can return a string.
**Why it happens:** NestJS `HttpException` accepts either `string | Record<string, any>` in constructor.
**How to avoid:** Check `typeof body === 'object'` before spreading. Handle string case separately.
**Warning signs:** TypeScript type narrowing should catch this if types are checked.

### Pitfall 3: Missing ERROR_MESSAGE Keys
**What goes wrong:** `ERROR_CODE_TO_MESSAGE[grpcCode]` returns `undefined` for unmapped codes.
**Why it happens:** New gRPC codes added to `GRPC_TO_HTTP` but not to `ERROR_MESSAGE`.
**How to avoid:** Ensure every key in `GRPC_TO_HTTP` has a corresponding entry in `ERROR_MESSAGE` and `ERROR_CODE_TO_MESSAGE`. Add fallback: `?? ERROR_MESSAGE.INTERNAL`.
**Warning signs:** `Object.keys(GRPC_TO_HTTP).length !== Object.keys(ERROR_CODE_TO_MESSAGE).length`.

### Pitfall 4: ClsService.getId() Can Return Undefined
**What goes wrong:** If called outside CLS context (e.g., during app startup errors), `getId()` may return undefined.
**Why it happens:** CLS context is set up per-request; startup-time errors don't have a request context.
**How to avoid:** Use `this.cls.getId() ?? 'no-correlation-id'` or generate a fallback UUID.
**Warning signs:** `correlationId: undefined` in error responses.

## Code Examples

### Expanded ERROR_MESSAGE Constant
```typescript
// error-messages.ts
export const ERROR_MESSAGE = {
  NOT_FOUND: 'Resource not found',
  INVALID_ARGUMENT: 'Invalid request data',
  ALREADY_EXISTS: 'Resource already exists',
  PERMISSION_DENIED: 'Permission denied',
  UNAUTHENTICATED: 'Authentication required',
  INTERNAL: 'Internal server error',
  UNAVAILABLE: 'Service temporarily unavailable',
  // New entries (D-04):
  FAILED_PRECONDITION: 'Request precondition not met',
  OUT_OF_RANGE: 'Value out of acceptable range',
  ABORTED: 'Operation was aborted',
  DEADLINE_EXCEEDED: 'Request timed out',
  RESOURCE_EXHAUSTED: 'Too many requests',
  DATA_LOSS: 'Internal server error',       // Don't reveal data loss to clients
  CANCELLED: 'Request was cancelled',
  UNIMPLEMENTED: 'Operation not supported',
} as const;
```

Note: `DATA_LOSS` deliberately maps to "Internal server error" (same as `INTERNAL`) -- revealing data loss to clients is a security concern.

### Metadata Optional Chaining Fix
```typescript
// logging.module.ts -- applies to BOTH forGrpc (line 68) and forGrpcAsync (line 150)
idGenerator: (ctx: ExecutionContext) => {
  if (ctx.getType() === CONTEXT_TYPE.RPC) {
    const metadata = ctx.switchToRpc().getContext<Metadata>();
    const id = metadata.get(HEADER.CORRELATION_ID)?.[0];  // Optional chaining added
    return (id as string) || crypto.randomUUID();
  }
  return crypto.randomUUID();
},
```

### Discretion: Adding Timestamp
Recommendation: **Add `timestamp` to error responses.** It is standard practice (NestJS default exception filter includes it), costs nothing, and aids debugging. Use `new Date().toISOString()`.

Final shape: `{ statusCode, message, error, correlationId, timestamp }`.

### Discretion: AllRpcExceptionsFilter Changes
Recommendation: **No changes needed for AllRpcExceptionsFilter.** It handles gRPC-to-gRPC errors (service-to-service), not client-facing responses. It already sanitizes unhandled exceptions (returns generic `ERROR_MESSAGE.INTERNAL`). Adding correlationId to gRPC error responses is a different concern (gRPC uses metadata for that, not message body). Leave for a future phase if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- project has no test infrastructure |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

Note: REQUIREMENTS.md explicitly states "Tests are out of scope" for v1. Testing is listed in v2 requirements (TEST-01, TEST-02). However, nyquist_validation is enabled, so we document what WOULD be tested.

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ERR-01 | `metadata.get()` with missing metadata returns UUID fallback | unit | Manual verification -- no test framework | N/A |
| ERR-02 | gRPC error with internal message returns safe message to client | unit | Manual verification -- no test framework | N/A |
| ERR-03 | Error response includes `{ statusCode, message, error, correlationId }` | unit | Manual verification -- no test framework | N/A |

### Wave 0 Gaps
Testing infrastructure does not exist and is explicitly out of scope for v1. Validation will be done via:
1. TypeScript compilation (`pnpm build` in foundation package)
2. Manual inspection of error response shape
3. Phase 8 (VER-04) will verify error format via curl against running gateway

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all 5 canonical files listed in CONTEXT.md
- `logging.module.ts` -- confirmed TWO instances of the unsafe metadata access (line 68 and line 150)
- `grpc-to-http.filter.ts` -- confirmed `extractMessage()` returns raw `exception.message`
- `error-messages.ts` -- confirmed 7 existing entries, mapped all 16 gRPC codes in `GRPC_TO_HTTP` to identify 7 missing
- `gateway.module.ts` and `main.ts` -- confirmed filter registration pattern (provider + `app.get()`)
- `correlation.interceptor.ts` -- confirmed `ClsService` injection pattern for reference

### Secondary (MEDIUM confidence)
- NestJS `HttpException.getResponse()` can return string or object -- based on NestJS framework knowledge (verified by the code accepting both `string | Record<string, any>`)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all code inspected directly
- Architecture: HIGH -- all decisions are locked with specific line numbers and approaches
- Pitfalls: HIGH -- found by reading actual code (two-location bug, return type variance)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- no library changes needed)
