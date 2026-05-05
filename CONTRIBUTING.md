# Contributing

## First-time setup

```sh
pnpm install
pnpm setup-hooks
```

`pnpm setup-hooks` configures Git to use `.githooks/` for `pre-commit`
and `pre-push` gates. Without it, security and quality checks won't run
locally — CI will still enforce them on every MR, but local feedback
loop becomes painful.

## Development workflow

All non-trivial changes go through the GSD planning workflow:

```sh
/gsd:plan-phase {phase-name}     # plan a phase
/gsd:execute-phase {phase}       # execute planned phase
/gsd:fast                        # trivial fixes (single-file or doc tweak)
```

See `CLAUDE.md` § "GSD Workflow Enforcement" for the full routing table.

## Branching

Per-phase branches: `gsd/phase-{N}-{slug}`. Created automatically by GSD
workflow. Don't push directly to `main` — pipeline + branch protection
enforce MR review.

## Code style

- TypeScript strict mode, no implicit `any`
- No magic values — see `.claude/skills/no-magic-values/SKILL.md`
- No env-branching in app code — see `.claude/skills/twelve-factor/SKILL.md`
- Clean / DDD / Hexagonal — see `.claude/skills/clean-ddd-hexagonal/SKILL.md`
- NestJS ↔ Hexagonal mapping — see `.claude/skills/nestjs-hexagonal-mapping/SKILL.md`

Full list: `ls .claude/skills/`.

## Pre-commit / pre-push gates

`.githooks/pre-commit` runs:

- `pnpm run quality:staged` (eslint + prettier on staged files via lint-staged)
- `pnpm run security:secrets-staged` (gitleaks staged-only)

`.githooks/pre-push` runs the parallel security orchestrator
(`scripts/security/pre-push-orchestrator.sh`).

These gates ARE enforced server-side too — required CI jobs on every MR.
