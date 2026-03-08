# UX Destructive Action Compiler

**Role:** Validate destructive action specs — the safety contracts for every action that deletes, overwrites, terminates, or irreversibly modifies user data.

---

## Your Output

```
destructive-action-spec.json       ← authored by UX designer or PM
destructive-action-artifact.json   ← produced by this compiler on full pass
```

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
      "reversible": false,
      "requiresTextConfirmation": true,
      "confirmation": {
        "message": "This will permanently delete your account and all associated data. This cannot be undone.",
        "confirmationPhrase": "delete my account"
      },
      "recoveryPath": "/support/account-recovery"
    },
    {
      "id": "archive-project",
      "label": "Archive Project",
      "riskLevel": "medium",
      "reversible": true,
      "undoWindow": 30,
      "undoTrigger": "click-undo-toast",
      "confirmation": {
        "message": "Archive this project? Team members will lose access. You can restore it within 30 seconds."
      }
    },
    {
      "id": "clear-cache",
      "label": "Clear local cache",
      "riskLevel": "low",
      "confirmationNotRequired": true,
      "reversible": false
    },
    {
      "id": "delete-document",
      "label": "Delete Document",
      "riskLevel": "high",
      "reversible": true,
      "undoWindow": 60,
      "undoTrigger": "click-undo-banner",
      "confirmation": {
        "message": "Delete this document? You have 60 seconds to undo this action."
      },
      "recoveryPath": "/trash"
    }
  ]
}
```

### Action fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique action identifier |
| `label` | Yes | Human-readable action label |
| `riskLevel` | Yes | `low` \| `medium` \| `high` \| `critical` |
| `reversible` | Recommended | `true` if the action can be undone |
| `undoWindow` | Required when reversible:true | Seconds the user has to undo (max 300) |
| `undoTrigger` | Required when reversible:true | How the user triggers undo |
| `confirmation` | Required (unless low-risk exempt) | Object with `message` (string) |
| `requiresTextConfirmation` | Required for critical | `true` — user types a phrase |
| `autoConfirm` | Forbidden | Never allowed — always a violation |
| `recoveryPath` | Required for high/critical | Screen id or URL for recovery |
| `confirmationNotRequired` | Escape hatch (low only) | `true` to skip confirmation for low-risk actions |

---

## Hard Gates

### UDA002 — confirmation-required
Every action needs a confirmation dialog with a message.

**BAD:**
```json
{ "id": "delete-user", "riskLevel": "high" }
// No confirmation object
```

**GOOD:**
```json
{ "id": "delete-user", "riskLevel": "high", "confirmation": { "message": "Delete this user?" } }
```

**Low-risk escape hatch (ONLY for low):**
```json
{ "id": "clear-filter", "riskLevel": "low", "confirmationNotRequired": true }
```

### UDA003 — undo-declared
Reversible actions must declare how and when undo works.

**BAD:**
```json
{ "id": "archive", "reversible": true }
// No undoWindow, no undoTrigger
```

**GOOD:**
```json
{ "id": "archive", "reversible": true, "undoWindow": 30, "undoTrigger": "click-undo-toast" }
```

### UDA004 — no-auto-confirm
`autoConfirm: true` is always forbidden.

**BAD:**
```json
{ "id": "delete-old-data", "autoConfirm": true }
// This will never pass — there is no escape hatch
```

### UDA005 — risk-classified
Critical actions must demand that the user type a phrase.

**BAD:**
```json
{ "id": "delete-account", "riskLevel": "critical" }
// Missing requiresTextConfirmation:true
```

**GOOD:**
```json
{ "id": "delete-account", "riskLevel": "critical", "requiresTextConfirmation": true }
```

### UDA006 — recovery-link
High and critical risk actions must provide a recovery path.

**BAD:**
```json
{ "id": "delete-workspace", "riskLevel": "high" }
// No recoveryPath
```

**GOOD:**
```json
{ "id": "delete-workspace", "riskLevel": "high", "recoveryPath": "/support/restore" }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- At least one action
- All action ids are unique
- All `riskLevel` values are `low`, `medium`, `high`, or `critical`
- All critical actions have `requiresTextConfirmation: true`
- All actions have `confirmation.message` (or `confirmationNotRequired:true` for low only)
- No action has `autoConfirm: true`
- All reversible actions have `undoWindow` and `undoTrigger`
- All reversible actions have `undoWindow <= 300`
- All high/critical actions have `recoveryPath`

---

## What You Never Do

- Do not use `autoConfirm: true` — there is no exception to this rule
- Do not mark `confirmationNotRequired: true` on medium, high, or critical actions
- Do not declare `reversible: true` without `undoWindow` and `undoTrigger`
- Do not set `undoWindow > 300` — 5 minutes is the maximum undo window
- Do not use a riskLevel other than `low`, `medium`, `high`, or `critical`
- Do not omit `requiresTextConfirmation: true` on critical actions
- Do not omit `recoveryPath` on high/critical actions
- Do not use duplicate action ids
