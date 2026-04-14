---
phase: quick-260414-hhe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/22.4-storage-gateway-proxy/ (renamed via git mv)
  - .planning/phases/22.4-public-bucket-abstraction/ (new path after rename)
  - .planning/ROADMAP.md
  - .planning/STATE.md
autonomous: true
requirements:
  - QUICK-RENAME-22.4
must_haves:
  truths:
    - "Directory .planning/phases/22.4-storage-gateway-proxy no longer exists"
    - "Directory .planning/phases/22.4-public-bucket-abstraction exists with the three original files (22.4-CONTEXT.md, 22.4-DISCUSSION-LOG.md, .gitkeep)"
    - "File contents of 22.4-CONTEXT.md and 22.4-DISCUSSION-LOG.md are byte-identical to pre-rename (no content edits)"
    - "git log --follow shows rename history for 22.4-CONTEXT.md and 22.4-DISCUSSION-LOG.md"
    - "ROADMAP.md heading reads '### Phase 22.4: public-bucket-abstraction (INSERTED)'"
    - "STATE.md Roadmap Evolution entry for 22.4 references 'public-bucket-abstraction' slug (not 'storage-gateway-proxy')"
    - "STATE.md Session Continuity 'Resume file' path points at new directory path"
    - "No remaining occurrences of the substring '22.4-storage-gateway-proxy' anywhere under .planning/"
  artifacts:
    - path: ".planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md"
      provides: "Relocated phase context (unchanged content)"
    - path: ".planning/phases/22.4-public-bucket-abstraction/22.4-DISCUSSION-LOG.md"
      provides: "Relocated discussion log (unchanged content)"
    - path: ".planning/phases/22.4-public-bucket-abstraction/.gitkeep"
      provides: "Relocated gitkeep"
    - path: ".planning/ROADMAP.md"
      provides: "Updated Phase 22.4 heading slug"
    - path: ".planning/STATE.md"
      provides: "Updated Roadmap Evolution + Resume file path for 22.4"
  key_links:
    - from: "ROADMAP.md heading 22.4"
      to: ".planning/phases/22.4-public-bucket-abstraction/"
      via: "slug match"
      pattern: "public-bucket-abstraction"
    - from: "STATE.md Resume file"
      to: ".planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md"
      via: "textual path reference"
      pattern: "22\\.4-public-bucket-abstraction/22\\.4-CONTEXT\\.md"
---

<objective>
Rename phase 22.4 planning directory from `storage-gateway-proxy` to `public-bucket-abstraction` and align the two textual references (ROADMAP.md heading, STATE.md Roadmap Evolution + Resume file path) to the new slug. Pure planning-artifact rename — no code, no infra, no content edits inside the moved files.

Purpose: Original slug reflected an abandoned design direction. During `/gsd:discuss-phase` the architecture pivoted to a `public` bucket with namespaced abstractions; CONTEXT.md already documents the new direction. The directory slug and two ROADMAP/STATE references are the only remaining misaligned artifacts. Fixing them now prevents confusion before `/gsd:plan-phase 22.4` runs.

Output: A single rename commit in git history preserving `--follow` traceability for `22.4-CONTEXT.md` and `22.4-DISCUSSION-LOG.md`, plus two small text edits in ROADMAP.md and STATE.md.
</objective>

<execution_context>
@/home/mr/Hellkitchen/workspace/projects/tba-tech/api/email-platform_claude/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@./CLAUDE.md

