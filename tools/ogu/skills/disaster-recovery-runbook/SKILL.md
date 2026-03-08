---
name: disaster-recovery-runbook
description: Compiler skill for the disaster_recovery_runbook compiler. Activates when producing dr-runbook-artifact.json. Gates: DR001–DR008. No upstream dependency.
---

# disaster-recovery-runbook — Compiler Skill

## What This Compiler Does

Compiles the disaster recovery runbook — RTO/RPO targets, failure scenarios, failover configuration, communication plan, and test schedule. Enforces: RTO/RPO use ISO 8601 format with RPO ≤ RTO, every scenario has name/trigger/steps/owner, failover regions are distinct, communication plan has an incident commander and escalation path, and a test schedule is defined.

**Upstream dependency:** none
**Output artifact:** `dr-runbook-artifact.json`
**IR identifier:** `DR_RUNBOOK:{project}`

---

## Spec Shape

```json
{
  "service": "payment-api",
  "rto": "PT4H",
  "rpo": "PT30M",
  "scenarios": [
    {
      "name": "database-failure",
      "trigger": "Primary DB becomes unreachable",
      "steps": [
        { "action": "Alert on-call via PagerDuty" },
        { "action": "Promote read replica to primary" },
        { "action": "Update connection string in Vault" },
        { "action": "Verify application connectivity" }
      ],
      "owner": "platform-team",
      "estimatedRecoveryMinutes": 30
    },
    {
      "name": "data-loss-restore",
      "trigger": "Accidental data deletion detected",
      "steps": [
        { "action": "Identify last clean backup" },
        { "action": "Restore to point-in-time" },
        { "action": "Verify data integrity" }
      ],
      "owner": "data-team"
    }
  ],
  "failover": {
    "primaryRegion": "us-east-1",
    "secondaryRegion": "us-west-2",
    "strategy": "active-passive"
  },
  "communicationPlan": {
    "incidentCommander": "on-call-sre",
    "escalationPath": ["team-lead", "vp-engineering"],
    "statusPageUrl": "https://status.example.com"
  },
  "testSchedule": {
    "frequency": "quarterly",
    "lastTested": "2025-09-01",
    "nextTest": "2025-12-01"
  }
}
```

Required fields:
- `service` — service name
- `rto` — Recovery Time Objective (ISO 8601 duration, e.g. `PT4H`)
- `rpo` — Recovery Point Objective (ISO 8601 duration, e.g. `PT30M`)
- `scenarios` — non-empty array

---

## Gates

### DR001 — spec-valid
Reads `dr-runbook-spec.json`. Required: `service`, `rto`, `rpo` (ISO 8601 duration format), `scenarios` (non-empty).

Hard-fails if `dr-runbook-spec.json` is missing.

### DR002 — rto-rpo-defined
Both `rto` and `rpo` must be valid ISO 8601 duration strings (e.g. `PT4H`, `PT30M`, `P1D`). RPO must be ≤ RTO — you cannot recover to a point in time that is further in the past than your recovery time objective.

RTO > 24 hours triggers a warning (add `skipRTOWarning: true` to suppress).

BAD:
```json
{ "rto": "4 hours", "rpo": "30 minutes" }
// not ISO 8601
```
```json
{ "rto": "PT1H", "rpo": "PT4H" }
// rpo > rto — impossible
```
GOOD:
```json
{ "rto": "PT4H", "rpo": "PT30M" }
```

### DR003 — scenarios-complete
Each scenario must have:
- `name` — string identifier
- `trigger` — what causes this scenario
- `steps` — non-empty array, each with `action` field
- `owner` — team or person responsible

BAD:
```json
{ "scenarios": [{ "name": "db-failure" }] }
// missing trigger, steps, owner
```
GOOD: Every scenario has all four required fields.

### DR004 — failover-targets-valid
Skipped if `spec.failover` is not declared. When declared:
- `primaryRegion` must not equal `secondaryRegion`
- `strategy` must be: `active-active`, `active-passive`, `pilot-light`, or `warm-standby`

BAD:
```json
{ "failover": { "primaryRegion": "us-east-1", "secondaryRegion": "us-east-1", "strategy": "active-passive" } }
// same region — not a real failover
```
GOOD:
```json
{ "failover": { "primaryRegion": "us-east-1", "secondaryRegion": "us-west-2", "strategy": "active-passive" } }
```

### DR005 — communication-plan-defined
`communicationPlan` must be declared with:
- `incidentCommander` — who leads the response
- `escalationPath` — array of escalation contacts
- `statusPageUrl` or `statusChannel` — where to post updates

Escape: `skipCommunicationPlan: true`.

BAD:
```json
{ "service": "api", "rto": "PT4H", "rpo": "PT30M", "scenarios": [] }
// no communication plan
```
GOOD:
```json
{
  "communicationPlan": {
    "incidentCommander": "on-call-sre",
    "escalationPath": ["team-lead", "cto"],
    "statusPageUrl": "https://status.example.com"
  }
}
```

### DR006 — test-schedule-defined
`testSchedule` must be declared with at least `frequency`. DR runbooks that are never tested are unreliable.

Valid frequency values: `monthly`, `quarterly`, `semi-annually`, `annually`.

### DR007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### DR008 — contract-runbook
Final contract checks:
- Scenario names must be unique
- At least one scenario must cover data-loss/backup/restore (unless `skipDataLossScenario: true`)
- All scenarios must have `owner` declared
- Cross-artifact: if `k8s-workload-artifact.json` exists, `spec.service` must match the workload name (escape: `skipWorkloadMatch: true`)

BAD:
```json
{ "scenarios": [{ "name": "db-failure", "trigger": "...", "steps": [], "owner": "" }] }
// empty owner
```
GOOD: All scenarios have non-empty `owner`, and at least one covers data-loss recovery.

---

## What This Compiler Never Forgives

- `dr-runbook-spec.json` missing (DR001 hard-fails)
- `service`, `rto`, `rpo`, or `scenarios` missing (DR001)
- `rto` or `rpo` not in ISO 8601 duration format (DR002)
- `rpo` > `rto` (DR002)
- Any scenario missing `trigger`, `steps`, or `owner` (DR003)
- Any step missing `action` field (DR003)
- Failover with `primaryRegion` == `secondaryRegion` (DR004)
- Failover `strategy` not in valid list (DR004)
- `communicationPlan` missing without `skipCommunicationPlan` (DR005)
- `communicationPlan` missing `incidentCommander` or `escalationPath` (DR005)
- `testSchedule` not declared (DR006)
- Duplicate scenario names (DR008)
- No data-loss/restore scenario without `skipDataLossScenario` (DR008)
