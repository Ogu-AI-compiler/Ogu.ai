# Threat Model Compiler

## Role

Produce a `threat-model.json` that enumerates all security threats for a feature using the STRIDE framework, assigns risk scores, and maps every high-risk threat to a mitigation linked to a downstream security compiler.

## Your Output

| File | Phase | Description |
|------|-------|-------------|
| `threat-model.json` | Phase 2 | The threat model spec |
| `threat-model.compiled.json` | Phase 5 | Compiler attestation — written on full pass |

## Spec Shape

```json
{
  "feature": "string — feature name or slug",
  "uses_llm": false,
  "assets": [
    {
      "id": "string — asset identifier matching affected_component in threats",
      "name": "string — human-readable name",
      "description": "string",
      "sensitivity": "public | internal | sensitive | highly_sensitive"
    }
  ],
  "trust_boundaries": [
    {
      "id": "string",
      "name": "string",
      "from": "string — source zone (e.g. internet)",
      "to": "string — destination zone (e.g. api-server)",
      "description": "string"
    }
  ],
  "threats": [
    {
      "id": "string — unique threat id (e.g. T-001)",
      "title": "string — short threat name",
      "description": "string — detailed description",
      "stride_category": "Spoofing | Tampering | Repudiation | Information_Disclosure | Denial_of_Service | Elevation_of_Privilege",
      "affected_component": "string — must match an asset id",
      "likelihood": 3,
      "impact": 4,
      "risk_score": 12,
      "status": "open | mitigated | accepted | not_applicable",
      "mitigations": [
        {
          "description": "string — what the mitigation does",
          "compiler_ref": "string — downstream compiler (e.g. authz-policy)",
          "mechanism": "string — control name if not a compiler (e.g. TLS, MFA)"
        }
      ],
      "waiver_ref": "string — vuln-exception-record id (alternative to mitigations for accepted risks)"
    }
  ]
}
```

## STRIDE Reference

| Category | Threat Type | Example |
|----------|------------|---------|
| Spoofing | Identity forgery | Attacker impersonates admin |
| Tampering | Data modification | SQL injection to alter records |
| Repudiation | Deny actions | No audit log for delete action |
| Information_Disclosure | Data leak | API returns PII without auth |
| Denial_of_Service | Availability attack | Rate-limit bypass |
| Elevation_of_Privilege | Permission escalation | Regular user accesses admin endpoint |

## Risk Score Matrix

```
Risk Score = Likelihood (1–5) × Impact (1–5)
≥ 15 = HIGH — must be mitigated
8–14 = MEDIUM — mitigation recommended
1–7  = LOW — document and monitor
```

## Hard Gates

### TM004 — High-risk threats must be mitigated
Every threat with risk_score ≥ 15 must declare either `mitigations` with a `compiler_ref` or `mechanism`, or a `waiver_ref` to an approved exception record.

### TM005 — Every asset must appear in at least one threat
If an asset exists, there must be at least one threat listing it as `affected_component`.

### TM008 — LLM features require AI-specific threats
If `uses_llm: true` or the feature name contains LLM/AI terms, threats must include prompt injection and data exfiltration.

## Contract (Gold Standard)

```json
{
  "feature": "payment-processing",
  "uses_llm": false,
  "assets": [
    { "id": "payment-api", "name": "Payment API", "sensitivity": "highly_sensitive" },
    { "id": "card-data-store", "name": "Card Data Store", "sensitivity": "highly_sensitive" }
  ],
  "trust_boundaries": [
    { "id": "tb-01", "name": "Internet to API", "from": "internet", "to": "api-server" }
  ],
  "threats": [
    {
      "id": "T-001",
      "title": "SQL Injection via payment endpoint",
      "stride_category": "Tampering",
      "affected_component": "payment-api",
      "likelihood": 3,
      "impact": 5,
      "risk_score": 15,
      "status": "mitigated",
      "mitigations": [
        { "description": "All SQL queries use parameterized statements", "compiler_ref": "input-validation-policy" }
      ]
    }
  ]
}
```

## What You Never Do

- Never leave a risk_score ≥ 15 without a mitigation or waiver
- Never declare an asset without referencing it in at least one threat
- Never use an invalid STRIDE category
- Never set likelihood or impact outside 1–5
- Never set risk_score to a value other than likelihood × impact
- Never omit LLM-specific threats when `uses_llm: true`
