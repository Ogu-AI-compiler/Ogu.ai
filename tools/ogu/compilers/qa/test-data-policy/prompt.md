# QA Compiler: test-data-policy

## Purpose
Validate that test data management policy prevents PII in tests, isolates DB state
between test runs, and ensures reproducible data generation.

## Spec File
`test-data-policy-spec.json` in the compiler directory.

## Invariants

| Code  | Rule                                                                                    |
|-------|-----------------------------------------------------------------------------------------|
| QA080 | Spec must have `strategy`, `isolation` (with `strategy`), and `piiPolicy`              |
| QA081 | `piiPolicy.allowRealData` must not be `true`; source must not be a production copy     |
| QA082 | `snapshotPolicy` required when strategy includes `"snapshots"` (maxAgeDays, sanitized) |
| QA083 | `isolation.strategy` must be a safe strategy — `"shared"` and `"none"` forbidden       |
| QA084 | `seed` required when strategy includes `"factories"` or `"generated"`                  |
| QA085 | `factoryFramework` required when strategy includes `"factories"`                       |
| QA086 | No TODO/FIXME/HACK in any source file                                                   |
| QA087 | `test-data-policy-artifact.json` must be structurally valid                            |

## Spec Shape

```json
{
  "project": "my-app",
  "strategy": ["factories", "fixtures"],
  "isolation": {
    "strategy": "transaction-rollback",
    "parallelSafe": true
  },
  "piiPolicy": {
    "allowRealData": false,
    "source": "synthetic",
    "note": "All data generated with @faker-js/faker using fixed seed"
  },
  "factoryFramework": "@faker-js/faker",
  "seed": {
    "value": 42
  }
}
```

## Snapshot Policy (when strategy includes "snapshots")

```json
{
  "snapshotPolicy": {
    "maxAgeDays": 30,
    "sanitized": true,
    "updateFrequency": "weekly",
    "storageLocation": "s3://test-fixtures/snapshots/"
  }
}
```

## DB Isolation Strategies

| Strategy              | How it works                           | Parallel-safe |
|-----------------------|----------------------------------------|---------------|
| `transaction-rollback`| Wrap test in transaction, roll back    | Yes           |
| `per-test-db`         | Fresh DB for each test                 | Yes           |
| `per-suite-db`        | Fresh DB for each test suite           | Yes           |
| `truncate-between`    | TRUNCATE tables after each test        | No            |
| `in-memory`           | SQLite :memory: or in-memory Mongo     | Yes           |
| `docker-per-suite`    | New Docker container per suite         | Yes           |
| `shared`              | **FORBIDDEN**                          | N/A           |

## Seed Strategies

```json
// Fixed — fully deterministic
"seed": { "value": 42 }

// Per-run — different each time, but logged for reproduction
"seed": { "strategy": "per-run", "logged": true }
```

## Error Codes

| Code  | Name                          | Fix                                                         |
|-------|-------------------------------|-------------------------------------------------------------|
| QA080 | spec-invalid                  | Add `strategy`, `isolation`, `piiPolicy`                    |
| QA081 | pii-in-test-data              | Set `allowRealData: false`, use synthetic source            |
| QA082 | snapshot-policy-missing       | Add `snapshotPolicy` with `maxAgeDays`, `sanitized: true`   |
| QA083 | shared-db-isolation           | Use `transaction-rollback` or `per-test-db`                 |
| QA084 | non-deterministic-seed        | Add `seed.value: 42` or `seed.strategy: "per-run", logged` |
| QA085 | no-factory-framework          | Add `factoryFramework: "@faker-js/faker"`                   |
| QA086 | todos-found                   | Resolve all TODO/FIXME/HACK                                 |
| QA087 | artifact-invalid              | Run runner.mjs to regenerate artifact                       |

## Output Artifact

`test-data-policy-artifact.json`

```json
{
  "ir_id": "TEST_DATA_POLICY:my-app",
  "strategies": ["factories", "fixtures"],
  "isolation": { "strategy": "transaction-rollback", "parallelSafe": true },
  "piiPolicy": { "allowRealData": false, "source": "synthetic" },
  "seed": { "value": 42 },
  "factoryFramework": "@faker-js/faker",
  "gates": [ { "pass": true, "code": "QA080" } ],
  "pass": true,
  "attestation": { "hash": "<sha256>", "timestamp": "..." }
}
```
