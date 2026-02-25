# Ogu Error Codes

Format: `OGU{gate}{sequence}` — 4-digit code.
- First 2 digits = gate/phase number (01-14, 00 for general)
- Last 2 digits = specific error within that gate

## Severity Levels

- **error** — compilation fails, must fix
- **warn** — compilation succeeds but with warnings, should fix

## General (OGU00xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0001 | error | Missing required file: `{path}` |
| OGU0002 | error | Invalid JSON: `{path}` — `{parseError}` |
| OGU0003 | error | Feature `{slug}` not found |

## Gate 01 — Doctor (OGU01xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0101 | warn | Context lock stale: `{file}` hash mismatch |
| OGU0102 | error | .ogu/ directory missing or corrupted |

## Gate 02 — Context (OGU02xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0201 | warn | Spec section `{heading}` has no IR task coverage |

## Gate 03 — Plan (OGU03xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0301 | error | IR output chain broken: task `{id}` needs `{input}`, not produced by any prior task or pre-existing |
| OGU0302 | error | Unresolved IR input: `{identifier}` in task `{id}` |
| OGU0303 | error | Duplicate IR output: `{identifier}` in tasks `{id1}` and `{id2}` |
| OGU0304 | warn | Task `{id}` has no IR outputs (legacy format) |
| OGU0305 | error | IR output missing from codebase: `{identifier}` |

## Gate 04 — TODOs (OGU04xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0401 | error | TODO/FIXME found: `{file}:{line}` — `{text}` |

## Gate 05 — UI (OGU05xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0501 | error | Non-functional UI element: `{selector}` — `{reason}` |

## Gate 06 — Design (OGU06xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0601 | error | Design invariant violated: `{rule}` — found `{actual}`, expected `{expected}` |
| OGU0602 | warn | Design rule not machine-verifiable: `{rule}` (skipped) |
| OGU0603 | error | Too many border-radius values: found `{n}`, max `{max}` |
| OGU0604 | error | Spacing token violation: `{element}` has `{actual}px`, nearest token `{expected}px` (tolerance +/-2px) |
| OGU0605 | error | Inline style forbidden: `{file}:{line}` — `{property}` |

## Gate 07 — Brand (OGU07xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0701 | warn | Brand color mismatch: `{token}` expected `{expected}`, found `{actual}` |

## Gate 08 — Smoke (OGU08xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0801 | error | Smoke test failed: `{testName}` — `{error}` |

## Gate 09 — Vision (OGU09xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU0901 | error | Critical vision assertion failed: `{assertionId}` — `{rule}` |
| OGU0902 | warn | Non-critical vision assertion failed: `{assertionId}` — `{rule}` |
| OGU0903 | error | Vision pass rate below threshold: `{rate}%` < 80% |

## Gate 10 — Contracts (OGU10xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU1001 | warn | IR output `{identifier}` has no matching contract entry |
| OGU1002 | warn | Contract entry `{key}` is orphaned (no IR output references it) |
| OGU1003 | error | Contract violation: `{contract}` — `{detail}` |

## Gate 11 — Preview (OGU11xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU1101 | error | Preview health check failed: `{url}` returned `{status}` |

## Gate 12 — Memory (OGU12xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU1201 | warn | Memory update skipped: no new patterns detected |

## Gate 13 — Spec (OGU13xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU1301 | error | Spec hash chain broken: locked `{locked}` -> actual `{actual}`, no valid SCR path |
| OGU1302 | error | Spec section `{heading}` referenced by IR but missing from Spec.md |
| OGU1303 | warn | SCR `{id}` exists but hash chain already complete (redundant) |

## Gate 14 — Drift (OGU14xx)

| Code | Severity | Message |
|------|----------|---------|
| OGU1401 | error | IR output drift: `{identifier}` — `{status}` |
| OGU1402 | warn | Untracked file: `{path}` not in any task's touches[] |
| OGU1403 | error | Contract drift: `{contract}` — `{detail}` |
| OGU1404 | error | Design token drift: `{token}` expected `{expected}`, computed `{actual}` |
