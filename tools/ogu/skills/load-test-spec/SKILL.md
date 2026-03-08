---
name: load-test-spec
description: Compiler skill for the load-test-spec compiler. Activates when producing load-test-artifact.json. Gates: QA040–QA049. No upstream dependency.
---

# load-test-spec — Compiler Skill

## What This Compiler Does

Compiles the load test specification — tool, scenarios, per-scenario thresholds, error rate, smoke guard, staging enforcement for stress tests, output artifacts, and baseline comparison. Enforces: tool explicitly declared, every non-smoke scenario has thresholds, at least one scenario has an `errorRate` threshold, a smoke scenario exists (≤5 VUs, ≤2 minutes), stress/spike/soak/breakpoint tests cannot target production, and output destinations are configured.

**Upstream dependency:** none
**Output artifact:** `load-test-artifact.json`
**IR identifier:** `LOAD_TEST_SPEC:{project}`

---

## Spec Shape

```json
{
  "project": "e-commerce-api",
  "tool": "k6",
  "targetEnvironment": "staging",
  "scenarios": [
    {
      "id": "smoke",
      "name": "Smoke check",
      "type": "smoke",
      "vus": 1,
      "duration": "30s"
    },
    {
      "id": "baseline-load",
      "name": "Baseline load test",
      "type": "load",
      "vus": 100,
      "duration": "5m",
      "thresholds": {
        "p95ResponseTime": 500,
        "p99ResponseTime": 1000,
        "errorRate": 0.01,
        "rps": 200
      }
    },
    {
      "id": "stress-peak",
      "name": "Peak stress test",
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
    "htmlReport": "results/report.html",
    "summaryFile": "results/summary.json"
  },
  "baseline": {
    "enabled": true,
    "source": "previous-run",
    "regressionThreshold": 0.15
  }
}
```

Required fields:
- `project` — string
- `targetEnvironment` — string
- `scenarios` — non-empty array, each with `id`, `name`, `type`, `vus` (≥1), `duration` (e.g. `"30s"`, `"5m"`, `"1h"`)
- Valid scenario types: `smoke`, `load`, `stress`, `spike`, `soak`, `breakpoint`

---

## Gates

### QA040 — spec-valid
Reads `load-test-spec.json`. Required: `project`, `targetEnvironment`, `scenarios` (non-empty). Each scenario: `id`, `name`, valid `type`, `vus ≥ 1`, `duration` matching `NNs/NNm/NNh`.

### QA041 — tool-declared
`spec.tool` must be declared and valid: `k6`, `artillery`, `locust`, `gatling`, `jmeter`, `autocannon`, `wrk`, `vegeta`.

BAD: `"tool"` missing — VU semantics differ radically between tools.
GOOD: `"tool": "k6"`

### QA042 — smoke-required
At least one scenario must have `type: "smoke"` with `vus ≤ 5` and `duration ≤ 2m` (120 seconds). The smoke scenario validates the test script before heavy load runs.

BAD: All scenarios are `type: "load"` — no smoke sanity check.
GOOD:
```json
{ "id": "smoke", "type": "smoke", "vus": 1, "duration": "30s" }
```

### QA043 — thresholds-per-scenario
Every non-smoke scenario must declare `thresholds` with at least one of: `p95ResponseTime`, `p99ResponseTime`, `errorRate`, `rps`, `avgResponseTime`.

BAD:
```json
{ "id": "load", "type": "load", "vus": 100, "duration": "5m" }
// no thresholds — CI cannot pass/fail the run
```
GOOD:
```json
{
  "id": "load",
  "type": "load",
  "vus": 100,
  "duration": "5m",
  "thresholds": { "p95ResponseTime": 500, "errorRate": 0.01 }
}
```

### QA044 — error-rate-defined
At least one non-smoke scenario must have `thresholds.errorRate` declared as a number between 0.0 and 1.0 (not a percentage like 5 = 500%).

BAD: No scenario has `errorRate` — test can "pass" while serving 30% errors.
BAD: `"errorRate": 5` — this means 500%, not 5%.
GOOD: `"errorRate": 0.01` — 1% maximum error rate.

### QA045 — staging-only-for-stress
Scenarios of type `stress`, `spike`, `soak`, or `breakpoint` must NOT have `targetEnvironment` matching production keywords: `production`, `prod`, `live`, `main`, `www`, `release`.

BAD:
```json
{ "targetEnvironment": "production", "scenarios": [{ "type": "stress" }] }
```
GOOD:
```json
{ "targetEnvironment": "staging", "scenarios": [{ "type": "stress" }] }
```

### QA046 — output-artifacts-defined
`spec.outputArtifacts` must be declared with at least one non-empty value from: `resultsFile`, `htmlReport`, `summaryFile`, `dashboard`, `influxdb`, `prometheus`.

BAD: `outputArtifacts` missing — results are ephemeral, no trend analysis possible.
GOOD:
```json
{ "outputArtifacts": { "resultsFile": "results/load.json", "htmlReport": "results/report.html" } }
```

### QA047 — baseline-comparison
Skipped if `spec.baseline` not declared or `spec.baseline.enabled: false`. When declared and enabled:
- `baseline.source` must be one of: `previous-run`, `file`, `rolling-average`, `manual`
- `baseline.regressionThreshold` should be declared (0.0–1.0)

### QA048 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA049 — contract-load-test
The compiled artifact `load-test-artifact.json` must exist with: `ir_id` (starting `LOAD_TEST_SPEC:`), `project`, `tool`, `scenarios` (non-empty array), `attestation.hash`.

---

## What This Compiler Never Forgives

- `load-test-spec.json` missing (QA040 hard-fails)
- `project` or `targetEnvironment` missing (QA040)
- Any scenario missing `id`, `name`, `type`, `vus`, or `duration` (QA040)
- Invalid scenario type (not smoke/load/stress/spike/soak/breakpoint) (QA040)
- `tool` not declared (QA041)
- No smoke scenario (`type: "smoke"`) (QA042)
- Smoke scenario with >5 VUs or >2 minute duration (QA042)
- Non-smoke scenario with no `thresholds` (QA043)
- No scenario with `errorRate` threshold (QA044)
- `errorRate` > 1.0 (e.g. `errorRate: 5` means 500%) (QA044)
- Stress/spike/soak/breakpoint targeting production environment (QA045)
- `outputArtifacts` missing or empty (QA046)