Relevant state before rename:
- Directory: `.planning/phases/22.4-storage-gateway-proxy/` contains exactly three files: `22.4-CONTEXT.md`, `22.4-DISCUSSION-LOG.md`, `.gitkeep`.
- ROADMAP.md line ~110: `### Phase 22.4: storage-gateway-proxy (INSERTED)` — only the slug after the colon changes; the "(INSERTED)" suffix and rest of block (Goal, Requirements, Depends on, Plans) stay untouched.
- STATE.md has TWO references that mention the old slug:
  1. Line ~105 in "Roadmap Evolution": `- Phase 22.4 inserted after Phase 22: storage-gateway-proxy (URGENT) — StoragePort.getDownloadUrl ...` — replace only the slug token `storage-gateway-proxy` with `public-bucket-abstraction`; keep the full descriptive text after the em-dash as-is (it documents the original intent at time of insertion — historical context).

     NOTE re: historical integrity — user intent per planning_context is to update the slug label only. Descriptive text after the em-dash (`StoragePort.getDownloadUrl returns gateway-relative URLs с HMAC-токенами ...`) describes the OLD design. Per the constraint "content already references `public-bucket-abstraction` concept internally, and we agreed phase-number references inside content are semantic not positional", leave the descriptive tail unchanged. Scope of this plan is strictly slug alignment.
  2. Line ~111 in "Session Continuity": `Resume file: .planning/phases/22.4-storage-gateway-proxy/22.4-CONTEXT.md` — path must point to the new directory after rename.
- File names inside the directory keep their `22.4-` numeric prefix unchanged.
- Use `git mv` so git records this as a rename (not delete + add), preserving `git log --follow` history.

Constraints reminder (from planning_context):
- Do NOT edit content of `22.4-CONTEXT.md` or `22.4-DISCUSSION-LOG.md`.
- Do NOT renumber the phase.
- Do NOT commit — executor handles commits per its own workflow conventions.
</context>

<tasks>

<task type="auto">
  <name>Task 1: git mv phase directory and update ROADMAP/STATE slug references</name>
  <files>
    .planning/phases/22.4-storage-gateway-proxy/ -> .planning/phases/22.4-public-bucket-abstraction/
    .planning/ROADMAP.md
    .planning/STATE.md
  </files>
  <action>
Execute the rename and text updates atomically (single working-tree change set, no commit).

Step 1 — Directory rename via git mv:
```
git mv .planning/phases/22.4-storage-gateway-proxy .planning/phases/22.4-public-bucket-abstraction
```
This renames the directory and all three files inside it (22.4-CONTEXT.md, 22.4-DISCUSSION-LOG.md, .gitkeep) in one git operation. Do NOT `mv` then `git add` — that would break rename detection. If git complains the target exists, abort and investigate (it must not exist).

Step 2 — ROADMAP.md heading edit:
Use Edit tool. Change exactly one line:
- From: `### Phase 22.4: storage-gateway-proxy (INSERTED)`
- To:   `### Phase 22.4: public-bucket-abstraction (INSERTED)`

Do NOT touch surrounding lines (Goal, Requirements, Depends on, Plans list). Only the heading slug changes.

Step 3 — STATE.md Roadmap Evolution slug edit:
Use Edit tool. On the line starting `- Phase 22.4 inserted after Phase 22:`, change exactly the slug token:
- From: `- Phase 22.4 inserted after Phase 22: storage-gateway-proxy (URGENT) —`
- To:   `- Phase 22.4 inserted after Phase 22: public-bucket-abstraction (URGENT) —`

Preserve everything after the em-dash unchanged (descriptive tail documents original design context and is intentionally historical per plan scope).

Step 4 — STATE.md Session Continuity path edit:
Use Edit tool. Change exactly one line:
- From: `Resume file: .planning/phases/22.4-storage-gateway-proxy/22.4-CONTEXT.md`
- To:   `Resume file: .planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md`

No other lines in STATE.md change. Do NOT touch `last_updated`, `progress`, `stopped_at`, or any other field.

After all four steps, the working tree should show:
- R  .planning/phases/22.4-storage-gateway-proxy/.gitkeep -> .planning/phases/22.4-public-bucket-abstraction/.gitkeep
- R  .planning/phases/22.4-storage-gateway-proxy/22.4-CONTEXT.md -> .planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md
- R  .planning/phases/22.4-storage-gateway-proxy/22.4-DISCUSSION-LOG.md -> .planning/phases/22.4-public-bucket-abstraction/22.4-DISCUSSION-LOG.md
- M  .planning/ROADMAP.md
- M  .planning/STATE.md

Do NOT create a commit in this task — executor handles commit per its own conventions.
  </action>
  <verify>
    <automated>
