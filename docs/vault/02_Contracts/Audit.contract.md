# Audit Trail Contract

> Formal contract for the audit trail system.

## Version

1.0

## Purpose

Every state change in the system produces a structured, append-only audit event. Events are used for debugging, compliance, and replay.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/audit/current.jsonl` | All events (append-only) |
| `.ogu/audit/YYYY-MM-DD.jsonl` | Daily partition |
| `.ogu/audit/index.json` | Quick lookup (by type, feature, day) |

## Event Schema

```json
{
  "id": "UUID",
  "timestamp": "ISO 8601",
  "type": "string (dot-separated, e.g. 'feature.transition')",
  "severity": "info | warn | error | critical",
  "source": "cli | daemon | studio | agent",
  "actor": { "type": "human | agent | system", "id": "string" },
  "feature": "string (optional — feature slug)",
  "parentEventId": "UUID (optional — for replay chains)",
  "tags": ["string (optional — searchable tags)"],
  "model": { "provider": "string", "model": "string", "tokens": 0, "cost": 0.0 },
  "artifact": { "type": "string", "path": "string", "hash": "string" },
  "gate": { "name": "string", "passed": true, "reason": "string" },
  "payload": {}
}
```

## Invariants

1. Audit files are APPEND-ONLY. Events are NEVER deleted, modified, or reordered.
2. Every event has a unique UUID `id` and ISO `timestamp`.
3. Events are written to both `current.jsonl` AND daily `YYYY-MM-DD.jsonl`.
4. `parentEventId` creates a chain for replay. Chains must not form cycles.
5. `type` uses dot notation: `{domain}.{action}` (e.g. `compile.start`, `feature.transition`).

## Event Types

| Type | When |
|------|------|
| `org.initialized` | OrgSpec created |
| `feature.created` | New feature directory created |
| `feature.transition` | Feature state change |
| `compile.start` | Compilation begins |
| `compile.gates` | Gate check results |
| `compile.complete` | Compilation finished |
| `budget.recorded` | Budget deduction |
| `budget.alert` | Budget threshold crossed |
| `agent.started` | Agent begins task |
| `agent.completed` | Agent finishes task |
| `governance.check` | Policy check performed |
| `governance.approved` | Action approved |
| `governance.denied` | Action denied |

## Commands

| Command | Purpose |
|---------|---------|
| `audit:show` | Show recent events |
| `audit:search` | Filter by type, feature, date |
| `audit:export` | Export as JSON array |
| `audit:replay` | Follow event chain from ID |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU4001 | Audit directory not found |
| OGU4002 | Malformed audit event |
| OGU4003 | Replay chain not found |
