---
name: done
description: Final completion gate for a feature — runs all 10 machine-enforced gates. Use when user says "is it done", "mark complete", "finish feature", "ship it", "final check".
argument-hint: <slug>
disable-model-invocation: true
---

You are the final gate. A feature is NOT complete until every single check passes. No shortcuts.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user.

## Gate checks

Run all 10 gates using the CLI:

```bash
node tools/ogu/cli.mjs gates run <slug>
```

This runs all 10 gates sequentially with checkpoint/recovery:

1. **Doctor** — full health check
2. **Context lock** — rebuild context, lock hashes, validate
3. **Plan tasks** — every task in Plan.json has its done_when met
4. **No TODOs** — grep for TODO/FIXME/HACK/XXX in feature files
5. **UI functional** — no empty handlers, no href="#", no stubs
6. **Smoke test** — run E2E smoke tests (Playwright/Vitest/Jest)
7. **Vision** — 3-tier visual verification (DOM, screenshot, AI)
8. **Contracts** — all contract files valid, no TODOs
9. **Preview** — preview healthy, all services up
10. **Memory** — auto-apply memory updates

If a gate fails, it stops and reports. On retry, it resumes from the failed gate (checkpoint recovery).

### Useful commands

```bash
node tools/ogu/cli.mjs gates status <slug>         # Show current gate state
node tools/ogu/cli.mjs gates reset <slug>           # Clear checkpoints
node tools/ogu/cli.mjs gates run <slug> --force     # Re-run all gates
node tools/ogu/cli.mjs gates run <slug> --gate 6    # Run specific gate
```

## Output

The `gates run` command outputs:

```
Completion Gates: <slug>

  [1] doctor           PASS
  [2] context_lock     PASS
  [3] plan_tasks       PASS
  [4] no_todos         PASS
  [5] ui_functional    PASS
  [6] smoke_test       PASS
  [7] vision           PASS
  [8] contracts        PASS
  [9] preview          PASS
  [10] memory          PASS

  Completion Gate: PASSED
  Feature "<slug>" is COMPLETE.
```

Or on failure:

```
  [1] doctor           PASS
  ...
  [6] smoke_test       FAIL
       tests/smoke/my-feature.test.ts: Expected element to be visible

  Completion Gate: FAILED at gate 6
  Feature "<slug>" is NOT complete.
  Fix the issue and re-run: ogu gates run <slug>
```

## Metrics

Gate results are automatically written to `.ogu/METRICS.json` by the `gates` command. No manual metric collection needed — it tracks:
- Pass/fail per gate
- Attempt count per gate
- Failure details
- Start/completion timestamps

## Post-completion

After all 10 gates pass:

1. Consider setting up production observation: run `/observe` if deploying.
2. Run `node tools/ogu/cli.mjs learn` to extract patterns for cross-project learning.
3. Run `node tools/ogu/cli.mjs trends` to update trend analysis across all completed features.
4. Run `node tools/ogu/cli.mjs clean --all --dry-run` to check what can be cleaned up.

## Log

```bash
node tools/ogu/cli.mjs log "Completion gate <PASSED/FAILED at gate N>: <slug>"
```

If passed, clear `current_task` in `.ogu/STATE.json` to null.

## Rules

- All 10 gates must pass. 9 out of 10 is not complete.
- Gates run in order. Stop at first failure.
- Gates are machine-enforced functions, not prose. They return pass/fail deterministically.
- This skill does not fix anything. It only verifies and reports.
- After passing, the feature is done. No more changes without a new Plan.json task and ADR.
- Metrics are ALWAYS written, even on failure. This data feeds the learning loop.
