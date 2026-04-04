---
name: env-schema
description: Enforce strict env schema validation rules for Zod-based config schemas. Triggers on z.object, z.coerce, z.string().default, z.boolean().default, env-schema, GlobalEnvSchema, loadGlobalConfig, .env validation, environment variable schema, config schema. Apply when writing or reviewing Zod schemas that validate environment variables, adding new env vars to schemas, or modifying config validation logic.
---

# Env Schema — Strict Validation Rules

Environment schemas validate, they don't invent. Every value must come from the environment explicitly. The schema catches missing or malformed config at boot — it never silently provides fallbacks.

## Rule: No Defaults in Env Schemas

**Prohibited:** `.default()` on any field in an env validation schema.

```typescript
// PROHIBITED — schema invents a value the operator never provided
CORS_STRICT: z.coerce.boolean().default(false),
LOG_LEVEL: z.string().default('info'),
RATE_LIMIT: z.coerce.number().default(100),

// ALLOWED — schema validates, operator provides the value in .env
CORS_STRICT: z.string().transform((v) => v === 'true'),
LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
RATE_LIMIT: z.coerce.number().positive(),
```

A default in the schema means a missing `.env` entry goes unnoticed. The app boots with a value nobody explicitly chose. In production, this becomes a silent misconfiguration — the operator thinks they set everything, but one var was quietly filled in by code.

## Rule: No Optional Env Vars

**Prohibited:** `.optional()` on env schema fields.

```typescript
// PROHIBITED — schema allows absence, hides missing config
PROTO_DIR: z.string().optional(),
REDIS_URL: z.string().min(1).optional(),

// ALLOWED — every var is required, fail fast if absent
PROTO_DIR: z.string().min(1),
REDIS_URL: z.string().min(1),
```

If a variable exists in some environments but not others, the solution is to add it to ALL `.env` files with the correct value for each context — not to make the schema tolerant of absence. This keeps env files as the single source of truth and the schema as a strict validator.

## Rule: No z.coerce.boolean()

**Prohibited:** `z.coerce.boolean()` for env vars.

```typescript
// PROHIBITED — Boolean("false") === true in JavaScript
CORS_STRICT: z.coerce.boolean(),
ENABLE_CACHE: z.coerce.boolean(),

// ALLOWED — explicit string comparison
CORS_STRICT: z.string().transform((v) => v === 'true'),
ENABLE_CACHE: z.string().transform((v) => v === 'true'),
```

Environment variables are always strings. `z.coerce.boolean()` calls `Boolean(value)`, and `Boolean("false")` is `true` because any non-empty string is truthy in JavaScript. This is a real bug — `CORS_STRICT=false` in `.env` silently becomes `true`.

## Rule: z.coerce.number() Is Safe

`z.coerce.number()` is allowed because `Number("3000")` correctly produces `3000`, and `Number("")` produces `NaN` which Zod rejects.

```typescript
// ALLOWED — Number() coercion works correctly for env strings
GATEWAY_PORT: z.coerce.number(),
GRPC_DEADLINE_MS: z.coerce.number().positive(),
MINIO_PORT: z.coerce.number(),
```

## Rule: No Fallbacks in Consumer Code

The schema guarantees every value exists and is valid. Consumer code must not add its own fallbacks — this would bypass the schema contract.

```typescript
// PROHIBITED — fallback in code bypasses schema guarantee
const dir = config.get('PROTO_DIR') ?? CONTRACTS_PROTO_DIR;
const port = config.get('PORT') || 3000;
const strict = config.get('CORS_STRICT') ?? false;

// ALLOWED — trust the schema, use the value directly
const dir = config.get<string>('PROTO_DIR');
const port = config.get<number>('PORT');
const strict = config.get<boolean>('CORS_STRICT');
```

If consumer code needs a fallback, the schema is incomplete. Fix the schema, not the consumer.

## Rule: Env Files Are the Contract

When adding a new env var:

1. Add to schema with strict validation (no default, no optional)
2. Add to ALL env files: `.env`, `.env.docker`, `.env.example`
3. Each file has the correct value for its context

```
# .env (local dev — services on host)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_platform
PROTO_DIR=packages/contracts/proto

# .env.docker (full Docker — services in containers)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/email_platform
PROTO_DIR=/app/proto

# .env.example (template — tracked in git)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PROTO_DIR=packages/contracts/proto
```

The difference between files is only in **values** (hostnames, paths), never in **which keys exist**.

## Decision Tree

```
Adding or modifying an env var in Zod schema?
|
+-- Using .default()?
|   +-- PROHIBITED. Remove it. Add the value to all .env files instead.
|
+-- Using .optional()?
|   +-- PROHIBITED. Make it required. Add to all .env files.
|
+-- Boolean variable?
|   +-- z.coerce.boolean()? --> PROHIBITED. Use z.string().transform(v => v === 'true')
|
+-- Number variable?
|   +-- z.coerce.number() --> OK
|
+-- String variable?
|   +-- z.string().min(1) --> OK
|   +-- z.string().url() --> OK for URLs
|   +-- z.enum([...]) --> OK for constrained values
|
+-- Adding fallback in consumer code?
    +-- PROHIBITED. Fix the schema instead.
```

## Code Review Checklist

| Check | Violation |
|-------|-----------|
| `.default(` in env schema | Silent misconfiguration — operator unaware |
| `.optional()` in env schema | Missing var goes unnoticed at boot |
| `z.coerce.boolean()` for env var | `Boolean("false") === true` bug |
| `?? fallback` after `config.get()` | Bypasses schema contract |
| `\|\| fallback` after `config.get()` | Bypasses schema contract |
| New env var without `.env.example` update | Env file drift |
| Var in one `.env` but not others | Key set mismatch between environments |
