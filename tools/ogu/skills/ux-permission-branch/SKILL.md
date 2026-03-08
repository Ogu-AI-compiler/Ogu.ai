---
name: ux-permission-branch
description: Compiler skill for the ux-permission-branch compiler. Activates when producing permission-branch-artifact.json. Gates: UPB001–UPB008. No upstream dependency.
---

# ux-permission-branch — Compiler Skill

## What This Compiler Does

Compiles the UI permission branching specification — role definitions, per-role restrictions, denied state messaging, protected action coverage, conflict detection, and multi-role resolution strategy. Enforces: every role has at least one branch, hide/disable restrictions declare a denied state or redirect, autoConfirm never bypasses restrictions, protected actions are covered by at least one branch, no contradictory restrictions for the same role+target, and valid redirectTo format.

**Upstream dependency:** none
**Output artifact:** `permission-branch-artifact.json`
**IR identifier:** `UX_PERMISSION_BRANCH:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "roles": [
    { "id": "admin", "label": "Administrator" },
    { "id": "viewer", "label": "Read-Only Viewer" },
    { "id": "editor", "label": "Editor" }
  ],
  "branches": [
    {
      "roleId": "viewer",
      "restrictions": [
        {
          "targetId": "edit-button",
          "type": "hide",
          "deniedMessage": "You need editor access to modify this content."
        },
        {
          "targetId": "delete-action",
          "type": "hide",
          "redirectTo": "/access-denied"
        }
      ]
    },
    {
      "roleId": "editor",
      "restrictions": [
        {
          "targetId": "admin-panel",
          "type": "disable",
          "deniedMessage": "Admin panel requires administrator access."
        }
      ]
    },
    {
      "roleId": "admin",
      "restrictions": []
    }
  ],
  "protectedActions": ["edit-button", "delete-action", "admin-panel"],
  "multiRoleResolution": "most-restrictive"
}
```

Required fields:
- `version` — string (required for contract gate)
- `roles` — non-empty array, each with `id` (string)
- `branches` — non-empty array, each with `roleId` (string) and `restrictions` (array)

---

## Gates

### UPB001 — spec-valid
Reads `permission-branch-spec.json`. Required: `roles` (non-empty array, each with `id`), `branches` (non-empty array, each with `roleId` and `restrictions` array).

### UPB002 — roles-covered
Every role in `spec.roles` must have at least one corresponding entry in `spec.branches` where `branch.roleId` matches the role id. Roles without any branch have undefined permission behavior.

BAD:
```json
{
  "roles": [{ "id": "admin" }, { "id": "viewer" }],
  "branches": [{ "roleId": "admin", "restrictions": [] }]
  // "viewer" role has no branch
}
```
GOOD: every role id appears as a `roleId` in at least one branch.

### UPB003 — denied-state
Every restriction with `type: "hide"` or `type: "disable"` must declare either `deniedMessage` (non-empty string) or `redirectTo` (non-empty string). Escape hatch: `restriction.silentDeny: true`.

BAD:
```json
{ "targetId": "edit-button", "type": "hide" }
// No deniedMessage or redirectTo — user doesn't know why element is hidden
```
GOOD:
```json
{ "targetId": "edit-button", "type": "hide", "deniedMessage": "Editor access required." }
```
GOOD (silent):
```json
{ "targetId": "secret-feature", "type": "hide", "silentDeny": true }
```

### UPB004 — no-unprotected-paths
When `spec.protectedActions` is declared, every action id in that array must appear as `targetId` in at least one branch restriction. Actions in `protectedActions` not covered by any branch are effectively open to all roles.

BAD:
```json
{
  "protectedActions": ["delete-action"],
  "branches": [{ "roleId": "viewer", "restrictions": [] }]
  // "delete-action" listed as protected but no branch restricts it
}
```
GOOD: every `protectedActions` entry appears as a `targetId` in some restriction.

### UPB005 — role-conflicts
No two restrictions for the same `roleId` and `targetId` may have contradictory types:
- `hide` and `show` for the same target+role
- `enable` and `disable` for the same target+role

BAD:
```json
{
  "roleId": "editor",
  "restrictions": [
    { "targetId": "btn", "type": "hide" },
    { "targetId": "btn", "type": "show" }
  ]
}
```
GOOD: each targetId appears once per roleId.

### UPB006 — valid-flow-references
Every `redirectTo` declared in a restriction must be either a route (starts with `/`) or a named flow id (alphanumeric with hyphens/underscores only).

BAD:
```json
{ "redirectTo": "go here please" }
// spaces not allowed
```
GOOD:
```json
{ "redirectTo": "/access-denied" }
{ "redirectTo": "access-denied-flow" }
```

### UPB007 — multi-role-coverage
When `spec.multiRoleResolution` is declared, its value must be one of: `"most-restrictive"`, `"least-restrictive"`, `"priority-order"`. This gate is skipped if `multiRoleResolution` is not declared.

BAD:
```json
{ "multiRoleResolution": "merge" }
// Not a valid strategy
```
GOOD:
```json
{ "multiRoleResolution": "most-restrictive" }
```

### UPB008 — contract-permission-branch
Final contract check:
- `version` declared
- All role `id` values are unique
- Every restriction has `targetId` and `type` fields

---

## What This Compiler Never Forgives

- `permission-branch-spec.json` missing — gate skipped (soft, not hard-fail)
- `roles` or `branches` missing or empty (UPB001)
- Any role without a matching branch (UPB002)
- `hide`/`disable` restriction without `deniedMessage` or `redirectTo` (UPB003)
- `protectedActions` entry not covered by any branch (UPB004)
- Contradictory restriction types for same role+target (UPB005)
- `redirectTo` with spaces or invalid format (UPB006)
- `multiRoleResolution` with invalid value (UPB007)
- Duplicate role ids (UPB008)
- `version` missing (UPB008)
