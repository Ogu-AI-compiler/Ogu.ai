---
name: publishing-workflow-spec
description: Compiler skill for the publishing-workflow-spec compiler. Activates when producing publishing-workflow-artifact.json. Gates: PWS001–PWS007 + no-todos. Hard-fails when spec missing.
---

# publishing-workflow-spec — Compiler Skill

## What This Compiler Does

Compiles publishing workflow state machine definitions — validates spec structure (states, initialState, roles), requires draft and published states to exist, ensures the published state has an archive/unpublish exit path, detects unreachable states via BFS from initialState, requires at least one terminal state, validates that role references in transitions point to defined roles, and blocks direct draft-to-published transitions without a review step.

**Upstream dependency:** none
**Output artifact:** `publishing-workflow-artifact.json`
**IR identifier:** `PUBLISHING_WORKFLOW:{project}`

---

## Spec Shape

**`publishing-workflow-spec.spec.json`**:
```json
{
  "initialState": "draft",
  "states": [
    {
      "id": "draft",
      "transitions": {
        "submit": "in-review"
      },
      "allowedRoles": ["author", "editor"]
    },
    {
      "id": "in-review",
      "transitions": {
        "approve": "published",
        "reject":  "draft"
      },
      "transitionRoles": {
        "approve": ["editor", "publisher"],
        "reject":  ["editor", "publisher"]
      }
    },
    {
      "id": "published",
      "terminal": true,
      "transitions": {
        "unpublish": "archived"
      }
    },
    {
      "id": "archived",
      "terminal": true,
      "transitions": {}
    }
  ],
  "roles": {
    "author":    { "description": "Creates content" },
    "editor":    { "description": "Reviews and edits" },
    "publisher": { "description": "Approves for publication" }
  }
}
```

Required fields:
- `states` — non-empty array, each with `id` and `transitions`
- `initialState` — string
- `roles` — object

---

## Gates

### PWS001 — spec-valid
Reads `publishing-workflow-spec.spec.json`. Hard-fails if missing. Required: `states` non-empty array, `initialState` string, `roles` object. Each state must have `id` and `transitions`.

BAD: spec missing or `states: []` or any state without `id` or `transitions`.
GOOD: all three top-level fields present, each state has `id` and `transitions`.

### PWS002 — states-complete
Workflow must include both `draft` and `published` states. Every publishing workflow requires these two anchor states at minimum.

BAD:
```json
{ "states": [
  { "id": "new",  "transitions": { "publish": "live" } },
  { "id": "live", "transitions": {} }
] }
// No "draft" or "published" states — workflow missing required anchors
```
GOOD: `states` array contains entries with `id: "draft"` and `id: "published"`.

### PWS003 — published-has-archive
The `published` state must have a transition to an archive, unpublish, or retirement state. Content cannot be permanently stuck in published without an off-ramp.

BAD:
```json
{ "id": "published", "transitions": { "update": "draft" } }
// No path to archived/unpublished — published content can never be taken down
```
GOOD:
```json
{
  "id": "published",
  "transitions": {
    "unpublish": "archived",
    "update":    "draft"
  }
}
```

### PWS004 — no-unreachable-states
All states must be reachable from `initialState` via BFS traversal of transitions. Unreachable states indicate dead workflow branches that can never be entered.

BAD:
```json
{
  "initialState": "draft",
  "states": [
    { "id": "draft",     "transitions": { "submit": "in-review" } },
    { "id": "in-review", "transitions": { "approve": "published" } },
    { "id": "published", "transitions": { "archive": "archived" } },
    { "id": "archived",  "transitions": {} },
    { "id": "embargo",   "transitions": { "release": "published" } }
  ]
}
// "embargo" is unreachable from "draft" — no transition leads to it
```
GOOD: Every state has at least one path leading to it from `initialState`.

### PWS005 — terminal-state-exists
Workflow must have at least one terminal state. Terminal states are identified by `terminal: true` or by conventional IDs: `published`, `archived`, `live`, `removed`.

BAD:
```json
{ "states": [
  { "id": "draft",      "transitions": { "submit": "in-review" } },
  { "id": "in-review",  "transitions": { "approve": "draft" } }
] }
// No terminal state — workflow loops forever
```
GOOD:
```json
{
  "id": "archived",
  "terminal": true,
  "transitions": {}
}
```

### PWS006 — role-transitions-valid
Roles referenced in `state.allowedRoles` and `state.transitionRoles` must be defined in `spec.roles`. Undefined role references break authorization enforcement.

BAD:
```json
{
  "roles": { "author": {}, "editor": {} },
  "states": [{
    "id": "in-review",
    "transitionRoles": { "approve": ["publisher"] }
  }]
}
// "publisher" not in spec.roles
```
GOOD: All roles referenced in states are declared in `spec.roles`.

### PWS007 — no-direct-draft-to-published
The `draft` state must not transition directly to `published` — an intermediate review/approval step is required. This prevents unreviewed content from being published.

BAD:
```json
{
  "id": "draft",
  "transitions": { "publish": "published" }
}
// Draft bypasses review and goes straight to published
```
GOOD:
```json
{
  "id": "draft",
  "transitions": { "submit": "in-review" }
}
```
Escape: `allowDirectPublish: true` in spec root (deliberate policy for internal tools or wikis).

### PWS008 — no-todos
No `TODO`, `FIXME`, `HACK`, or `XXX` in `.json`, `.yaml`, `.yml` files.

---

## What This Compiler Never Forgives

- `publishing-workflow-spec.spec.json` missing (PWS001 hard-fails)
- `states`, `initialState`, or `roles` missing (PWS001)
- Any state missing `id` or `transitions` (PWS001)
- `draft` or `published` state not present (PWS002)
- `published` state has no archive/unpublish transition (PWS003)
- Any state unreachable from `initialState` (PWS004)
- No terminal state in the workflow (PWS005)
- Transition or state references an undefined role (PWS006)
- `draft` transitions directly to `published` without `allowDirectPublish: true` (PWS007)
- TODO/FIXME/HACK/XXX anywhere (PWS008)
