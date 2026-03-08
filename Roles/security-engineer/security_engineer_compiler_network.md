# Security Engineer Compiler Network
> Domain Compiler Network — Security Engineer Role Decomposition
> Generated for: formal compiler network build planning
> Excludes already-built and shared/cross-role compilers

---

## Summary Table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| `threat-model` | per-feature | Architecture diagram, data flow, asset register | `threat-model.json` |
| `authz-policy` | per-feature | Role definitions, resource types, action matrix | `authz-policy.json` / `rego` |
| `permission-matrix` | per-feature | Role list, resource list, CRUD/action map | `permission-matrix.json` |
| `secret-handling-policy` | per-project | Secret types inventory, env list, rotation requirements | `secret-policy.json` |
| `dep-vuln-policy` | per-project | Dependency ecosystem, severity thresholds, exceptions list | `dep-vuln-policy.json` |
| `sast-policy` | per-project | Language/framework list, rule categories, suppression list | `semgrep-policy.yaml` / `.semgrepignore` |
| `dast-scan-config` | per-project | Target URL list, auth config, scan scope | `dast-config.yaml` |
| `csp-policy` | per-feature | Frontend asset inventory, third-party origins, nonce strategy | `csp-policy.json` |
| `security-headers-policy` | per-project | App type, embedding requirements, CORS origins | `security-headers.json` |
| `input-validation-policy` | per-feature | API surface / schema, field types, trust boundaries | `input-validation-policy.json` |
| `rate-limit-policy` | per-feature | Endpoint list, user tiers, abuse surface assessment | `rate-limit-policy.json` |
| `webhook-verification-policy` | per-feature | Webhook provider list, signing mechanism, payload schema | `webhook-policy.json` |
| `file-upload-policy` | per-feature | Upload surface spec, allowed types, storage target | `file-upload-policy.json` |
| `session-cookie-policy` | per-project | Auth mechanism, session duration requirements, domain config | `session-policy.json` |
| `encryption-key-policy` | per-project | Data classification, KMS/vault config, rotation schedule | `encryption-policy.json` |
| `audit-log-policy` | per-feature | Event types, actor/resource/action taxonomy, retention reqs | `audit-log-policy.json` |
| `pii-classification-policy` | per-project | Data model, field inventory, jurisdiction requirements | `pii-policy.json` |
| `secure-code-review-spec` | per-feature | Feature spec, language, risk tier | `code-review-checklist.json` |
| `sbom-policy` | per-project | Build system, artifact types, attestation format | `sbom-policy.json` |
| `container-scan-policy` | per-project | Base image list, registry config, severity thresholds | `container-scan-policy.yaml` |
| `iac-security-policy` | per-project | IaC toolchain, cloud provider, resource types | `iac-policy.json` / OPA rego |
| `runtime-guardrails` | per-project | Runtime environment, syscall profile, network egress rules | `runtime-policy.json` |
| `vuln-exception-record` | per-incident | CVE/finding ID, affected component, business justification | `exception-record.json` |
| `abuse-surface-model` | per-feature | Feature spec, user types, AI/LLM surface flag | `abuse-model.json` |
| `cors-policy` | per-feature | Origin list, credential requirements, method allowlist | `cors-policy.json` |
| `ssrf-risk-profile` | per-feature | Outbound HTTP surfaces, URL input fields, service mesh config | `ssrf-risk-profile.json` |
| `token-rotation-policy` | per-project | Token types, expiry requirements, rotation triggers | `token-rotation-policy.json` |
| `staging-prod-drift-report` | daily | Staging policy set, production policy set | `drift-report.json` |
| `third-party-integration-policy` | per-feature | Third-party service spec, data shared, auth method | `third-party-policy.json` |
| `mtls-trust-policy` | per-project | Service mesh topology, cert authority config, service identities | `mtls-policy.json` |

---

## Detailed Breakdown

---

### 1. `threat-model`

**Frequency:** per-feature

**Input:**
- Architecture diagram (system context, container, component level)
- Data flow diagram (DFD)
- Asset register (crown jewels, data tiers)
- Trust boundary definitions
- Feature spec / PRD

**Output:**
- `threat-model.json` — structured threat enumeration with STRIDE classification, affected components, risk score, and required mitigations

**Correctness Gates:**
1. Every trust boundary crossing has at least one threat entry
2. Every threat entry has a STRIDE category assigned (`Spoofing | Tampering | Repudiation | Info Disclosure | DoS | Elevation`)
3. Every threat entry has a risk score (`likelihood × impact`, both 1–5)
4. Every threat with risk score ≥ 15 has at least one mitigation mapped
5. Every mitigation references a downstream compiler ID (e.g., `authz-policy`, `rate-limit-policy`)
6. No component is listed as both trusted and untrusted in the same boundary
7. External actor nodes are present for every public-facing interface
8. AI/LLM surfaces (if present) have prompt injection and data exfiltration threats enumerated

**Dependencies:**
- Architecture diagrams (external input)
- `pii-classification-policy` (to identify high-value data assets)

**Downstream Consumers:**
- `authz-policy`
- `input-validation-policy`
- `rate-limit-policy`
- `abuse-surface-model`
- `ssrf-risk-profile`
- `secure-code-review-spec`

---

### 2. `authz-policy`

**Frequency:** per-feature

