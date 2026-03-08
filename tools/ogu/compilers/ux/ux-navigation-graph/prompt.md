# UX Navigation Graph Compiler

**Role:** Validate the navigation logic graph — the machine-checkable model of how users move between screens, what guards protect each route, and that no paths trap the user.

---

## Your Output

```
navigation-spec.json       ← authored by UX designer
navigation-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "notFoundHandledExternally": false,
  "fallbackNode": null,
  "entryPoints": ["login", "home"],
  "nodes": [
    {
      "id": "home",
      "visibility": "public",
      "transitions": [
        { "to": "dashboard", "trigger": "click" },
        { "to": "login",     "trigger": "click" }
      ]
    },
    {
      "id": "login",
      "visibility": "public",
      "transitions": [
        { "to": "dashboard", "trigger": "submit" }
      ]
    },
    {
      "id": "dashboard",
      "auth": true,
      "visibility": "authenticated",
      "guard": { "type": "auth", "redirectTo": "/login" },
      "redirectOnFail": "login",
      "transitions": [
        { "to": "settings",  "trigger": "click" },
        { "to": "home",      "trigger": "click" }
      ]
    },
    {
      "id": "settings",
      "auth": true,
      "visibility": "authenticated",
      "guard": { "type": "auth", "redirectTo": "/login" },
      "redirectOnFail": "login",
      "transitions": [
        { "to": "dashboard", "trigger": "click" }
      ]
    },
    {
      "id": "not-found",
      "type": "not-found",
      "visibility": "public",
      "transitions": [
        { "to": "home", "trigger": "click" }
      ]
    }
  ]
}
```

### Required fields per node

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique node identifier. |
| `transitions` | array | List of outgoing transitions: `{ to: string, trigger: string }`. |

### Optional fields per node

| Field | Type | Description |
|-------|------|-------------|
| `auth` | boolean | Whether this node requires authentication. |
| `visibility` | string | `"public"`, `"authenticated"`, or role name. |
| `guard` | object\|string | Access control guard declaration. Required when auth=true or visibility != public. |
| `redirectOnFail` | string | Node id to redirect to when guard fails. |
| `type` | string | `"not-found"` for the 404 node. |
| `deepLinkOnly` | boolean | Node reachable only via deep link, not in-app navigation. Exempts from back-path check. |
| `reachabilityExempt` | boolean | Node is intentionally unreachable from nav (e.g. modal overlay). Exempts from reachability check. |
| `cyclicOk` | boolean | Node participates in a deliberate cycle (e.g. wizard loop). Exempts SCC from trap detection. |

---

## Hard Gates

### UNG003 — no-orphan-routes
Every node must be reachable from at least one entry point via BFS.

**BAD:** Node `"profile"` exists but no other node transitions to it and it is not an entry point.

### UNG004 — guards-declared
Every node with `auth=true` or `visibility != "public"` must declare `guard` or `redirectOnFail`.

**BAD:**
```json
{ "id": "admin", "auth": true, "visibility": "admin" }
// no guard or redirectOnFail declared
```
**GOOD:**
```json
{ "id": "admin", "auth": true, "visibility": "admin", "redirectOnFail": "login" }
```

### UNG008 — no-cyclic-trap
Strongly connected components of size > 1 must have at least one exit.

**BAD:**
```json
{ "id": "A", "transitions": [{ "to": "B", "trigger": "click" }] },
{ "id": "B", "transitions": [{ "to": "A", "trigger": "click" }] }
// A and B form a closed cycle — user is trapped
```
**GOOD:** Add a transition from A or B to a node outside the cycle.

---

## Contract (Gold Standard)

A minimal compliant navigation spec with login, dashboard, and 404:

```json
{
  "version": "1.0.0",
  "entryPoints": ["login"],
  "nodes": [
    {
      "id": "login",
      "visibility": "public",
      "transitions": [
        { "to": "dashboard", "trigger": "submit" }
      ]
    },
    {
      "id": "dashboard",
      "auth": true,
      "visibility": "authenticated",
      "redirectOnFail": "login",
      "transitions": [
        { "to": "login", "trigger": "click" }
      ]
    },
    {
      "id": "not-found",
      "type": "not-found",
      "visibility": "public",
      "transitions": [
        { "to": "login", "trigger": "click" }
      ]
    }
  ]
}
```

---

## What You Never Do

- Do not declare a protected node without a `guard` or `redirectOnFail`
- Do not create unreachable nodes without `reachabilityExempt: true`
- Do not create closed cycles without `cyclicOk: true` on at least one cycle node
- Do not set `auth: true` without declaring `visibility`
- Do not leave transitions without a `trigger` type
- Do not omit the 404/not-found node unless `notFoundHandledExternally: true`
- Do not duplicate node ids within the graph
