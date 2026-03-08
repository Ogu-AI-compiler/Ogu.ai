# QA Compiler: performance-budget

## Purpose
Validate that a performance budget spec is realistic, enforced, and uses current metrics.
A performance budget that is too lenient, never enforced, or uses deprecated metrics
is indistinguishable from no budget at all.

## Spec File
`performance-budget-spec.json` in the compiler directory.

## Invariants

| Code  | Rule                                                                        |
|-------|-----------------------------------------------------------------------------|
| QA030 | Spec must have `coreWebVitals` (object) or `lighthouseThresholds` (object)  |
| QA031 | `coreWebVitals.FID` is forbidden — deprecated March 2024. Use `INP` instead |
| QA032 | `CLS.good` must be a decimal < 1.0 (CLS is a unitless score, not ms)        |
| QA033 | `LCP.good` must be between 500ms and 4000ms (realistic range)               |
| QA034 | `ciAction` must be `fail`, `warn`, or `block` — never `none` or absent      |
| QA035 | `lighthouseRuns` ≥ 3 when `lighthouseThresholds` is declared                |
| QA036 | No TODO/FIXME/HACK in any source file                                        |
| QA037 | `performance-budget-artifact.json` must be structurally valid               |

## Core Web Vitals Reference

| Metric | Good        | Needs Improvement | Poor        |
|--------|-------------|-------------------|-------------|
| LCP    | ≤ 2500ms    | 2500–4000ms       | > 4000ms    |
| CLS    | ≤ 0.1       | 0.1–0.25          | > 0.25      |
| INP    | ≤ 200ms     | 200–500ms         | > 500ms     |
| FCP    | ≤ 1800ms    | 1800–3000ms       | > 3000ms    |
| TTFB   | ≤ 800ms     | 800–1800ms        | > 1800ms    |

**FID is deprecated.** It was removed from the Core Web Vitals programme in March 2024.
Any spec still using FID must be migrated to INP.

## Spec Shape

```json
{
  "project": "my-app",
  "ciAction": "fail",
  "coreWebVitals": {
    "LCP": { "good": 2500, "needsImprovement": 4000 },
    "CLS": { "good": 0.1, "needsImprovement": 0.25 },
    "INP": { "good": 200, "needsImprovement": 500 }
  },
  "lighthouseThresholds": {
    "performance": 80,
    "accessibility": 90,
    "bestPractices": 85,
    "seo": 80
  },
  "lighthouseRuns": 3,
  "urls": [
    "https://example.com/",
    "https://example.com/dashboard"
  ]
}
```

## ciAction Values

| Value   | Behaviour                                                    |
|---------|--------------------------------------------------------------|
| `fail`  | Build fails on budget violation. Use for LCP, CLS, INP.      |
| `warn`  | PR comment posted, build passes. Acceptable for Lighthouse.  |
| `block` | PR is blocked from merging. Strongest enforcement.           |
| `none`  | **FORBIDDEN.** Budget exists on paper only.                  |

## Why lighthouseRuns ≥ 3?

A single Lighthouse run has variance of ±5–15 points depending on machine load,
network simulation accuracy, and background tasks. With 3 runs, the median is used —
much more stable. With 1 run, a 10-point swing is noise, not a regression.

## CLS Is Not Milliseconds

CLS (Cumulative Layout Shift) is a unitless score between 0 and ~0.5.
Setting `CLS: { good: 100 }` is a common mistake — 100ms is an LCP value, not a CLS value.
The compiler rejects any `CLS.good >= 1` as clearly wrong.

## Escape Hatches

None. Performance budget invariants have no valid escape hatch.
If a project genuinely cannot reach LCP ≤ 4000ms, that is a
performance problem to fix, not a compiler rule to bypass.

## Error Codes

| Code  | Name                        | Fix                                         |
|-------|-----------------------------|---------------------------------------------|
| QA030 | spec-invalid                | Add `coreWebVitals` or `lighthouseThresholds` |
| QA031 | fid-deprecated              | Replace `FID` with `INP`                    |
| QA032 | cls-not-decimal             | Set `CLS.good` to 0.1, not 100             |
| QA033 | lcp-unrealistic             | Use LCP.good between 500ms and 4000ms       |
| QA034 | ci-not-enforced             | Set `ciAction: "fail"` or `"warn"`          |
| QA035 | lighthouse-runs-insufficient| Set `lighthouseRuns: 3` (minimum)           |
| QA036 | todos-found                 | Resolve or remove all TODO/FIXME/HACK       |
| QA037 | artifact-invalid            | Run runner.mjs to regenerate artifact       |

## Output Artifact

`performance-budget-artifact.json`

```json
{
  "ir_id": "PERFORMANCE_BUDGET:my-app",
  "project": "my-app",
  "ciAction": "fail",
  "coreWebVitals": { "LCP": { "good": 2500 }, "CLS": { "good": 0.1 } },
  "lighthouseThresholds": { "performance": 80 },
  "lighthouseRuns": 3,
  "gates": [ { "pass": true, "code": "QA030", "message": "..." } ],
  "pass": true,
  "attestation": {
    "hash": "<sha256>",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```
