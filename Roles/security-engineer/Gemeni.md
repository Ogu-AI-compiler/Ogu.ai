# Security Engineer Domain Compiler Network

This document defines the atomic task types for the Security Engineer role within a formal compiler network. Each compiler takes a specific intent (specification) and produces a verified, machine-readable, and attested artifact.

---

## Summary Table

| Compiler ID                 | Frequency    | Input                            | Output                                 |
| :-------------------------- | :----------- | :------------------------------- | :------------------------------------- |
| `threat-model`              | Per-Feature  | Feature Spec + Data Flow         | JSON Threat Graph / Risk Registry      |
| `authz-policy`              | Per-Feature  | Resource + Action + Actor Matrix | Rego (OPA) or Cedar Policy File        |
| `secret-spec`               | Per-Project  | App Architecture + Integrations  | Secret Metadata / Rotation Config      |
| `sast-custom-rule`          | Per-Incident | Vulnerability Pattern (Code)     | Semgrep / CodeQL Rule Set              |
| `csp-manifest`              | Per-Page     | Origin List + Asset Types        | Content-Security-Policy Header         |
| `input-validation-schema`   | Per-Feature  | API Spec + Data Types            | JSON Schema / Zod Constraints          |
| `rate-limit-policy`         | Per-Feature  | Endpoint + Sensitivity Level     | Redis / Gateway Throttling Config      |
| `webhook-verification-spec` | Per-Feature  | Provider Payload + Signing Algo  | Verification Logic / Signature Spec    |
| `file-upload-policy`        | Per-Feature  | Upload Source + Type             | S3 Bucket Policy / Scanner Config      |
| `audit-logging-spec`        | Per-Feature  | Sensitive Action List            | Structured Log Schema / Event Map      |
| `data-classification-map`   | Per-Project  | Database Schema                  | PII / Sensitive Data Tagging Manifest  |
| `dependency-allowlist`      | Daily        | SBOM / Vulnerability Feed        | Deny/Allow Decision Record             |
| `vulnerability-waiver`      | Per-Incident | CVE ID + Mitigation Strategy     | Signed Exception Manifest              |
| `iac-guardrail`             | Per-Project  | Infrastructure Intent            | Terraform / CloudFormation Lint Policy |

---

## Detailed Compiler Breakdown

### 1. `threat-model`

- **Name:** `threat-model-compiler`
- **Frequency:** Per-feature.
- **Input:** Functional requirement spec, data flow diagram (DFD) nodes, and asset list.
- **Output:** JSON-formatted Threat Model including STRIDE categories and mitigation IDs.
- **Correctness Gates:**
  - Every external data entry point (from `api-route`) must have at least one associated threat.
  - Every identified threat must map to a `mitigation-id` or a `vulnerability-waiver`.
- **Dependencies:** `openapi-spec`, `api-route`.
- **Downstream Consumers:** `authz-policy`, `sast-custom-rule`, `audit-logging-spec`.

### 2. `authz-policy`

- **Name:** `authz-policy-compiler`
- **Frequency:** Per-feature.
- **Input:** Resource definitions, action mappings (CRUD+), and actor roles (human/machine).
- **Output:** Rego (OPA) files or Cedar policy modules.
- **Correctness Gates:**
  - Policy must include an explicit "Default Deny" statement.
  - All defined `api-route` endpoints must be covered by at least one policy rule.
  - No rule may grant `admin` permissions to `unauthenticated` scopes.
- **Dependencies:** `auth-middleware`, `api-route`.
- **Downstream Consumers:** API Gateway, Runtime Policy Engine.

### 3. `secret-spec`

- **Name:** `secret-spec-compiler`
- **Frequency:** Per-project.
- **Input:** List of third-party integrations and internal service-to-service dependencies.
- **Output:** Secret Manager configuration (e.g., AWS Secrets Manager or HashiCorp Vault manifest).
- **Correctness Gates:**
  - Every secret must have a defined `rotation-interval` (e.g., 30, 60, 90 days).
  - Mandatory `ttl` (Time-to-Live) for machine-to-machine tokens.
- **Dependencies:** `infrastructure-spec`.
- **Downstream Consumers:** CI/CD Secret Injector, Runtime Environment.

### 4. `csp-manifest`

- **Name:** `csp-manifest-compiler`
- **Frequency:** Per-page (or per-app).
- **Input:** List of required external scripts, styles, and API origins.
- **Output:** `Content-Security-Policy` header string or Meta tag.
- **Correctness Gates:**
  - `script-src` must not contain `'unsafe-inline'` unless a cryptographic nonce is specified.
  - `base-uri` must be explicitly defined (no default to `*`).
- **Dependencies:** `react-page`.
- **Downstream Consumers:** Load Balancer / Web Server config.