**Input:**
- Role definitions (RBAC/ABAC model)
- Resource type list
- Action matrix (CRUD + custom verbs)
- Multi-tenancy flag (single-tenant / multi-tenant)
- Machine-to-machine (M2M) actor list
- `threat-model.json` (elevation of privilege threats)
- `permission-matrix.json`

**Output:**
- `authz-policy.json` — declarative policy mapping subjects → resources → actions → effect (allow/deny)
- Optionally: `authz-policy.rego` (Open Policy Agent format)

**Correctness Gates:**
1. Every resource type has at least one explicit deny-by-default rule
2. Every `allow` rule specifies a minimum required role or claim
3. Multi-tenant resources have a `tenant_id` isolation predicate on every allow rule
4. M2M actors are listed as first-class subjects with scoped permissions (not inheriting user roles)
5. No wildcard (`*`) resource or action matches on production policy
6. Every admin-tier action requires an explicit elevated role (not base `user`)
7. Cross-tenant read/write actions are explicitly enumerated and denied unless whitelisted
8. Policy lints clean against OPA/Cedar policy linter with zero errors

**Dependencies:**
- `threat-model.json`
- `permission-matrix.json`

**Downstream Consumers:**
- `auth-middleware` (already built)
- `api-route` (already built)
- `audit-log-policy`
- `secure-code-review-spec`

---

### 3. `permission-matrix`

**Frequency:** per-feature

**Input:**
- Complete role list (names, hierarchy)
- Complete resource type list
- Action list per resource type
- Inheritance / role hierarchy rules
- Guest / unauthenticated access requirements

**Output:**
- `permission-matrix.json` — 2D matrix of `role × resource × action → effect`

**Correctness Gates:**
1. Matrix is exhaustive: every (role, resource, action) triple has an explicit value
2. No role inherits permissions not granted at a parent level
3. Unauthenticated/guest access is explicitly enumerated (not implied by absence)
4. Super-admin role is isolated and annotated with `requires_mfa: true`
5. Matrix serializes without circular role inheritance

**Dependencies:**
- Role definitions (product/engineering input)
- `threat-model.json` (optional, for elevation-of-privilege review)

**Downstream Consumers:**
- `authz-policy`

---

### 4. `secret-handling-policy`

**Frequency:** per-project

**Input:**
- Secret types inventory (API keys, DB credentials, signing keys, OAuth secrets, etc.)
- Environment list (local, dev, staging, prod)
- Vault/KMS platform config
- Rotation schedule requirements
- Service identity map

**Output:**
- `secret-policy.json` — rules for secret storage location, injection method, rotation period, and access scope per secret type

**Correctness Gates:**
1. Every secret type has an assigned storage backend (env var forbidden for prod secrets)
2. Every secret has a `max_age_days` rotation period defined
3. No secret has `rotation_required: false` without an approved exception record reference
4. Every secret lists allowed consumers (service identities, not humans by default)
5. Plaintext secret logging is explicitly prohibited for every secret type (`log_safe: false`)
6. Staging secrets are never reused from production (validated by distinct secret path prefixes)

**Dependencies:**
- `encryption-key-policy`
- `pii-classification-policy`

**Downstream Consumers:**
- `token-rotation-policy`
- `audit-log-policy`
- `iac-security-policy`
- `secure-code-review-spec`

---

### 5. `dep-vuln-policy`

**Frequency:** per-project

**Input:**
- Dependency ecosystem list (npm, pip, maven, go modules, etc.)
- Severity threshold configuration
- Approved exception list (existing waivers)
- License policy (optional)
- SBOM from last build

**Output:**
- `dep-vuln-policy.json` — policy file defining block/warn/allow thresholds per severity, auto-merge rules, exception handling, and SLA for remediation per severity tier

**Correctness Gates:**
1. `critical` severity vulnerabilities have `action: block` defined
2. `high` severity has a remediation SLA ≤ 14 days
3. Every `allow` exception references a `vuln-exception-record` ID
4. Policy covers all declared ecosystems (no ecosystem is unaddressed)
5. Auto-merge threshold (if set) is ≤ `patch` level only
6. Policy file validates against the dep-vuln-policy JSON schema

**Dependencies:**
- `sbom-policy`
- `vuln-exception-record` (for any pre-existing exceptions)

**Downstream Consumers:**
- `sbom-policy`
- `container-scan-policy`
- CI/CD integration (via policy file)

---

### 6. `sast-policy`

**Frequency:** per-project

**Input:**
- Language and framework list
- Semgrep/SAST rule categories to enable
- Suppression/ignore list (with justification)
- Severity blocking threshold
- Custom rule definitions (optional)

**Output:**
- `semgrep-policy.yaml` — Semgrep config with rule sources, severity levels, ignore paths, and block criteria
- `.semgrepignore` — paths excluded from scanning

**Correctness Gates:**
1. At least one rule set covers each declared language
2. Security rule categories enabled: `injection`, `xss`, `ssrf`, `path-traversal`, `deserialization`
3. Every suppression entry has a justification comment and an expiry date
4. `error` severity findings are CI-blocking (no passthrough allowed)
5. Custom rules have at least one test case defined
6. AI/LLM-specific rules present if LLM surfaces are flagged in `abuse-surface-model`

**Dependencies:**
- `threat-model.json`
- `abuse-surface-model` (for AI/LLM surfaces)

**Downstream Consumers:**
- `secure-code-review-spec`
- CI/CD pipeline integration

---

### 7. `dast-scan-config`

