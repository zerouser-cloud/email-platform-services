# Testing Patterns

**Analysis Date:** 2026-04-02

## Test Framework

**Status:** No test files found in workspace

**Runner:** Not configured
- `package.json` contains no test script
- No Jest, Vitest, or Mocha configuration files detected
- No `*.test.ts` or `*.spec.ts` files in `apps/` or `packages/`

**Expected Setup (When Added):**
- Jest recommended for NestJS (framework standard)
- Alternative: Vitest for TypeScript-first approach
- Test discovery: `**/*.spec.ts` or `**/*.test.ts` pattern

## Codebase Structure for Testing

**Testing-Ready Architecture:**
The codebase is structured to enable testing via dependency injection:

**Controllers:** `apps/{service}/src/*.controller.ts`
- NestJS `@Controller()` decorator with optional routes
- Minimal business logic (delegation to services)
- Example: `apps/gateway/src/health/health.controller.ts` (60 lines)
  - Dependencies injected via constructor
  - Methods return observables or direct responses
  - No direct calls to external services in controller

**Services (Infrastructure):** `packages/foundation/src/**/*.ts`
- Custom exception classes: `packages/foundation/src/errors/grpc-exceptions.ts`
- Interceptors: `packages/foundation/src/logging/grpc-logging.interceptor.ts`
- Filters: `packages/foundation/src/errors/rpc-exception.filter.ts`
- Health indicators: `packages/foundation/src/health/indicators/*.health.ts`
- All use `@Injectable()` decorator, testable via mocking

**Configuration Loading:** `packages/config/src/config-loader.ts`
- Pure function: `loadGlobalConfig()` validates process.env only
- No file I/O, no side effects
- Returns cached config on subsequent calls
- Testable by stubbing process.env before import

## Recommended Test Structure

**File Placement:**
```
apps/gateway/src/
├── health/
│   ├── health.controller.ts
│   ├── health.controller.spec.ts    # co-located
│   └── health.module.ts
└── throttle/
    ├── throttle.module.ts
    └── throttle.module.spec.ts
```

**Pattern:** Co-locate test files with source files, using `.spec.ts` extension

## Test Types Needed

**Unit Tests:**

**Controllers** - Test HTTP/gRPC request handling
- Mock injected services and dependencies
- Verify correct service method calls
- Check response structure and status codes
- Example targets:
  - `apps/gateway/src/health/health.controller.ts` (liveness/readiness checks)
  - `apps/sender/src/health/health.controller.ts` (database/message queue health)

**Services/Utilities** - Test business logic in isolation
- Mock external dependencies (databases, services, loggers)
- Test all code paths and error conditions
- Example targets:
  - `packages/foundation/src/errors/rpc-exception.filter.ts` (exception handling)
  - `packages/foundation/src/logging/grpc-logging.interceptor.ts` (request logging)
  - `packages/config/src/config-loader.ts` (environment validation)

**Integration Tests:**

**Modules** - Test module bootstrap and dependency resolution
- Verify module imports load correctly
- Check provider instantiation
- Test module factories like `LoggingModule.forHttp()`
- Example targets:
  - `apps/gateway/src/gateway.module.ts` (full app module)
  - `packages/foundation/src/logging/logging.module.ts` (logging setup)

**gRPC Communication** - Test service-to-service calls
- Use real gRPC stubs or mock clients
- Verify protobuf serialization/deserialization
- Test timeout and retry behavior
- Targets: `packages/foundation/src/grpc/grpc-client.module.ts`

**End-to-End Tests:**
- Docker compose full stack (`infra/docker-compose.yml`)
- Test request flow through gateway to backend services
- Verify health check endpoints
- Test correlation ID propagation across services

## Mocking Strategy

**NestJS Testing Module:**
```typescript
// Recommended pattern (when tests are added)
import { Test, TestingModule } from '@nestjs/testing';

describe('HealthController', () => {
  let module: TestingModule;
  let controller: HealthController;
  let mockHealthService: any;

  beforeEach(async () => {
    mockHealthService = {
      check: jest.fn().mockResolvedValue({
        status: 'ok',
      }),
    };

    module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should return health status', async () => {
    const result = await controller.liveness();
    expect(mockHealthService.check).toHaveBeenCalled();
  });
});
```

**What to Mock:**
- External service clients (gRPC clients, database connections)
- Configuration values (via `loadGlobalConfig` stub)
- Logger instances
- Database connections
- Message queue connections

**What NOT to Mock:**
- NestJS core utilities (decorators, validators, pipes)
- Custom exception classes (test exception behavior directly)
- Type definitions and constants
- Actual error filter/interceptor logic (test with real implementations)

## Fixtures and Test Data

**Not Yet Established** - When adding tests:

**Recommended Approach:**
- Create `test/fixtures/` directory at workspace root
- Common data files:
  ```
  test/fixtures/
  ├── config/
  │   └── valid-env.json        # Sample .env values
  ├── grpc/
  │   └── mock-responses.ts      # Protobuf message samples
  └── db/
      └── seed.ts                # Test data for integration tests
  ```

