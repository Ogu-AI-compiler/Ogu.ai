---
name: threat-model
description: Compiler skill for the threat-model compiler. Activates when producing threat-model.json. Gates: TM001–TM009. No upstream dependency — this is the root security artifact.
---

# threat-model — Compiler Skill

## What This Compiler Does

Compiles a structured threat model for a feature or system. It is the root of the security IR chain — `authz-policy`, `audit-log-policy`, and `input-validation-policy` all read `threat-model.compiled.json` as input. If this artifact is missing or invalid, downstream security compilers skip or fail.

**Upstream dependency:** none
**Output artifact:** `threat-model.compiled.json`
**Spec file you write:** `threat-model.json`

---

## Spec Shape

```json
{
  "feature": "user-authentication",
  "assets": [
    { "id": "user-credentials", "name": "User Credentials" },
    { "id": "session-token",    "name": "Session Token" }
  ],
  "trust_boundaries": [
    { "id": "public-internet", "name": "Public Internet / API Gateway" },
    { "id": "internal-network", "name": "Internal Service Mesh" }
  ],
  "threats": [
    {
      "id": "T001",
      "title": "Credential stuffing via login endpoint",
      "stride_category": "Spoofing",
      "affected_component": "auth-service",
      "likelihood": 4,
      "impact": 5,
      "risk_score": 20,
      "mitigations": [
        {
          "description": "Rate-limit login to 10 rpm per IP and lock out after 5 failures",
          "compiler_ref": "rate-limit-policy"
        }
      ]
    },
    {
      "id": "T002",
      "title": "Session token theft via XSS",
      "stride_category": "InformationDisclosure",
      "affected_component": "session-token",
      "likelihood": 3,
      "impact": 4,
      "risk_score": 12,
      "mitigations": [
        {
          "description": "Set HttpOnly and Secure flags on all session cookies",
          "compiler_ref": "session-cookie-policy"
        }
      ]
    }
  ]
}
```

---

## Gates

### TM001 — spec-valid
Reads `threat-model.json`. Skips (pass) if file absent.

Required top-level fields: `feature` (string), `assets` (non-empty array), `trust_boundaries` (array), `threats` (array).

Required per-threat fields: `id`, `title`, `stride_category`, `affected_component`, `likelihood`, `impact`.

BAD: `{ "feature": "auth" }` → missing `assets`, `trust_boundaries`, `threats`.
BAD: threat missing `affected_component` → gate fails naming the index and field.
GOOD: all six per-threat fields present on every threat.

### TM002 — stride-categories-valid
`stride_category` must be **exactly** one of these six strings (case-sensitive):

```
Spoofing
Tampering
Repudiation
InformationDisclosure
DenialOfService
ElevationOfPrivilege
```

BAD: `"stride_category": "DoS"` → not in set.
BAD: `"stride_category": "information disclosure"` → wrong casing.
GOOD: `"stride_category": "DenialOfService"`.

### TM003 — risk-score-valid
`likelihood` and `impact` must each be integers 1–5. The computed score is `likelihood × impact` (range 1–25). You may also set `risk_score` explicitly to override the computed value.

BAD: `"likelihood": "high"` → string, not number.
BAD: `"likelihood": 6` → out of range.
GOOD: `"likelihood": 4, "impact": 5` → score 20.

### TM004 — high-risk-mitigated
Any threat with `risk_score >= 15` (or `likelihood × impact >= 15`) must have either:
- `mitigations`: non-empty array, each entry with a `description` of at least 5 characters, OR
- `waiver_ref`: non-empty string referencing a vuln-exception-record.

BAD: threat with `likelihood: 5, impact: 4` (score 20) and no `mitigations` and no `waiver_ref`.
BAD: `"mitigations": [{ "description": "ok" }]` → description < 5 chars.
GOOD: `"mitigations": [{ "description": "Apply rate limiting per rate-limit-policy", "compiler_ref": "rate-limit-policy" }]`.

### TM005 — every-asset-has-threat
Every `id` in `assets[]` must appear as `affected_component` on at least one threat.

BAD: `assets: [{ "id": "database" }]` but no threat references `"affected_component": "database"`.
GOOD: every asset ID is covered by at least one threat.

### TM006 — trust-boundaries-named
`trust_boundaries` array must be non-empty and every entry must have a non-empty `name` string.

BAD: `"trust_boundaries": [{}]` → missing `name`.
GOOD: `{ "id": "api-gateway", "name": "API Gateway / CDN Edge" }`.

### TM007 — mitigations-reference-compiler
Every mitigation that exists must declare **either** `compiler_ref` OR `mechanism`. A mitigation with neither fails.

Accepted `compiler_ref` values: `authz-policy`, `input-validation-policy`, `rate-limit-policy`, `csp-policy`, `audit-log-policy`, `webhook-verification-policy`, `file-upload-policy`, `session-cookie-policy`, `dep-vuln-policy`, `sast-policy`, `secret-handling-policy`, `pii-classification`, `encryption-key-policy`, `vuln-exception-record`.

Accepted `mechanism` values (examples): `tls`, `mfa`, `cors`, `waf`, `input-sanitization`, `output-encoding`, `parameterized-queries`, `csrf-protection`, `authentication`, `authorization`.

BAD: `"mitigations": [{ "description": "Encrypt data in transit" }]` → no `compiler_ref` or `mechanism`.
GOOD: `{ "description": "Enforce TLS 1.3", "mechanism": "tls" }`.

### TM008 — llm-surfaces-addressed
If the feature involves LLM/AI (detectable from the feature name or spec content), the threat model must include at least one threat about prompt injection or model abuse.

BAD: feature `"ai-chat-assistant"` with no threat mentioning prompt injection.
GOOD: `{ "title": "Prompt injection via user message", "stride_category": "Tampering" }`.
Skips automatically if no LLM surfaces are detectable.

### TM009 — no-todos
No `TODO`, `FIXME`, or `HACK` anywhere in `threat-model.json`.

---

## What This Compiler Never Forgives

- `stride_category` outside the exact six-value enum (any casing or abbreviation variant fails)
- High-risk threats (score ≥ 15) with no mitigation and no `waiver_ref`
- Any asset in `assets[]` with no corresponding `affected_component` in `threats[]`
- A mitigation with neither `compiler_ref` nor `mechanism`
- `likelihood` or `impact` outside the integer range 1–5
