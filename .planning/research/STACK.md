# Technology Stack: Foundation Audit Tooling

**Project:** Email Platform Foundation Audit
**Researched:** 2026-04-02
**Focus:** Architectural quality enforcement in a NestJS microservices monorepo

## Current State Assessment

The project already has:
- **Turborepo 2.8.14** for build orchestration
- **pnpm 9.0.0** workspace for package management
- **ESLint 8** with `.eslintrc.js` legacy config (ESLint 8 reached EOL October 2024)
- **typescript-eslint v7** (`@typescript-eslint/eslint-plugin ^7.0.0`)
- **Prettier 3** for formatting
- **`no-restricted-imports` rules** already enforcing package dependency direction (contracts -> config -> foundation -> apps)
- **`scripts/check-architecture.sh`** bash script doing grep-based boundary checks
- **ts-proto 2.6.0** for protobuf code generation
- **No test framework** installed

What is missing: ESLint is outdated (EOL), boundary enforcement is fragile (bash grep scripts), no protobuf linting or breaking change detection, no dead code detection, no dependency graph visualization, no monorepo hygiene tooling.

## Recommended Stack

### 1. ESLint Modernization (CRITICAL)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| eslint | ^9.0.0 | Core linter, flat config required | HIGH |
| typescript-eslint | ^8.58.0 | TypeScript parsing and rules | HIGH |
| eslint-plugin-boundaries | ^6.0.2 | Architecture boundary enforcement via ESLint rules | HIGH |
| eslint-plugin-import-x | latest | Import ordering, no-cycle detection (flat config native) | HIGH |
| eslint-config-prettier | ^10.0.0 | Disable formatting rules that conflict with Prettier | HIGH |

**WHY:** ESLint 8 is EOL since October 2024, receiving zero security patches. The project currently uses `.eslintrc.js` (legacy config) with `@typescript-eslint/eslint-plugin ^7.0.0`. ESLint 10 will remove legacy config support entirely. Migrating now prevents being forced into an emergency migration later.

**WHY eslint-plugin-boundaries over the existing `no-restricted-imports` approach:** The current `.eslintrc.js` already defines `no-restricted-imports` rules for package direction (contracts -> config -> foundation -> apps, apps cannot cross-import). This works but is brittle: every new package requires updating 4+ override blocks manually. `eslint-plugin-boundaries` lets you define element types and dependency rules declaratively. It catches violations that `no-restricted-imports` misses (re-exports, dynamic imports, type-only imports). The `boundaries/element-types` and `boundaries/entry-point` rules give richer control than pattern matching alone.

**WHY eslint-plugin-import-x over eslint-plugin-import:** The original `eslint-plugin-import` has stalled flat config support. `eslint-plugin-import-x` is a maintained fork with native flat config, better TypeScript support, and significantly faster resolution. The `no-cycle` rule catches circular dependencies that cause runtime issues in NestJS module initialization.

**WHY NOT Nx `@nx/eslint-plugin`:** Nx boundary enforcement is excellent but requires buying into the Nx ecosystem. The project already uses Turborepo. Adding Nx just for lint rules would create tooling confusion and dependency bloat. `eslint-plugin-boundaries` provides equivalent boundary enforcement without framework lock-in.

**Flat config migration notes:**
- Rename `.eslintrc.js` to `eslint.config.mjs`
- Replace `extends` arrays with flat config composition
- Move `parserOptions` into `languageOptions`
- The existing `no-restricted-imports` overrides can be preserved alongside `eslint-plugin-boundaries` during transition, then removed once boundaries rules are validated

