---
name: ux-user-flow
description: Compiler skill for the ux-user-flow compiler. Activates when producing user-flow-artifact.json. Gates: UXF001–UXF009. Hard-fails when spec not found.
---

# ux-user-flow — Compiler Skill

## What This Compiler Does

Compiles the user flow graph specification — nodes (screen/decision/terminal/system), directed edges with triggers, entry nodes, terminal classification, dead-end detection, orphan detection, decision branch validation, finite path verification, and edge condition typing. Enforces a complete, navigable, terminating flow graph with no dead ends, no unreachable nodes, and explicit condition types on all decision branches.

**NOTE:** This compiler **hard-fails** (not skips) when `user-flow-spec.json` is missing.

**Upstream dependency:** none
**Output artifact:** `user-flow-artifact.json`
**IR identifier:** `UX_USER_FLOW:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "feature_id": "checkout",
  "entryNodes": ["cart"],
  "terminals": ["order-confirmed", "checkout-abandoned", "payment-failed-terminal"],
  "nodes": [
    { "id": "cart",                   "type": "screen",   "label": "Shopping Cart" },
    { "id": "address-check",          "type": "decision", "label": "Has saved address?" },
    { "id": "address-entry",          "type": "screen",   "label": "Enter Address" },
    { "id": "payment",                "type": "screen",   "label": "Payment" },
    { "id": "payment-check",          "type": "decision", "label": "Payment successful?" },
    { "id": "order-confirmed",        "type": "terminal", "terminalType": "success",   "label": "Order Confirmed" },
    { "id": "checkout-abandoned",     "type": "terminal", "terminalType": "abandoned", "label": "User Abandoned" },
    { "id": "payment-failed-terminal","type": "terminal", "terminalType": "failure",   "label": "Payment Failed" }
  ],
  "edges": [
    { "from": "cart",           "to": "address-check",          "trigger": "proceed-to-checkout" },
    { "from": "cart",           "to": "checkout-abandoned",     "trigger": "user-leaves" },
    { "from": "address-check",  "to": "payment",                "trigger": "has-address",       "conditionType": "data-state" },
    { "from": "address-check",  "to": "address-entry",          "trigger": "no-address",        "conditionType": "data-state" },
    { "from": "address-entry",  "to": "payment",                "trigger": "address-saved" },
    { "from": "payment",        "to": "payment-check",          "trigger": "submit-payment" },
    { "from": "payment-check",  "to": "order-confirmed",        "trigger": "payment-ok",        "conditionType": "system-event" },
    { "from": "payment-check",  "to": "payment-failed-terminal","trigger": "payment-declined",  "conditionType": "system-event" }
  ]
}
```

Required fields:
- `version` — string (required for contract gate)
- `nodes` — non-empty array, each with `id` and `type`
- `edges` — array, each with `from`, `to`, `trigger`
- `terminals` — non-empty array of terminal node ids
- `entryNodes` — non-empty array of entry node ids

---

## Gates

### UXF001 — spec-valid
Reads `user-flow-spec.json`. **Hard-fails** if not found. Required: `nodes`, `edges`, `terminals`, `entryNodes` (all arrays, all non-empty except edges). Each node needs `id` and `type`. Each edge needs `from`, `to`, `trigger`.

### UXF002 — terminal-nodes-classified
Every node id listed in `terminals` must:
1. Exist in the `nodes` array
2. Have `type: "terminal"`
3. Declare `terminalType` — one of: `"success"`, `"failure"`, `"abandoned"`, `"external"`, `"cancelled"`

BAD:
```json
{ "id": "done", "type": "screen" }
// Listed in terminals but type is "screen", not "terminal"
```
BAD: terminal node without `terminalType`.
GOOD:
```json
{ "id": "order-confirmed", "type": "terminal", "terminalType": "success" }
```

### UXF003 — no-dead-ends
Every node that is NOT a terminal must have at least one outgoing edge. A non-terminal node with zero outgoing edges leaves the user stuck.

