# OrgSpec Contract

> Formal contract for `.ogu/OrgSpec.json` — the organizational specification.

## Version

1.0

## Purpose

OrgSpec defines the complete organizational structure: roles, teams, capabilities, model policies, budgets, and governance. It is the foundation for all agent operations.

## Location

`.ogu/OrgSpec.json`

## Schema Invariants

### Structural
1. `version` MUST be a positive integer
2. `name` MUST be a non-empty string
3. `updatedAt` MUST be an ISO 8601 datetime
4. `roles` MUST contain at least one role

### Roles
1. Every `roleId` MUST be unique across all roles
2. `roleId` MUST match `/^[a-z][a-z0-9_-]*$/`
3. Every `escalationPath` target MUST reference an existing `roleId`
4. Circular escalation paths are FORBIDDEN
5. Every role MUST have at least one capability
6. `budgetQuota.dailyTokens` MUST be positive when specified
7. `phases` entries MUST be valid pipeline phases: `idea`, `feature`, `architect`, `design`, `preflight`, `lock`, `build`, `verify`, `enforce`, `preview`, `done`, `observe`, `pipeline`, `governance`

### Teams
1. Every `teamId` MUST be unique
2. Team `lead` MUST reference an existing `roleId`
3. All team `roles` entries MUST reference existing `roleId` values

### Budget
1. `dailyLimit` and `monthlyLimit` MUST be positive
2. `monthlyLimit` MUST be >= `dailyLimit`
3. `currency` MUST be `"USD"`
4. `alertThreshold` MUST be in range [0, 1]

### Governance
1. `maxConcurrentFeatures` MUST be a positive integer

## Validation Command

```
ogu org:validate
```

## Error Codes

| Code | Meaning |
|------|---------|
| OGU2001 | OrgSpec missing or invalid JSON |
| OGU2002 | Duplicate roleId |
| OGU2003 | Escalation target not found |
| OGU2004 | Invalid budget quota |
| OGU2005 | Team references unknown role |
| OGU2006 | Invalid pipeline phase |

## Modification Rules

1. OrgSpec is modified ONLY through `ogu org:init` or direct JSON edit
2. Every modification MUST update `updatedAt`
3. Removing a role that is referenced by teams or escalation paths is FORBIDDEN
4. Adding a role with a duplicate `roleId` is FORBIDDEN
