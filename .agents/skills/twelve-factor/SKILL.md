---
name: twelve-factor
description: Enforce 12-Factor App principles in code. Triggers on environment checks, NODE_ENV, isDev, isProduction, config branching, hardcoded URLs, in-memory state, file logging, backing service connections. Apply when writing or reviewing service bootstrap, config access, database connections, logging setup, or state management.
---

# 12-Factor App — Code-Level Rules

Enforce environment-agnostic, stateless, config-driven services. The app never knows where it runs.

## Rule: No Environment Branching

**Prohibited:** Any code path that depends on deployment environment name.

```typescript
// PROHIBITED — app knows its environment
if (process.env.NODE_ENV === 'development') { ... }
if (isDev()) { enableDebug(); }
const url = isProd ? 'https://api.prod' : 'http://localhost';
switch (env) { case 'production': ... case 'staging': ... }

// ALLOWED — app reads a config VALUE, not an environment NAME
const logLevel = config.get('LOG_LEVEL');      // dev='debug', prod='info'
const dbUrl = config.get('MONGO_URL');          // same code, different env
const enableCache = config.get('CACHE_ENABLED'); // feature toggle, not env check
```

**Key distinction:** `LOG_LEVEL=debug` is a config value. `NODE_ENV=development` is an environment identity. The app consumes values, never identities.

**Allowed env vars that are NOT environment identity:**
- Connection strings: `MONGO_URL`, `REDIS_URL`, `RABBITMQ_URL`
- Tuning: `LOG_LEVEL`, `GRPC_DEADLINE_MS`, `RATE_LIMIT`
- Feature toggles: `CACHE_ENABLED`, `METRICS_ENABLED`
- Credentials: `JWT_SECRET`, `API_KEY`

**Prohibited env vars (environment identity):**
- `NODE_ENV` — never read in app code (build tools only)
- `APP_ENV`, `DEPLOY_ENV`, `ENVIRONMENT` — same violation
- Any var whose value is a stage name (dev/staging/prod)

## Factor III — Config in Environment

All config that varies between deploys must come from environment variables, validated at startup.

```typescript
// PROHIBITED — hardcoded values
const port = 3000;
const mongoUrl = 'mongodb://localhost:27017/mydb';

// PROHIBITED — config file per environment
import devConfig from './config.dev';
import prodConfig from './config.prod';

// ALLOWED — single config source from env, validated at boot
const port = config.get('HTTP_PORT');       // validated by Zod schema
const mongoUrl = config.get('MONGO_URL');   // fails fast if missing
```

**Already in place:** `@email-platform/config` with Zod validation does this correctly. Ensure no code bypasses it with direct `process.env` reads.

## Factor IV — Backing Services as Attached Resources

Treat every external service (DB, queue, cache, SMTP, S3) as an attached resource swappable via config.

```typescript
// PROHIBITED — infrastructure awareness in business code
import { MongoClient } from 'mongodb';
const client = new MongoClient('mongodb://localhost:27017');

// ALLOWED — injected through port, connected via config
constructor(
  @Inject(USER_REPOSITORY) private readonly users: UserRepository, // port
) {}
// MongoUserRepository is wired in infrastructure layer, URL from config
```

**Test:** Can you swap MongoDB for an in-memory implementation by changing only infrastructure code and env vars? If yes, Factor IV is satisfied.

## Factor VI — Stateless Processes

No in-memory state shared between requests. Each request is self-contained.

```typescript
// PROHIBITED — in-process cache between requests
const userCache = new Map<string, User>();

// PROHIBITED — singleton mutable state
class RateLimiter {
  private counts = new Map<string, number>(); // lost on restart, wrong with N replicas
}

// ALLOWED — state in backing service
const user = await this.redis.get(`user:${id}`);
await this.rateLimiter.increment(key); // Redis-backed
```

**Exception:** Read-only config loaded at startup is fine (it's immutable for the process lifetime).

## Factor IX — Disposability

Fast startup, graceful shutdown. No work lost on SIGTERM.

```typescript
// REQUIRED — drain connections on shutdown
app.enableShutdownHooks();

// REQUIRED — finish in-flight work before exit
process.on('SIGTERM', async () => {
  await server.close();       // stop accepting new work
  await queue.drain();         // finish current messages
  await db.disconnect();       // release connections
  process.exit(0);
});
```

**Already in place:** Phase 7 implemented graceful shutdown. Ensure new services follow the same pattern.

## Factor X — Dev/Prod Parity

Same code, same dependencies, same behavior everywhere. Differences are only in config values.

**Prohibited patterns:**
- Mock services in dev, real in prod
- SQLite in dev, PostgreSQL in prod
- In-memory queue in dev, RabbitMQ in prod
- Different logging formats per environment

**Allowed:** Same backing service types everywhere, different instances via config:
- Dev: `MONGO_URL=mongodb://localhost:27017`
- Prod: `MONGO_URL=mongodb://cluster.prod:27017`

## Factor XI — Logs as Event Streams

The app writes to stdout/stderr. Never to files. Log routing is the platform's job.

```typescript
// PROHIBITED — file writing
fs.appendFileSync('/var/log/app.log', message);
const transport = pino.transport({ target: 'pino/file', options: { destination: '/var/log/app.log' } });
new winston.transports.File({ filename: 'error.log' });

// ALLOWED — stdout via Pino (already configured)
logger.info({ userId, action }, 'Request processed');
// Docker/K8s captures stdout and routes to log aggregator
```

## Decision Tree

```
Writing code that touches config, connections, or state?
|
+-- Reading an env var?
|   +-- Is it a VALUE (URL, number, flag)? --> OK via config module
|   +-- Is it an environment NAME (dev/prod/staging)? --> PROHIBITED
|
+-- Connecting to external service?
|   +-- URL/credentials from config? --> OK (Factor IV)
|   +-- Hardcoded or env-specific? --> PROHIBITED
|
+-- Storing state?
|   +-- In-memory between requests? --> PROHIBITED (Factor VI)
|   +-- In backing service (Redis/DB)? --> OK
|   +-- Read-only config at startup? --> OK
|
+-- Writing logs?
|   +-- To stdout/stderr? --> OK (Factor XI)
|   +-- To a file? --> PROHIBITED
|
+-- Different behavior per environment?
    +-- Via config VALUE (log level, timeout)? --> OK
    +-- Via environment NAME check? --> PROHIBITED (Factor X)
```

## Code Review Checklist

| Check | Violation |
|---|---|
| `process.env.NODE_ENV` in app code | Factor III + X |
| `if (isDev)` / `if (isProd)` | Factor X |
| Hardcoded connection string | Factor III + IV |
| `new Map()` or object as cross-request cache | Factor VI |
| `fs.writeFile` / `fs.appendFile` for logs | Factor XI |
| `import config from './config.dev'` | Factor III |
| Direct `process.env.X` without config module | Factor III |