**Frequency:** per-project

**Input:**
- Target URL list (staging/prod)
- Authentication config (session cookie, API key, OAuth token for scanner)
- Scan scope inclusions/exclusions
- Active vs passive scan flag
- Alert thresholds

**Output:**
- `dast-config.yaml` — DAST scanner configuration (OWASP ZAP, Nuclei, or equivalent format) with target, auth, scope, and alerting rules

**Correctness Gates:**
1. Every public-facing URL is listed in the scan target
2. Auth config is present and references a non-production test credential (not prod credentials)
3. Paths with destructive side effects (delete, payment, send-email) are in the exclusion list
4. Active scan is disabled for production targets
5. Every alert threshold has an action (`block` / `warn`)
6. Scanner config passes dry-run validation (connection test passes)

**Dependencies:**
- `threat-model.json`
- `input-validation-policy`

**Downstream Consumers:**
- CI/CD pipeline
- `vuln-exception-record` (for accepted DAST findings)

---

### 8. `csp-policy`

**Frequency:** per-feature

**Input:**
- Frontend asset inventory (scripts, styles, fonts, images)
- Third-party origin list (analytics, CDN, embeds)
- Nonce strategy (static vs dynamic)
- Frame embedding requirements (same-origin / allow-list / deny)
- Reporting endpoint config

**Output:**
- `csp-policy.json` — Content Security Policy directive set with per-directive source lists, nonce config, and report-uri

**Correctness Gates:**
1. `default-src` is `'none'` or `'self'` (no wildcard)
2. `script-src` does not contain `'unsafe-inline'` unless nonce strategy is active
3. `script-src` does not contain `'unsafe-eval'`
4. Every third-party origin is explicitly listed (no scheme-only wildcards like `https:`)
5. `frame-ancestors` is explicitly defined (not absent)
6. `report-uri` or `report-to` is present with a valid endpoint
7. Nonce is marked as `rotation: per-request` if dynamic strategy selected
8. CSP string passes CSP evaluator validation with no high-severity issues

**Dependencies:**
- Frontend asset inventory (build system output)
- `security-headers-policy`

**Downstream Consumers:**
- `security-headers-policy` (CSP injected as header)
- Frontend deployment config

---

### 9. `security-headers-policy`

**Frequency:** per-project

**Input:**
- Application type (web app, API-only, embedded widget)
- CORS origin requirements
- Frame embedding requirements
- HSTS requirements (max-age, includeSubDomains, preload)
- Referrer policy requirements

