---
name: lock
description: Verify or refresh the context lock before implementation. Use when user says "lock context", "check lock", "refresh lock", "is context stale", or before coding.
argument-hint: [feature slug]
disable-model-invocation: true
---

You are the context lock gate. You ensure no one implements against stale context.

## Input

Feature slug (optional): $ARGUMENTS

## Step 1: Check if lock exists

Check if `.ogu/CONTEXT_LOCK.json` exists.

If it doesn't exist:
- Tell the user: "No context lock found. Building context and locking."
- Go to Step 3.

## Step 2: Validate the lock

```bash
node tools/ogu/cli.mjs validate
```

If validate passes with no lock mismatch errors → lock is current. Skip to Step 4.

If validate reports lock mismatch → context is stale. Tell the user which file drifted and continue to Step 3.

## Step 3: Rebuild and re-lock

```bash
node tools/ogu/cli.mjs context --feature <slug>
node tools/ogu/cli.mjs context:lock
```

If no slug was provided and `.ogu/STATE.json` has a `current_task`, use that. If both are empty, rebuild without `--feature`:

```bash
node tools/ogu/cli.mjs context
node tools/ogu/cli.mjs context:lock
```

## Step 4: Confirm

```
Context lock: CURRENT

  context_hash: <first 12 chars>...
  state_hash:   <first 12 chars>...
  repo_map_hash: <first 12 chars>...
  locked_at:    <timestamp>
```

```bash
node tools/ogu/cli.mjs log "Context lock verified for <slug or 'no feature'>"
```

## Rules

- Never implement against a stale or missing lock.
- If the lock is stale, always rebuild context first, then lock. Never just re-lock without rebuilding.
- This skill is a gate, not a fix. It verifies or refreshes — it does not modify code or specs.
