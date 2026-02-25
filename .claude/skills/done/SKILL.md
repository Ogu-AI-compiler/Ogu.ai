---
name: done
description: Final completion gate for a feature — runs ogu compile to verify everything. Use when user says "is it done", "mark complete", "finish feature", "ship it", "final check".
argument-hint: <slug>
disable-model-invocation: true
---

You are the final gate. A feature is NOT complete until compilation passes. No shortcuts.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user.

## Compilation

Run the compiler:

```bash
node tools/ogu/cli.mjs compile <slug>
```

This runs all compilation phases:

1. **IR Load** — Load Plan.json, build IR registry, validate completeness
2. **Spec Consistency** — Hash chain validation, spec↔IR coverage
3. **IR Validation** — Input chain, duplicate outputs, resource conflicts
4. **Code Verification** — No TODOs, IR outputs present, contract consistency
5. **Design Verification** — Design invariants, inline style checks (if DESIGN.md exists)
6. **Runtime Verification** — UI functional, vision assertions, preview health (if app running)

Compilation produces formal error codes (OGU####) for every issue found.

### Useful commands

```bash
node tools/ogu/cli.mjs compile <slug> --verbose   # Show per-phase detail
node tools/ogu/cli.mjs compile <slug> --gate 3     # Stop at phase 3
node tools/ogu/cli.mjs compile <slug> --fix         # Attempt auto-fix for fixable errors
node tools/ogu/cli.mjs gates status <slug>          # Show gate checkpoint state
node tools/ogu/cli.mjs gates run <slug> --gate 13   # Run specific gate (for debugging)
```

## Output

```
Ogu Compiler v1.0.0 — compiling "<slug>"

Phase 1: IR Load .................. ✔ (12 tasks, 34 outputs)
Phase 2: Spec Consistency ......... ✔ (hash chain valid, 8/8 sections covered)
Phase 3: IR Validation ............ ✔ (all inputs resolved, no duplicates)
Phase 4: Code Verification ........ ✔ (34/34 outputs present, 0 TODOs)
Phase 5: Design Verification ...... ✔ (all invariants satisfied)
Phase 6: Runtime Verification ..... ✔ (UI functional, vision 100%, preview healthy)

────────────────────────────────────
Compilation PASSED ✔ — 0 error(s), 0 warning(s)

Feature "<slug>" is production-ready.
```

Or on failure:

```
Phase 4: Code Verification ........ ✖ 2 errors, 1 warning
  ✖ OGU0305: IR output missing from codebase: API:/settings GET
  ✖ OGU0401: TODO/FIXME found: apps/api/routes/users.ts:42
  ⚠ OGU1001: IR output COMPONENT:SettingsPanel has no matching contract entry

────────────────────────────────────
Compilation FAILED — 2 error(s), 1 warning(s)
```

## Post-completion

After compilation passes:

1. Consider setting up production observation: run `/observe` if deploying.
2. Run `node tools/ogu/cli.mjs learn` to extract patterns for cross-project learning.
3. Run `node tools/ogu/cli.mjs trends` to update trend analysis across all completed features.
4. Run `node tools/ogu/cli.mjs clean --all --dry-run` to check what can be cleaned up.

## Log

```bash
node tools/ogu/cli.mjs log "Compilation <PASSED/FAILED>: <slug>"
```

If passed, clear `current_task` in `.ogu/STATE.json` to null.

## Rules

- Compilation must pass with 0 errors. Warnings are allowed but should be addressed.
- Error codes (OGU####) are greppable and documented in `docs/vault/05_Runbooks/Error_Codes.md`.
- This skill does not fix anything. It only verifies and reports.
- After passing, the feature is done. No more changes without a new Plan.json task and ADR.
- `ogu compile` supersedes `ogu gates run` as the primary verification command.
