---
name: ux-sitemap
description: Compiler skill for the ux-sitemap compiler. Activates when producing sitemap-artifact.json. Gates: USM001–USM009. Hard-fails when spec not found (unlike most UX compilers).
---

# ux-sitemap — Compiler Skill

## What This Compiler Does

Compiles the information architecture sitemap — page nodes with routes, parent hierarchy, visibility rules, 404 handling, and root node count limits. Enforces: all node ids are unique, parent references are valid (no orphan parents), no circular parent chains, routes start with `/`, authenticated nodes declare non-public visibility, duplicate routes are blocked, no more than 10 root-level nodes (default), and a 404/not-found page is declared.

**NOTE:** This compiler **hard-fails** (not skips) when `sitemap-spec.json` is missing — unlike most UX compilers.

**Upstream dependency:** none
**Output artifact:** `sitemap-artifact.json`
**IR identifier:** `UX_SITEMAP:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "nodes": [
    { "id": "home",       "label": "Home",       "route": "/",               "parent": null },
    { "id": "dashboard",  "label": "Dashboard",  "route": "/dashboard",      "parent": null, "auth": true, "visibility": "authenticated" },
    { "id": "settings",   "label": "Settings",   "route": "/settings",       "parent": null, "auth": true, "visibility": "authenticated" },
    { "id": "profile",    "label": "Profile",    "route": "/settings/profile", "parent": "settings", "auth": true, "visibility": "authenticated" },
    { "id": "billing",    "label": "Billing",    "route": "/settings/billing", "parent": "settings", "auth": true, "visibility": "admin" },
    { "id": "not-found",  "label": "Not Found",  "route": "/404",            "parent": null, "type": "not-found" }
  ]
}
```

Required fields:
- `version` — string (required for contract gate)
- `nodes` — non-empty array, each with `id` (string), `label` (string), `route` (string)

---

## Gates

### USM001 — spec-valid
Reads `sitemap-spec.json`. **Hard-fails** if not found (does not skip). Required: `nodes` (non-empty array). Each node needs: `id` (string), `label` (string), `route` (string).

### USM002 — unique-ids
Every node `id` must be unique. Duplicate ids cause cross-reference failures in all downstream compilers.

BAD: two nodes with `id: "settings"`.
GOOD: all node ids are distinct strings.

### USM003 — orphan-nodes
Every node with a non-null `parent` must reference a `parent` id that exists in the nodes array. Root nodes (`parent: null` or no `parent` field) are always allowed.

BAD:
```json
{ "id": "profile", "parent": "settings" }
// "settings" does not exist in nodes array
```
GOOD:
```json
[
  { "id": "settings", "route": "/settings", "label": "Settings" },
  { "id": "profile",  "route": "/settings/profile", "label": "Profile", "parent": "settings" }
]
```

### USM004 — no-circular-parent
Following `parent` references must never form a cycle. A → B → C → A is a cycle and must be rejected.

BAD:
```json
[
  { "id": "a", "parent": "b" },
  { "id": "b", "parent": "a" }
]
// Circular: a → b → a
```
GOOD: parent chain always terminates at null.

### USM005 — valid-visibility
Every node that declares a `visibility` field must use a valid value: `"public"`, `"authenticated"`, or a non-empty role string. Nodes without `visibility` default to `"public"` (allowed).

BAD:
```json
{ "visibility": "" }
{ "visibility": null }
```
GOOD:
```json
{ "visibility": "public" }
{ "visibility": "authenticated" }
{ "visibility": "admin" }
```

### USM006 — route-format
Every node route must start with `/` and use valid URL path characters. Dynamic segments are allowed: `/users/:id`, `/items/[slug]`. Nodes marked `planned: true` are exempt.

BAD:
```json
{ "route": "dashboard" }
{ "route": "http://example.com/page" }
```
GOOD:
```json
{ "route": "/dashboard" }
{ "route": "/users/:id" }
{ "route": "/items/[slug]" }
```

### USM007 — root-node-limit
Root-level nodes (`parent: null` or `parent` absent) must not exceed `maxRootNodes` (default 10). Override with `spec.maxRootNodes` (integer). More than 10 top-level nav items indicates an IA problem.

BAD: 15 nodes with `parent: null` and no `maxRootNodes` override.
GOOD: ≤10 root nodes, or `"maxRootNodes": 15` explicitly declared.

### USM008 — not-found-declared
The sitemap must include a 404/not-found page node. Detection: `route: "/404"`, `route: "/not-found"`, `type: "not-found"`, or node `id` containing `"404"` or `"not-found"`. Escape hatch: `spec.notFoundHandledExternally: true`.

BAD: no node matching 404 detection, no `notFoundHandledExternally` flag.
GOOD:
```json
{ "id": "not-found", "route": "/404", "label": "Not Found", "type": "not-found" }
```

### USM009 — contract-sitemap
Final contract check:
- `version` declared
- Nodes with `auth: true` must have `visibility` set to something other than `"public"`
- No duplicate routes (except `planned: true` nodes)

BAD: `{ "auth": true, "visibility": "public" }` — authenticated node with public visibility.
BAD: two nodes both with `route: "/dashboard"`.

---

## What This Compiler Never Forgives

- `sitemap-spec.json` missing — **hard-fails** (USM001, unlike most UX compilers)
- `nodes` array missing or empty (USM001)
- Any node missing `id`, `label`, or `route` (USM001)
- Duplicate node ids (USM002)
- `parent` referencing non-existent node (USM003)
- Circular parent chain (USM004)
- Empty string or null `visibility` (USM005)
- Route not starting with `/` (USM006)
- More than `maxRootNodes` root-level nodes (USM007)
- No 404/not-found node declared (USM008)
- `auth:true` node with `visibility: "public"` (USM009)
- Duplicate routes (USM009)
- `version` missing (USM009)
