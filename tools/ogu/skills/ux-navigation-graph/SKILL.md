---
name: ux-navigation-graph
description: Compiler skill for the ux-navigation-graph compiler. Activates when producing navigation-graph-artifact.json. Gates: UNG001–UNG009. HARD FAILS when spec missing (unlike other UX compilers).
---

# ux-navigation-graph — Compiler Skill

## What This Compiler Does

Compiles the navigation graph specification — nodes, entry points, protected routes, reachability, 404 handling, and cycle detection. IMPORTANT: this compiler hard-fails (not skips) when `navigation-spec.json` is missing. Enforces: all entry points reference valid nodes, BFS reachability from entry points, protected nodes have guards, non-entry nodes have incoming transitions, all transition targets exist, 404 node declared, no cyclic traps (Tarjan SCC).

**Upstream dependency:** none
**Output artifact:** `navigation-graph-artifact.json`
**IR identifier:** `NAVIGATION_GRAPH:{project}`

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "nodes": [
    { "id": "home", "route": "/", "auth": false, "type": "screen" },
    { "id": "dashboard", "route": "/dashboard", "auth": true, "visibility": "authenticated", "guard": "auth-guard", "redirectOnFail": "/login" },
    { "id": "not-found", "route": "/404", "type": "not-found" }
  ],
  "entryPoints": ["home"],
  "transitions": [
    { "from": "home", "to": "dashboard", "trigger": { "type": "navigate" } }
  ]
}
```

Required fields:
- `nodes` — non-empty array (hard-fail if missing)
- `entryPoints` — non-empty array (hard-fail if missing)

---

## Gates

### UNG001 — spec-valid
Reads `navigation-spec.json`. **HARD FAILS** (not skips) when file not found — unlike other UX compilers. Required: `nodes` (non-empty array), `entryPoints` (non-empty array).

### UNG002 — entry-points-valid
All `entryPoints` must reference existing node ids. Entry points pointing to non-existent nodes create broken navigation.

BAD:
```json
{ "entryPoints": ["home", "nonexistent-page"], "nodes": [{ "id": "home" }] }
// "nonexistent-page" not in nodes
```
GOOD: Every entry point id matches a node id.

### UNG003 — all-nodes-reachable
Every node must be reachable from at least one entry point via BFS over `transitions`. Unreachable nodes cannot be navigated to. Escape hatch: `node.deepLinkOnly: true`.

BAD: Node `settings` exists but no transition leads to it from any entry point.
GOOD: All nodes are reachable, or `deepLinkOnly: true` explicitly marks deep-link-only nodes.

### UNG004 — protected-nodes-guarded
Nodes with `auth: true` or `visibility` not equal to `"public"` must declare either `guard` (string) or `redirectOnFail` (string). Protected nodes without guards are silently accessible.

BAD:
```json
{ "id": "admin", "auth": true }
// no guard and no redirectOnFail
```
GOOD:
```json
{ "id": "admin", "auth": true, "guard": "admin-guard", "redirectOnFail": "/403" }
```

### UNG005 — no-isolated-nodes
Every non-entry-point node must have at least one incoming transition. Nodes with no incoming transitions cannot be reached through normal navigation. Escape hatch: `node.deepLinkOnly: true`.

BAD: Node `profile` has no incoming transitions and is not an entry point.
GOOD: Node has an incoming transition, or `deepLinkOnly: true`.

### UNG006 — transition-targets-valid
All `transition.to` values must reference existing node ids. Dangling transition targets create broken links.

BAD:
```json
{ "from": "home", "to": "deleted-page" }
// "deleted-page" not in nodes
```

### UNG007 — not-found-declared
A 404/not-found node must exist. Identified by: `route: "/404"` or `"/not-found"`, `type: "not-found"`, or `id` containing `"404"` or `"not-found"`. Escape hatch: `spec.notFoundHandledExternally: true`.

BAD: No 404 node in the spec and `notFoundHandledExternally` not set.
GOOD:
```json
{ "id": "not-found", "route": "/404", "type": "not-found" }
// OR
{ "notFoundHandledExternally": true }
```

### UNG008 — no-cyclic-traps
Uses Tarjan SCC algorithm to find strongly connected components with no exit path. Cyclic traps mean users can get stuck. Escape hatch: `node.cyclicOk: true` for intentional loops (wizard retry).

BAD: Nodes A → B → A with no exit transition from A or B.
GOOD: Cycles always have an exit transition to a non-cyclic node, or `cyclicOk: true`.

### UNG009 — contract-navigation
Final contract check: `version` declared, unique node ids, all transitions have `trigger.type` declared.

---

## What This Compiler Never Forgives

- `navigation-spec.json` missing — **HARD FAIL** (unlike other UX compilers) (UNG001)
- `nodes` or `entryPoints` missing (UNG001)
- Entry point references non-existent node (UNG002)
- Node unreachable from any entry point (without `deepLinkOnly: true`) (UNG003)
- Protected node (`auth: true` or non-public `visibility`) without `guard` or `redirectOnFail` (UNG004)
- Non-entry node with no incoming transitions (without `deepLinkOnly: true`) (UNG005)
- `transition.to` references non-existent node (UNG006)
- No 404/not-found node (without `notFoundHandledExternally: true`) (UNG007)
- Cyclic trap (SCC with no exit) without `cyclicOk: true` (UNG008)
- `version` missing or duplicate node ids (UNG009)