BAD:
```json
{ "nodes": [{ "id": "payment", "type": "screen" }], "edges": [] }
// "payment" is not a terminal but has no outgoing edges
```
GOOD: every non-terminal node appears as `from` in at least one edge.

### UXF004 — no-orphan-nodes
Every node must be reachable from at least one entry node by following edges (BFS). Unreachable nodes cannot be encountered by real users. Escape hatch: `node.reachabilityExempt: true`.

BAD:
```json
{ "id": "secret-page", "type": "screen" }
// No path from any entryNode to "secret-page"
```
GOOD: every node reachable via BFS from `entryNodes`.

### UXF005 — decision-branches
Every node with `type: "decision"` must have at least 2 outgoing edges. A decision node with only 1 branch is not a decision — it's a passthrough or a missing branch.

BAD:
```json
{ "id": "auth-check", "type": "decision" }
// Only 1 outgoing edge
```
GOOD:
```json
// 2+ edges with from: "auth-check"
{ "from": "auth-check", "to": "dashboard", "trigger": "authenticated", "conditionType": "permission" },
{ "from": "auth-check", "to": "login",     "trigger": "not-authenticated", "conditionType": "permission" }
```

### UXF006 — edge-references-valid
Every edge's `from` and `to` must reference existing node ids. Dangling edges create undefined navigation.

BAD:
```json
{ "from": "payment", "to": "nonexistent-screen", "trigger": "submit" }
// "nonexistent-screen" not in nodes array
```
GOOD: all `from` and `to` values reference declared node ids.

### UXF007 — finite-paths
Every path from an entry node must eventually reach a terminal node. Nodes trapped in cycles with no exit to a terminal produce infinite loops. Escape hatch: `node.cyclicOk: true` for intentional loops (e.g., wizard retry).

BAD:
```json
// A → B → C → A with no way out to a terminal
```
GOOD: every cycle has at least one edge leaving the cycle toward a terminal.
GOOD: `{ "id": "retry-step", "cyclicOk": true }` for intentional retry loops.

### UXF008 — branch-conditions-typed
Every edge from a `decision` node must declare `conditionType`. Valid types: `"permission"`, `"data-state"`, `"experiment"`, `"user-choice"`, `"system-event"`, `"validation"`, `"feature-flag"`.

BAD:
```json
{ "from": "auth-check", "to": "dashboard", "trigger": "authenticated" }
// auth-check is a decision node but no conditionType
```
GOOD:
```json
{ "from": "auth-check", "to": "dashboard", "trigger": "authenticated", "conditionType": "permission" }
```

### UXF009 — contract-user-flow
Final contract check:
- `version` declared
- All node `id` values are unique
- At least one `success` terminal (terminal with `terminalType: "success"`)
- All `entryNodes` reference existing node ids

---

## What This Compiler Never Forgives

- `user-flow-spec.json` missing — **hard-fails** (UXF001)
- `nodes`, `edges`, `terminals`, or `entryNodes` missing (UXF001)
- `nodes` or `entryNodes` or `terminals` empty (UXF001)
- Node without `id` or `type` (UXF001)
- Edge without `from`, `to`, or `trigger` (UXF001)
- Terminal listed in `terminals` without `type: "terminal"` on the node (UXF002)
- Terminal node without `terminalType` (UXF002)
- Invalid `terminalType` value (UXF002)
- Non-terminal node with no outgoing edge — dead end (UXF003)
- Node unreachable from any entryNode — orphan (UXF004)
- Decision node with fewer than 2 outgoing edges (UXF005)
- Edge `from` or `to` referencing non-existent node (UXF006)
- Node in a cycle with no path to a terminal (UXF007)
- Edge from decision node without `conditionType` (UXF008)
- No `success` terminal in the flow (UXF009)
- Duplicate node ids (UXF009)
- `version` missing (UXF009)