**Output:**
- `security-headers.json` — complete HTTP security header set with values for: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy`, `Content-Security-Policy`

**Correctness Gates:**
1. `X-Content-Type-Options: nosniff` is always present
2. `Strict-Transport-Security` has `max-age` ≥ 31536000 (1 year)
3. `X-Frame-Options` or `frame-ancestors` CSP directive is present (not both conflicting)
4. `Referrer-Policy` is one of: `no-referrer`, `strict-origin`, `strict-origin-when-cross-origin`
5. `Permissions-Policy` explicitly disables unused powerful features (camera, microphone, geolocation)
6. API-only apps have `Content-Type: application/json` enforced (no HTML served)
7. Headers validate clean against securityheaders.com scoring model (A or above equivalent)

**Dependencies:**
- `csp-policy`
- `cors-policy`

**Downstream Consumers:**
- Reverse proxy / CDN config
- `dast-scan-config` (headers checked in scan)

---

### 10. `input-validation-policy`

**Frequency:** per-feature

**Input:**
- API surface / OpenAPI spec
- Field type inventory (string, integer, file, URL, HTML, JSON blob, etc.)
- Trust boundary map (public vs internal vs admin endpoint)
- Known injection risk fields (free-text, URL inputs, file names)

**Output:**
- `input-validation-policy.json` — per-field validation rules: type, max length, allowlist/denylist pattern, sanitization method, rejection behavior

**Correctness Gates:**
1. Every public endpoint field has an explicit max-length constraint
2. URL-type fields have SSRF-allowlist or denylist rule defined
3. HTML-type fields have a sanitizer specified (e.g., DOMPurify config reference)
4. File name fields disallow path traversal characters (`../`, `%2F`, null bytes)
5. Integer fields have min/max bounds
6. No field has `validation: none` without an exception record
7. Internal endpoints have stricter allowlist vs public endpoints (not looser)

**Dependencies:**
- `threat-model.json`
- `ssrf-risk-profile` (for URL fields)
- OpenAPI spec (`openapi-spec` — already built)

**Downstream Consumers:**
- `api-route` (already built)
- `sast-policy`
- `secure-code-review-spec`
- `file-upload-policy`

---

### 11. `rate-limit-policy`

**Frequency:** per-feature

**Input:**
- Endpoint list with sensitivity tier (public / authenticated / admin / M2M)
- User tier definitions (free, paid, internal, bot)
- Abuse surface assessment (from `threat-model.json`)
- Cost-per-request profile (for LLM endpoints)

**Output:**
- `rate-limit-policy.json` — per-endpoint rate limit rules: window size, request limit per tier, burst allowance, backoff strategy, penalty (block / throttle / CAPTCHA), key type (IP / user_id / API key / tenant)

**Correctness Gates:**
1. Every public-facing endpoint has a rate limit defined
2. Authentication endpoints have a stricter limit than authenticated endpoints
3. Password reset / OTP / magic-link endpoints have attempt limits ≤ 5/15min
4. Every rule specifies the key type (IP / user_id / tenant_id / API key)
5. LLM/AI endpoints have token-budget limits (not only request counts)
6. M2M endpoints have API-key-based limits, not IP-based limits
7. Penalty action is defined for every rule (`block` | `throttle` | `challenge`)
8. No endpoint has `rate_limit: none` without an exception record

**Dependencies:**
- `threat-model.json`
- `abuse-surface-model`
- `authz-policy` (to determine tier separation)

**Downstream Consumers:**
- `api-route` (already built)
- `auth-middleware` (already built)
- `abuse-surface-model`

---

### 12. `webhook-verification-policy`

**Frequency:** per-feature

**Input:**
- Webhook provider list (Stripe, GitHub, Twilio, custom, etc.)
- Signing mechanism per provider (HMAC-SHA256, RSA, ed25519, etc.)
- Payload schema per provider
- Replay attack window requirements

**Output:**
- `webhook-policy.json` — per-provider verification rules: signature header name, algorithm, secret reference, timestamp tolerance (replay window), rejection behavior

**Correctness Gates:**
1. Every inbound webhook endpoint has a provider entry
2. Every provider entry specifies the signature algorithm (no `algorithm: none`)
3. Replay window is defined and ≤ 300 seconds for all providers
4. Secret reference points to vault path (not hardcoded value)
5. Rejection on signature failure returns HTTP 401 (not 200)
6. Timestamp tolerance is validated server-side (not client-provided)
7. HMAC comparison uses constant-time equality function (annotated in policy)

**Dependencies:**
- `secret-handling-policy`
- `input-validation-policy`

**Downstream Consumers:**
- `api-route` (already built)
- `audit-log-policy`

---

### 13. `file-upload-policy`

**Frequency:** per-feature

**Input:**
- Upload surface spec (endpoint, user tier, upload purpose)
- Allowed MIME types and extensions
- Maximum file size
- Storage target (local, S3, GCS, etc.)
- Virus scanning / content inspection availability

**Output:**
- `file-upload-policy.json` — rules per upload surface: allowed types, max size, storage isolation config, scan requirement, filename sanitization rules, URL access control (signed URL vs public)

**Correctness Gates:**
1. Every upload endpoint has an explicit MIME type allowlist (no wildcard MIME types)
2. File extension validation is independent of MIME type (both checked)
3. Max file size is defined and ≤ application tier limit
4. Files are stored outside the web root (no direct serve from upload path)
5. Virus scan is required for any user-supplied file (or exception record referenced)
6. Filename is sanitized: no path traversal, no null bytes, no executable extensions
7. Download URLs use signed/expiring URLs (not permanent public URLs) unless explicitly exempted
8. SVG uploads require sanitization rule (XSS vector)

**Dependencies:**
- `input-validation-policy`
- `secret-handling-policy` (for signed URL key references)

**Downstream Consumers:**
- `api-route` (already built)
- `csp-policy` (for inline SVG or blob URL handling)
- `secure-code-review-spec`

---

### 14. `session-cookie-policy`

**Frequency:** per-project

**Input:**
- Auth mechanism (session cookie, JWT, refresh token, etc.)
- Session duration requirements (idle timeout, absolute timeout)
- Domain and subdomain configuration
- SSO / federated identity requirements
- Multi-device session requirements

**Output:**
- `session-policy.json` — session configuration: cookie attributes (`HttpOnly`, `Secure`, `SameSite`, `Domain`, `Path`), token lifetime, rotation triggers, concurrent session limits, invalidation behavior

**Correctness Gates:**
1. All session cookies have `HttpOnly: true`
2. All session cookies have `Secure: true`
3. `SameSite` is `Lax` or `Strict` (never `None` without explicit cross-site justification)
4. Absolute session timeout is defined and ≤ 24 hours for standard users
5. Idle timeout is defined and ≤ 4 hours
6. Session token is rotated on privilege change (login, role switch, password change)
7. Concurrent session limit is defined (unlimited requires exception record)
8. Session invalidation on logout is server-side (not client-delete-only)

**Dependencies:**
- `secret-handling-policy` (session signing key reference)
- `token-rotation-policy`

**Downstream Consumers:**
- `auth-middleware` (already built)
- `audit-log-policy`

---

### 15. `encryption-key-policy`

**Frequency:** per-project

**Input:**
- Data classification tiers (from `pii-classification-policy`)
- Encryption use cases (data at rest, data in transit, field-level encryption)
- KMS / vault platform config
- Key rotation schedule requirements
- Envelope encryption requirements

**Output:**
- `encryption-policy.json` — per-use-case encryption rules: algorithm, key length, key storage backend, rotation period, envelope encryption flag, allowed key consumers

**Correctness Gates:**
1. Every data classification tier ≥ `confidential` has field-level or storage-level encryption rule
2. Symmetric encryption algorithm is AES-256 or ChaCha20 (no DES, 3DES, RC4)
3. Asymmetric encryption is RSA-2048+ or EC P-256+ (no RSA-1024)
4. Key rotation period is defined for every key type
5. Master keys are stored in HSM or cloud KMS (not in application secrets)
6. Envelope encryption is required for any key that encrypts bulk data
7. Key consumers are enumerated (services, not humans)
8. Key escrow/backup policy is defined

**Dependencies:**
- `pii-classification-policy`

**Downstream Consumers:**
- `secret-handling-policy`
- `session-cookie-policy`
- `audit-log-policy`
- `iac-security-policy`

---

### 16. `audit-log-policy`

**Frequency:** per-feature

**Input:**
- Event taxonomy (actor, action, resource, outcome)
- Retention requirements (compliance-driven)
- PII handling rules for log data
- Tamper-evidence requirements
- Log destination config

**Output:**
- `audit-log-policy.json` — event schema, required fields per event type, PII masking rules, retention periods, tamper-evidence method, log destination, alerting thresholds

**Correctness Gates:**
1. Every logged event has: `actor_id`, `action`, `resource_type`, `resource_id`, `outcome`, `timestamp` (all required fields present)
2. PII fields in log entries are masked or hashed per `pii-classification-policy` rules
3. Authentication events (login, logout, MFA, password change) are mandated
4. Authorization failures are mandated (every 403/401 logged)
5. Admin actions are mandated with full request context
6. Retention period is defined and ≥ compliance minimum
7. Log destination is append-only or tamper-evident (write-once storage or WORM)
8. Secret/credential values are never logged (gate: no secret-type fields in schema)

**Dependencies:**
- `pii-classification-policy`
- `authz-policy`
- `secret-handling-policy`

**Downstream Consumers:**
- SIEM integration
- `secure-code-review-spec`
- Compliance reporting pipeline

---

### 17. `pii-classification-policy`

**Frequency:** per-project

**Input:**
- Data model / entity definitions
- Field inventory (with data type and business purpose)
- Jurisdiction list (GDPR, CCPA, HIPAA, etc.)
- Data retention requirements
- Third-party data sharing map

**Output:**
- `pii-policy.json` — per-field classification: data category, sensitivity tier, jurisdiction applicability, retention period, allowed processors, encryption requirement, log-safe flag

**Correctness Gates:**
1. Every field in the data model has a classification entry
2. Every field with `tier: sensitive` or above has `encryption_required: true`
3. Every field has a `log_safe` boolean
4. Every jurisdiction-regulated field has a `jurisdiction` list
5. Retention period is defined for every entity type
6. No field can be `tier: pii` and `log_safe: true` simultaneously unless explicitly masked
7. Third-party sharing entries reference approved data processing agreements (DPA IDs)

**Dependencies:**
- Data model (engineering input)
- Jurisdiction requirements (legal/compliance input)

**Downstream Consumers:**
- `encryption-key-policy`
- `audit-log-policy`
- `secret-handling-policy`
- `dep-vuln-policy`
- Nearly all other compilers (foundational)

---

### 18. `secure-code-review-spec`

**Frequency:** per-feature

**Input:**
- Feature spec / PR scope
- Language and framework
- Risk tier (low / medium / high / critical)
- `threat-model.json` for the feature
- Relevant policies (authz, input-validation, file-upload, etc.)

**Output:**
- `code-review-checklist.json` — structured checklist of security review gates: category, check description, pass criterion, auto-checkable flag, reference policy

**Correctness Gates:**
1. Checklist includes items from all applicable policy compilers (authz, input-validation, etc.)
2. Every item has a `pass_criterion` (binary, not qualitative)
3. Risk tier `high` or `critical` requires ≥ 1 human security reviewer sign-off (annotated)
4. Injection-risk items are present for all user-input surfaces
5. Auth/authz checks are present for every state-changing endpoint
6. Checklist references the specific `threat-model.json` ID it was generated from
7. All `auto_checkable: true` items have a linked SAST rule reference

**Dependencies:**
- `threat-model.json`
- `authz-policy`
- `input-validation-policy`
- `sast-policy`
- `file-upload-policy` (if applicable)
- `webhook-verification-policy` (if applicable)

**Downstream Consumers:**
- PR review tooling
- Security sign-off tracking

---

### 19. `sbom-policy`

**Frequency:** per-project

**Input:**
- Build system config
- Artifact types (container, package, binary)
- Attestation format preference (SPDX, CycloneDX, in-toto)
- Signing key config (Sigstore, cosign, etc.)
- Distribution channel requirements

**Output:**
- `sbom-policy.json` — SBOM generation requirements: format, required fields, attestation signing method, storage location, verification procedure

**Correctness Gates:**
1. SBOM format is one of: SPDX 2.3+, CycloneDX 1.4+
2. Every component entry has: name, version, PURL, license, hash
3. Attestation is signed with a hardware-backed or Sigstore keyless signature
4. SBOM is generated per-build (not per-release only)
5. Signing key reference is in vault (not inline)
6. Verification procedure is defined and executable in CI

**Dependencies:**
- `dep-vuln-policy`
- `encryption-key-policy` (for signing key policy)

**Downstream Consumers:**
- `dep-vuln-policy`
- `container-scan-policy`
- Supply chain compliance reporting

---

### 20. `container-scan-policy`

**Frequency:** per-project

**Input:**
- Base image list
- Container registry config
- Severity blocking thresholds
- OS package allowlist/denylist
- Rootless container requirement flag

**Output:**
- `container-scan-policy.yaml` — scanner config (Trivy, Grype, or Snyk container format): base image rules, severity thresholds, block/warn actions, required labels, rootless flag, no-new-privileges flag

**Correctness Gates:**
1. `critical` CVEs in base image have `action: block`
2. Base images must be from approved registry list only
3. `latest` tag is disallowed for production images
4. Rootless container flag is `required: true` unless exception record exists
5. `no-new-privileges` seccomp annotation is required
6. Every image has a max base image age (e.g., ≤ 90 days since last rebuild)
7. Scanner config validates against scanner schema (dry-run passes)

**Dependencies:**
- `dep-vuln-policy`
- `sbom-policy`
- `iac-security-policy`

**Downstream Consumers:**
- CI/CD container build pipeline
- `runtime-guardrails`

---

### 21. `iac-security-policy`

**Frequency:** per-project

**Input:**
- IaC toolchain (Terraform, Pulumi, CDK, Helm, etc.)
- Cloud provider(s) (AWS, GCP, Azure)
- Resource types in use
- Compliance framework requirements (CIS, SOC2, PCI, etc.)

**Output:**
- `iac-policy.json` — IaC security rules: resource type, required configuration, forbidden configuration, compliance mapping (OPA/Rego or Checkov policy format)

**Correctness Gates:**
1. Every cloud resource type has at least one security rule
2. S3/GCS/blob storage resources have `public_access: deny` rule
3. Security groups / firewall rules forbid `0.0.0.0/0` ingress on non-HTTP/HTTPS ports
4. All database resources require encryption-at-rest rule
5. IAM policies forbid `*:*` wildcard policies
6. Every rule has a compliance framework mapping (CIS benchmark ID or equivalent)
7. Policy lints clean against OPA/Checkov with zero errors

**Dependencies:**
- `encryption-key-policy`
- `pii-classification-policy`
- `secret-handling-policy`

**Downstream Consumers:**
- `container-scan-policy`
- `runtime-guardrails`
- IaC CI/CD pipeline

---

### 22. `runtime-guardrails`

**Frequency:** per-project

**Input:**
- Runtime environment (Kubernetes, ECS, Lambda, bare VM)
- Syscall profile requirements
- Network egress rules
- File system access requirements
- Resource limits

**Output:**
- `runtime-policy.json` — runtime security rules: seccomp profile, AppArmor/SELinux profile, network policy (egress/ingress rules), resource limits, read-only filesystem flag, allowed/denied capabilities

**Correctness Gates:**
1. Seccomp profile is defined (not `unconfined`)
2. Linux capabilities are drop-all with explicit allowlist
3. Network egress policy is default-deny with explicit allows
4. Read-only root filesystem is `required: true` unless exception record exists
5. Resource limits (CPU, memory) are defined for every workload
6. Privilege escalation is `allowPrivilegeEscalation: false`
7. Policy validates against Kubernetes admission controller schema

**Dependencies:**
- `container-scan-policy`
- `iac-security-policy`
- `mtls-trust-policy` (for network policy mesh)

**Downstream Consumers:**
- Kubernetes admission webhook
- Runtime security tooling (Falco, etc.)

---

### 23. `vuln-exception-record`

**Frequency:** per-incident

**Input:**
- CVE ID or finding reference
- Affected component and version
- Business justification text
- Risk owner (person/team)
- Compensating controls list
- Proposed remediation date

**Output:**
- `exception-record.json` — structured waiver: finding ID, component, severity, justification, compensating controls, risk owner, expiry date, approval chain

**Correctness Gates:**
1. `finding_id` is present and references a real CVE or scanner finding ID
2. `expiry_date` is present and ≤ 90 days from creation (renewable with re-approval)
3. `risk_owner` is a named individual or team (not a role or department)
4. At least one compensating control is listed
5. Severity `critical` exceptions require a second approver signature
6. Exception file is signed/attested (cryptographic signature or approval workflow reference)
7. `remediation_date` is defined and ≤ `expiry_date`

**Dependencies:**
- SAST/DAST/SCA scan output (external tool)

**Downstream Consumers:**
- `dep-vuln-policy`
- `sast-policy`
- `container-scan-policy`
- `rate-limit-policy`
- Any policy compiler that permits exceptions

---

### 24. `abuse-surface-model`

**Frequency:** per-feature

**Input:**
- Feature spec
- User types (anonymous, authenticated, admin, bot, M2M)
- AI/LLM surface flag
- Monetization model (if relevant: free tier, credit system)
- Abuse scenario brainstorm (threat-model output)

**Output:**
- `abuse-model.json` — per-feature abuse surface enumeration: surface name, actor type, abuse vector, impact, likelihood, recommended control, linked compiler

**Correctness Gates:**
1. Every user-facing surface has at least one abuse scenario enumerated
2. Every scenario has an impact and likelihood score (1–5 each)
3. AI/LLM surfaces enumerate: prompt injection, jailbreak, data exfiltration, cost abuse
4. Every scenario with combined score ≥ 12 has a `recommended_control` and linked compiler ID
5. Anonymous actor scenarios are present for every public surface
6. Credential stuffing / account takeover scenarios present for all auth surfaces
7. Every control recommendation references an existing or planned compiler ID

**Dependencies:**
- `threat-model.json`
- `rate-limit-policy` (bidirectional reference)

**Downstream Consumers:**
- `rate-limit-policy`
- `sast-policy`
- `input-validation-policy`
- `secure-code-review-spec`

---

### 25. `cors-policy`

**Frequency:** per-feature

**Input:**
- Origin list (frontend app origins, third-party consumers)
- Credential requirement (cookies / auth headers cross-origin)
- Method allowlist (GET, POST, PUT, DELETE, OPTIONS, etc.)
- Exposed headers list
- Preflight cache duration

**Output:**
- `cors-policy.json` — per-endpoint CORS rules: allowed origins, allow-credentials flag, allowed methods, allowed headers, exposed headers, max-age

**Correctness Gates:**
1. No endpoint has `Access-Control-Allow-Origin: *` combined with `credentials: true`
2. Wildcard origin (`*`) is only permitted for fully public, credential-free endpoints
3. `credentials: true` requires explicit origin allowlist (no wildcard)
4. Preflight `max-age` is defined and ≤ 86400 seconds
5. Non-simple methods (PUT, DELETE, PATCH) require explicit allowlist entry
6. Internal-only endpoints have `allowed_origins: []` (empty = deny all cross-origin)

**Dependencies:**
- `authz-policy` (to determine which endpoints require credentials)
- `security-headers-policy`

**Downstream Consumers:**
- `security-headers-policy`
- `api-route` (already built)

---

### 26. `ssrf-risk-profile`

**Frequency:** per-feature

**Input:**
- Outbound HTTP call inventory (URL, service, purpose)
- User-controlled URL input surfaces
- Internal service topology (cloud metadata, internal APIs, databases)
- DNS resolution config (split-horizon risk)

**Output:**
- `ssrf-risk-profile.json` — per-surface SSRF risk entry: surface name, user-controlled flag, allowlist/denylist rules, internal IP block requirement, redirect-follow policy, DNS rebinding risk flag

**Correctness Gates:**
1. Every outbound HTTP call surface has an entry
2. User-controlled URL inputs have explicit denylist: link-local (`169.254.0.0/16`), loopback (`127.0.0.0/8`), private RFC1918 ranges
3. Cloud metadata endpoint (`169.254.169.254`) is explicitly blocked
4. Redirect following is disabled or hop-limited (≤ 3) for user-supplied URLs
5. DNS rebinding risk is flagged for all async URL fetchers
6. Internal services accessible from the app are listed as SSRF targets to protect

**Dependencies:**
- `threat-model.json`
- `input-validation-policy`

**Downstream Consumers:**
- `input-validation-policy`
- `sast-policy`
- `secure-code-review-spec`

---

### 27. `token-rotation-policy`

**Frequency:** per-project

**Input:**
- Token types inventory (access tokens, refresh tokens, API keys, signing keys, session tokens)
- Expiry requirements per token type
- Rotation trigger events (breach, compromise, scheduled, on-use)
- Revocation mechanism availability

**Output:**
- `token-rotation-policy.json` — per-token-type rotation rules: max TTL, rotation trigger list, revocation method, key ID versioning scheme, grace period

**Correctness Gates:**
1. Every token type has a `max_ttl` defined
2. Access tokens have `max_ttl` ≤ 1 hour
3. Refresh tokens have a `rotation_on_use: true` flag or explicit justification if false
4. API keys have a forced rotation schedule ≤ 365 days
5. Revocation method is defined for every token type
6. Key ID versioning scheme is defined (enables zero-downtime rotation)
7. Compromise-triggered rotation is an enumerated trigger for all token types

**Dependencies:**
- `secret-handling-policy`
- `session-cookie-policy`

**Downstream Consumers:**
- `session-cookie-policy`
- `auth-middleware` (already built)
- `audit-log-policy`

---

### 28. `staging-prod-drift-report`

**Frequency:** daily

**Input:**
- Staging policy set (all `*-policy.json` files from staging)
- Production policy set (all `*-policy.json` files from production)
- Drift tolerance config (which fields are allowed to differ)

**Output:**
- `drift-report.json` — diff of policy files between staging and production: policy ID, field, staging value, production value, drift classification (allowed / unexpected / critical)

**Correctness Gates:**
1. Report covers 100% of policy files present in production
2. Every diff entry is classified: `allowed_drift` | `unexpected_drift` | `critical_drift`
3. `critical_drift` entries block deployment until acknowledged
4. Allowed drift config is itself versioned and reviewed
5. Report includes a `policy_coverage` field: number of policies compared / total
6. Timestamp and source commit SHA are present in report header

**Dependencies:**
- All `*-policy.json` files (entire compiler network output)

**Downstream Consumers:**
- CI/CD deployment gate
- Security team alerting

---

### 29. `third-party-integration-policy`

**Frequency:** per-feature

**Input:**
- Third-party service spec (name, purpose, data shared)
- Authentication method to third party (OAuth, API key, mTLS)
- Data egress inventory (what fields are sent)
- Webhook inbound flag
- SDKs / libraries used

**Output:**
- `third-party-policy.json` — per-integration rules: data egress allowlist, auth method, secret reference, inbound webhook policy reference, SDK version pin, data residency requirement

**Correctness Gates:**
1. Every third-party integration has an entry
2. Data egress fields are enumerated (no `all_fields` shorthand)
3. Every egressed field is cross-referenced against `pii-policy.json` classification
4. Auth secret is referenced by vault path (not inline)
5. SDK/library version is pinned (no `latest` or range specifiers in production)
6. Inbound webhook integrations reference a `webhook-policy.json` entry
7. Data residency is defined if any field is `jurisdiction: GDPR` or equivalent

**Dependencies:**
- `pii-classification-policy`
- `secret-handling-policy`
- `webhook-verification-policy` (if inbound webhooks)
- `authz-policy`

**Downstream Consumers:**
- `audit-log-policy`
- `dep-vuln-policy` (for SDK libraries)
- `cors-policy` (for browser-side SDKs)

---

### 30. `mtls-trust-policy`

**Frequency:** per-project

**Input:**
- Service mesh topology (service list, communication matrix)
- Certificate authority config (internal CA, cloud CA, SPIFFE/SPIRE)
- Service identity scheme (SPIFFE URI, DNS SANs)
- mTLS enforcement level (permissive vs strict)
- Certificate rotation schedule

**Output:**
- `mtls-policy.json` — per-service-pair trust rules: client identity, server identity, mTLS required flag, cert authority, rotation period, allowed cipher suites

**Correctness Gates:**
1. Every service-to-service communication pair has an entry
2. All production service pairs have `mtls_required: true`
3. `permissive` mode is only permitted with an exception record reference and expiry
4. Certificate rotation period is ≤ 90 days
5. Allowed cipher suites exclude TLS 1.1 and below
6. SPIFFE URIs are used as service identities (not IP addresses)
7. Policy validates against service mesh admission config schema

**Dependencies:**
- `encryption-key-policy`
- `iac-security-policy`

**Downstream Consumers:**
- `runtime-guardrails`
- Service mesh config (Istio/Linkerd)
- `audit-log-policy`

---

## Recommended Build Order

The build order is determined by the dependency graph. Foundational classifiers and threat models must exist before policy compilers, which must exist before scanner configs and downstream consumers.

### Tier 0 — Foundations (no dependencies on other compilers)

These must be built first. All other compilers depend on them directly or indirectly.

```
1. pii-classification-policy      ← foundational data taxonomy
2. threat-model                   ← foundational risk surface
3. permission-matrix              ← foundational role/resource map
```

---

### Tier 1 — Core Policy Compilers (depend only on Tier 0)

```
4.  encryption-key-policy         ← depends on: pii-classification-policy
5.  authz-policy                  ← depends on: threat-model, permission-matrix
6.  secret-handling-policy        ← depends on: encryption-key-policy, pii-classification-policy
7.  ssrf-risk-profile             ← depends on: threat-model
8.  abuse-surface-model           ← depends on: threat-model
```

---

### Tier 2 — Feature-Level Policy Compilers (depend on Tier 1)

```
9.  input-validation-policy       ← depends on: threat-model, ssrf-risk-profile
10. rate-limit-policy             ← depends on: threat-model, abuse-surface-model, authz-policy
11. token-rotation-policy         ← depends on: secret-handling-policy
12. audit-log-policy              ← depends on: pii-classification-policy, authz-policy, secret-handling-policy
13. cors-policy                   ← depends on: authz-policy
14. csp-policy                    ← depends on: (asset inventory input)
15. webhook-verification-policy   ← depends on: secret-handling-policy, input-validation-policy
16. session-cookie-policy         ← depends on: secret-handling-policy, token-rotation-policy
```

---

### Tier 3 — Derived & Composite Policy Compilers (depend on Tier 2)

```
17. security-headers-policy       ← depends on: csp-policy, cors-policy
18. file-upload-policy            ← depends on: input-validation-policy, secret-handling-policy
19. secure-code-review-spec       ← depends on: threat-model, authz-policy, input-validation-policy, sast-policy
20. sast-policy                   ← depends on: threat-model, abuse-surface-model
21. third-party-integration-policy ← depends on: pii-classification-policy, secret-handling-policy, webhook-verification-policy
22. mtls-trust-policy             ← depends on: encryption-key-policy, iac-security-policy
```

---

### Tier 4 — Infrastructure & Build Compilers

```
23. iac-security-policy           ← depends on: encryption-key-policy, pii-classification-policy, secret-handling-policy
24. sbom-policy                   ← depends on: dep-vuln-policy, encryption-key-policy
25. dep-vuln-policy               ← depends on: sbom-policy (soft), vuln-exception-record
26. container-scan-policy         ← depends on: dep-vuln-policy, sbom-policy, iac-security-policy
27. runtime-guardrails            ← depends on: container-scan-policy, iac-security-policy, mtls-trust-policy
```

---

### Tier 5 — Incident & Operational Compilers

```
28. vuln-exception-record         ← depends on: (scanner output, any policy compiler)
29. staging-prod-drift-report     ← depends on: ALL policy compiler outputs
```

---

### Full Linear Build Order (safe serialization of the DAG)

```
1.  pii-classification-policy
2.  threat-model
3.  permission-matrix
4.  encryption-key-policy
5.  authz-policy
6.  secret-handling-policy
7.  ssrf-risk-profile
8.  abuse-surface-model
9.  input-validation-policy
10. rate-limit-policy
11. token-rotation-policy
12. audit-log-policy
13. cors-policy
14. csp-policy
15. webhook-verification-policy
16. session-cookie-policy
17. security-headers-policy
18. file-upload-policy
19. sast-policy
20. secure-code-review-spec
21. third-party-integration-policy
22. iac-security-policy
23. mtls-trust-policy
24. dep-vuln-policy
25. sbom-policy
26. container-scan-policy
27. runtime-guardrails
28. dast-scan-config
29. vuln-exception-record
30. staging-prod-drift-report
```

---

*Document generated for: Domain Compiler Network — Security Engineer Role*
*Total compilers defined: 30*
*Excludes: already-built compilers (9) and shared/cross-role compilers (5)*
