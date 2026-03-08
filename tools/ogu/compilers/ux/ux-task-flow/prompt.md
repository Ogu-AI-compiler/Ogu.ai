# UX Task Flow Compiler

**Role:** Validate task flow specs — the step-by-step sequence of actions a user and system take to complete a discrete task, from initiation through success, failure, or abandonment.

---

## Your Output

```
task-flow-spec.json       ← authored by UX designer or PM
task-flow-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "task_id": "upload-document",
  "abandonable": true,
  "resumeFrom": "file-select",
  "steps": [
    {
      "id": "file-select",
      "order": 1,
      "actor": "user",
      "label": "Select file",
      "type": "action"
    },
    {
      "id": "validate-file",
      "order": 2,
      "actor": "system",
      "label": "Validate file type and size",
      "type": "action",
      "retryable": true,
      "maxRetries": 3
    },
    {
      "id": "upload-progress",
      "order": 3,
      "actor": "both",
      "label": "Upload with progress indicator",
      "type": "action"
    },
    {
      "id": "upload-failed",
      "order": 4,
      "actor": "system",
      "label": "Show error and retry option",
      "type": "failure"
    },
    {
      "id": "upload-complete",
      "order": 5,
      "actor": "system",
      "label": "Show success confirmation",
      "type": "success"
    }
  ],
  "completion_criteria": [
    { "description": "File is stored in cloud storage and accessible via URL" },
    { "description": "User sees success confirmation with file preview" },
    { "description": "Audit log entry created with user id and timestamp" }
  ],
  "failure_paths": [
    { "id": "file-too-large", "trigger": "file > 50MB", "recovery": "show size limit message" },
    { "id": "network-timeout", "trigger": "upload timeout > 30s", "recovery": "retry with backoff" }
  ]
}
```

### Step fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Recommended | Unique step identifier for cross-referencing |
| `order` | Yes | Sequential integer (0-based or 1-based, no gaps) |
| `actor` | Yes | `"user"` \| `"system"` \| `"both"` |
| `label` | Yes | Human-readable description of what happens |
| `type` | Yes | `"action"` \| `"decision"` \| `"failure"` \| `"cancellation"` \| `"success"` \| `"parallel"` |
| `retryable` | No | `true` if this step can be retried |
| `maxRetries` | Required when retryable | Integer 1–5 |
| `parallelGroup` | Required for parallel steps | Group id string |

---

## Hard Gates

### UTK002 — step-order
Steps must be sequentially ordered with no gaps. Order can start at 0 or 1.

**BAD:**
```json
[
  { "order": 1 },
  { "order": 3 }
]
// Missing order 2 — gap violation
```

**GOOD:**
```json
[
  { "order": 1 },
  { "order": 2 },
  { "order": 3 }
]
```

### UTK004 — failure-paths
At least one failure or cancellation path must exist.

**BAD:**
```json
{
  "steps": [
    { "type": "action" },
    { "type": "success" }
  ]
}
// No failure step and no failure_paths array
```

**GOOD:**
```json
{
  "steps": [
    { "type": "action" },
    { "type": "failure" },
    { "type": "success" }
  ]
}
```

### UTK005 — retry-cap
Retryable steps must declare maxRetries <= 5. `retryable: true` without `maxRetries` is an infinite retry violation.

**BAD:**
```json
{ "id": "upload", "retryable": true }
// No maxRetries — infinite loop
```

**GOOD:**
```json
{ "id": "upload", "retryable": true, "maxRetries": 3 }
```

### UTK006 — abandoned-recovery
When `abandonable: true`, the spec must declare where the user can resume.

**BAD:**
```json
{ "abandonable": true }
// No resumeFrom or recovery_entry
```

**GOOD:**
```json
{ "abandonable": true, "resumeFrom": "file-select" }
```

### UTK007 — step-actors
Every step needs an actor. Parallel steps need a group id.

**BAD:**
```json
{ "id": "upload", "type": "parallel" }
// No actor, no parallelGroup
```

**GOOD:**
```json
{ "id": "upload-chunk-1", "actor": "system", "type": "parallel", "parallelGroup": "chunk-upload" }
```

---

## Contract

A spec that passes all gates looks like the full example above. Key requirements:

- `version` declared
- At least one step with `actor="user"`
- All step ids are unique
- All steps have `order` with no gaps
- `completion_criteria` is non-empty with `description` on each entry
- At least one failure step or non-empty `failure_paths` array
- No `retryable:true` or `maxRetries` without `maxRetries <= 5`
- If `abandonable:true`, then `resumeFrom` or `recovery_entry` is declared

---

## What You Never Do

- Do not create steps with no `actor` — every step has an owner
- Do not set `retryable: true` without `maxRetries`
- Do not set `maxRetries > 5` — retry caps are a safety invariant
- Do not skip the failure path — every task can fail and must say so
- Do not gap the order sequence — delete steps cleanly or renumber
- Do not set `abandonable: true` without a recovery entry point
- Do not create parallel steps without a `parallelGroup` id
- Do not omit `completion_criteria` — tests are written from these
