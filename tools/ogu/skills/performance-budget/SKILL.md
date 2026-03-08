---
name: performance-budget
description: Compiler skill for the performance-budget compiler. Activates when producing performance-budget-artifact.json. Gates: QA030–QA037. No upstream dependency.
---

# performance-budget — Compiler Skill

## What This Compiler Does

Compiles the Core Web Vitals and Lighthouse performance budget — LCP, CLS, INP thresholds with realistic values, CI enforcement action, and Lighthouse run count for statistical reliability. Enforces: FID is replaced by INP (deprecated March 2024), CLS is a decimal (0–0.25) not milliseconds, LCP is between 500ms and 4000ms, `ciAction` is not `"none"`, and Lighthouse runs ≥3 for median stability.

**Upstream dependency:** none
**Output artifact:** `performance-budget-artifact.json`
**IR identifier:** `PERFORMANCE_BUDGET:{project}`

---

## Spec Shape

```json
{
  "coreWebVitals": {
    "LCP": {
      "good": 2500,
      "needsImprovement": 4000
    },
    "CLS": {
      "good": 0.1,
      "needsImprovement": 0.25
    },
    "INP": {
      "good": 200,
      "needsImprovement": 500
    }
  },
  "ciAction": "fail",
  "lighthouseThresholds": {
    "performance": 85,
    "accessibility": 95,
    "bestPractices": 90,
    "seo": 80
  },
  "lighthouseRuns": 3
}
```

Required fields:
- `coreWebVitals` — object with at least `LCP` and `CLS`
- `ciAction` — `"fail"`, `"warn"`, or `"block"` (not `"none"`)

---

## Gates

### QA030 — spec-valid
Reads `performance-budget-spec.json`. Required: `coreWebVitals` (with at least `LCP` and `CLS`), `ciAction`.

### QA031 — no-fid-metric
`FID` (First Input Delay) was deprecated and removed as a Core Web Vital in March 2024, replaced by `INP` (Interaction to Next Paint). `FID` in `coreWebVitals` is a hard fail. `INP` must be present.

BAD:
```json
{ "coreWebVitals": { "FID": { "good": 100 } } }
// FID deprecated March 2024
```
BAD:
```json
{ "coreWebVitals": { "LCP": {}, "CLS": {} } }
// INP missing — required replacement for FID
```
GOOD:
```json
{ "coreWebVitals": { "LCP": { "good": 2500 }, "CLS": { "good": 0.1 }, "INP": { "good": 200 } } }
```

### QA032 — cls-is-decimal
CLS is a unitless layout stability score (0–~0.5). It is **not** milliseconds. `CLS.good ≥ 1` indicates the spec author confused it with a time metric.

- Google Good: ≤ 0.1
- Google Needs Improvement: 0.1–0.25
- Google Poor: > 0.25

BAD:
```json
{ "CLS": { "good": 100 } }
// 100 is not a CLS score — should be 0.1
```
GOOD:
```json
{ "CLS": { "good": 0.1, "needsImprovement": 0.25 } }
```

### QA033 — lcp-threshold-realistic
`LCP.good` must be between 500ms and 4000ms.

- < 500ms: unreachably fast even on localhost — will always fail
- > 4000ms: laxer than Google's "Poor" threshold — pointless budget
- Google Good: ≤ 2500ms

BAD:
```json
{ "LCP": { "good": 100 } }   // unreachable
{ "LCP": { "good": 8000 } }  // worse than Google "Poor"
```
GOOD:
```json
{ "LCP": { "good": 2500, "needsImprovement": 4000 } }
```

### QA034 — ci-action-enforced
`ciAction` must not be `"none"`, `false`, or absent. Valid values: `"fail"`, `"warn"`, `"block"`.

BAD: `"ciAction": "none"` — budget is defined but never enforced.
GOOD: `"ciAction": "fail"` — budget violations block the build.

### QA035 — lighthouse-runs-sufficient
Skipped if `spec.lighthouseThresholds` not declared. When declared, `lighthouseRuns` (or `numberOfRuns`) must be ≥3. A single Lighthouse run has ±5–15 point variance — the median of 3 runs is required for stability.

BAD: `lighthouseThresholds` declared but `lighthouseRuns` missing or < 3.
GOOD: `"lighthouseRuns": 3` — uses median of 3 runs.

### QA036 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA037 — contract-performance
The compiled artifact `performance-budget-artifact.json` must exist with: `ir_id` (starting `PERFORMANCE_BUDGET:`), `ciAction` (not `"none"`), `attestation.hash` (≥32 chars).

---

## What This Compiler Never Forgives

- `performance-budget-spec.json` missing (QA030 hard-fails)
- `coreWebVitals` missing `LCP` or `CLS` (QA030)
- `ciAction` missing (QA030)
- `FID` present in `coreWebVitals` — deprecated (QA031)
- `INP` absent from `coreWebVitals` (QA031)
- `CLS.good ≥ 1` — confused with milliseconds (QA032)
- `LCP.good < 500ms` — unreachable threshold (QA033)
- `LCP.good > 4000ms` — laxer than Google "Poor" (QA033)
- `ciAction: "none"` — budget never enforced (QA034)
- `lighthouseThresholds` declared but `lighthouseRuns < 3` (QA035)
