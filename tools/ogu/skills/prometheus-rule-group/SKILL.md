---
name: prometheus-rule-group
description: Compiler skill for the prometheus_rule_group compiler. Activates when producing prometheus-rules-artifact.json. Gates: PR001–PR007. No upstream dependency.
---

# prometheus-rule-group — Compiler Skill

## What This Compiler Does

Compiles the Prometheus alerting and recording rule groups — alert name uniqueness, required fields, recording rule name format, severity label validity, and runbook URL requirement. Enforces: no duplicate alert names across groups, every alert has `expr`/`labels.severity`/`annotations.summary`, recording rule names match the Prometheus metric name regex, severity is one of the allowed values, and all alerts link to a runbook.

**Upstream dependency:** none
**Output artifact:** `prometheus-rules-artifact.json`
**IR identifier:** `PROMETHEUS_RULES:{project}`

---

## Spec Shape

```json
{
  "groups": [
    {
      "name": "api-alerts",
      "interval": "1m",
      "rules": [
        {
          "alert": "HighErrorRate",
          "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) > 0.05",
          "for": "5m",
          "labels": { "severity": "critical", "team": "backend" },
          "annotations": {
            "summary": "High HTTP error rate detected",
            "description": "Error rate is {{ $value | humanizePercentage }}",
            "runbook_url": "https://runbooks.example.com/high-error-rate"
          }
        },
        {
          "record": "job:http_requests:rate5m",
          "expr": "rate(http_requests_total[5m])"
        }
      ]
    }
  ]
}
```

Required fields:
- `groups` — non-empty array, each with `name` and `rules`

---

## Gates

### PR001 — spec-valid
Reads `prometheus-rules-spec.json`. Required: `groups` (non-empty array). Each group needs `name` and `rules`.

Hard-fails if `prometheus-rules-spec.json` is missing.

### PR002 — alert-names-unique
Alert names must be unique across all groups. Duplicate alert names silently overwrite each other in Alertmanager — only one fires.

BAD:
```json
{ "groups": [
  { "name": "group-a", "rules": [{ "alert": "HighLatency", "expr": "..." }] },
  { "name": "group-b", "rules": [{ "alert": "HighLatency", "expr": "..." }] }
]}
// HighLatency declared in two groups
```
GOOD: Each alert name appears exactly once across all groups.

### PR003 — alerts-have-required-fields
Each alert rule must declare:
- `expr` — the PromQL expression
- `labels.severity` — required for Alertmanager routing
- `annotations.summary` — human-readable description

BAD:
```json
{ "alert": "HighLatency", "expr": "..." }
// missing labels.severity and annotations.summary
```
GOOD:
```json
{
  "alert": "HighLatency",
  "expr": "histogram_quantile(0.99, rate(http_duration_seconds_bucket[5m])) > 1",
  "labels": { "severity": "warning" },
  "annotations": { "summary": "P99 latency exceeds 1 second" }
}
```

### PR004 — recording-rule-names-valid
Recording rule `record` names must match the Prometheus metric name format: `/^[a-zA-Z_:][a-zA-Z0-9_:]*$/`

BAD:
```json
{ "record": "job:http requests:rate5m" }
// spaces not allowed
```
```json
{ "record": "0job:http_requests:rate5m" }
// cannot start with digit
```
GOOD:
```json
{ "record": "job:http_requests:rate5m" }
```

### PR005 — severity-labels-valid
`labels.severity` must be one of: `critical`, `warning`, `info`, `page`, `ticket`.

BAD:
```json
{ "labels": { "severity": "urgent" } }
// not in allowlist
```
GOOD:
```json
{ "labels": { "severity": "critical" } }
```

### PR006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### PR007 — contract-rules
Final contract checks:
- At least one alert rule must be present across all groups (unless `recordingOnly: true`)
- All alert rules must have `annotations.runbook_url` or `annotations.runbook` — alerts without runbooks leave on-call engineers with no response guidance

BAD:
```json
{
  "alert": "HighLatency",
  "expr": "...",
  "labels": { "severity": "critical" },
  "annotations": { "summary": "High latency" }
}
// no runbook_url or runbook
```
GOOD:
```json
{
  "annotations": {
    "summary": "High latency",
    "runbook_url": "https://runbooks.example.com/high-latency"
  }
}
```

---

## What This Compiler Never Forgives

- `prometheus-rules-spec.json` missing (PR001 hard-fails)
- `groups` missing or empty (PR001)
- Any group missing `name` or `rules` (PR001)
- Duplicate alert names across groups (PR002)
- Alert missing `expr` (PR003)
- Alert missing `labels.severity` (PR003)
- Alert missing `annotations.summary` (PR003)
- Recording rule `record` name not matching `/^[a-zA-Z_:][a-zA-Z0-9_:]*$/` (PR004)
- `labels.severity` not in valid list (PR005)
- No alert rules without `recordingOnly: true` (PR007)
- Alert missing `annotations.runbook_url` or `annotations.runbook` (PR007)
