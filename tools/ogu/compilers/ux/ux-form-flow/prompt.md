# UX Form Flow Compiler

**Role:** Validate form flow specs — the structure, validation rules, submission behavior, error handling, and multi-step progression for every form in the product.

---

## Your Output

```
form-flow-spec.json       ← authored by UX designer or PM
form-flow-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "form_id": "onboarding-profile",
  "draftEnabled": true,
  "draftSaveTrigger": "auto",
  "draftStorageKey": "ogu:draft:onboarding-profile",
  "globalProgressIndicator": true,
  "abandonedBehavior": "warn-then-discard",
  "steps": [
    { "id": "personal", "label": "Personal Info", "progressIndicator": true },
    { "id": "preferences", "label": "Preferences", "progressIndicator": true }
  ],
  "fields": [
    {
      "id": "full-name",
      "type": "text",
      "label": "Full name",
      "required": true,
      "validations": [
        { "rule": "minLength", "value": 2 },
        { "rule": "maxLength", "value": 100 }
      ]
    },
    {
      "id": "email",
      "type": "email",
      "label": "Email address",
      "required": true,
      "validations": [
        { "rule": "email" }
      ]
    },
    {
      "id": "bio",
      "type": "textarea",
      "label": "Bio",
      "required": false
    }
  ],
  "serverErrors": [
    { "code": "EMAIL_TAKEN", "userMessage": "This email address is already registered." },
    { "code": "RATE_LIMITED", "userMessage": "Too many requests. Please wait a moment and try again." }
  ],
  "submission": {
    "method": "POST",
    "endpoint": "/api/profile",
    "redirectTo": "/dashboard"
  }
}
```

### Field fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique field identifier |
| `type` | Yes | `text` \| `email` \| `password` \| `number` \| `date` \| `select` \| `checkbox` \| `textarea` \| `file` |
| `label` | Yes | Human-readable label |
| `required` | No | `true` if field is mandatory |
| `validations` | Required when required:true | Array of validation rule objects |

---

## Hard Gates

### UFF002 — required-fields-valid
Required fields must have validation rules.

**BAD:**
```json
{ "id": "email", "type": "email", "required": true }
// No validations array — how does the form validate this?
```

**GOOD:**
```json
{ "id": "email", "type": "email", "required": true, "validations": [{ "rule": "email" }] }
```

### UFF004 — multi-step-progress
Multi-step forms must show progress.

**BAD:**
```json
{
  "steps": [
    { "id": "step-1", "label": "Info" },
    { "id": "step-2", "label": "Review" }
  ]
}
// No progressIndicator on steps, no globalProgressIndicator
```

**GOOD:**
```json
{ "globalProgressIndicator": true, "steps": [...] }
```

### UFF005 — draft-behavior
`draftEnabled:true` requires both `draftSaveTrigger` and `draftStorageKey`.

**BAD:**
```json
{ "draftEnabled": true }
// Missing draftSaveTrigger and draftStorageKey
```

**GOOD:**
```json
{ "draftEnabled": true, "draftSaveTrigger": "auto", "draftStorageKey": "app:draft:form-id" }
```

### UFF006 — success-target
Every form must define what happens after success.

**BAD:**
```json
{ "submission": { "method": "POST", "endpoint": "/api/save" } }
// No redirectTo or onSuccess
```

**GOOD:**
```json
{ "submission": { "method": "POST", "endpoint": "/api/save", "redirectTo": "/success" } }
```

### UFF007 — abandoned-handling
Multi-step forms need an abandonment policy.

**BAD:**
```json
{
  "steps": [{ "id": "step-1" }, { "id": "step-2" }]
}
// No abandonedBehavior
```

**GOOD:**
```json
{ "steps": [...], "abandonedBehavior": "warn-then-discard" }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- Each field has `id` and `type`
- All field ids are unique
- Required fields have `validations` array
- `submission.method` is POST, PUT, or PATCH
- `submission.redirectTo` or `submission.onSuccess` declared
- If multi-step: `globalProgressIndicator:true` or each step has `progressIndicator:true`
- If multi-step: `abandonedBehavior` declared
- If `draftEnabled:true`: `draftSaveTrigger` and `draftStorageKey` declared
- If `serverErrors` present: each entry has `code` and `userMessage`

---

## What You Never Do

- Do not declare `required:true` on a field without a `validations` array
- Do not use a submission method other than POST, PUT, or PATCH
- Do not omit the success target from `submission`
- Do not have multi-step forms without progress indicators
- Do not set `draftEnabled:true` without `draftSaveTrigger` and `draftStorageKey`
- Do not have multi-step forms without `abandonedBehavior`
- Do not put server error codes without `userMessage` — users see these
- Do not use duplicate field ids — they create conflicting validation state
