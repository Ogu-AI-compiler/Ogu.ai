# Budget Contract

> Formal contract for the budget tracking system.

## Version

1.0

## Purpose

Track token spending per agent, feature, and model. Enforce daily and monthly limits. Alert on threshold crossings.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/budget/budget-state.json` | Current budget state (daily, monthly, by-feature, by-model) |
| `.ogu/budget/transactions.jsonl` | Append-only transaction log |

## Budget State Schema

```json
{
  "version": 1,
  "updatedAt": "ISO timestamp",
  "daily": { "date": "YYYY-MM-DD", "tokensUsed": 0, "costUsed": 0.0, "limit": 50 },
  "monthly": { "month": "YYYY-MM", "tokensUsed": 0, "costUsed": 0.0, "limit": 1000 },
  "features": { "<slug>": { "tokensUsed": 0, "costUsed": 0.0 } },
  "models": { "<provider>/<model>": { "tokensUsed": 0, "costUsed": 0.0, "callCount": 0 } }
}
```

## Transaction Schema

```json
{
  "id": "UUID",
  "timestamp": "ISO",
  "type": "deduct",
  "featureSlug": "string",
  "taskId": "string",
  "agentRoleId": "string",
  "model": "string",
  "provider": "string",
  "tokens": { "input": 0, "output": 0, "total": 0 },
  "cost": 0.0,
  "currency": "USD"
}
```

## Invariants

1. `transactions.jsonl` is append-only. Entries are NEVER deleted or modified.
2. Daily counters reset when `daily.date` changes.
3. Monthly counters reset when `monthly.month` changes.
4. `costUsed` MUST always equal the sum of all transactions for that period.
5. `deductBudget()` MUST be called before any LLM API call returns.
6. Budget limits come from `OrgSpec.json.budget`.
7. Per-role quotas come from `OrgSpec.json.roles[].budgetQuota`.

## Alert Thresholds

Alert thresholds are defined in `OrgSpec.json.budget.alertThresholds` (default: `[0.50, 0.75, 0.90]`).
When daily spend crosses a threshold, a `budget.alert` audit event is emitted.

## Commands

| Command | Purpose |
|---------|---------|
| `budget:status` | Show current daily/monthly spend |
| `budget:check --cost N` | Check if cost is within limits |
| `budget:set --daily N --monthly N` | Update limits |
| `budget:report` | Detailed spending report |
| `budget:record` | Manual spend recording |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU3001 | Daily budget exceeded |
| OGU3002 | Monthly budget exceeded |
| OGU3003 | Per-role quota exceeded |
