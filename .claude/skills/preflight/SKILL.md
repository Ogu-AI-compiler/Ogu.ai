---
name: preflight
description: Run Ogu preflight checks before any implementation. Use before coding, before /build, or when user says "preflight", "check before building", "is everything ready".
argument-hint: [feature slug]
disable-model-invocation: true
---

You are the Ogu preflight gate. No code gets written until this passes. This is not optional.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task` for the active feature. If that's also null, ask the user which feature to preflight.

## Step 1: Run doctor

```bash
node tools/ogu/cli.mjs doctor
```

If doctor exits non-zero: **STOP. Do not proceed.** Report the failure to the user exactly as doctor printed it, including the "Next action" hint. Do not attempt to fix it yourself — tell the user what failed and what to do.

## Step 2: Query cross-project patterns

```bash
node tools/ogu/cli.mjs recall
```

If relevant patterns are found, include them in the output. These are lessons learned from other projects that may apply here (same stack, same domain, same platform).

## Step 3: Build context

```bash
node tools/ogu/cli.mjs context --feature <slug>
```

## Step 4: Read CONTEXT.md

Read `.ogu/CONTEXT.md` in full.

## Step 5: Extract constraints

From CONTEXT.md, extract and list for the user:

**Project Profile** — platform, services, and infrastructure needs from Section 2.6. This informs what's available (DB, auth, storage, etc.)

**Invariants** — every rule from Section 1. These are non-negotiable. If implementation would violate any invariant, it must not proceed.

**Contracts** — relevant contracts from Section 2 (API, Navigation, SDUI). List only the ones that apply to this feature.

**Design Theme** — current theme mood and key tokens from Section 2.5, if set.

**Patterns** — relevant patterns from Section 4. List only the ones that apply to this feature.

Format the output as:

```
Preflight: PASSED

Feature: <slug>
Platform: <platform from profile>
Services: <available services>

## Invariants (all apply)
- [invariant 1]
- [invariant 2]
- ...

## Contracts (relevant to this feature)
- [contract: specific relevant section]
- ...

## Design Theme
- Mood: [mood]
- Key colors: [primary, background]

## Patterns (relevant to this feature)
- [pattern: description]
- ...
```

## Step 6: Log it

```bash
node tools/ogu/cli.mjs log "Preflight passed for <slug>"
```

## Rules

- If doctor fails, STOP. No exceptions.
- Never skip or summarize invariants. List every single one.
- For contracts and patterns, use judgement — only list what's relevant to the feature, but err on the side of including more rather than less.
- This skill produces no code. It only verifies and reports.
- After preflight passes, tell the user: "Ready to implement. Invariants, contracts, and patterns above must be followed."
