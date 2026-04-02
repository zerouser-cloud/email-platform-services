# Phase 1: Contract Consolidation - Research

**Researched:** 2026-04-02
**Domain:** Monorepo proto generation, Turborepo pipeline, TypeScript codegen
**Confidence:** HIGH

## Summary

This phase is a cleanup and build-pipeline wiring task, not a greenfield build. The duplicate `packages/contracts/generated/` directory contains stale proto output (dated March 7) while the canonical `packages/contracts/src/generated/` has newer output (dated March 9). No code imports from the duplicate -- confirmed via codebase-wide grep. The root `.gitignore` already patterns out `packages/contracts/generated/*.ts`, but the directory still exists in the working tree.

The generation script (`generate.sh`) is fully functional and outputs to `src/generated/`. The root `pnpm proto:generate` script works. The main work is: (1) delete the duplicate, (2) add a `generate` task to `turbo.json` that the `build` task depends on, and (3) ensure the top-level command name matches the requirement (CONT-03 says `pnpm generate:contracts`, root package.json currently has `pnpm proto:generate`).

**Primary recommendation:** Delete the duplicate directory, add Turbo `generate` task with proto file inputs and `src/generated/**` outputs, chain `build` -> `generate` dependency in contracts package, and rename/alias the root script to match CONT-03.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Delete `packages/contracts/generated/` entirely -- it is not imported by anything. Only `packages/contracts/src/generated/` is used via `index.ts` re-exports.
- **D-02:** Also clean up `packages/contracts/dist/generated/` if it exists as a build artifact from the duplicate.
- **D-03:** Hybrid approach -- generate at build time via Turbo AND commit generated code to git. This way generated types are always fresh after build, but also available without building (e.g., for IDE support, code review).
- **D-04:** Keep the existing `scripts/generate.sh` -- it works, is clean, and does exactly what's needed. No need for Buf CLI or other tooling.
- **D-05:** Root-level command `pnpm proto:generate` already exists and works. Verify it still works after cleanup.
- **D-06:** Add a `generate` task to `turbo.json` with proto files as inputs and `src/generated/` as outputs. Turbo will cache the result.
- **D-07:** Make the contracts `build` task depend on `generate` -- so `turbo build` automatically regenerates proto types before compiling TypeScript.

### Claude's Discretion
- Exact Turbo task configuration (inputs/outputs/dependsOn)
- Whether to add `dist/generated/` to `.gitignore`
- Any cleanup of the `generate.sh` script if minor improvements are obvious

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | Single source of generated types at `contracts/src/generated/`, duplicate `contracts/generated/` removed | Verified: duplicate exists with stale files (Mar 7 vs Mar 9), zero imports reference it, safe to delete |
| CONT-02 | Proto generation integrated into Turbo pipeline, runs automatically on build | Turbo 2.8.14 supports `inputs`/`outputs`/`dependsOn` on tasks; add `generate` task, wire as dependency of `build` |
| CONT-03 | Command `pnpm generate:contracts` available at monorepo root | Current root script is `pnpm proto:generate` -- needs rename or alias to match requirement |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| turbo | 2.8.14 | Build orchestration with caching | Already installed, locked decision |
| ts-proto | 2.6.0 | Proto-to-TypeScript codegen (NestJS mode) | Already used in generate.sh |
| grpc-tools | 1.12.4 | protoc compiler wrapper for Node | Already used in generate.sh |
| pnpm | 9.0.0 | Workspace package manager | Project standard |

No new dependencies needed. This phase uses only existing tooling.

## Architecture Patterns

### Current Contracts Package Structure
```
packages/contracts/
  proto/                  # Source .proto files (5 files)
    auth.proto
    sender.proto
    parser.proto
    audience.proto
    common.proto
  scripts/
    generate.sh           # Working generation script
  src/
    generated/            # CANONICAL generated output (used by index.ts)
    index.ts              # Barrel re-exports: AuthProto, SenderProto, etc.
    proto-dir.ts          # Exports CONTRACTS_PROTO_DIR path constant
  generated/              # DUPLICATE -- to be deleted
  dist/                   # Build output (includes dist/generated/)
  package.json
  tsconfig.json
```

### Target Structure (after phase)
```
packages/contracts/
  proto/                  # Unchanged
  scripts/
    generate.sh           # Unchanged (per D-04)
  src/
    generated/            # Sole generated output
    index.ts              # Unchanged
    proto-dir.ts          # Unchanged
  dist/                   # Build output
  package.json            # Updated: generate script name
  tsconfig.json           # Unchanged
```

