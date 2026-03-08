# QA Compiler: load-test-spec

## Purpose
Validate that a load test specification is safe, structured, and produces actionable results.
A load test without thresholds is an observation. A stress test against production is an outage.

## Spec File
`load-test-spec.json` in the compiler directory.

## Invariants

| Code  | Rule                                                                              |
|-------|-----------------------------------------------------------------------------------|
| QA040 | Spec must have `project`, `targetEnvironment`, and `scenarios[]`                  |
| QA041 | `tool` must be explicitly declared (k6, artillery, locust, gatling, etc.)         |
| QA042 | At least one `smoke` scenario with vus ≤ 5 and duration ≤ 2m                     |
| QA043 | All non-smoke scenarios must declare `thresholds` with at least one metric         |
| QA044 | At least one scenario must declare `errorRate` threshold (0.0–1.0)                |
| QA045 | stress/spike/soak/breakpoint scenarios must not target production                 |
| QA046 | `outputArtifacts` must declare at least one output destination                    |
| QA047 | `baseline` comparison, if declared, must have valid source and threshold           |
| QA048 | No TODO/FIXME/HACK in any source file                                              |
| QA049 | `load-test-artifact.json` must be structurally valid                              |

## Scenario Types

| Type          | Purpose                                       | Target Env    |
|---------------|-----------------------------------------------|---------------|
| `smoke`       | Script sanity check (1–5 VUs, ≤ 2m)           | Any           |
| `load`        | Normal expected traffic                        | Any           |
| `stress`      | Beyond expected capacity                       | Staging only  |
| `spike`       | Sudden 10–100x traffic burst                   | Staging only  |
| `soak`        | Sustained load for hours (memory leaks)        | Staging only  |
| `breakpoint`  | Find the system breaking point                 | Staging only  |

## Spec Shape

```json
{
  "project": "my-app",
  "tool": "k6",
  "targetEnvironment": "staging",
  "scenarios": [
    {
      "id": "smoke",
      "name": "Smoke test",
      "type": "smoke",
      "vus": 1,
      "duration": "30s"
    },
    {
      "id": "load-homepage",
      "name": "Homepage load test",
      "type": "load",
      "vus": 50,
      "duration": "5m",
      "thresholds": {
        "p95ResponseTime": 500,
        "errorRate": 0.01
      }
    },
    {
      "id": "stress-api",
      "name": "API stress test",
      "type": "stress",
      "vus": 500,
      "duration": "10m",
      "thresholds": {
        "p95ResponseTime": 2000,
        "errorRate": 0.05
      }
    }
  ],
  "outputArtifacts": {
    "resultsFile": "results/load-test.json",
    "htmlReport": "results/report.html"
  },
  "baseline": {
    "enabled": true,
    "source": "previous-run",
    "regressionThreshold": 0.15
  }
}
```

## Error Codes

| Code  | Name                      | Fix                                                    |
|-------|---------------------------|--------------------------------------------------------|
| QA040 | spec-invalid              | Add `project`, `targetEnvironment`, `scenarios[]`      |
| QA041 | tool-not-declared         | Add `tool: "k6"` (or artillery, locust, etc.)          |
| QA042 | no-smoke-scenario         | Add `{ "type": "smoke", "vus": 1, "duration": "30s" }` |
| QA043 | thresholds-missing        | Add `thresholds` to all non-smoke scenarios            |
| QA044 | error-rate-missing        | Add `errorRate: 0.01` to at least one scenario         |
| QA045 | stress-on-production      | Set `targetEnvironment: "staging"`                     |
| QA046 | no-output-artifacts       | Add `outputArtifacts.resultsFile`                      |
| QA047 | baseline-misconfigured    | Set `baseline.source` to a valid value                 |
| QA048 | todos-found               | Resolve all TODO/FIXME/HACK                            |
| QA049 | artifact-invalid          | Run runner.mjs to regenerate artifact                  |

## Why errorRate Must Be 0.0–1.0

`errorRate: 0.01` means 1% max error rate.
`errorRate: 5` would mean 500% — impossible. Common mistake when thinking in percentages.
The compiler rejects any errorRate outside [0.0, 1.0].

## Output Artifact

`load-test-artifact.json`

```json
{
  "ir_id": "LOAD_TEST_SPEC:my-app",
  "project": "my-app",
  "tool": "k6",
  "targetEnvironment": "staging",
  "scenarios": [ ... ],
  "outputArtifacts": { "resultsFile": "results/load-test.json" },
  "baseline": { "source": "previous-run", "regressionThreshold": 0.15 },
  "gates": [ { "pass": true, "code": "QA040" } ],
  "pass": true,
  "attestation": { "hash": "<sha256>", "timestamp": "..." }
}
```
