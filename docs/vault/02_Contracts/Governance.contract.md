# Governance Contract

> Formal contract for the governance engine — policy evaluation and approval flow.

## Version

1.0

## Purpose

Enforce organizational policies on agent actions. Every task is evaluated against rules before execution. High-risk or cross-boundary actions require explicit approval.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/policies/rules.json` | Declarative policy rules |
| `.ogu/approvals/{feature}-{task}.json` | Approval records per task |

## Rule Schema

```json
{
  "version": 1,
  "rules": [
    {
      "id": "unique-id",
      "name": "Human-readable name",
      "description": "What this rule enforces",
      "enabled": true,
      "priority": 100,
      "when": {
        "operator": "AND",
        "conditions": [
          { "field": "task.riskTier", "op": "in", "value": ["high", "critical"] }
        ]
      },
      "then": [
        { "effect": "requireApprovals", "params": { "count": 1, "fromRoles": ["tech-lead"] } }
      ]
    }
  ]
}
```

## Condition Operators

| Op | Meaning | Example |
|----|---------|---------|
| `eq` | Equals | `{ "field": "task.riskTier", "op": "eq", "value": "critical" }` |
| `neq` | Not equals | |
| `in` | Value in list | `{ "field": "task.riskTier", "op": "in", "value": ["high", "critical"] }` |
| `not_in` | Value not in list | |
| `gt`, `lt`, `gte`, `lte` | Numeric comparison | |
| `matches` | Glob match | `{ "field": "feature.slug", "op": "matches", "value": "security-*" }` |
| `matches_any` | Any path matches any glob | For file-touch policies |
| `exists` | Field is not null/undefined | |

## Group Operators

| Operator | Meaning |
|----------|---------|
| `AND` | All conditions must match |
| `OR` | At least one must match |
| `NOT` | None must match |

## Trigger Types

| Field | Type | Description |
|-------|------|-------------|
| `task.riskTier` | string | low, medium, high, critical |
| `task.touches` | string[] | File paths the task modifies |
| `task.capability` | string | Required capability |
| `task.roleId` | string | Agent role performing the task |
| `budget.exceeded` | boolean | Budget limit hit |
| `budget.remaining` | number | Remaining budget |
| `scope.violation` | boolean | Agent outside ownership scope |
| `trigger` | string | Event trigger type |

## Effect Types

| Effect | Params | Description |
|--------|--------|-------------|
| `allow` | — | Explicitly allow |
| `deny` | `{ reason }` | Block execution |
| `requireApprovals` | `{ count, fromRoles }` | Require N approvals from specified roles |
| `addGates` | `{ gates }` | Add extra quality gates |
| `notify` | `{ channel, message }` | Send notification |

## Approval Lifecycle

```
pending → approved
pending → denied
pending → escalated → approved/denied/timed_out
```

## Commands

| Command | Purpose |
|---------|---------|
| `governance:check` | Evaluate policy rules against task |
| `approve` | Grant approval |
| `deny` | Deny approval |
| `escalate` | Escalate to higher authority |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU5001 | Policy rules file not found |
| OGU5002 | Invalid rule schema |
| OGU5003 | Approval not found |
| OGU5004 | Escalation target not found |