Sources:
- [ESLint v8 EOL announcement](https://eslint.org/blog/2024/09/eslint-v8-eol-version-support/)
- [eslint-plugin-boundaries GitHub](https://github.com/javierbrea/eslint-plugin-boundaries)
- [eslint-plugin-import-x GitHub](https://github.com/un-ts/eslint-plugin-import-x)
- [typescript-eslint v8 announcement](https://typescript-eslint.io/blog/announcing-typescript-eslint-v8/)

---

### 2. Dependency Graph Validation

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| dependency-cruiser | ^17.3.10 | Dependency graph validation, circular dependency detection, architecture rule enforcement | HIGH |

**WHY:** `dependency-cruiser` operates at a different level than ESLint. While ESLint checks file-by-file at lint time, dependency-cruiser analyzes the entire dependency graph and can:
- Detect circular dependencies across package boundaries (not just within a file)
- Validate that the package DAG (contracts -> config -> foundation -> apps) is acyclic
- Generate SVG/DOT dependency visualizations for architecture reviews
- Enforce "orphan" detection (files imported by nothing)
- Run as a Turbo task in CI with zero runtime cost

**WHY NOT just ESLint:** ESLint rules check individual files. dependency-cruiser sees the whole graph. The bash script `scripts/check-architecture.sh` currently does grep-based cross-import detection -- dependency-cruiser replaces that entirely with proper AST-based analysis that handles re-exports, barrel files, and aliased imports.

**Configuration approach:** Create `.dependency-cruiser.cjs` at root with rules mapping to the existing architecture constraints:
```javascript
// Rule: apps cannot import from other apps
{ from: { path: "^apps/([^/]+)" }, to: { path: "^apps/(?!\\1)" }, severity: "error" }
// Rule: contracts is a leaf package
{ from: { path: "^packages/contracts" }, to: { path: "^(packages/(config|foundation)|apps/)" }, severity: "error" }
// Rule: no circular dependencies
{ from: {}, to: { circular: true }, severity: "error" }
```

Add to `turbo.json` as a `validate` task and to `package.json` as `"check:deps": "depcruise apps packages --config"`.

**Replaces:** `scripts/check-architecture.sh` (the bash grep script). The bash script should be deleted once dependency-cruiser rules are validated to produce equivalent or better results.

Sources:
- [dependency-cruiser GitHub](https://github.com/sverweij/dependency-cruiser)
- [dependency-cruiser npm](https://www.npmjs.com/package/dependency-cruiser)

---

### 3. Protobuf Contract Management

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| @bufbuild/buf | ^1.66.1 | Proto linting, breaking change detection, code generation orchestration | HIGH |

**WHY:** The project has a critical concern documented in CONCERNS.md: "Double-defined Generated Contract Types" with proto-generated code in two locations. The proto generation pipeline is a bash script (`packages/contracts/scripts/generate.sh`) with no linting or breaking change guards. Buf solves three problems at once:

1. **Proto linting:** Enforces consistent naming conventions, package structure, and best practices across all `.proto` files. Catches issues like missing field numbers, poorly named RPCs, non-standard casing before they become tech debt.

2. **Breaking change detection:** `buf breaking` compares current protos against a git ref (e.g., `main` branch) and catches backward-incompatible changes: removed fields, changed types, renamed services. This is essential because the project has 4 proto files defining extensive RPC methods that controllers don't even implement yet -- when implementation happens, accidental proto breakage will be invisible without automated detection.

3. **Generation orchestration:** `buf generate` with `buf.gen.yaml` replaces the manual bash script, providing deterministic, reproducible code generation with clear output directory configuration. This directly fixes the dual-output-directory problem.

**WHY NOT just keep the bash script:** The bash script has no linting, no breaking change detection, and the dual output directory issue proves it is already causing confusion. Buf is the industry standard for protobuf workflow (comparable to what ESLint is for JavaScript).

**Configuration:**
```yaml
# buf.yaml at packages/contracts/
version: v2
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

```yaml
# buf.gen.yaml at packages/contracts/
version: v2
plugins:
  - local: protoc-gen-ts_proto
    out: src/generated
    opt:
      - esModuleInterop=true
      - nestJs=true
```

**CI integration:** Add `buf lint` and `buf breaking --against .git#branch=main` to the Turbo `lint` task pipeline.

Sources:
- [Buf documentation](https://buf.build/docs/cli/quickstart/)
- [Buf breaking change detection](https://buf.build/docs/breaking/)
- [@bufbuild/buf npm](https://www.npmjs.com/package/@bufbuild/buf)

---

### 4. Dead Code and Dependency Hygiene

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| knip | ^6.0.6 | Detect unused dependencies, exports, files, and types across the monorepo | HIGH |
| sherif | latest (run via `pnpm dlx`) | Monorepo consistency linting: version alignment, dependency placement, package.json hygiene | MEDIUM |

**WHY knip:** The project is early-stage with stub controllers and health check placeholders. As implementation proceeds, dead code will accumulate fast. Knip catches:
- Dependencies in `package.json` that no source file imports (common after refactoring)
- Exported functions/types that nothing imports (the contracts package likely has many unused generated exports)
- Files that are never imported or referenced
- Missing dependencies (imported but not in `package.json`)

Knip has first-class pnpm workspace support and understands NestJS module patterns. Configure with `knip.config.ts` at root.

**WHY sherif:** Sherif is a zero-config Rust-based monorepo linter that enforces consistency rules:
- Same dependency version across all workspace packages (prevents "works on my machine" from version mismatches)
- `@types/*` in devDependencies not dependencies (the project has private packages where this matters)
- Alphabetical dependency ordering (cleaner diffs)

Sherif runs without `node_modules` installed and is extremely fast. Use it via `pnpm dlx sherif@latest` in CI rather than installing it as a dependency.

**WHY NOT depcheck:** Knip supersedes depcheck. Knip is actively maintained, TypeScript-native, understands monorepos natively, and finds unused exports/files in addition to unused dependencies. depcheck only finds unused dependencies.

Sources:
- [Knip documentation](https://knip.dev)
- [Knip monorepo support](https://knip.dev/features/monorepos-and-workspaces)
- [Sherif GitHub](https://github.com/QuiiBz/sherif)

---

### 5. TypeScript Strictness (Already Mostly There)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| typescript | ^5.9.0 | Type checking (already installed, verify latest 5.x) | HIGH |

**Current state:** `tsconfig.base.json` already has `strict: true`, `strictNullChecks: true`, `noImplicitAny: true`. This is good. No changes needed to compiler options.

**Recommended addition to tsconfig.base.json:**
```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": true
  }
}
```

**WHY:** The metadata array access bug (`metadata.get(HEADER.CORRELATION_ID)[0]` returning undefined) documented in CONCERNS.md would have been caught at compile time with `noUncheckedIndexedAccess`. This flag makes TypeScript treat all indexed access as potentially undefined, forcing explicit checks. It is the single most impactful TypeScript strictness flag that the project is missing.

**WHY NOT `noUncheckedSideEffectImports`:** Too aggressive for NestJS which relies heavily on side-effect imports for decorators and metadata.

---

## Turbo Task Pipeline Additions

The existing `turbo.json` should be extended with validation tasks:

```json
{
  "tasks": {
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check:deps": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "check:boundaries": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "proto:lint": {
      "cache": true
    },
    "proto:breaking": {
      "cache": false
    },
    "validate": {
      "dependsOn": ["lint", "typecheck", "check:deps", "check:boundaries", "proto:lint"]
    }
  }
}
```

This creates a single `pnpm run validate` command that runs all quality checks.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Boundary enforcement | eslint-plugin-boundaries | Nx @nx/eslint-plugin | Requires Nx ecosystem; project uses Turborepo |
| Boundary enforcement | eslint-plugin-boundaries | bash grep scripts (current) | Misses re-exports, barrel files, dynamic imports; brittle to maintain |
| Dependency graph | dependency-cruiser | madge | madge is simpler but has no rule engine; dependency-cruiser validates rules, not just visualizes |
| Proto management | Buf CLI | Manual protoc scripts (current) | No linting, no breaking change detection, already causing dual-directory bugs |
| Dead code detection | knip | depcheck | depcheck only finds unused deps; knip finds unused exports, files, and types too |
| Import linting | eslint-plugin-import-x | eslint-plugin-import | Original has stalled flat config support; import-x is faster and maintained |
| Monorepo hygiene | sherif | syncpack | sherif is faster (Rust), zero-config, covers more rules out of the box |
| ESLint migration | ESLint 9 flat config | Stay on ESLint 8 | ESLint 8 is EOL since Oct 2024; no security patches; ESLint 10 removes legacy config |

---

## Installation

```bash
# ESLint modernization (replace existing eslint + typescript-eslint)
pnpm add -Dw eslint@^9.0.0 typescript-eslint@^8.58.0 eslint-plugin-boundaries@^6.0.2 eslint-plugin-import-x eslint-config-prettier@^10.0.0

# Remove old packages
pnpm remove -w @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-prettier

# Dependency graph validation
pnpm add -Dw dependency-cruiser@^17.3.10

# Proto management (dev dependency in contracts package)
pnpm add -D --filter @email-platform/contracts @bufbuild/buf@^1.66.1

# Dead code detection
pnpm add -Dw knip@^6.0.6

# Sherif runs via pnpm dlx, no install needed
# Add to CI: pnpm dlx sherif@latest
```

Note: `eslint-plugin-prettier` is removed because the recommended approach since 2024 is to run Prettier separately (not through ESLint). Keep `prettier` as a standalone formatter and use `eslint-config-prettier` only to disable conflicting ESLint rules.

---

## What NOT to Install

| Tool | Why Not |
|------|---------|
| **Nx** | Project uses Turborepo. Adding Nx for boundary enforcement alone creates tooling confusion. eslint-plugin-boundaries + dependency-cruiser cover the same ground. |
| **Husky + lint-staged** | Not needed for this audit milestone. Add when implementing CI/CD pipeline in a future milestone. |
| **Jest / Vitest** | Tests are explicitly out of scope for this milestone per PROJECT.md. |
| **commitlint** | Convention enforcement is valuable but out of scope. Focus is on code architecture, not commit messages. |
| **madge** | dependency-cruiser is strictly more capable. madge only visualizes; dependency-cruiser validates rules. |
| **depcheck** | Knip supersedes it entirely with broader detection capabilities. |
| **eslint-plugin-import** (original) | Use eslint-plugin-import-x instead. The original has stalled development and partial flat config support. |

---

## Confidence Assessment

| Recommendation | Confidence | Reasoning |
|----------------|------------|-----------|
| ESLint 9 + flat config migration | HIGH | ESLint 8 EOL is documented fact. typescript-eslint v8 has full ESLint 9 support. Migration path is well-documented. |
| eslint-plugin-boundaries | HIGH | v6.0.2 published recently. Active maintenance. ESLint 9 flat config support added in v5+. Widely used in monorepo architectures. |
| dependency-cruiser | HIGH | v17.3.10, actively maintained, 5k+ GitHub stars. Well-documented monorepo support. Performance improvements in recent releases. |
| Buf CLI for proto management | HIGH | Industry standard for protobuf. v1.66.1 on npm. Directly addresses the documented dual-directory concern. |
| knip | HIGH | v6.0.6, very actively maintained. First-class pnpm workspace and NestJS support documented. |
| sherif | MEDIUM | Newer tool, less ecosystem penetration. But zero-risk to try (runs via `pnpm dlx`, no install). Does one job well. |
| `noUncheckedIndexedAccess` | HIGH | Standard TypeScript strictness flag. Directly prevents the documented metadata bug class. |
| eslint-plugin-import-x | HIGH | Active fork with native flat config. Recommended by community for ESLint 9 migration. |

---

## Migration Order

The tools should be adopted in this order due to dependencies:

1. **ESLint 9 + typescript-eslint v8** -- Foundation for all other ESLint plugins
2. **eslint-plugin-boundaries** -- Requires ESLint 9 flat config
3. **eslint-plugin-import-x** -- Requires ESLint 9 flat config
4. **dependency-cruiser** -- Independent, can run in parallel with ESLint migration
5. **Buf CLI** -- Independent, scoped to contracts package
6. **knip** -- Independent, run after other changes stabilize (to avoid noise from in-progress refactoring)
7. **sherif** -- Independent, add to CI last
8. **`noUncheckedIndexedAccess`** -- Last, because it will surface many type errors across the codebase that need fixing

Sources:
- [ESLint v8 EOL](https://eslint.org/blog/2024/09/eslint-v8-eol-version-support/)
- [ESLint flat config migration guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)
- [eslint-plugin-import-x](https://github.com/un-ts/eslint-plugin-import-x)
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
- [Buf CLI](https://buf.build/docs/cli/quickstart/)
- [Buf breaking change detection](https://buf.build/docs/breaking/)
- [Knip](https://knip.dev)
- [Sherif](https://github.com/QuiiBz/sherif)

---

*Stack research: 2026-04-02*
