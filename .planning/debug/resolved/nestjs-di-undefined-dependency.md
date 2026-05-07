---
status: abandoned
trigger: 'NestJS UndefinedDependencyException in sender (and likely auth, parser, audience, notifier) services when running in Docker images from GHCR. Gateway works fine. Services work locally.'
created: 2026-04-05T00:00:00Z
updated: 2026-05-03T00:00:00Z
abandoned_reason: 'Coolify deploy path superseded by GitLab+K8s migration plan (see memory project_gitlab_migration / project_hosting_infra). Coolify env-var sub-hypothesis never verified — diagnostic data was never gathered. Re-open as fresh session if issue resurfaces under K8s deploy.'
---

## Current Focus

hypothesis: The issue is 100% environmental (Coolify-side), not code. Two competing sub-hypotheses: (A) Coolify is not injecting env vars — but Zod should crash before DI if vars are missing, so either the error logs were not read completely or env vars are partially present; (B) Coolify is running a stale/cached image that still has the old circular import bug.
test: Need user to gather specific diagnostic data from Coolify deployment
expecting: Container logs showing either Zod error before DI error (confirms env vars missing) or only DI error (confirms stale image or other issue)
next_action: CHECKPOINT — request user to run diagnostics on Coolify

## Symptoms

expected: All 6 NestJS microservices start successfully in Docker containers (from GHCR images built by GHA)
actual: Gateway starts fine. Sender crashes with "Nest can't resolve dependencies of the CreateCampaignUseCase (?). Argument at index [0] is available in the current module." Other services (auth, parser, audience, notifier) have similar DI errors.
errors: UndefinedDependencyException for CreateCampaignUseCase — argument at index [0] (CAMPAIGN_REPOSITORY_PORT -> PgCampaignRepository which @Inject(DRIZZLE)). The circular import from module files was already fixed (tokens moved to \*.constants.ts), and locally `docker run` with the SAME ghcr.io image works fine.
reproduction: Deploy via Coolify Docker Compose or pull ghcr.io/zerouser-cloud/email-platform-sender:dev-latest. Gateway works, sender/others crash. BUT running `docker run` locally with the same image and proper env vars — sender starts successfully!
started: First deployment attempt. These services never ran in Docker before.

## Eliminated

- hypothesis: Code bug in Docker image (circular imports, missing DI tokens)
  evidence: User verified dist/sender.constants.js and dist/sender.module.js are correct inside the image. Same image starts successfully with `docker run` locally when given proper env vars.
  timestamp: 2026-04-05T00:00:00Z

- hypothesis: Missing npm dependencies in production deploy (pg, @nestjs/config, etc)
  evidence: All required deps are in regular dependencies (not devDependencies). sender has @nestjs/config, foundation has pg and drizzle-orm as regular deps. pnpm deploy --prod would include them all.
  timestamp: 2026-04-05T00:02:00Z

## Evidence

- timestamp: 2026-04-05T00:00:00Z
  checked: Running same GHCR image locally with docker run
  found: Sender starts successfully with proper env vars passed via -e flags
  implication: The Docker image code is correct. Problem is environmental (Coolify config, env vars, or compose processing)

- timestamp: 2026-04-05T00:00:00Z
  checked: Coolify "Docker Compose Content (processed)" output
  found: User-configured env vars (DATABASE_URL, etc) are NOT present in the processed compose — only Coolify-internal vars appear
  implication: Coolify may not be injecting env vars into the container, causing startup failures

- timestamp: 2026-04-05T00:01:00Z
  checked: Code path analysis — what happens when env vars are missing
  found: loadGlobalConfig() calls GlobalEnvSchema.parse(process.env) SYNCHRONOUSLY in main.ts line 9, BEFORE NestFactory.create(). If DATABASE_URL is missing/empty, Zod throws ZodError immediately. The bootstrap().catch() handler logs "Bootstrap failed" and exits. This should produce a CLEAR Zod error, NOT a NestJS DI error.
  implication: If the user truly sees UndefinedDependencyException as the FIRST error, then env vars ARE present and passing Zod validation. The DI failure must have a different cause.

- timestamp: 2026-04-05T00:01:00Z
  checked: docker-compose.prod.yml env var mechanism
  found: Uses YAML anchors with ${VARIABLE} syntax. All env vars use direct substitution. Coolify needs to provide these vars via its environment variable management.
  implication: The compose file is correct — it relies on host-level env var injection.

- timestamp: 2026-04-05T00:01:00Z
  checked: Why gateway works but others don't
  found: Gateway has NO PersistenceModule — no database dependency. Other services import PersistenceModule.forRootAsync() which needs DRIZZLE -> PG_POOL -> ConfigService.get('DATABASE_URL').
  implication: Consistent with a database-related initialization issue, but DI token resolution does not require actual DB connectivity (Pool constructor doesn't connect).

- timestamp: 2026-04-05T00:02:00Z
  checked: Dependency analysis for production deploy
  found: All required packages (pg, drizzle-orm, @nestjs/config, reflect-metadata) are in regular dependencies chains. pnpm deploy --prod should include everything.
  implication: Missing production dependencies is unlikely.

- timestamp: 2026-04-05T00:02:00Z
  checked: Key contradiction analysis
  found: If env vars are truly missing in Coolify, Zod parse() should throw a ZodError BEFORE NestJS DI even starts. The user reports seeing UndefinedDependencyException, not ZodError. This means EITHER: (1) env vars ARE present but something else causes the DI failure, OR (2) the user didn't see the Zod error because it was scrolled off / container restarted too fast, OR (3) Coolify is running an older image that doesn't have the current code.
  implication: Need actual container logs from Coolify to resolve this contradiction.

## Resolution

root_cause: UNCONFIRMED — Most likely Coolify environment configuration issue. Need diagnostic data to determine exact cause: missing env vars (with swallowed Zod error), stale image cache, or Coolify compose processing issue.
fix:
verification:
files_changed: []
