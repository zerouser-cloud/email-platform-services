---
created: 2026-05-03T07:30:00.000Z
title: File upstream bug — gsd-sdk extractFrontmatter LAST-block selection corrupts plan parsing
area: tooling
files:
  - .planning/phases/999.18-post-pnpm-11-migration-system-audit/999.18-02-PLAN.md
  - .planning/phases/999.18-post-pnpm-11-migration-system-audit/999.18-06-PLAN.md
---

## Problem

`gsd-sdk` (npm package `get-shit-done-cc`) `extractFrontmatter()` in
`sdk/dist/query/frontmatter.js:174-181` deliberately uses the **last**
`---…---` block in a file as "frontmatter" — comment in source says
"corruption recovery (uses LAST match)".

Consequence: any PLAN.md / SPEC.md / RESEARCH.md authored with `---`
markdown horizontal rules between body sections gets its real frontmatter
ignored. Wave/autonomous fields silently fall back to defaults
`wave=1, autonomous=true`. Downstream `gsd-sdk query phase-plan-index`
returns wrong wave grouping and missing checkpoints.

Empirically reproduced 2026-05-03 on phase 999.18: plans 02 and 06 had
body `---` HRs → SDK reported `wave=1, autonomous=true` for both, instead
of true `wave=2/autonomous=false` (Plan 02) and `wave=6/autonomous=false`
(Plan 06). This would have executed Plan 06 (phase closure) before Plans
03/04/05 (fix waves), violating dependency contracts and silently dropping
two human-verify checkpoints.

## Root cause

```js
// sdk/dist/query/frontmatter.js:174
export function extractFrontmatter(content) {
    const allBlocks = [...content.matchAll(/(?:^|\n)\s*---\r?\n([\s\S]+?)\r?\n---/g)];
    const match = allBlocks.length > 0 ? allBlocks[allBlocks.length - 1] : null;
    ...
}
```

The "LAST block wins" heuristic only helps if a real corruption case has
appended a salvage block at end of file — vanishingly rare. It actively
mis-parses well-formed files far more often.

Note: same module already exports `extractFrontmatterLeading()` (line 152)
which correctly uses the FIRST block. The LAST-block path is the deviation.

## Local workaround applied

Commit `8bc7889` on branch `gsd/phase-999.18-post-pnpm-11-migration-system-audit`:
replace body `---` HRs with `<hr />` HTML inline (CommonMark-equivalent,
prettier-safe, regex-invisible) in plans 02 and 06.

Memory note added: `~/.claude/projects/.../memory/reference_gsd_sdk_extractfrontmatter_bug.md`.

## Action — file upstream

1. Locate the upstream repo for npm package `get-shit-done-cc` (probably
   GitHub `anthropics/get-shit-done` or similar — verify via
   `npm view get-shit-done-cc repository`).
2. Open issue with: title "extractFrontmatter LAST-block heuristic silently
   mis-parses plans containing markdown HR `---` in body", reproduction
   recipe (any plan with `^---$` between body sections), proposed fix
   (switch consumers like `phase-plan-index` to `extractFrontmatterLeading`
   or change `extractFrontmatter` to first-block-by-default with an
   opt-in fallback for genuine corruption).
3. Optional PR — one-line change: `allBlocks[allBlocks.length - 1]` →
   `allBlocks[0]`, plus updated tests.

## Why this is a todo and not part of 999.18

Pure tooling concern, async with phase work. 999.18 already has its
local workaround. Filing upstream is community courtesy and prevents
the next person from rediscovering this trap.

## Resolution criteria

- Upstream issue filed (link recorded in this todo)
- Optional: PR submitted
- When fix lands and we update gsd-sdk → revert `<hr />` workaround and
  re-test
