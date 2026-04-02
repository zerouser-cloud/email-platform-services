# Phase 3: Error Handling & Safety - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Errors are safe for clients, structured for debugging, and consistent across all services. Metadata bug fixed. No internal details leak to HTTP responses.

</domain>

<decisions>
## Implementation Decisions

### Metadata Bug Fix
- **D-01:** Fix `metadata.get(HEADER.CORRELATION_ID)[0]` in `logging.module.ts` line 68. Add optional chaining: `metadata.get(HEADER.CORRELATION_ID)?.[0]`. Fallback to `crypto.randomUUID()` (already on line 69, just needs the safe access).

### Error Sanitization
- **D-02:** Map errors to safe messages BY gRPC STATUS CODE, not by message content. `extractMessage()` in `GrpcToHttpExceptionFilter` must NOT return `exception.message` directly. Instead, map `grpcCode` → safe message from `ERROR_MESSAGE` constant.
- **D-03:** Log the original error message server-side (already done on line 46 via `this.logger.warn`), but return only the safe message to the client.
- **D-04:** Expand `ERROR_MESSAGE` constant to cover all gRPC status codes used in `GRPC_TO_HTTP` mapping (currently missing: FAILED_PRECONDITION, OUT_OF_RANGE, ABORTED, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, DATA_LOSS, CANCELLED).

### Unified Error Shape
- **D-05:** Add `correlationId` to all error responses. Source: `ClsService.getId()` from `nestjs-cls` (already available in every request context). Final shape: `{ statusCode, message, error, correlationId }`.
- **D-06:** Inject `ClsService` into `GrpcToHttpExceptionFilter`. The filter already has `PinoLogger` injected via constructor — add `ClsService` the same way.
- **D-07:** Update the `HttpException` passthrough path (line 31-36) to also include `correlationId` in its response, not just forward raw `exception.getResponse()`.

### Claude's Discretion
- Whether to add `timestamp` to error responses (standard practice, low effort)
- Exact wording of new ERROR_MESSAGE entries
- Whether `AllRpcExceptionsFilter` needs similar changes (it's for gRPC-to-gRPC, not client-facing)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Error handling
- `packages/foundation/src/errors/grpc-to-http.filter.ts` — Main exception filter, where sanitization and shape changes happen
- `packages/foundation/src/errors/rpc-exception.filter.ts` — gRPC service-side filter (may need similar changes)
- `packages/foundation/src/errors/error-messages.ts` — Safe error message constants to expand
- `packages/foundation/src/errors/grpc-exceptions.ts` — gRPC exception helpers

### Metadata bug
- `packages/foundation/src/logging/logging.module.ts` — Line 68 has the unsafe array access

### CLS context (for correlationId)
- `packages/foundation/src/logging/logging.module.ts` — ClsModule setup with correlation ID generation (lines 60-74)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ERROR_MESSAGE` constant — already has 7 safe messages, needs expansion to cover all gRPC codes
- `GRPC_TO_HTTP` mapping — complete mapping of gRPC to HTTP status codes
- `ClsModule` with `generateId: true` — correlation IDs already generated for every request
- `PinoLogger` already injected into both filters

### Established Patterns
- Exception filters use constructor injection (`private readonly logger: PinoLogger`)
- `@Catch()` decorator on filter classes (catch-all)
- `AllRpcExceptionsFilter` already sanitizes unhandled exceptions (line 26: returns generic `ERROR_MESSAGE.INTERNAL`)

### Integration Points
- `GrpcToHttpExceptionFilter` is used in gateway only (HTTP → client facing)
- `AllRpcExceptionsFilter` is used in gRPC services (service → service)
- `ClsService` is global (from `ClsModule.forRoot({ global: true })`)

</code_context>

<specifics>
## Specific Ideas

- correlationId from CLS context, not request headers
- Sanitize by gRPC code mapping, not message whitelist
- Error shape: `{ statusCode, message, error, correlationId }`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-error-handling-safety*
*Context gathered: 2026-04-02*
