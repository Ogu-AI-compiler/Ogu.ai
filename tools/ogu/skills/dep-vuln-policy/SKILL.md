---
name: dep-vuln-policy
description: Compiler skill for the dep-vuln-policy compiler. Activates when producing dep-vuln-policy.json. Gates: DV001–DV006. No upstream dependency.
---

# dep-vuln-policy — Compiler Skill

## What This Compiler Does

Compiles the dependency vulnerability scanning policy. Enforces that critical vulnerabilities block the build, high-severity vulnerabilities have a remediation SLA, all exceptions reference a formal vuln-exception-record, and every package ecosystem used by the project is covered. The `vuln-exception-record` compiler reads this artifact.

**Upstream dependency:** none
**Output artifact:** `dep-vuln-policy.compiled.json`
**Spec file you write:** `dep-vuln-policy.json`

---

## Spec Shape

```json
{
  "project": "my-saas-app",
  "scan_tool": "snyk",
  "ecosystems": ["npm", "pip"],
  "severity": {
    "critical": {
      "action": "block",
      "max_cvss": 10.0
    },
    "high": {
      "action": "sla",
      "remediation_days": 14
    },
    "medium": {
      "action": "track",
      "remediation_days": 90
    },
    "low": {
      "action": "accept"
    }
  },
  "exceptions": [
    {
      "cve_id": "CVE-2023-12345",
      "waiver_ref": "vuln-exception-001",
      "expires_at": "2026-04-01"
    }
  ]
}
```

---

## Gates

### DV001 — spec-valid
Reads `dep-vuln-policy.json`. Skips (pass) if file absent.

Required top-level fields: `scan_tool` (string), `ecosystems` (non-empty array), `severity` (object).

### DV002 — critical-is-blocked
`severity.critical.action` must be `"block"`. Any other value means critical CVEs (CVSS ≥ 9.0) do not fail CI.

BAD: `"critical": { "action": "warn" }`.
BAD: `"critical": { "action": "accept" }`.
GOOD: `"critical": { "action": "block" }`.

### DV003 — high-has-sla
`severity.high` must declare `action: "sla"` and a positive `remediation_days` field.

BAD: `"high": { "action": "accept" }` — high CVEs accepted silently.
BAD: `"high": { "action": "sla" }` — SLA without a deadline.
GOOD: `"high": { "action": "sla", "remediation_days": 14 }`.

### DV004 — exceptions-reference-waiver
Every entry in `exceptions[]` must have a non-empty `waiver_ref` string referencing a vuln-exception-record artifact ID.

BAD: `{ "cve_id": "CVE-2023-99999" }` — no `waiver_ref`.
GOOD: `{ "cve_id": "CVE-2023-99999", "waiver_ref": "vuln-exception-001" }`.

### DV005 — all-ecosystems-covered
`ecosystems` must include every package manager used by the project. Detected from lockfiles:

| Lockfile | Ecosystem |
|---|---|
| `package-lock.json` or `yarn.lock` | `npm` |
| `Pipfile.lock` or `requirements.txt` | `pip` |
| `go.sum` | `go` |
| `Gemfile.lock` | `rubygems` |
| `Cargo.lock` | `cargo` |

BAD: project has `package-lock.json` and `Pipfile.lock` but `"ecosystems": ["npm"]` only.
GOOD: `"ecosystems": ["npm", "pip"]`.

### DV006 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `dep-vuln-policy.json`.

---

## What This Compiler Never Forgives

- `severity.critical.action` anything other than `"block"`
- `severity.high` without `remediation_days`
- Exception entries without a `waiver_ref`
- Project ecosystems missing from the `ecosystems` array