**Factory Pattern for Objects:**
```typescript
// test/factories/config.factory.ts (recommended when added)
export function createMockConfig(overrides?: Partial<GlobalEnv>) {
  return {
    LOG_LEVEL: 'debug',
    LOG_FORMAT: 'json',
    GATEWAY_PORT: 3000,
    ...overrides,
  };
}
```

## Coverage Goals

**Current State:** No coverage tracking configured

**Recommended Setup:**
- Jest config addition: `collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts']`
- Coverage thresholds:
  - Statements: 70%+
  - Branches: 60%+
  - Lines: 70%+
  - Functions: 70%+
- Critical areas requiring 90%+ coverage:
  - Error handling (`packages/foundation/src/errors/`)
  - Configuration loading (`packages/config/src/config-loader.ts`)
  - Interceptors and filters

**View Coverage (When Implemented):**
```bash
pnpm test --coverage
# Or per-app:
cd apps/gateway && pnpm test --coverage
```

## Environment Variables in Tests

**Pattern:**

**For Unit Tests:**
```typescript
// Override process.env for config-loader tests
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    LOG_LEVEL: 'debug',
    GATEWAY_PORT: '3000',
    // ... other required vars
  };
});

afterEach(() => {
  process.env = originalEnv;
});
```

**For Integration Tests:**
- Load `.env.test` file before module initialization
- Use `dotenv-cli` pattern from root `package.json`: `dotenv -e .env.test -- pnpm test`

## Async Testing

**Observable/Promise Handling:**

```typescript
// gRPC interceptor returning Observable
it('should log gRPC call', (done) => {
  const mockContext = { /* ... */ };
  const mockNext = {
    handle: () => of({ result: 'success' }),
  };

  interceptor.intercept(mockContext, mockNext).subscribe({
    next: (value) => {
      expect(mockLogger.info).toHaveBeenCalled();
      done();
    },
    error: (err) => done(err),
  });
});

// Or with done() and async/await
it('should resolve health check', async () => {
  const result = await controller.readiness();
  expect(result).toHaveProperty('status');
});
```

## Error Testing

**Exception Behavior:**

```typescript
// Test custom exception class
it('should throw GrpcNotFoundException with correct status', () => {
  expect(() => {
    throw new GrpcNotFoundException('Not found');
  }).toThrow(GrpcException);
});

// Test exception filter
it('should catch RPC exceptions and log', () => {
  const filter = new AllRpcExceptionsFilter(mockLogger);
  const exception = new RpcException({ code: 5, message: 'Not found' });
  const result = filter.catch(exception, {} as ArgumentsHost);

  expect(mockLogger.warn).toHaveBeenCalledWith(
    expect.objectContaining({ error: expect.any(Object) }),
    'RPC exception'
  );
});
```

## Common Test Patterns

**Controller Testing:**
```typescript
describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({ status: 'ok' }),
          },
        },
        // ... other providers
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  it('liveness should check memory', async () => {
    await controller.liveness();
    expect(healthCheckService.check).toHaveBeenCalled();
  });
});
```

**Interceptor Testing:**
```typescript
describe('GrpcLoggingInterceptor', () => {
  let interceptor: GrpcLoggingInterceptor;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    interceptor = new GrpcLoggingInterceptor(mockLogger);
  });

  it('should log successful RPC call', (done) => {
    const next = {
      handle: () => of({ success: true }),
    };

    interceptor
      .intercept({} as ExecutionContext, next)
      .subscribe({
        next: () => {
          expect(mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'OK' }),
            'gRPC call completed'
          );
          done();
        },
      });
  });
});
```

**Configuration Testing:**
```typescript
describe('loadGlobalConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      LOG_LEVEL: 'debug',
      GATEWAY_PORT: '3000',
      // ... required vars
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should validate required environment variables', () => {
    expect(() => loadGlobalConfig()).not.toThrow();
  });

  it('should throw on missing required variables', () => {
    delete process.env.GATEWAY_PORT;
    expect(() => loadGlobalConfig()).toThrow();
  });
});
```

## Test Running

**Planned Commands (When Tests Added):**
```bash
# Run all tests
pnpm test

# Watch mode
pnpm test --watch

# Coverage report
pnpm test --coverage

# Single package
cd apps/gateway && pnpm test

# Specific test file
pnpm test -- health.controller.spec.ts
```

## Snapshot Testing

**Guidelines:**
- Use sparingly (only for API responses or config structures that rarely change)
- Store snapshots with source files: `__snapshots__/`
- Example: Health check response structure
  ```typescript
  it('readiness response structure should match', () => {
    const result = await controller.readiness();
    expect(result).toMatchSnapshot();
  });
  ```

---

*Testing analysis: 2026-04-02*