### Pattern 1: Turbo Generate Task

Turborepo 2.x supports task-level `inputs` to control cache hashing and `outputs` for cache restoration. The `generate` task should be scoped to the contracts package only (other packages don't have a generate script).

**Recommended turbo.json configuration:**
```json
{
  "tasks": {
    "generate": {
      "inputs": ["proto/**/*.proto", "scripts/generate.sh"],
      "outputs": ["src/generated/**"]
    },
    "build": {
      "dependsOn": ["^build", "generate"],
      "outputs": ["dist/**"]
    }
  }
}
```

Key points:
- `"generate"` is defined globally but only contracts has a `generate` script in package.json -- Turbo silently skips packages without the matching script.
- `"build"` depends on both `"^build"` (upstream packages) and `"generate"` (same-package). This means the contracts package's build will run generate first, but other packages' builds are unaffected (they don't have a generate script).
- `inputs` restricts cache hashing to proto files and the generation script. Changes to other files won't invalidate the generate cache.
- `outputs: ["src/generated/**"]` tells Turbo to cache the generated files for restoration on cache hits.

### Pattern 2: Package-scoped Turbo Override (alternative)

If global `generate` task feels too broad, Turborepo 2.x supports package-scoped configuration via `packages/contracts/turbo.json`. However, since only contracts has a generate script, the global approach is simpler and sufficient.

### Anti-Patterns to Avoid
- **Do NOT add generate to all packages' dependsOn:** Only contracts needs it. Using same-package `"generate"` (not `"^generate"`) keeps it scoped.
- **Do NOT remove src/generated from git:** Decision D-03 locks hybrid approach -- generated code stays committed.
- **Do NOT modify generate.sh output path:** It already outputs to `src/generated/` which is correct.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proto codegen | Custom TypeScript codegen | ts-proto + grpc-tools (existing) | Mature, NestJS-native options, already configured |
| Build caching | Manual file-hash cache | Turbo task with inputs/outputs | Turbo handles hash computation, cache storage, restoration |
| Cross-package build ordering | Manual script sequencing | Turbo dependsOn with `^build` | Already working, just needs generate step added |

## Common Pitfalls

### Pitfall 1: Wrong dependsOn Syntax for Same-Package Task
**What goes wrong:** Using `"^generate"` instead of `"generate"` in the build task's dependsOn. The caret (`^`) means "run this in upstream dependency packages," not "run in same package."
**Why it happens:** The `^build` pattern is so common that it's easy to assume all dependsOn entries need `^`.
**How to avoid:** Use `"generate"` (no caret) since build and generate are both in the contracts package.
**Warning signs:** `turbo build` does not run generate before building contracts.

### Pitfall 2: Generated Files Not in Git After Generate
**What goes wrong:** If `.gitignore` patterns accidentally exclude `src/generated/`, the committed files get removed.
**Why it happens:** Overly broad gitignore rules.
**How to avoid:** Verify current .gitignore. Current root .gitignore only excludes `packages/contracts/generated/*.ts` (the duplicate path), not `packages/contracts/src/generated/`. This is already correct.
**Warning signs:** `git status` shows `src/generated/` files as deleted after generation.

### Pitfall 3: CONT-03 Command Name Mismatch
**What goes wrong:** Requirement CONT-03 specifies `pnpm generate:contracts` but root package.json has `pnpm proto:generate`.
**Why it happens:** Naming evolved differently between requirement doc and implementation.
**How to avoid:** Rename the root script from `proto:generate` to `generate:contracts`, OR add `generate:contracts` as an alias while keeping `proto:generate` for backward compatibility.
**Warning signs:** Running `pnpm generate:contracts` at root fails with "missing script."

### Pitfall 4: dist/generated/ Contains Stale Duplicate Artifacts
**What goes wrong:** `dist/generated/` exists from previous builds that compiled the old `generated/` directory. After deleting the source duplicate, this stale dist artifact remains.
**Why it happens:** `tsconfig.json` has `rootDir: "./src"` so only `src/` is compiled. The `dist/generated/` was compiled when the duplicate was under a different config or manually.
**How to avoid:** Decision D-02 says clean up `dist/generated/` if it exists. Current tsconfig compiles only `src/`, so `dist/generated/` is from a previous build. A clean `turbo build` after removing the duplicate will produce correct `dist/` with only `src/generated/` content at `dist/generated/`.
**Warning signs:** Files in `dist/generated/` have different timestamps from `dist/` root files.

## Code Examples

### Current generate.sh (verified, working)
```bash
# Source: packages/contracts/scripts/generate.sh
pnpm exec grpc_tools_node_protoc \
  --plugin="protoc-gen-ts_proto=$TS_PROTO_PLUGIN" \
  --ts_proto_out="$OUT_DIR" \
  --ts_proto_opt=nestJs=true \
  --ts_proto_opt=addGrpcMetadata=true \
  --ts_proto_opt=outputServices=grpc-js \
  --ts_proto_opt=esModuleInterop=true \
  --ts_proto_opt=env=node \
  --ts_proto_opt=useOptionals=messages \
  --proto_path="$PROTO_DIR" \
  "$PROTO_DIR"/*.proto
```

### Turbo generate task configuration
```json
// turbo.json -- add "generate" task, update "build" dependsOn
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "generate": {
      "inputs": ["proto/**/*.proto", "scripts/generate.sh"],
      "outputs": ["src/generated/**"]
    },
    "build": {
      "dependsOn": ["^build", "generate"],
      "outputs": ["dist/**"]
    }
  }
}
```

### Root package.json script update
```json
// package.json -- rename proto:generate to generate:contracts (per CONT-03)
{
  "scripts": {
    "generate:contracts": "pnpm --filter @email-platform/contracts run generate"
  }
}
```

### Contracts .gitignore update
```gitignore
# Current contents:
generated/
dist/

# Add to ensure dist/generated/ stale artifacts don't persist:
# (dist/ already covers this -- no change needed)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Buf CLI for proto generation | ts-proto + grpc-tools remains standard for NestJS | Ongoing | No migration needed, existing setup is standard |
| Turbo 1.x pipeline syntax | Turbo 2.x task syntax | 2024 | Already on 2.8.14, syntax is current |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (tests are out of scope per project constraints) |
| Config file | none |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | Duplicate directory removed, imports resolve | smoke | `test ! -d packages/contracts/generated && pnpm turbo build --filter=@email-platform/contracts` | N/A (shell assertion) |
| CONT-02 | Proto generation runs as part of turbo build | smoke | `pnpm turbo build --filter=@email-platform/contracts --force && test -f packages/contracts/src/generated/auth.ts` | N/A (shell assertion) |
| CONT-03 | Root command `pnpm generate:contracts` works | smoke | `pnpm generate:contracts && test -f packages/contracts/src/generated/auth.ts` | N/A (shell assertion) |

### Sampling Rate
- **Per task commit:** Shell assertions above
- **Per wave merge:** `pnpm turbo build` (full monorepo build)
- **Phase gate:** All three shell assertions pass, plus `turbo build` succeeds

### Wave 0 Gaps
None -- no formal test infrastructure needed. Phase verification is via shell assertions and build success.

## Open Questions

1. **CONT-03 command name: `generate:contracts` vs `proto:generate`**
   - What we know: Root package.json has `proto:generate`. CONT-03 says `pnpm generate:contracts`.
   - What's unclear: Whether to rename (breaking existing muscle memory) or alias (adding both).
   - Recommendation: Rename to `generate:contracts` to match the requirement. The project is early enough that no CI/CD or documentation references the old name.

## Project Constraints (from CLAUDE.md)

- Architecture for apps/: Clean/DDD/Hexagonal (not relevant to this phase)
- Architecture for packages/: Simple utility structure, no DDD
- No business logic: Only structural scaffolding
- No tests: Testing is a separate next phase
- Tech stack: NestJS 11, TypeScript, gRPC, MongoDB, RabbitMQ, Redis -- do not change
- GSD workflow enforcement: Use GSD commands for file changes

## Sources

### Primary (HIGH confidence)
- Direct filesystem inspection of `packages/contracts/` -- verified duplicate exists, canonical imports confirmed
- `turbo.json` and `package.json` -- read directly from project
- `generate.sh` -- read and verified working script

### Secondary (MEDIUM confidence)
- [Turborepo Configuration Reference](https://turborepo.dev/docs/reference/configuration) -- task inputs/outputs/dependsOn syntax
- [Configuring Tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks) -- dependsOn semantics (`^` prefix behavior)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already installed and working, no new dependencies
- Architecture: HIGH - Direct inspection of all files, clear structure
- Pitfalls: HIGH - Verified through filesystem state and Turbo docs

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain, no fast-moving dependencies)
