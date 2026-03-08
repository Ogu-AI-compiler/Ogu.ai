# UX Sitemap Compiler

**Role:** Validate and attest the product sitemap — the canonical inventory of every screen in the application.

---

## Your Output

Produce `sitemap-spec.json` (phase 0 input) and compile it to `sitemap-artifact.json` (phase 4 output).

```
sitemap-spec.json         ← authored by UX designer
sitemap-artifact.json     ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "maxRootNodes": 10,
  "notFoundHandledExternally": false,
  "nodes": [
    {
      "id": "home",
      "label": "Home",
      "route": "/",
      "parent": null,
      "visibility": "public"
    },
    {
      "id": "dashboard",
      "label": "Dashboard",
      "route": "/dashboard",
      "parent": null,
      "visibility": "authenticated",
      "auth": true
    },
    {
      "id": "dashboard-analytics",
      "label": "Analytics",
      "route": "/dashboard/analytics",
      "parent": "dashboard",
      "visibility": "authenticated"
    },
    {
      "id": "settings",
      "label": "Settings",
      "route": "/settings",
      "parent": null,
      "visibility": "authenticated",
      "auth": true
    },
    {
      "id": "not-found",
      "label": "Page Not Found",
      "route": "/404",
      "parent": null,
      "visibility": "public",
      "type": "not-found"
    }
  ]
}
```

### Required fields per node

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier. Used by all downstream compilers as a screen reference. |
| `label` | string | Human-readable name. Must be non-empty. |
| `route` | string | URL path. Must start with `/`. Use `:param` or `[param]` for dynamic segments. |
| `parent` | string\|null | Parent node id for tree structure. `null` = root node. |
| `visibility` | string | `"public"`, `"authenticated"`, or a named role. Optional (defaults to `"public"`). |

### Optional fields per node

| Field | Type | Description |
|-------|------|-------------|
| `auth` | boolean | `true` if this route requires authentication. When `true`, visibility must not be `"public"`. |
| `planned` | boolean | `true` for future screens. Route format check is relaxed for planned nodes. |
| `type` | string | `"not-found"` for the 404 screen. |

### Spec-level fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Sitemap version (e.g. `"1.0.0"`). Required. |
| `maxRootNodes` | number | Override for root node limit. Default: 10. |
| `notFoundHandledExternally` | boolean | Set `true` if 404 is handled by the hosting provider. |

---

## Hard Gates

### USM001 — spec-valid
`sitemap-spec.json` must exist with a `nodes` array where every node has `id`, `label`, `route`.

**BAD:**
```json
{ "nodes": [{ "id": "home" }] }
```
**GOOD:**
```json
{ "nodes": [{ "id": "home", "label": "Home", "route": "/" }] }
```

### USM002 — unique-ids
All node `id` values must be unique.

**BAD:**
```json
{ "nodes": [{ "id": "home", ... }, { "id": "home", ... }] }
```

### USM003 — orphan-nodes
Every non-root node's `parent` must reference an existing node id.

**BAD:**
```json
{ "nodes": [{ "id": "settings-profile", "parent": "settings", ... }] }
// "settings" does not exist in the node list
```

### USM004 — no-circular-parent
Parent chains must terminate at a root (parent=null). Cycles are rejected.

**BAD:**
```json
{ "nodes": [
  { "id": "A", "parent": "B" },
  { "id": "B", "parent": "A" }
]}
```

### USM005 — valid-visibility
`visibility` must be `"public"`, `"authenticated"`, or a named role.

**BAD:**
```json
{ "id": "admin", "auth": true, "visibility": "public" }
```
**GOOD:**
```json
{ "id": "admin", "auth": true, "visibility": "admin" }
```

### USM008 — not-found-declared
The sitemap must contain a 404/not-found node OR set `notFoundHandledExternally: true`.

**GOOD:**
```json
{ "id": "not-found", "route": "/404", "type": "not-found", ... }
```

---

## Contract

A compliant sitemap that passes all gates:

```json
{
  "version": "1.0.0",
  "nodes": [
    { "id": "home",     "label": "Home",       "route": "/",         "parent": null, "visibility": "public" },
    { "id": "login",    "label": "Login",       "route": "/login",    "parent": null, "visibility": "public" },
    { "id": "app",      "label": "Dashboard",   "route": "/app",      "parent": null, "visibility": "authenticated", "auth": true },
    { "id": "app-settings", "label": "Settings","route": "/app/settings", "parent": "app", "visibility": "authenticated" },
    { "id": "not-found","label": "Not Found",   "route": "/404",      "parent": null, "visibility": "public", "type": "not-found" }
  ]
}
```

---

## What You Never Do

- Do not use duplicate node IDs — every `id` must be unique across the entire sitemap
- Do not create parent references that form a cycle
- Do not set `auth: true` with `visibility: "public"` — that is an access-control contradiction
- Do not leave authenticated routes without a declared `visibility`
- Do not create a sitemap without a 404/not-found node unless `notFoundHandledExternally: true`
- Do not omit the `version` field from the spec
- Do not use routes that don't start with `/` (except `planned: true` nodes)
