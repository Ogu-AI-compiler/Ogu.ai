---
name: test-data-policy
description: Compiler skill for the test-data-policy compiler. Activates when producing test-data-policy-artifact.json. Gates: QA080–QA087. No upstream dependency.
---

# test-data-policy — Compiler Skill

## What This Compiler Does

Compiles the test data management policy — strategy, isolation mechanism, PII rules, snapshot freshness, factory framework, and deterministic seeds. Enforces: no real PII in test data, no production data sources, isolation strategy is not `"shared"`, snapshots expire within 90 days and are sanitized, factories declare their framework, and generated data uses deterministic seeding.

**Upstream dependency:** none
**Output artifact:** `test-data-policy-artifact.json`
**IR identifier:** `TEST_DATA_POLICY:{project}`

---

## Spec Shape

```json
{
  "strategy": ["factories", "fixtures"],
  "isolation": {
    "strategy": "transaction-rollback",
    "description": "Each test runs in a DB transaction that is rolled back after"
  },
  "piiPolicy": {
    "allowRealData": false,
    "source": "synthetic",
    "anonymization": "faker-js"
  },
  "factoryFramework": "@faker-js/faker",
  "seed": {
    "value": 12345
  }
}
```

Required fields:
- `strategy` — string or array from: `factories`, `fixtures`, `snapshots`, `mocks`, `seeders`, `generated`, `synthetic`
- `isolation` — object with `strategy` field
- `piiPolicy` — object (see QA081)

---

## Gates

### QA080 — spec-valid
Reads `test-data-policy-spec.json`. Required: `strategy` (valid values), `isolation` (object with `strategy`), `piiPolicy` (object).

Valid strategies: `factories`, `fixtures`, `snapshots`, `mocks`, `seeders`, `generated`, `synthetic`.

BAD: `"strategy": "database-clone"` — not in valid list.
GOOD: `"strategy": ["factories", "fixtures"]`

### QA081 — pii-forbidden
Three checks:
1. `piiPolicy.allowRealData` must not be `true`
2. `piiPolicy.source` must not be a production data source: `production-copy`, `prod-copy`, `prod-dump`, `production-dump`, `live-export`, `prod-export`
3. If `source` involves real data, `piiPolicy.anonymization` must be declared

BAD:
```json
{ "piiPolicy": { "allowRealData": true } }
{ "piiPolicy": { "source": "prod-dump" } }
```
GOOD:
```json
{ "piiPolicy": { "allowRealData": false, "source": "synthetic", "anonymization": "faker-js" } }
```

### QA082 — snapshot-policy-defined
Skipped if strategy does not include `"snapshots"`. When snapshots are used:
- `spec.snapshotPolicy.maxAgeDays` — required (≤90 days)
- `spec.snapshotPolicy.sanitized` — must be `true`
- `spec.snapshotPolicy.updateFrequency` — required string

BAD: Strategy includes `"snapshots"` but no `snapshotPolicy` declared.
BAD: `snapshotPolicy.sanitized: false` — PII risk.
BAD: `snapshotPolicy.maxAgeDays: 180` — exceeds 90 day limit.
GOOD:
```json
{
  "snapshotPolicy": {
    "maxAgeDays": 30,
    "sanitized": true,
    "updateFrequency": "weekly"
  }
}
```

### QA083 — no-shared-db-isolation
`isolation.strategy` must not be `"shared"`, `"none"`, `"manual-cleanup"`, or `"best-effort"`.

Valid isolation strategies: `transaction-rollback`, `per-test-db`, `per-suite-db`, `truncate-between`, `in-memory`, `docker-per-suite`, `savepoint-rollback`, `schema-per-test`.

BAD:
```json
{ "isolation": { "strategy": "shared" } }
// all tests share one DB — parallel runs corrupt each other
```
GOOD:
```json
{ "isolation": { "strategy": "transaction-rollback" } }
```

### QA084 — deterministic-seed-defined
Skipped if strategy doesn't include `factories`, `generated`, or `synthetic`. When it does, `spec.seed` must be declared:
- `{ "value": 42 }` — fixed seed (fully reproducible)
- `{ "strategy": "per-run", "logged": true }` — per-run but seed logged for reproduction

BAD: `spec.seed` missing for factory strategy.
BAD: `{ "strategy": "per-run", "logged": false }` — seed not logged, failures can't be reproduced.
GOOD:
```json
{ "seed": { "value": 12345 } }
```

### QA085 — factory-framework-specified
Skipped if strategy doesn't include `"factories"`. When factories used, `spec.factoryFramework` (or `spec.factory.framework`) must be declared.

Valid frameworks: `faker`, `@faker-js/faker`, `fishery`, `rosie`, `factory-girl`, `@anatine/zod-mock`, `chance`, `casual`, `generate`, `mock-data`, `factory-bot`, `factory-boy`, `ffaker`, `generate-js`.

BAD: Strategy includes `"factories"` but `factoryFramework` missing.
GOOD: `"factoryFramework": "@faker-js/faker"`

### QA086 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA087 — contract-test-data
The compiled artifact `test-data-policy-artifact.json` must exist with: `ir_id` (starting `TEST_DATA_POLICY:`), `strategies` (non-empty array), `isolation`, `piiPolicy`, `attestation.hash`.

---

## What This Compiler Never Forgives

- `test-data-policy-spec.json` missing (QA080 hard-fails)
- Invalid strategy value (QA080)
- `isolation` or `piiPolicy` missing (QA080)
- `piiPolicy.allowRealData: true` (QA081)
- `piiPolicy.source` is a production dump/copy (QA081)
- Strategy includes `"snapshots"` but no `snapshotPolicy` (QA082)
- `snapshotPolicy.sanitized: false` (QA082)
- `snapshotPolicy.maxAgeDays > 90` (QA082)
- `isolation.strategy: "shared"` or `"none"` (QA083)
- Factory strategy without `spec.seed` (QA084)
- Per-run seed without `logged: true` (QA084)
- Strategy includes `"factories"` but `factoryFramework` not declared (QA085)