# 1. Old dir gone, new dir exists with all three files
test ! -d .planning/phases/22.4-storage-gateway-proxy &&
test -f .planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md &&
test -f .planning/phases/22.4-public-bucket-abstraction/22.4-DISCUSSION-LOG.md &&
test -f .planning/phases/22.4-public-bucket-abstraction/.gitkeep &&
# 2. git sees the move as renames (R status), not delete+add
git status --porcelain | grep -E '^R[ M]  \.planning/phases/22\.4-storage-gateway-proxy/22\.4-CONTEXT\.md' &&
git status --porcelain | grep -E '^R[ M]  \.planning/phases/22\.4-storage-gateway-proxy/22\.4-DISCUSSION-LOG\.md' &&
# 3. ROADMAP.md heading updated, no old slug remains as heading
grep -c '^### Phase 22.4: public-bucket-abstraction (INSERTED)$' .planning/ROADMAP.md | grep -q '^1$' &&
! grep -q '^### Phase 22.4: storage-gateway-proxy' .planning/ROADMAP.md &&
# 4. STATE.md Roadmap Evolution slug flipped
grep -q '^- Phase 22.4 inserted after Phase 22: public-bucket-abstraction (URGENT) —' .planning/STATE.md &&
! grep -q '^- Phase 22.4 inserted after Phase 22: storage-gateway-proxy (URGENT) —' .planning/STATE.md &&
# 5. STATE.md Resume file path updated
grep -q '^Resume file: \.planning/phases/22\.4-public-bucket-abstraction/22\.4-CONTEXT\.md$' .planning/STATE.md &&
! grep -q '22\.4-storage-gateway-proxy/22\.4-CONTEXT\.md' .planning/STATE.md &&
# 6. No remaining references to old slug anywhere under .planning/ (excluding .git)
! grep -rn '22.4-storage-gateway-proxy' .planning/ &&
echo VERIFY_OK
    </automated>
  </verify>
  <done>
    - `.planning/phases/22.4-storage-gateway-proxy/` does not exist; `.planning/phases/22.4-public-bucket-abstraction/` exists with the three original files.
    - `git status --porcelain` shows R (rename) entries for the three files — not D+A pairs.
    - ROADMAP.md heading reads `### Phase 22.4: public-bucket-abstraction (INSERTED)` (exactly once, old variant absent).
    - STATE.md Roadmap Evolution line for 22.4 uses new slug; descriptive tail after em-dash unchanged.
    - STATE.md Resume file path points at new directory.
    - `grep -rn '22.4-storage-gateway-proxy' .planning/` returns zero hits.
    - Content of moved `22.4-CONTEXT.md` and `22.4-DISCUSSION-LOG.md` is byte-identical to pre-rename (rename-only, verified by `git diff --stat` showing only R entries with no line changes for those files).
    - No commit created by this task.
  </done>
</task>

</tasks>

<verification>
Single-task plan; task-level verify block is the phase-level check. Additional sanity after task completes:

```
# Rename history preserved (should show history from before the move)
git log --follow --oneline -- .planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md | head

# No accidental content drift in moved files
git diff --stat HEAD -- .planning/phases/22.4-public-bucket-abstraction/22.4-CONTEXT.md
git diff --stat HEAD -- .planning/phases/22.4-public-bucket-abstraction/22.4-DISCUSSION-LOG.md
# Expected: empty output (rename with zero content change)
```
</verification>

<success_criteria>
- Directory renamed via `git mv` (rename detected by git, history preserved via `--follow`).
- ROADMAP.md heading slug updated exactly once.
- STATE.md Roadmap Evolution slug + Resume file path updated; descriptive tail and other STATE fields untouched.
- Zero remaining occurrences of `22.4-storage-gateway-proxy` anywhere under `.planning/`.
- File contents inside the moved directory are unchanged (byte-identical).
- No commit created (executor commits per its own conventions).
</success_criteria>

<output>
After completion, no SUMMARY file is required for this quick rename task. The executor's own commit message will document the change. If a summary is conventionally expected, create `.planning/quick/260414-hhe-rename-phase-22-4-directory-from-storage/260414-hhe-SUMMARY.md` noting: what was renamed, what text was updated, and confirmation that `git log --follow` traces history across the rename.
</output>
