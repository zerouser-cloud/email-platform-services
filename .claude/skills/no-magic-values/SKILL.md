---
name: no-magic-values
description: Extract unnamed literals to named constants. Triggers on magic number, magic string, hardcoded value, literal, constant extraction, named constant, bare number, string literal, DI token, injection token, varchar length, timeout, pool size, retry count, exit code, fallback value. Apply when writing or reviewing code that contains numeric or string literals used as configuration, identifiers, keys, or behavioral values.
---

# No Magic Values -- Named Constants for All Literals

Extract every behavioral literal to a named `as const` object or Symbol token. Choose the **simplest extraction that fits**.

## Rule

**Prohibited:** Bare numeric literals (except 0, 1, -1 in idioms), unnamed string literals used as identifiers/keys/routes/headers, inline fallback strings, string DI tokens.

**Allowed:** Type literals (`type X = 'a' | 'b'`), import paths, 0/1/-1 in array/loop/comparison idioms, log message strings (human-readable, not keys), `process.exit(0)` and `process.exit(1)` (standard Unix).

```typescript
// ALLOWED -- type literal
type LogFormat = 'json' | 'pretty';

// ALLOWED -- idiomatic zero/one
if (items.length === 0) return [];
const next = index + 1;

// ALLOWED -- log message (human-readable, not identifier)
this.logger.info({ duration }, 'gRPC call completed');

// ALLOWED -- standard Unix exit
process.exit(1);

// PROHIBITED -- bare config number
new Pool({ max: 10, idleTimeoutMillis: 30_000 });

// PROHIBITED -- string as identifier
@Inject('UserRepositoryPort') private readonly repo: UserRepository

// PROHIBITED -- inline fallback string
const correlationId = cls.get('correlationId') ?? 'no-correlation-id';
```

## Decision Tree -- What to Do with a Literal

```
Found a literal value in code?
|
+-- Is it a type literal in TypeScript? (type X = 'a' | 'b')
|   +-- ALLOWED -- type system, not runtime value
|
+-- Is it an import path or module specifier?
|   +-- ALLOWED -- structural, not behavioral
|
+-- Is it 0, 1, or -1 in array/loop/comparison?
|   +-- ALLOWED -- universal idioms (arr.length === 0, index + 1)
|
+-- Is it a log message string? (human-readable, not used as key)
|   +-- ALLOWED -- documentation, not identifier
|
+-- Is it process.exit(0) or process.exit(1)?
|   +-- ALLOWED -- standard Unix exit codes
|
+-- Is it a numeric config value? (timeout, pool size, retry count)
|   +-- Extract to named constant in *-constants.ts
|   +-- Use UPPER_SNAKE_CASE object: `const PG_POOL_DEFAULTS = { MAX: 10 } as const`
|
+-- Is it a string used as identifier/key/route/header?
|   +-- Used in one file only --> local `as const` object
|   +-- Used across files in same package --> package *-constants.ts
|   +-- Used across packages --> packages/foundation/src/constants.ts
|
+-- Is it a DI injection token?
|   +-- Use Symbol('TokenName') -- project convention
|
+-- Is it a set of related string values? (status codes, tiers, types)
|   +-- `as const` object with UPPER_SNAKE_CASE keys
|
+-- Is it a repeated number in DB schemas? (varchar length, precision)
|   +-- Extract to shared constant: COLUMN_LENGTH.DEFAULT
|
+-- Is it a fallback/default string? ('unknown', 'N/A', 'no-id')
    +-- Extract to named constant near its usage context
```

## Pattern 1 -- `as const` Object for Related Named Constants

**When:** Group of related numeric or string values used together (pool config, column lengths, timeouts).

```typescript
// packages/foundation/src/persistence/persistence.constants.ts
export const PG_POOL_DEFAULTS = {
  MAX_CONNECTIONS: 10,
  IDLE_TIMEOUT_MS: 30_000,
  CONNECTION_TIMEOUT_MS: 5_000,
} as const;

// Usage:
new Pool({
  connectionString: config.get<string>('DATABASE_URL'),
  max: PG_POOL_DEFAULTS.MAX_CONNECTIONS,
  idleTimeoutMillis: PG_POOL_DEFAULTS.IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: PG_POOL_DEFAULTS.CONNECTION_TIMEOUT_MS,
});
```

## Pattern 2 -- Symbol Tokens for DI Injection

**When:** NestJS dependency injection token. Never use bare strings -- Symbols are collision-free.

```typescript
// di-tokens.ts (per service or in foundation)
export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');
export const LOGIN_PORT = Symbol('LoginPort');

// Module:
{ provide: USER_REPOSITORY_PORT, useClass: UserRepositoryAdapter }

// Consumer:
@Inject(USER_REPOSITORY_PORT) private readonly repo: UserRepositoryPort
```

## Pattern 3 -- Shared Constants for Repeated Values Across Files

**When:** Same literal appears in multiple files or packages. Single source of truth.

```typescript
// packages/foundation/src/persistence/persistence.constants.ts
export const COLUMN_LENGTH = {
  SHORT: 50,
  MEDIUM: 100,
  DEFAULT: 255,
} as const;

// Any service schema:
email: varchar('email', { length: COLUMN_LENGTH.DEFAULT }),
status: varchar('status', { length: COLUMN_LENGTH.SHORT }),
```

## Pattern 4 -- Extending Existing Constant Objects

**When:** New constant belongs to an existing logical group. Add to the existing object, do not create a new one.

```typescript
// packages/foundation/src/constants.ts -- extend existing HEADER object
export const HEADER = {
  CORRELATION_ID: 'x-correlation-id',
  FALLBACK_CORRELATION_ID: 'no-correlation-id',  // ADD here
} as const;

// New object only when no existing group fits:
export const HTTP_ERROR = {
  FALLBACK_MESSAGE: 'Internal Server Error',
} as const;
```

## Anti-Patterns

| Prohibited | Replace With |
|---|---|
| `max: 10` in pool config | `PG_POOL_DEFAULTS.MAX_CONNECTIONS` |
| `'UserRepositoryPort'` string token | `Symbol('UserRepositoryPort')` |
| `process.env.NODE_ENV \|\| 'development'` | Remove or pipe through config |
| `{ length: 255 }` repeated in schemas | `COLUMN_LENGTH.DEFAULT` |
| `'no-correlation-id'` inline | `HEADER.FALLBACK_CORRELATION_ID` |
| `'Internal Server Error'` inline | `HTTP_ERROR.FALLBACK_MESSAGE` |

## Code Review Checklist

Before approving code, check:

| # | Check | If Yes |
|---|-------|--------|
| 1 | Any bare number that is not 0, 1, or -1 in an idiom? | Extract to named `as const` object |
| 2 | Any string used as identifier, key, route, or header name? | Extract to `as const` object |
| 3 | Any DI token using string instead of Symbol? | Convert to `Symbol('TokenName')` |
| 4 | Any `process.env.X` read with `\|\|` or `??` fallback in consumer code? | Route through config module |
| 5 | Any repeated numeric value across multiple files? | Extract to shared constant |
| 6 | Any inline fallback/default string? | Extract to named constant |
