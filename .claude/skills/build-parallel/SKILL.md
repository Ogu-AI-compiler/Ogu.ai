---
name: build-parallel
description: Parallel implementation of a feature using DAG orchestration. Tasks without dependency overlap run simultaneously. Use when user says "build parallel", "build fast", or for features with many independent tasks.
argument-hint: <slug>
disable-model-invocation: true
---

You are the parallel build engine. You implement Plan.json tasks as fast as possible by running independent tasks simultaneously.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user.

## Before you start

1. Run preflight:
   ```bash
   node tools/ogu/cli.mjs feature:validate <slug>
   ```
   If it fails, STOP. Tell the user to run `/feature <slug>` first.

2. Build the DAG:
   ```bash
   node tools/ogu/cli.mjs orchestrate <slug>
   ```

3. Read the DAG:
   - `.ogu/orchestrate/<slug>/PLAN_DAG.json`
   - `docs/vault/04_Features/<slug>/Spec.md`
   - `docs/vault/04_Features/<slug>/Plan.json`
   - `.ogu/CONTEXT.md`

4. Check if parallel execution is available:
   - If `parallelizable: false` in DAG → fall back to sequential `/build`
   - If all waves have 1 task → fall back to sequential `/build`
   - If `max_parallelism > 1` → proceed with parallel build

## Wave execution

For each wave in `PLAN_DAG.json`:

### Sequential wave (1 task or `parallel: false`)

Implement the task directly, following all rules from `/build`:
1. Announce the task
2. Read the spec section
3. Implement
4. Verify `done_when`
5. Log completion

### Parallel wave (`parallel: true`, multiple tasks)

Use the **Task tool** to launch multiple agents simultaneously:

For each task in the wave:
- Launch an agent with subagent_type "general-purpose"
- Give it: the task definition, spec section content, CONTEXT.md constraints
- Tell it to implement ONLY that task, touching ONLY the files in `touches`
- Tell it NOT to modify files in `forbidden`

Wait for all agents to complete. Then:
1. Verify each task's `done_when` condition
2. Check for conflicts (did two agents modify the same file unexpectedly?)
3. If conflicts exist, resolve them manually or re-run the conflicting task
4. Log all completed tasks

### After each wave

Before moving to the next wave:
- Verify all tasks in the current wave are complete
- Check that no `forbidden` files were modified
- Run post-merge validation:
  ```bash
  node tools/ogu/cli.mjs orchestrate <slug> --validate
  ```
  Check `post_wave_validation` in the output. If typecheck or build **fails**, STOP. Do not proceed to the next wave. Fix the errors first, then re-run validation.
- Log: `node tools/ogu/cli.mjs log "Wave <N> complete: tasks <ids>"`

## After all waves

Run the full checklist from `/build`:
- [ ] Every task in Plan.json has been implemented
- [ ] Every `done_when` condition is satisfied
- [ ] All API endpoints from Spec.md exist with real handlers
- [ ] All routes from Spec.md are registered and reachable
- [ ] All UI actions from Spec.md are wired to real logic
- [ ] No TODO, FIXME, or placeholder code anywhere in new files
- [ ] Code respects all invariants from CONTEXT.md

## Report

```
Build (parallel): <slug>

  Tasks completed: <N>/<total>
  Waves executed: <W>
  Max parallelism used: <P>
  Scope conflicts resolved: <C>

  Wave 1 (parallel): tasks 1, 2, 3 — DONE
  Wave 2 (parallel): tasks 4, 5 — DONE
  Wave 3 (sequential): task 6 — DONE

  Next step: Run /vision and /done
```

## Rules

- `touches` scope is enforced. An agent must NOT modify files outside its scope.
- `forbidden` scope is absolute. If an agent needs a forbidden file, the task is broken — STOP.
- If a wave fails partially, stop the entire build. Do not continue to next wave.
- Parallel agents must NOT communicate with each other. Each works in isolation.
- After parallel wave, always verify no unexpected file conflicts occurred.
- Falls back to sequential `/build` if Plan.json has no `touches` fields.
