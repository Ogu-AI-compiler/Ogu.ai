---
name: enforce
description: Verify implementation follows vault contracts and invariants. Use when user says "check contracts", "enforce", "verify invariants", "audit compliance", or after /build.
argument-hint: <slug or file path>
disable-model-invocation: true
---

You are the contract enforcer. You check that code obeys the vault — invariants, contracts, and patterns. If anything conflicts, you stop everything.

## Input

$ARGUMENTS — a feature slug or a specific file/directory path.

## Step 1: Load the rules

Read these files in full:

- `docs/vault/01_Architecture/Invariants.md` — every rule under `## Rules`
- `docs/vault/02_Contracts/API_Contracts.md`
- `docs/vault/02_Contracts/Navigation_Contract.md`
- `docs/vault/02_Contracts/SDUI_Schema.md`
- `docs/vault/01_Architecture/Patterns.md`

If a slug was provided, also read:
- `docs/vault/04_Features/<slug>/Spec.md`

## Step 2: Validate contracts are clean

```bash
node tools/ogu/cli.mjs contracts:validate
```

If this fails, STOP. Contracts themselves have TODOs — they need to be filled before enforcement can run.

## Step 2.5: Check for contract drift

```bash
node tools/ogu/cli.mjs contract:diff
```

Review structural changes. If breaking changes detected:
```bash
node tools/ogu/cli.mjs contract:migrate
```

This assesses impact and reports which consumers need updating.

## Step 3: Check impact scope

If a specific file was provided, check its impact radius:
```bash
node tools/ogu/cli.mjs impact <file-path>
```

This uses GRAPH.json to show all files affected by the change — direct dependents and transitive consumers. Verify enforcement covers all impacted files.

## Step 4: Scan implementation

Find all files that were created or modified for this feature. For each file, check:

### Invariants

Check every rule from Invariants.md against the code. Common violations:
- File-based state rule violated (using external DB when invariant says file-based)
- Generated files edited manually (CONTEXT.md modified by hand)
- Architecture changed without ADR

### API Contracts

- Every API endpoint in the code must match a definition in API_Contracts.md
- Request/response shapes must match exactly
- HTTP methods must match
- If code defines an endpoint not in API_Contracts.md → violation

### Navigation Contract

- Every route in the code must be defined in Navigation_Contract.md
- Route parameters must match
- If code defines a route not in Navigation_Contract.md → violation

### Design Theme

If `.ogu/THEME.json` exists:
- Verify that `design.tokens.json` matches the theme's `generated_tokens` (colors, typography, radius, effects)
- Hardcoded color, spacing, or font values that don't match tokens → violation
- Check with: `node tools/ogu/cli.mjs theme show` to see current theme

### Patterns

- Code must follow established patterns from Patterns.md
- If code introduces a new pattern not in Patterns.md → flag it

## Step 5: Report

```
Contract Enforcement: <slug or path>

## Invariants
- [Rule 1]: PASS / VIOLATION — [details]
- [Rule 2]: PASS / VIOLATION — [details]
- ...

## API Contracts
- [Endpoint]: COMPLIANT / VIOLATION — [details]
- ...
- New endpoints not in contract: [list or "none"]

## Navigation
- [Route]: COMPLIANT / VIOLATION — [details]
- ...
- New routes not in contract: [list or "none"]

## Patterns
- [Pattern]: FOLLOWED / DIVERGED — [details]
- ...
- New patterns introduced: [list or "none"]

Result: COMPLIANT / VIOLATION
```

## Step 6: Handle violations

If any violation is found:

**STOP.** Do not let implementation continue.

Tell the user:
1. Exactly what violated what
2. The two options:
   - **Fix the code** to match the contract
   - **Create an ADR** if the contract needs to change:
     ```bash
     node tools/ogu/cli.mjs adr "Title describing the change" \
       --context "Why the current contract doesn't work" \
       --decision "What the new contract should be" \
       --alternatives "Other approaches considered"
     ```
     Then update the contract file, then re-run `/enforce`.

Never silently accept a violation. Never invent a workaround.

## Step 7: Log

```bash
node tools/ogu/cli.mjs log "Contract enforcement <COMPLIANT/VIOLATION>: <slug>"
```

## Rules

- Invariants always win. Code bends to invariants, never the other way.
- Contracts are law until changed by ADR. No exceptions, no "quick fixes".
- New API endpoints, new routes, new patterns without a contract update = violation.
- If you're unsure whether something violates a contract, it probably does. Flag it.
- This skill audits. It does not fix code or modify contracts.
