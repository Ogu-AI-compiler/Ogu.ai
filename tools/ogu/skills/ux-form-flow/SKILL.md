---
name: ux-form-flow
description: Compiler skill for the ux-form-flow compiler. Activates when producing form-flow-artifact.json. Gates: UFF001–UFF008. No upstream dependency.
---

# ux-form-flow — Compiler Skill

## What This Compiler Does

Compiles the form flow specification — fields, validations, server errors, multi-step progress, draft saving, submission targets, and abandonment behavior. Enforces: required fields have validations, server error codes have user messages, multi-step forms have progress indicators, draft-enabled forms declare storage key, submission has success target, and multi-step abandonment is handled.

**Upstream dependency:** none
**Output artifact:** `form-flow-artifact.json`
**IR identifier:** `FORM_FLOW:{project}`

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "form_id": "checkout-form",
  "fields": [
    { "id": "email", "type": "email", "required": true, "validations": [{ "rule": "format", "message": "Invalid email" }] },
    { "id": "name", "type": "text" }
  ],
  "submission": { "method": "POST", "redirectTo": "/thank-you" },
  "steps": [
    { "id": "personal", "fields": ["email", "name"], "progressIndicator": true },
    { "id": "payment", "fields": ["card"], "progressIndicator": true }
  ],
  "draftEnabled": true,
  "draftSaveTrigger": "auto",
  "draftStorageKey": "checkout-draft",
  "abandonedBehavior": "warn-then-discard"
}
```

Required fields:
- `form_id` — string
- `fields` — non-empty array, each with `id` and `type`
- `submission` — object with `method` (POST/PUT/PATCH)

---

## Gates

### UFF001 — spec-valid
Reads `form-flow-spec.json`. Returns `skipped: true` if file not found. Required: `form_id` (string), `fields` (non-empty array, each with `id` + `type`), `submission` (object).

### UFF002 — required-fields-validated
Every field with `required: true` must have a `validations` array with at least one entry. Required fields without validation rules accept any input and fail at the server.

BAD:
```json
{ "id": "email", "required": true }
// required but no validations
```
GOOD:
```json
{ "id": "email", "required": true, "validations": [{ "rule": "format", "message": "Invalid email" }] }
```

### UFF003 — server-errors-mapped
When `spec.serverErrors` is declared, it must be a non-empty array. Each entry must have `code` (string) and `userMessage` (string). An empty array means the field is declared but abandoned — same as not declaring it.

BAD:
```json
{ "serverErrors": [] }
// declared but empty
```
BAD:
```json
{ "serverErrors": [{ "code": "E_CONFLICT" }] }
// missing userMessage
```
GOOD:
```json
{ "serverErrors": [{ "code": "E_CONFLICT", "userMessage": "This email is already in use." }] }
```

### UFF004 — multi-step-progress
When `spec.steps` has more than 1 entry, each step must declare `progressIndicator: true`, OR the spec must declare `globalProgressIndicator: true`. Multi-step forms without progress indication disorient users.

BAD:
```json
{ "steps": [{ "id": "step1" }, { "id": "step2" }] }
// two steps, no progressIndicator
```
GOOD:
```json
{ "globalProgressIndicator": true, "steps": [{ "id": "step1" }, { "id": "step2" }] }
// OR each step has progressIndicator: true
```

### UFF005 — draft-storage-declared
When `draftEnabled: true`, both `draftSaveTrigger` (`"auto"` or `"manual"`) and `draftStorageKey` (non-empty string) must be declared. Draft-enabled forms without a storage key cannot persist state.

BAD:
```json
{ "draftEnabled": true }
// missing draftSaveTrigger and draftStorageKey
```
GOOD:
```json
{ "draftEnabled": true, "draftSaveTrigger": "auto", "draftStorageKey": "checkout-draft" }
```

### UFF006 — submission-success-target
`submission` must declare either `redirectTo` (string) or `onSuccess` (string/object). Forms without a success target leave users on the form screen after submission with no feedback.

BAD:
```json
{ "submission": { "method": "POST" } }
// no redirectTo or onSuccess
```
GOOD:
```json
{ "submission": { "method": "POST", "redirectTo": "/thank-you" } }
// OR
{ "submission": { "method": "POST", "onSuccess": "show-confirmation-modal" } }
```

### UFF007 — abandonment-behavior
When `spec.steps.length > 1` (multi-step form), `spec.abandonedBehavior` must be one of: `"save-draft"`, `"discard"`, `"warn-then-discard"`. Escape hatch: `noAbandonmentHandling: true`. Multi-step forms where the user navigates away must define behavior.

BAD: Multi-step form with no `abandonedBehavior` and no `noAbandonmentHandling`.
BAD: `"abandonedBehavior": "ignore"` — not in valid list.
GOOD: `"abandonedBehavior": "warn-then-discard"`

### UFF008 — contract-form-flow
Final contract check: `version` declared, unique field ids, each field has `id` + `type`, `submission.method` is POST/PUT/PATCH.

---

## What This Compiler Never Forgives

- `form-flow-spec.json` missing (UFF001 skips — not hard-fail)
- `form_id`, `fields`, or `submission` missing (UFF001)
- `required: true` field without `validations` array (UFF002)
- `serverErrors: []` — declared but empty (UFF003)
- Server error entry without `code` or `userMessage` (UFF003)
- Multi-step form without `progressIndicator` or `globalProgressIndicator` (UFF004)
- `draftEnabled: true` without `draftSaveTrigger` and `draftStorageKey` (UFF005)
- `submission` without `redirectTo` or `onSuccess` (UFF006)
- Multi-step form without `abandonedBehavior` (UFF007)
- `version` missing or duplicate field ids (UFF008)
