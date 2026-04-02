# Phase 1: Contract Consolidation - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

All services import generated types from a single canonical location (`contracts/src/generated/`). The duplicate `contracts/generated/` is removed. Proto generation runs automatically as part of the Turbo build pipeline and is also available as a standalone command.

</domain>

<decisions>
## Implementation Decisions

### Duplicate Removal
- **D-01:** Delete `packages/contracts/generated/` entirely — it is not imported by anything. Only `packages/contracts/src/generated/` is used via `index.ts` re-exports.
- **D-02:** Also clean up `packages/contracts/dist/generated/` if it exists as a build artifact from the duplicate.

### Proto Generation Strategy
- **D-03:** Hybrid approach — generate at build time via Turbo AND commit generated code to git. This way generated types are always fresh after build, but also available without building (e.g., for IDE support, code review).
- **D-04:** Keep the existing `scripts/generate.sh` — it works, is clean, and does exactly what's needed. No need for Buf CLI or other tooling.
- **D-05:** Root-level command `pnpm proto:generate` already exists and works. Verify it still works after cleanup.

### Turbo Pipeline Integration
- **D-06:** Add a `generate` task to `turbo.json` with proto files as inputs and `src/generated/` as outputs. Turbo will cache the result.
- **D-07:** Make the contracts `build` task depend on `generate` — so `turbo build` automatically regenerates proto types before compiling TypeScript.

### Claude's Discretion
- Exact Turbo task configuration (inputs/outputs/dependsOn)
- Whether to add `dist/generated/` to `.gitignore`
- Any cleanup of the `generate.sh` script if minor improvements are obvious

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Proto generation
- `packages/contracts/scripts/generate.sh` — Current proto generation script (ts-proto + grpc_tools_node_protoc)
- `packages/contracts/package.json` — Build scripts and dependencies for contracts package
- `packages/contracts/src/index.ts` — Re-exports from src/generated/ (the canonical source)

### Build pipeline
- `turbo.json` — Current Turbo pipeline configuration (no generate task yet)
- `package.json` (root) — Root scripts including `proto:generate`

### Contracts structure
- `packages/contracts/proto/` — Proto source files (auth, sender, parser, audience, common)
- `packages/contracts/src/generated/` — Canonical generated TypeScript (used by index.ts)
- `packages/contracts/generated/` — Duplicate to be deleted (not imported anywhere)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/contracts/scripts/generate.sh` — Fully functional generation script with ts-proto options for NestJS
- `packages/contracts/src/index.ts` — Already correctly re-exports from `src/generated/`
- Root `pnpm proto:generate` command — already wired up

### Established Patterns
- Turbo uses `^build` dependency chain — packages build before apps
- Proto files are in `packages/contracts/proto/*.proto`
- Generated code exports namespaced: `AuthProto`, `SenderProto`, `ParserProto`, `AudienceProto`, `CommonProto`

### Integration Points
- `packages/foundation/src/grpc/proto-resolver.ts` imports `CONTRACTS_PROTO_DIR` from contracts
- All apps depend on `@email-platform/contracts` via pnpm workspace
- Turbo `build` cascades through `^build` — contracts builds first, then foundation, then apps

</code_context>

<specifics>
## Specific Ideas

- User wants `pnpm proto:generate` on the top level (already exists, verify it works after cleanup)
- Existing `generate.sh` script is fine — no need for Buf CLI or other tooling changes
- Generated code should be committed to git (for IDE, code review, no-build-needed usage)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-contract-consolidation*
*Context gathered: 2026-04-02*
