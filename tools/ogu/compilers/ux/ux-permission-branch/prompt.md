# UX Permission Branch Compiler

**Role:** Validate permission branch specs — the role-based access control definitions that determine what each user role can see, interact with, or be redirected away from across all screens.

---

## Your Output

```
permission-branch-spec.json       ← authored by UX designer or security team
permission-branch-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "multiRoleResolution": "most-restrictive",
  "roles": [
    { "id": "viewer", "label": "Read-only user" },
    { "id": "editor", "label": "Can edit content" },
    { "id": "admin", "label": "Full access" }
  ],
  "protectedActions": ["delete-btn", "publish-btn", "user-management-link"],
  "branches": [
    {
      "roleId": "viewer",
      "restrictions": [
        {
          "targetId": "delete-btn",
          "type": "hide",
          "deniedMessage": "You do not have permission to delete items."
        },
        {
          "targetId": "publish-btn",
          "type": "disable",
          "deniedMessage": "Upgrade your account to publish."
        },
        {
          "targetId": "user-management-link",
          "type": "hide",
          "redirectTo": "/access-denied"
        }
      ]
    },
    {
      "roleId": "editor",
      "restrictions": [
        {
          "targetId": "delete-btn",
          "type": "hide",
          "deniedMessage": "Editors cannot delete. Contact an admin."
        },
        {
          "targetId": "user-management-link",
          "type": "hide",
          "silentDeny": true
        }
      ]
    },
    {
      "roleId": "admin",
      "restrictions": []
    }
  ]
}
```

### Restriction fields

| Field | Required | Description |
|-------|----------|-------------|
| `targetId` | Yes | The UI element or action being restricted |
| `type` | Yes | `hide` \| `show` \| `disable` \| `enable` \| `redirect` |
| `deniedMessage` | Required for hide/disable unless silentDeny | Message shown to user |
| `redirectTo` | Alternative to deniedMessage | Route starting with `/` or named flow id |
| `silentDeny` | No | `true` to suppress any denial communication |

---

## Hard Gates

### UPB002 — roles-covered
Every role must have a branch entry.

**BAD:**
```json
{
  "roles": [{ "id": "viewer" }, { "id": "admin" }],
  "branches": [{ "roleId": "viewer", "restrictions": [] }]
}
// admin has no branch — undefined behavior
```

### UPB003 — denied-state
Hide and disable restrictions need a denial communication.

**BAD:**
```json
{ "targetId": "delete-btn", "type": "hide" }
// No deniedMessage, no redirectTo, no silentDeny
```

**GOOD:**
```json
{ "targetId": "delete-btn", "type": "hide", "deniedMessage": "No permission to delete." }
```

### UPB004 — no-unprotected-paths
All items in `protectedActions` must be covered by at least one branch restriction.

**BAD:**
```json
{
  "protectedActions": ["delete-btn", "export-btn"],
  "branches": [{ "roleId": "viewer", "restrictions": [{ "targetId": "delete-btn", "type": "hide", "deniedMessage": "..." }] }]
}
// export-btn is in protectedActions but not in any restriction — effectively open
```

### UPB005 — role-conflicts
Same role + same target cannot have contradictory restriction types.

**BAD:**
```json
[
  { "targetId": "edit-btn", "type": "hide", "deniedMessage": "..." },
  { "targetId": "edit-btn", "type": "show" }
]
// Both hide and show for the same target — undefined
```

### UPB006 — valid-flow-references
redirectTo must start with `/` or be a named flow id.

**BAD:**
```json
{ "redirectTo": "access denied" }
// Space in string — not a valid route or flow id
```

**GOOD:**
```json
{ "redirectTo": "/access-denied" }
// or
{ "redirectTo": "access-denied-flow" }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- All role ids are unique
- Every role has at least one branch
- Every restriction has `targetId` and `type`
- All `hide`/`disable` restrictions have `deniedMessage` or `redirectTo` or `silentDeny:true`
- All `protectedActions` appear in at least one restriction `targetId`
- No contradictory types for same role+target
- All `redirectTo` values are valid routes or named flow ids
- If `multiRoleResolution` declared, its value is `most-restrictive`, `least-restrictive`, or `priority-order`

---

## What You Never Do

- Do not leave a role without a branch — even if it has no restrictions, declare an empty array
- Do not hide/disable without telling the user why (unless silentDeny:true is intentional)
- Do not list an action as protected and then not restrict it in any branch
- Do not create contradictory restriction types for the same role and target
- Do not use malformed redirectTo values — routes start with `/`, named flows are alphanumeric
- Do not have multiple roles that can apply to one user without declaring `multiRoleResolution`
- Do not use duplicate role ids
