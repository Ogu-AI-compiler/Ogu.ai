---
name: sast-policy
description: Compiler skill for the sast-policy compiler. Activates when producing sast-policy.json. Gates: ST001–ST006. No upstream dependency.
---

# sast-policy — Compiler Skill

## What This Compiler Does

Compiles the static analysis security testing (SAST) configuration. Enforces that all OWASP Top 10 categories are covered, error-severity findings block the build, all suppressions have expiry dates, and every programming language in the project is included in the scan.

**Upstream dependency:** none
**Output artifact:** `sast-policy.compiled.json`
**Spec file you write:** `sast-policy.json`

---

## Spec Shape

```json
{
  "project": "my-saas-app",
  "tool": "semgrep",
  "languages": ["typescript", "javascript"],
  "block_on_severity": "error",
  "owasp_categories": [
    "A01-injection",
    "A02-broken-auth",
    "A03-xss",
    "A04-insecure-design",
    "A05-security-misconfiguration",
    "A06-vulnerable-components",
    "A07-auth-failures",
    "A08-integrity-failures",
    "A09-logging-failures",
    "A10-ssrf"
  ],
  "suppressions": [
    {
      "id": "suppress-001",
      "rule_id": "javascript.lang.security.detect-eval",
      "reason": "eval() used in sandboxed test harness only — never in production paths",
      "expires_at": "2026-06-01",
      "approved_by": "security-team"
    }
  ]
}
```

---

## Gates

### ST001 — spec-valid
Reads `sast-policy.json`. Skips (pass) if file absent.

Required top-level fields: `tool` (string), `languages` (non-empty array), `block_on_severity` (string).

### ST002 — owasp-categories-covered
`owasp_categories` must contain representations of all OWASP Top 10 categories. The gate uses substring keyword matching — all 10 must be detectable:

| Category | Required keyword |
|---|---|
| A01 | `injection` |
| A02 | `broken-auth` or `authentication` |
| A03 | `xss` or `cross-site` |
| A04 | `insecure-design` |
| A05 | `misconfiguration` |
| A06 | `vulnerable-component` |
| A07 | `auth-fail` |
| A08 | `integrity` |
| A09 | `logging` |
| A10 | `ssrf` |

BAD: `"owasp_categories": ["injection", "xss"]` — only 2 of 10 covered.
GOOD: all 10 categories represented.

### ST003 — error-severity-blocking
`block_on_severity` must be `"error"` or `"high"` (case-insensitive). Any other value means the build continues with security findings.

BAD: `"block_on_severity": "warning"`.
BAD: `"block_on_severity": "none"`.
GOOD: `"block_on_severity": "error"`.

### ST004 — suppressions-have-expiry
Every entry in `suppressions[]` must have an `expires_at` field in `YYYY-MM-DD` format. Suppressions without an expiry are permanent blind spots.

BAD: `{ "id": "suppress-001", "rule_id": "...", "reason": "..." }` — no `expires_at`.
GOOD: `"expires_at": "2026-06-01"`.

### ST005 — language-coverage-complete
`languages` must include every programming language present in the project. Detected from source file extensions (`.ts`/`.tsx`/`.js`/`.mjs` → `typescript`/`javascript`, `.py` → `python`, `.go` → `go`, `.java` → `java`, `.rs` → `rust`).

BAD: project has `.py` files but `"languages": ["typescript"]` only.
GOOD: `"languages": ["typescript", "javascript", "python"]`.

### ST006 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `sast-policy.json`.

---

## What This Compiler Never Forgives

- `block_on_severity` set to anything other than `"error"` or `"high"`
- Suppressions without an `expires_at` date
- OWASP Top 10 coverage missing any of the 10 categories
- Project languages missing from the `languages` array
