---
name: ux-task-flow
description: Compiler skill for the ux-task-flow compiler. Activates when producing task-flow-artifact.json. Gates: UTK001–UTK008. No upstream dependency.
---

# ux-task-flow — Compiler Skill

## What This Compiler Does

Compiles the task flow specification — sequential steps with explicit ordering, completion criteria, failure/cancellation paths, bounded retry caps, abandonment recovery, and per-step actor declarations. Enforces: step order is sequential (no gaps), completion criteria are non-empty with descriptions, at least one failure or cancellation path exists, retry is always bounded (≤5), parallel steps declare a group, and every step declares its actor (user/system/both).

**Upstream dependency:** none
**Output artifact:** `task-flow-artifact.json`
**IR identifier:** `UX_TASK_FLOW:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "task_id": "checkout-flow",
  "abandonable": true,
  "resumeFrom": "payment-step",
  "steps": [
    {
      "id": "cart-review",
      "order": 1,
      "type": "user-action",
      "actor": "user",
      "description": "User reviews cart contents and proceeds"
    },
    {
      "id": "payment-step",
      "order": 2,
      "type": "user-action",
      "actor": "user",
      "retryable": true,
      "maxRetries": 3,
      "description": "User enters payment details"
    },
    {
      "id": "process-payment",
      "order": 3,
      "type": "system",
      "actor": "system",
      "description": "System processes payment with gateway"
    },
    {
      "id": "confirmation",
      "order": 4,
      "type": "success",
      "actor": "system",
      "description": "System shows order confirmation"
    },
    {
      "id": "payment-failed",
      "order": 5,
      "type": "failure",
      "actor": "system",
      "description": "System shows payment failure with retry option"
    }
  ],
  "completion_criteria": [
    { "description": "Payment successfully processed" },
    { "description": "Order confirmation email sent" }
  ],
  "failure_paths": [
    { "trigger": "payment declined", "outcome": "Show retry dialog" }
  ]
}
```

Required fields:
- `version` — string (required for contract gate)
- `task_id` — non-empty string
- `steps` — non-empty array
- `completion_criteria` — array

---

## Gates

### UTK001 — spec-valid
Reads `task-flow-spec.json`. Required: `task_id` (non-empty string), `steps` (non-empty array), `completion_criteria` (array).

### UTK002 — step-order
Steps must have unique sequential `order` integers with no gaps. Valid sequences: `0,1,2,…` or `1,2,3,…`. Gaps and duplicates are violations.

BAD:
```json
{ "steps": [
  { "id": "a", "order": 1 },
  { "id": "b", "order": 3 }
] }
// Gap: missing order 2
```
BAD:
```json
{ "steps": [
  { "id": "a", "order": 1 },
  { "id": "b", "order": 1 }
] }
// Duplicate order value
```
GOOD:
```json
{ "steps": [
  { "id": "a", "order": 1 },
  { "id": "b", "order": 2 },
  { "id": "c", "order": 3 }
] }
```

### UTK003 — completion-criteria
`completion_criteria` must be non-empty and each criterion must have a `description` (non-empty string). A task flow without completion criteria has no definition of done.

BAD:
```json
{ "completion_criteria": [] }
// Empty array
```
BAD:
```json
{ "completion_criteria": [{}] }
// Missing description
```
GOOD:
```json
{ "completion_criteria": [
  { "description": "Payment processed successfully" },
  { "description": "Confirmation email sent" }
] }
```

### UTK004 — failure-paths
At least one failure or cancellation path must exist. Either:
- A step with `type: "failure"` or `type: "cancellation"`, OR
- A non-empty `failure_paths` array at spec level

BAD: all steps are `type: "user-action"` or `type: "system"` — no failure path.
GOOD:
```json
{ "steps": [{ "id": "fail", "order": 5, "type": "failure", "actor": "system", "description": "Payment failed" }] }
```
GOOD:
```json
{ "failure_paths": [{ "trigger": "payment declined", "outcome": "Show retry" }] }
```

### UTK005 — retry-cap
Steps with `retryable: true` or `retry: true` must declare `maxRetries` (integer, ≤5). Infinite retry is forbidden.

BAD:
```json
{ "retryable": true }
// No maxRetries — infinite retry
```
BAD:
```json
{ "retryable": true, "maxRetries": 10 }
// Exceeds cap of 5
```
GOOD:
```json
{ "retryable": true, "maxRetries": 3 }
```

### UTK006 — abandoned-recovery
When `spec.abandonable: true`, spec must declare either `resumeFrom` (string step id) or `recovery_entry` (string screen/route). Escape hatch: `spec.abandonmentNotApplicable: true`.

BAD:
```json
{ "abandonable": true }
// No resumeFrom or recovery_entry
```
GOOD:
```json
{ "abandonable": true, "resumeFrom": "payment-step" }
{ "abandonable": true, "recovery_entry": "/checkout/resume" }
```

### UTK007 — step-actors
Every step must declare `actor`: `"user"`, `"system"`, or `"both"`. Parallel steps (`type: "parallel"`) must also declare `parallelGroup` (non-empty string).

BAD:
```json
{ "id": "process", "order": 3, "type": "system" }
// Missing actor field
```
BAD:
```json
{ "id": "parallel-step", "type": "parallel", "actor": "system" }
// Missing parallelGroup
```
GOOD:
```json
{ "id": "process", "order": 3, "type": "system", "actor": "system" }
{ "id": "parallel-step", "type": "parallel", "actor": "both", "parallelGroup": "email-notifications" }
```

### UTK008 — contract-task-flow
Final contract check:
- `version` declared
- All step `id` values unique (where ids are declared)
- At least one step with `actor: "user"`

---

## What This Compiler Never Forgives

- `task-flow-spec.json` missing — gate skipped (soft, not hard-fail)
- `task_id`, `steps`, or `completion_criteria` missing (UTK001)
- Steps array empty (UTK001)
- Step without integer `order` field (UTK002)
- Duplicate or non-sequential `order` values (UTK002)
- Order not starting at 0 or 1 (UTK002)
- `completion_criteria` empty or criterion without `description` (UTK003)
- No failure/cancellation step or `failure_paths` (UTK004)
- `retryable:true` or `retry:true` without `maxRetries` (UTK005)
- `maxRetries > 5` (UTK005)
- `abandonable:true` without `resumeFrom` or `recovery_entry` (UTK006)
- Step missing `actor` field (UTK007)
- Parallel step without `parallelGroup` (UTK007)
- `version` missing (UTK008)
