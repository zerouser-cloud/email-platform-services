---
phase: quick
plan: 260404-pja
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/config/src/env-schema.ts
  - packages/foundation/src/grpc/proto-resolver.ts
  - packages/foundation/src/grpc/grpc-server.factory.ts
  - .env
  - .env.docker
  - .env.example
autonomous: true
requirements: []
must_haves:
  truths:
    - "CORS_STRICT=false is parsed as false (not truthy string coercion)"
    - "CORS_STRICT=true is parsed as true"
    - "PROTO_DIR is required — app fails fast if missing"
    - "proto-resolver has no fallback to CONTRACTS_PROTO_DIR — uses protoDir parameter directly"
    - "All three env files have both CORS_STRICT and PROTO_DIR defined"
  artifacts:
    - path: "packages/config/src/env-schema.ts"
      provides: "Fixed CORS_STRICT transform and required PROTO_DIR"
      contains: "z.string().transform"
    - path: "packages/foundation/src/grpc/proto-resolver.ts"
      provides: "Simplified proto resolver with required protoDir"
  key_links:
    - from: "packages/config/src/env-schema.ts"
      to: "all services via loadGlobalConfig()"
      via: "Zod parse at startup"
      pattern: "CORS_STRICT.*transform"
---

<objective>
Fix two env schema bugs and remove dead fallback code in proto-resolver.

1. CORS_STRICT uses z.coerce.boolean() which means Boolean("false") === true — any non-empty string is truthy. Replace with string transform that only treats "true" as true.
2. PROTO_DIR is optional with a runtime fallback in proto-resolver.ts. Make it required in schema (fail fast at boot) and remove the CONTRACTS_PROTO_DIR fallback.
3. Sync all .env files to include both vars.

Purpose: Prevent silent config bugs where CORS_STRICT=false is treated as true, and ensure PROTO_DIR is always explicitly configured (12-Factor: fail fast on missing config).
Output: Fixed schema, simplified proto-resolver, synced env files.
</objective>

<execution_context>
@/home/mr/Hellkitchen/workspace/projects/tba-tech/api/email-platform_claude/.claude/get-shit-done/workflows/execute-plan.md
@/home/mr/Hellkitchen/workspace/projects/tba-tech/api/email-platform_claude/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/config/src/env-schema.ts
@packages/foundation/src/grpc/proto-resolver.ts
@packages/foundation/src/grpc/grpc-server.factory.ts
@.env
@.env.docker
@.env.example
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix CORS_STRICT and PROTO_DIR in env-schema.ts</name>
  <files>packages/config/src/env-schema.ts</files>
  <action>
In packages/config/src/env-schema.ts:

1. Line 13 — Replace `CORS_STRICT: z.coerce.boolean().default(false)` with:
   `CORS_STRICT: z.string().transform((v) => v === 'true')`
   This fixes the Boolean("false")===true bug. No .default() — the var must be explicitly set in env files.

2. Line 12 — Replace `PROTO_DIR: z.string().min(1).optional()` with:
   `PROTO_DIR: z.string().min(1)`
   Remove .optional() to make it required. App fails fast at boot if missing.

3. In the GlobalEnv type (line 37) — Change `PROTO_DIR?: string` to `PROTO_DIR: string` (remove the optional marker).

Everything else in the file stays unchanged.
  </action>
  <verify>
    <automated>cd /home/mr/Hellkitchen/workspace/projects/tba-tech/api/email-platform_claude && pnpm --filter @email-platform/config build</automated>
  </verify>
  <done>CORS_STRICT uses string transform (not coerce.boolean), PROTO_DIR is required (not optional), GlobalEnv type reflects both changes, config package builds without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Simplify proto-resolver and make protoDir required</name>
  <files>packages/foundation/src/grpc/proto-resolver.ts, packages/foundation/src/grpc/grpc-server.factory.ts</files>
  <action>
In packages/foundation/src/grpc/proto-resolver.ts:
1. Remove the import: `import { CONTRACTS_PROTO_DIR } from '@email-platform/contracts';`
2. Change function signature from `resolveProtoPath(protoName: string, protoDir?: string)` to `resolveProtoPath(protoName: string, protoDir: string)` — make protoDir required.
3. Replace body: remove the `const baseDir = protoDir ?? CONTRACTS_PROTO_DIR` fallback. Use `protoDir` directly:
   `return join(baseDir, ...)` becomes `return join(protoDir, ...)`.

The final file should be:
```typescript
import { join } from 'path';

export function resolveProtoPath(protoName: string, protoDir: string): string {
  return join(protoDir, `${protoName}.proto`);
}
```

In packages/foundation/src/grpc/grpc-server.factory.ts:
1. Change `protoDir?: string` parameter to `protoDir: string` in createGrpcServerOptions function signature (line 11).
   All callers already pass `config.PROTO_DIR` which is now guaranteed non-undefined by the required schema.

Build foundation package to verify.
  </action>
  <verify>
    <automated>cd /home/mr/Hellkitchen/workspace/projects/tba-tech/api/email-platform_claude && pnpm --filter @email-platform/foundation build</automated>
  </verify>
  <done>proto-resolver.ts has no CONTRACTS_PROTO_DIR import, protoDir is required parameter, grpc-server.factory.ts protoDir is required, foundation builds clean.</done>
</task>

<task type="auto">
  <name>Task 3: Sync env files — add missing PROTO_DIR to .env</name>
  <files>.env, .env.docker, .env.example</files>
  <action>
1. .env — Add `PROTO_DIR=packages/contracts/proto` (this file is missing it; local dev runs from repo root so relative path is correct).

2. .env.docker — Verify PROTO_DIR=/app/proto and CORS_STRICT=false are present. They already exist, no changes expected.

3. .env.example — Verify PROTO_DIR and CORS_STRICT are present. They already exist, no changes expected.

After adding, do a quick grep to confirm all three files have both CORS_STRICT and PROTO_DIR.
  </action>
  <verify>
    <automated>cd /home/mr/Hellkitchen/workspace/projects/tba-tech/api/email-platform_claude && grep -l "CORS_STRICT" .env .env.docker .env.example | wc -l | grep -q 3 && grep -l "PROTO_DIR" .env .env.docker .env.example | wc -l | grep -q 3 && echo "PASS: all env files have both vars" || echo "FAIL: missing vars in env files"</automated>
  </verify>
  <done>All three env files (.env, .env.docker, .env.example) contain both CORS_STRICT and PROTO_DIR with correct values for their context.</done>
</task>

</tasks>

<verification>
1. Config package builds: `pnpm --filter @email-platform/config build`
2. Foundation package builds: `pnpm --filter @email-platform/foundation build`
3. All env files synced: grep confirms CORS_STRICT and PROTO_DIR in all three files
4. No remaining references to CONTRACTS_PROTO_DIR in proto-resolver.ts: `grep CONTRACTS_PROTO_DIR packages/foundation/src/grpc/proto-resolver.ts` returns nothing
</verification>

<success_criteria>
- CORS_STRICT=false is correctly parsed as boolean false (not truthy string)
- PROTO_DIR is required in schema — missing value fails Zod validation at boot
- proto-resolver.ts has zero fallback logic, uses protoDir parameter directly
- All .env files contain both CORS_STRICT and PROTO_DIR
- Both config and foundation packages build successfully
</success_criteria>

<output>
After completion, create `.planning/quick/260404-pja-fix-env-schema-strict-validation-no-defa/260404-pja-SUMMARY.md`
</output>