### 5. `input-validation-schema`

- **Name:** `input-validation-compiler`
- **Frequency:** Per-feature.
- **Input:** Field types, regex patterns, and business constraints.
- **Output:** JSON Schema or Zod validation objects for security-sensitive fields.
- **Correctness Gates:**
  - All string fields must have a `maxLength` defined.
  - Numeric fields must have `min`/`max` bounds.
- **Dependencies:** `ts-schema`, `openapi-spec`.
- **Downstream Consumers:** `api-route`, `react-form`.

### 6. `rate-limit-policy`

- **Name:** `rate-limit-compiler`
- **Frequency:** Per-feature.
- **Input:** Endpoint criticality (Auth vs. Public vs. Internal) and expected traffic.
- **Output:** Distributed Rate Limiter config (e.g., Envoy or Redis-based).
- **Correctness Gates:**
  - Auth-related endpoints (login/reset) must have lower thresholds than standard GET endpoints.
  - Public endpoints must have a per-IP limit defined.
- **Dependencies:** `api-route`.
- **Downstream Consumers:** Ingress Controller / API Gateway.

### 7. `webhook-verification-spec`

- **Name:** `webhook-verification-compiler`
- **Frequency:** Per-feature.
- **Input:** Provider name (Stripe, GitHub, etc.) and signing algorithm.
- **Output:** Cryptographic verification logic or Middleware configuration.
- **Correctness Gates:**
  - Must use a constant-time string comparison for signature checks to prevent timing attacks.
  - Timestamp "replay protection" window must be $\leq 300$ seconds.
- **Dependencies:** `auth-middleware`, `api-route`.
- **Downstream Consumers:** Webhook Handler.

### 8. `file-upload-policy`

- **Name:** `file-upload-compiler`
- **Frequency:** Per-feature.
- **Input:** Allowed MIME types, max file size, and storage destination.
- **Output:** S3 Bucket Policy / Scanner configuration.
- **Correctness Gates:**
  - `public-read` must be disabled by default.
  - Allowed extensions must be restricted (e.g., no `.exe`, `.sh`, `.html`).
- **Dependencies:** `api-route`.
- **Downstream Consumers:** Storage Service, Infrastructure-as-Code.

### 9. `audit-logging-spec`

- **Name:** `audit-log-compiler`
- **Frequency:** Per-feature.
- **Input:** List of high-risk actions (delete, export, permission change).
- **Output:** Structured logging schema with required security context fields.
- **Correctness Gates:**
  - Must include `actor_id`, `timestamp`, `source_ip`, and `action_result`.
  - Prohibit logging of fields marked as "Secret" or "PII" in `ts-schema`.
- **Dependencies:** `ts-schema`, `authz-policy`.
- **Downstream Consumers:** SIEM, Compliance Reports.

### 10. `data-classification-map`

- **Name:** `data-classification-compiler`
- **Frequency:** Per-project.
- **Input:** Database schema and entity relationships.
- **Output:** PII Manifest (mapping columns to levels: Public, Internal, Sensitive, Highly Sensitive).
- **Correctness Gates:**
  - Every table in the `db-migration` must have an assigned classification.
  - "Highly Sensitive" columns must map to an encryption key in `secret-spec`.
- **Dependencies:** `db-migration`.
- **Downstream Consumers:** `audit-logging-spec`, Data Masking Service.

### 11. `vulnerability-waiver`

- **Name:** `waiver-compiler`
- **Frequency:** Per-incident.
- **Input:** CVE ID, Business Justification, and Expiration Date.
- **Output:** Cryptographically signed JSON waiver record.
- **Correctness Gates:**
  - Expiration date must be $\leq 90$ days.
  - Must contain a `mitigation-context` explaining manual controls.
- **Dependencies:** `dependency-allowlist`.
- **Downstream Consumers:** CI/CD Blocking Step.

---

## Recommended Build Order

To ensure the dependency graph is respected, build the compilers in the following sequence:

1.  **Foundational Layer (Project-Level):**
    - `data-classification-map` (Essential for knowing what to protect)
    - `secret-spec` (Sets up the trust infrastructure)
    - `iac-guardrail` (Sets the base for the cloud environment)

2.  **Core Application Layer (Feature-Level):**
    - `threat-model` (Identifies the specific risks for the feature)
    - `authz-policy` (Builds on the resources defined in the feature)
    - `input-validation-schema` (Hardens the API entry points)

3.  **Edge & Transport Layer:**
    - `csp-manifest`
    - `rate-limit-policy`
    - `webhook-verification-spec`
    - `file-upload-policy`

4.  **Governance & Response Layer (Daily/Incident):**
    - `audit-logging-spec`
    - `dependency-allowlist`
    - `vulnerability-waiver`
    - `sast-custom-rule`
