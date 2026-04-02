# Coding Conventions

**Analysis Date:** 2026-04-02

## Naming Patterns

**Files:**
- Controllers: `*.controller.ts` (e.g., `health.controller.ts`, `sender.controller.ts`)
- Modules: `*.module.ts` (e.g., `gateway.module.ts`, `logging.module.ts`)
- Services: `*.service.ts` pattern (not yet used, but NestJS standard)
- Interceptors: `*.interceptor.ts` (e.g., `grpc-logging.interceptor.ts`)
- Filters: `*.filter.ts` (e.g., `rpc-exception.filter.ts`)
- Constants/Config: `*-constants.ts` or `env-constants.ts`
- Types: `types.ts` for type definitions
- Generated code: `generated/` directory contains protobuf-generated code
- Index files: `index.ts` serves as barrel exports for packages

**Functions:**
- camelCase for function names
- Descriptive names that indicate purpose: `loadGlobalConfig()`, `resolveProtoPath()`, `checkOverallHealth()`
- Factory functions prefixed with `create`: `createDeadlineInterceptor()`
- Async functions clearly named: `bootstrap()`, methods like `readiness()`, `liveness()`
- Helper functions with clear intent: `checkOverallHealth()`, `resolveTransport()`

**Variables:**
- camelCase for variable declarations
- Constant collections use uppercase with underscores: `GRPC_SERVICES`, `LOG_FORMAT`, `LOG_LEVEL`
- Const objects representing configuration use UPPER_SNAKE_CASE: `ERROR_MESSAGE`, `HEADER`, `SERVER`, `CORS`, `HEALTH`
- Private class properties use underscore prefix: `_host`, `_context`

**Types:**
- PascalCase for class names: `GatewayModule`, `HealthController`, `LoggingModule`
- PascalCase for interface names: `GrpcErrorPayload`, `ServiceDeclaration`, `ExecutionContext`
- Type aliases in PascalCase: `LogFormat`, `LogLevel`, `GlobalEnv`
- Discriminator types use readonly properties for immutability: `readonly port: number`

## Code Style

**Formatting:**
- Prettier configured with:
  - Single quotes (`singleQuote: true`)
  - Trailing commas on all (`trailingComma: "all"`)
  - Print width of 100 characters (`printWidth: 100`)
  - 2-space indentation (`tabWidth: 2`)
  - Semicolons required (`semi: true`)
- Format and check: `pnpm lint:fix` for workspace
- Individual app linting: `eslint src/ --ext .ts`

**Linting:**
- ESLint with TypeScript plugin:
  - Parser: `@typescript-eslint/parser`
  - Plugin: `@typescript-eslint/eslint-plugin`
  - Config extends: recommended + prettier

**Key Rules:**
- `@typescript-eslint/no-unused-vars`: warn, with underscore exception for intentionally unused params
- `@typescript-eslint/no-explicit-any`: error (strict type safety)
- `@typescript-eslint/explicit-function-return-type`: off (inferred returns allowed)
- `@typescript-eslint/explicit-module-boundary-types`: off
- `@typescript-eslint/no-empty-function`: warn

## Import Organization

**Order:**
1. Node.js built-in modules: `import 'reflect-metadata'`, `import { join } from 'path'`
2. Third-party packages: `import helmet from 'helmet'`, `import { Module } from '@nestjs/common'`
3. Package scoped imports from monorepo: `import { loadGlobalConfig } from '@email-platform/config'`
4. Foundation/shared packages: `import { LoggingModule } from '@email-platform/foundation'`
5. Relative imports from current package: `import { HealthModule } from './health/health.module'`

**Path Aliases:**
- Monorepo uses workspace package references via `@email-platform/{package}` naming
- Package structure: `@email-platform/contracts`, `@email-platform/config`, `@email-platform/foundation`
- Barrel files (`index.ts`) re-export public APIs from each package
- Example: `export * from './constants'` aggregates constants for package consumption

**Barrel Exports Pattern:**
- Each package's `index.ts` exports public API
- Packages export namespaced protos: `export * as AuthProto from './generated/auth'`
- Foundation exports all cross-cutting concerns: logging, error handling, health checks, resilience

## Error Handling

**Patterns:**
- gRPC services use custom `GrpcException` hierarchy extending `RpcException`
- Standard exceptions:
  - `GrpcNotFoundException` for NOT_FOUND (gRPC status code 5)
  - `GrpcInvalidArgumentException` for INVALID_ARGUMENT (code 3)
  - `GrpcAlreadyExistsException` for ALREADY_EXISTS (code 6)
  - `GrpcPermissionDeniedException` for PERMISSION_DENIED (code 7)
  - `GrpcUnauthenticatedException` for UNAUTHENTICATED (code 16)
  - `GrpcInternalException` for INTERNAL (code 13)
  - `GrpcUnavailableException` for UNAVAILABLE (code 14)
