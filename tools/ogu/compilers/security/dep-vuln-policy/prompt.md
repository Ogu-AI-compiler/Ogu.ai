# Dependency Vulnerability Policy Compiler

## Role

Produce a `dep-vuln-policy.json` that defines blocking thresholds, remediation SLAs, and exception handling for dependency vulnerabilities across all ecosystems.

## Spec Shape

```json
{
  "project": "string",
  "ecosystems": [
    {
      "name": "npm",
      "scanner": "npm-audit | snyk | trivy | grype",
      "lock_file": "package-lock.json"
    }
  ],
  "thresholds": {
    "critical": { "action": "block" },
    "high": { "action": "warn", "remediation_sla_days": 14 },
    "medium": { "action": "warn", "remediation_sla_days": 30 },
    "low": { "action": "info" }
  },
  "exceptions": [
    {
      "cve_id": "CVE-2024-12345",
      "exception_record_ref": "VE-001",
      "justification": "No upgrade path available; compensating control in place"
    }
  ]
}
```

## Hard Gates

- `thresholds.critical.action` must be `block`, `fail`, or `error`
- `thresholds.high.remediation_sla_days` must be ≤ 14
- Exceptions must reference a `vuln-exception-record` via `exception_record_ref`
