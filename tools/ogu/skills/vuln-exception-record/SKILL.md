---
name: vuln-exception-record
description: Compiler skill for the vuln-exception-record compiler. Activates when producing vuln-exception-record.json. Gates: VE001–VE006. Upstream: dep-vuln-policy.compiled.json.
---

# vuln-exception-record — Compiler Skill

## What This Compiler Does

Compiles a formal vulnerability exception record. A vuln-exception-record is required whenever `dep-vuln-policy` has an entry in its `exceptions[]` array. Enforces that the expiry is within 90 days, the mitigation context is meaningful (not boilerplate), an approver is declared, and the affected components are explicitly listed.

**Upstream dependency:** `dep-vuln-policy.compiled.json`
**Output artifact:** `vuln-exception-record.compiled.json`
**Spec file you write:** `vuln-exception-record.json`

---

## Spec Shape

```json
{
  "id": "vuln-exception-001",
  "cve_id": "CVE-2023-12345",
  "severity": "high",
  "affected_components": ["api-service@1.2.3", "worker-service@2.0.1"],
  "mitigation_context": "This CVE affects the XML parser in a code path invoked only when processing internal configuration files, not user input. Exploitability requires write access to the config volume, which is restricted to the infrastructure team via IAM policy.",
  "expires_at": "2026-05-01",
  "approver": "security-lead@company.com",
  "created_at": "2026-03-08"
}
```

---

## Gates

### VE001 — spec-valid
Reads `vuln-exception-record.json`. Skips (pass) if file absent.

Required fields: `cve_id` (string), `severity` (string), `expires_at` (string), `mitigation_context` (string), `approver` (string).

### VE002 — expiry-within-90-days
`expires_at` must be within 90 days from today. Exceptions with longer windows must be split or renewed.

Today is **2026-03-08** → maximum allowed `expires_at` is **2026-06-06**.

BAD: `"expires_at": "2027-01-01"` — 298 days out.
GOOD: `"expires_at": "2026-05-01"` — within 90 days.

### VE003 — mitigation-context-meaningful
`mitigation_context` must be a genuine explanation, not boilerplate. The gate rejects:
- Strings shorter than ~50 characters
- Generic phrases: `"will fix later"`, `"not applicable"`, `"no impact"`, `"low risk"`, `"accepted"`

The field must explain **specifically** why this CVE is not exploitable in **this** deployment context.

BAD: `"mitigation_context": "Low risk"`.
BAD: `"mitigation_context": "Will fix later"`.
GOOD: A real sentence (≥ 50 chars) that names the specific code path, deployment constraint, or compensating control.

### VE004 — approver-declared
`approver` must be a non-empty string.

BAD: `"approver": ""` or missing field.
GOOD: `"approver": "security-lead@company.com"`.

### VE005 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `vuln-exception-record.json`.

### VE006 — affected-components-listed
`affected_components` must be a non-empty array of strings scoping which packages or services carry this exception.

BAD: no `affected_components` field.
BAD: `"affected_components": []` — empty scope means exception applies everywhere.
GOOD: `"affected_components": ["lodash@4.17.20"]`.

---

## What This Compiler Never Forgives

- `expires_at` more than 90 days in the future (max today + 90 days)
- `mitigation_context` that is boilerplate or too short
- Missing `approver`
- Empty `affected_components` array
