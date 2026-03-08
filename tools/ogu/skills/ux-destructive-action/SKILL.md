---
name: ux-destructive-action
description: Compiler skill for the ux-destructive-action compiler. Activates when producing destructive-action-artifact.json. Gates: UDA001–UDA007. No upstream dependency.
---

# ux-destructive-action — Compiler Skill

## What This Compiler Does

Compiles the destructive action specification — actions with risk levels, confirmation requirements, reversibility, recovery paths, and text confirmation for critical actions. Enforces: `autoConfirm: true` is an absolute violation, critical actions require text confirmation, reversible actions need undo window + trigger, high/critical actions need recovery path, `undoWindow ≤ 300` seconds.

**Upstream dependency:** none
**Output artifact:** `destructive-action-artifact.json`
**IR identifier:** `DESTRUCTIVE_ACTION:{project}`

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "actions": [
    {
      "id": "delete-account",
      "label": "Delete Account",
      "riskLevel": "critical",
      "requiresTextConfirmation": true,
      "confirmation": { "message": "Type DELETE to confirm account deletion" },
      "recoveryPath": "/support/account-recovery"
    },
    {
      "id": "archive-item",
      "label": "Archive Item",
      "riskLevel": "low",
      "reversible": true,
      "undoWindow": 30,
      "undoTrigger": "Undo archive",
      "confirmation": { "message": "Archive this item?" }
    }
  ]
}
```

Required fields:
- `version` — declared string
- `actions` — non-empty array, each with `id`, `label`, `riskLevel`

---

## Gates

### UDA001 — spec-valid
Reads `destructive-action-spec.json`. Returns `skipped: true` if file not found. Required: `actions` (non-empty array), each action: `id` (string), `label` (string), `riskLevel` (string).

Valid risk levels: `low`, `medium`, `high`, `critical`.

### UDA002 — confirmation-required
Every action must declare `confirmation.message` (non-empty string). Escape hatch: `confirmationNotRequired: true` is only valid for `riskLevel: "low"` — medium/high/critical cannot skip confirmation.

BAD:
```json
{ "id": "delete", "riskLevel": "high" }
// missing confirmation.message, riskLevel is not low
```
BAD:
```json
{ "id": "delete", "riskLevel": "medium", "confirmationNotRequired": true }
// confirmationNotRequired only for low risk
```
GOOD:
```json
{ "id": "delete", "riskLevel": "low", "confirmationNotRequired": true }
// OR
{ "id": "delete", "riskLevel": "high", "confirmation": { "message": "Delete this record?" } }
```

### UDA003 — reversible-undo-window
Actions with `reversible: true` must declare both `undoWindow` (positive integer, seconds) and `undoTrigger` (non-empty string). Reversible without undo window is unenforceable.

BAD:
```json
{ "reversible": true }
// missing undoWindow and undoTrigger
```
GOOD:
```json
{ "reversible": true, "undoWindow": 30, "undoTrigger": "Undo deletion" }
```

### UDA004 — no-auto-confirm
`autoConfirm: true` is an absolute violation with no escape hatch. Auto-confirming destructive actions removes the last safety barrier from data loss.

BAD:
```json
{ "id": "purge", "autoConfirm": true }
// forbidden — no exceptions
```

### UDA005 — critical-text-confirmation
Actions with `riskLevel: "critical"` must declare `requiresTextConfirmation: true`. Critical actions (account deletion, data purge) require the user to type a confirmation phrase.

BAD:
```json
{ "riskLevel": "critical", "confirmation": { "message": "Click to confirm" } }
// missing requiresTextConfirmation:true
```
GOOD:
```json
{ "riskLevel": "critical", "requiresTextConfirmation": true, "confirmation": { "message": "Type DELETE to confirm" } }
```

### UDA006 — recovery-path-for-high-risk
Actions with `riskLevel: "high"` or `"critical"` must declare `recoveryPath` (non-empty string). Users must have a way back from catastrophic actions.

BAD:
```json
{ "riskLevel": "high" }
// missing recoveryPath
```
GOOD:
```json
{ "riskLevel": "high", "recoveryPath": "/restore" }
```

### UDA007 — contract-destructive-action
Final contract check: `version` declared, unique action ids, `undoWindow ≤ 300` seconds for all reversible actions.

BAD: `"undoWindow": 600` — exceeds 300 second maximum.

---

## What This Compiler Never Forgives

- `destructive-action-spec.json` missing (UDA001 skips — not hard-fail)
- `actions` missing or empty (UDA001)
- Any action missing `id`, `label`, or `riskLevel` (UDA001)
- `confirmation.message` missing for medium/high/critical risk (UDA002)
- `confirmationNotRequired: true` on non-low-risk action (UDA002)
- `reversible: true` without `undoWindow` and `undoTrigger` (UDA003)
- `autoConfirm: true` — absolute violation, no escape hatch (UDA004)
- `riskLevel: "critical"` without `requiresTextConfirmation: true` (UDA005)
- `riskLevel: "high"` or `"critical"` without `recoveryPath` (UDA006)
- `undoWindow > 300` seconds (UDA007)
- Duplicate action ids (UDA007)
