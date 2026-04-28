---
name: gsd-flow-guard
description: Route every action through GSD workflow before executing. Triggers on any file-changing operation (Edit, Write, Bash with file side-effects). Apply BEFORE making any change to repo files — code, config, planning artifacts, docs. Prevents ad-hoc edits that bypass GSD tracking, atomic commits, and state management.
---

# GSD Flow Guard — Route Before Acting

## Principles, Not Inventory

This skill describes **timeless principles** for routing every file change through the GSD workflow. It does **not** describe the current state of the codebase. Do **not** add inventory to this file: specific file paths beyond stable workspace roots (`apps/`, `packages/`), port numbers, production class or function names, enumerated counts of files / services / overrides / lines. For current-state lookups, link to a tracked configuration file by **role** (e.g., "the project ESLint config"), link to the enclosing **directory** (not a file), or provide a `grep` command the reader runs on demand.

Author-facing rule: if you feel the urge to write a specific file path, a real class name, or a count, stop and apply the **rename test** — would this sentence still be true if that file / class / number were renamed or changed tomorrow? If no, rewrite the sentence until it is.

Every file change in this repo must flow through a GSD command. Direct edits bypass tracking, atomic commits, deviation handling, and state sync. This skill is the checkpoint that fires before any Edit/Write/Bash-with-side-effects call.

## Rule

**Before touching any file, answer: "Which GSD command handles this?"**

If a GSD command exists for the action — use it. If none fits — ask the user before proceeding with a direct edit. "No matching GSD command" is not a silent bypass; it's a conscious decision that requires acknowledgment.

## Decision Tree

```
I'm about to change a file. STOP.

1. Am I currently inside a GSD workflow?
   (executing a /gsd:* command, inside a plan's task, spawned by a GSD agent)
   → YES: Continue. The workflow owns tracking.
   → NO: Go to step 2.

2. What kind of change is this?

   a) Code change (apps/, packages/)
      - Planned phase work     → /gsd:execute-phase
      - Small fix (< 3 files)  → /gsd:fast
      - Medium task (3+ files) → /gsd:quick
      - Bug investigation      → /gsd:debug
      - New feature / refactor → /gsd:insert-phase or /gsd:plan-phase

   b) Planning artifact (.planning/)
      - Phase status update (ROADMAP.md, VALIDATION.md, PROJECT.md)
        → Part of phase completion? Use /gsd:execute-phase or /gsd:complete-milestone
        → Standalone fix?        Use /gsd:fast
      - New phase planning      → /gsd:plan-phase
      - Discuss context         → /gsd:discuss-phase

   c) Documentation (docs/, CLAUDE.md)
      - Project docs            → /gsd:docs-update
      - CLAUDE.md update        → /gsd:fast
      - Runbook                 → /gsd:fast or /gsd:quick

   d) Infrastructure (docker-compose, .env, Dockerfile, CI)
      → infrastructure-guard skill FIRST, then /gsd:quick or /gsd:plan-phase

   e) User explicitly said "just do it" / "fix this directly" / "bypass GSD"
      → Proceed with direct edit. User override is valid.

3. If NO GSD command fits:
   → Tell the user: "This doesn't map to a GSD flow. Options:
      A) I route through /gsd:fast (lightweight tracking)
      B) You confirm direct edit (no GSD tracking)"
   → Do NOT silently proceed.
```

## Common Violations

These are the patterns where I historically bypass GSD. Catch them:

| Pattern | What I do wrong | Correct action |
|---------|----------------|----------------|
| "Quick ROADMAP.md status fix" | Direct Edit | `/gsd:fast` — it's still a tracked change |
| "Just update the progress table" | Direct Edit | Part of phase completion flow |
| "Small refactor, 2 files" | Direct Edit + commit | `/gsd:fast` with atomic commit |
| "Fix a typo in docs" | Direct Edit | `/gsd:fast` — even typos get tracked |
| "Update CLAUDE.md" | Direct Edit | `/gsd:fast` |
| "The user asked me to check X and I found a fix" | Fix inline | STOP. Report finding, route to `/gsd:debug` or `/gsd:fast` |
| "Phase is done, just flip the checkbox" | Direct Edit to ROADMAP | Phase completion ritual via `/gsd:execute-phase` or `/gsd:fast` |

## Self-Check Prompt

Before every file-modifying tool call, mentally answer:

1. **Am I in a GSD flow right now?** (check conversation for active /gsd:* command)
2. **If not, which /gsd:* command should I invoke?**
3. **If none fits, did the user explicitly authorize direct edit?**

If the answer to all three is "no" — STOP and route.

## Exceptions (direct edit allowed)

- User explicitly says "bypass GSD", "just edit", "don't use gsd for this"
- Memory files (`~/.claude/projects/*/memory/`) — these are outside repo
- Responding to a GSD agent's own workflow (the agent IS the GSD flow)
