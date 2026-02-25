---
name: pipeline
description: Run the full Ogu pipeline end-to-end for a feature. Use when user says "autopilot", "run pipeline", "full pipeline", "end to end", "build everything".
argument-hint: <slug>
---

You are the Ogu pipeline orchestrator. You run the entire pipeline for a feature from start to finish, stopping only on failure.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user which feature to run.

## Pipeline Stages

Run these stages **in order**. Each stage must pass before proceeding to the next. If any stage fails, **STOP** and report the failure.

### Stage 1: Doctor

```bash
node tools/ogu/cli.mjs doctor
```

If doctor fails → STOP. Report the failure.

### Stage 2: Feature validation (phase 1)

```bash
node tools/ogu/cli.mjs feature:validate <slug> --phase-1
```

If this fails, the feature needs `/feature` first:
- Check if PRD.md exists. If not → STOP. Tell user to run `/feature <slug>` first.
- If PRD.md exists but validation fails → STOP. Tell user what's missing.

### Stage 3: Architect validation (phase 2)

```bash
node tools/ogu/cli.mjs feature:validate <slug> --phase-2
```

If this fails, the feature needs `/architect`:
- Check if Spec.md still has `<!-- TO BE FILLED BY /architect -->` markers → STOP. Tell user to run `/architect <slug>` first.
- If Plan.json is missing or empty → STOP. Tell user to run `/architect <slug>` first.

### Stage 4: Design Direction

If `docs/vault/04_Features/<slug>/DESIGN.md` doesn't exist, run the `/design` skill.

Check `.ogu/STATE.json` field `design_mode`. If "bold" or "extreme" and no variant has been picked yet (DESIGN.md doesn't contain `**Variant:**`), ask the user to pick a variant:
```bash
node tools/ogu/cli.mjs design:show <slug>
```

If DESIGN.md already exists with a selected variant or standard mode, continue.

### Stage 5: Preflight

Run the `/preflight` skill for the feature:

```bash
node tools/ogu/cli.mjs doctor
node tools/ogu/cli.mjs context --feature <slug>
```

Read `.ogu/CONTEXT.md`. Extract invariants, contracts, patterns. If doctor fails → STOP.

### Stage 6: Build

Read `docs/vault/04_Features/<slug>/Plan.json` and execute each task in order:

1. Read each task's `title`, `touches`, and `done_when`
2. Implement the task following all invariants and contracts from preflight
3. After each task, verify its `done_when` condition is met
4. Log progress: `node tools/ogu/cli.mjs log "Task N complete: <title>"`

If Plan.json has a DAG (tasks with `depends_on`), check if orchestrate supports it:
```bash
node tools/ogu/cli.mjs orchestrate <slug>
```

### Stage 7: Compilation

```bash
node tools/ogu/cli.mjs compile <slug>
```

If compilation fails → STOP. Report errors with OGU codes and what to fix.

If compilation passes → feature is DONE.

### Stage 8: Post-completion

After all gates pass:

```bash
node tools/ogu/cli.mjs learn
node tools/ogu/cli.mjs log "Pipeline complete: <slug>"
```

Update `.ogu/STATE.json` to set `current_task` to null.

## Output Format

Report progress at each stage:

```
Pipeline: <slug>

  [1/8] Doctor           PASS
  [2/8] Feature (ph1)    PASS
  [3/8] Architect (ph2)  PASS
  [4/8] Design           PASS
  [5/8] Preflight        PASS
  [6/8] Build            PASS (N tasks completed)
  [7/8] Compile          PASS (0 errors, 0 warnings)
  [8/8] Post-completion  DONE

Pipeline COMPLETE. Feature "<slug>" is shipped.
```

Or on failure:

```
Pipeline: <slug>

  [1/8] Doctor           PASS
  [2/8] Feature (ph1)    PASS
  [3/8] Architect (ph2)  FAIL
       Spec.md still has architect markers. Run /architect <slug> first.

Pipeline STOPPED at stage 3.
```

## Rules

- Run stages sequentially. Never skip a stage.
- If a stage fails, STOP immediately. Do not continue.
- Log every stage result: `node tools/ogu/cli.mjs log "Pipeline stage N: <result>"`
- During the Build stage (5), follow ALL invariants and contracts from preflight.
- This skill is the "autopilot" — it drives the whole pipeline, but respects every gate and check.
- If the build stage requires human decisions (ambiguous requirements), STOP and ask.