- Exceptions accept optional `details?: Record<string, unknown>` for context
- All gRPC exceptions caught by `AllRpcExceptionsFilter` in `packages/foundation/src/errors/rpc-exception.filter.ts`
- HTTP exceptions handled by `GrpcToHttpExceptionFilter` in gateway
- Logging includes `stack` for Error objects: `error: errorMessage, stack`

**Exception Filter Implementation:**
- Catch decorator on filter classes: `@Catch()`
- Filters check exception type before handling
- Unknown errors logged with full stack trace
- Return Observable<never> with throwError for gRPC

## Logging

**Framework:** Pino (via `nestjs-pino`)

**Configuration:**
- HTTP logging configured in `LoggingModule.forHttp()` with:
  - Auto request/response serialization (method, url, statusCode)
  - Correlation ID generation from `x-correlation-id` header or UUID
  - Environment-based log level and format (json/pretty)
- gRPC logging configured in `LoggingModule.forGrpc()` with:
  - Disabled auto-logging (manual control)
  - Correlation ID from gRPC metadata
  - Same transport resolution

**Patterns:**
- Use `this.logger.info()`, `this.logger.warn()`, `this.logger.error()` from PinoLogger
- Log with structured objects: `this.logger.info({ method, duration, status: 'OK' }, 'message')`
- Correlation ID automatically included in logs via ClsModule
- Child loggers created with context: `PinoLogger.root.child({ correlationId })`
- Log levels: trace, debug, info, warn, error, fatal
- Logging interceptors capture method name, duration, success/error status

**Cross-Cutting Setup:**
- `ClsModule` for correlation ID propagation (globally mounted for HTTP, interceptor-mounted for gRPC)
- Two logging modes: `forHttp()` for REST APIs, `forGrpc()` for microservices
- Transport auto-resolved based on log format: JSON or pretty-printed

## Comments

**When to Comment:**
- Non-obvious business logic requiring explanation
- Architectural decisions or constraints
- Complex algorithms or edge cases
- Migration notes or planned improvements (use TODO/FIXME)

**JSDoc/TSDoc:**
- Used for public API documentation
- Example from `config-loader.ts`:
  ```typescript
  /**
   * Pure validator for process.env against Zod GlobalEnvSchema.
   *
   * Environment variables must be injected by the platform:
   * - Local dev: node --env-file=.env (Node.js 20+ native)
   * - Docker: env_file in docker-compose.yml
   * - CI/Prod: platform-level env injection
   *
   * @returns Safely validated GlobalEnv (topology + infrastructure)
   */
  ```
- Parameters and return types documented for public functions
- Type guards and inline type assertions marked when used

## Function Design

**Size:**
- Most functions are 10-40 lines
- Controllers often single-line method bodies delegating to injected services
- Middleware/interceptors keep business logic minimal
- Complex logic broken into helper functions

**Parameters:**
- Constructor injection for dependencies (NestJS pattern)
- Method parameters use named objects when more than 2 params: `{ service: string }`
- Arrow functions for callbacks: `({ key, url }) => ...`
- Type parameters for generics in factory functions: `<const Id extends string>`

**Return Values:**
- NestJS Observable return pattern for interceptors
- Promise returns for async bootstrap and health checks
- Object returns for configurations: `{ code, message, details }`
- Type-safe discriminated unions for service declarations

## Module Design

**Exports:**
- Barrel files (`index.ts`) export public API only
- Use `export *` for re-exporting: `export * from './constants'`
- Namespace re-exports for logical grouping: `export * as AuthProto from './generated/auth'`
- Services and utilities exported as named exports
- Private modules/helpers stay internal

**Example Barrel Pattern (packages/foundation/src/index.ts):**
- Exports: constants, proto-resolver, grpc-client.module, logging.module, error-messages, health-constants
- Structured as: export * from './category/file'
- Imports consume via: `import { HEALTH } from '@email-platform/foundation'`

**Circular Dependency Prevention:**
- ESLint rules enforce layered architecture in `.eslintrc.js`
- Layer order: contracts (leaf) -> config -> foundation -> apps
- Apps cannot import other apps
- Each layer has no-restricted-imports rules preventing upward references

## Architecture Constraints

**Monorepo Organization:**
- `packages/contracts/`: gRPC proto definitions and generated code
- `packages/config/`: configuration loading, service catalog, environment schema
- `packages/foundation/`: cross-cutting infrastructure (logging, health checks, error handling)
- `apps/{service}/`: microservices (gateway, auth, sender, parser, audience, notifier)

**Module Instantiation:**
- NestJS modules use static factory methods: `LoggingModule.forHttp()`, `LoggingModule.forGrpc()`
- Dynamic modules return `DynamicModule` with imports, providers, exports
- Global providers registered via `APP_FILTER`, `APP_INTERCEPTOR` tokens

---

*Convention analysis: 2026-04-02*
