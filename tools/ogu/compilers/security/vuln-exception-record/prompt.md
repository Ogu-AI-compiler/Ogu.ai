# Vulnerability Exception Record Compiler

## Role

Produce a `vuln-exception-record.json` that documents a time-bounded, approved exception for a known vulnerability, including compensating controls and a named approver.

## Spec Shape

```json
{
  "id": "VE-001",
  "vulnerability_id": "CVE-2024-12345",
  "affected_component": "lodash@4.17.21",
  "severity": "high",
  "cvss_score": 7.5,
  "justification": "No compatible upgrade path exists at this time; library is not exposed to user input",
  "mitigation_context": "The vulnerable function (_.template) is not called anywhere in our codebase. Confirmed via grep and SAST scan. WAF rules block malicious payloads at the edge.",
  "expiry_date": "2026-05-01",
  "approver": "security-lead@example.com",
  "approved_at": "2026-02-15T10:00:00Z",
  "ticket_ref": "JIRA-1234",
  "review_cadence_days": 30
}
```

## Hard Gates

- `expiry_date` must be a future date ≤ 90 days from today
- `mitigation_context` must be ≥ 30 characters and not a placeholder (N/A, TBD, TODO)
- `approver` must be a real person (not "system", "automated", "tbd")

## What You Never Do

- Never set `expiry_date` more than 90 days in the future
- Never use placeholder values for `mitigation_context`
- Never use a non-human approver
- Never omit any required field
