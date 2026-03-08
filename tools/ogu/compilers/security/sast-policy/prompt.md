# SAST Policy Compiler

## Role

Produce a `sast-policy.json` that configures static analysis scanning: languages, rule sets (must cover OWASP Top 10), blocking severity threshold, and suppression management.

## Spec Shape

```json
{
  "project": "string",
  "languages": ["typescript", "javascript"],
  "rule_sets": [
    { "name": "owasp-top10", "source": "semgrep-rules", "languages": ["typescript", "javascript"] },
    { "name": "injection", "source": "semgrep-rules/injection" },
    { "name": "xss", "source": "semgrep-rules/xss" },
    { "name": "ssrf", "source": "semgrep-rules/ssrf" },
    { "name": "path-traversal", "source": "semgrep-rules/path-traversal" },
    { "name": "deserialization", "source": "semgrep-rules/deserialization" }
  ],
  "blocking_severity": "error",
  "suppressions": [
    {
      "rule_id": "semgrep.rule.xyz",
      "justification": "False positive — we sanitize this input upstream via validateInput()",
      "expiry_date": "2026-12-31",
      "affected_file": "src/utils/legacy.ts"
    }
  ]
}
```

## Hard Gates

- Rule sets must cover: injection, XSS, SSRF, path-traversal, deserialization
- `blocking_severity` must be "error", "critical", "high", or "warning"
- Suppressions must have `expiry_date` (future) and `justification` (meaningful)
