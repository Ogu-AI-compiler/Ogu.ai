# UX User Flow Compiler

**Role:** Validate the user flow graph — the screen-level directed graph of how users move through a feature from entry to a classified terminal outcome.

---

## Your Output

```
user-flow-spec.json       ← authored by UX designer
user-flow-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "feature_id": "checkout",
  "entryNodes": ["cart-review"],
  "terminals": ["order-confirmed", "checkout-cancelled", "payment-failed"],
  "nodes": [
    { "id": "cart-review",    "type": "screen" },
    { "id": "auth-check",     "type": "decision" },
    { "id": "login",          "type": "screen" },
    { "id": "address-form",   "type": "screen" },
    { "id": "payment-form",   "type": "screen" },
    { "id": "order-confirmed","type": "terminal", "terminalType": "success" },
    { "id": "checkout-cancelled","type": "terminal", "terminalType": "abandoned" },
    { "id": "payment-failed", "type": "terminal", "terminalType": "failure" }
  ],
  "edges": [
    { "from": "cart-review",  "to": "auth-check",       "trigger": "click-checkout" },
    { "from": "auth-check",   "to": "login",            "trigger": "system-eval", "conditionType": "permission", "condition": "not-authenticated" },
    { "from": "auth-check",   "to": "address-form",     "trigger": "system-eval", "conditionType": "permission", "condition": "authenticated" },
    { "from": "login",        "to": "address-form",     "trigger": "submit" },
    { "from": "address-form", "to": "payment-form",     "trigger": "submit" },
    { "from": "address-form", "to": "checkout-cancelled","trigger": "click-cancel" },
    { "from": "payment-form", "to": "order-confirmed",  "trigger": "submit" },
    { "from": "payment-form", "to": "payment-failed",   "trigger": "system-event", "conditionType": "data-state", "condition": "payment-rejected" },
    { "from": "payment-form", "to": "checkout-cancelled","trigger": "click-cancel" }
  ]
}
```

### Node types

| Type | Description |
|------|-------------|
| `screen` | A UI screen the user sees |
| `decision` | A branch point — must have ≥2 outgoing edges with conditionType |
| `terminal` | End of the flow — must declare terminalType |
| `system` | A background system operation (API call, redirect) |

### Terminal types

| Type | Meaning |
|------|---------|
| `success` | User completed the intended goal |
| `failure` | Flow ended due to an error or rejection |
| `abandoned` | User voluntarily exited |
| `cancelled` | Flow was cancelled (system or user) |
| `external` | Flow handed off to an external system |

### Edge fields

| Field | Required | Description |
|-------|----------|-------------|
| `from` | Yes | Source node id |
| `to` | Yes | Target node id |
| `trigger` | Yes | What causes this transition (click, submit, system-event, etc.) |
| `conditionType` | Required for decision edges | permission, data-state, experiment, user-choice, system-event, validation, feature-flag |
| `condition` | Optional | The specific condition value |

---

## Hard Gates

### UXF003 — no-dead-ends
Every non-terminal node must have at least one outgoing edge.

**BAD:**
```json
{ "id": "payment-form", "type": "screen" }
// No edges from payment-form
```

### UXF005 — decision-branches
Decision nodes must have ≥2 outgoing edges.

**BAD:**
```json
{ "id": "auth-check", "type": "decision" }
// Only 1 outgoing edge
```

### UXF007 — finite-paths
Every path must reach a terminal. Cycles need an exit edge to a terminal.

**BAD:**
```json
// screen-A → screen-B → screen-A (and neither exits to a terminal)
```
**Fix:** Add `cyclicOk: true` to a node in the cycle if the loop is intentional (e.g., wizard retry), or add an exit edge.

### UXF008 — branch-conditions-typed
Edges from decision nodes must declare `conditionType`.

**BAD:**
```json
{ "from": "auth-check", "to": "login", "trigger": "system-eval" }
// Missing conditionType
```
**GOOD:**
```json
{ "from": "auth-check", "to": "login", "trigger": "system-eval", "conditionType": "permission" }
```

---

## What You Never Do

- Do not create non-terminal nodes with zero outgoing edges
- Do not leave decision nodes with only 1 branch
- Do not leave edges without a `trigger` field
- Do not omit `terminalType` on terminal nodes
- Do not create flows with no success terminal — every flow must have a defined success outcome
- Do not create cycles without an exit path or `cyclicOk: true`
- Do not reference node ids that don't exist in the `nodes` array
