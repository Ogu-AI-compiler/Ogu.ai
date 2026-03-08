# Security Engineer Compiler Network

## Scope and assumptions

This document decomposes the security engineer role into atomic, repeatable compiler tasks for a formal Domain Compiler Network.

The focus is on application security, product security, and platform security artifacts that are machine-checkable and can be produced by a single compiler. The emphasis is on artifacts, not human process.

Excluded by request:
- `react-component`
- `react-form`
- `react-hook`
- `react-page`
- `ts-schema`
- `api-route`
- `auth-middleware`
- `db-migration`
- `openapi-spec`
- Shared cross-role compilers such as `utility-fn`, `analytics-event`, `feature-flag`, `i18n`, `a11y-test`

Assumed upstream artifacts already exist where relevant:
- `openapi-spec`
- `api-route`
- `auth-middleware`
- `db-migration`
- `ts-schema`
- infrastructure manifests and container manifests where applicable

Conventions used below:
- Output paths are examples. The important part is that each compiler emits a stable, machine-checkable source artifact.
- "Correctness gates" are binary and automatable.
- Frequencies are constrained to: `daily`, `per-feature`, `per-project`, `per-incident`.
- The list is ordered roughly by practical usefulness for a compiler network, not by org chart.

---

## Summary table

| Task Name (Compiler ID) | Frequency | Input | Output |
|---|---|---|---|
| Endpoint Trust Classification (`endpoint-trust-classifier`) | per-feature | OpenAPI spec, route manifest, deployment exposure metadata | `security/endpoint-trust-map.yaml` |
| Threat Model Spec (`threat-model-spec`) | per-feature | Feature spec, endpoint trust map, data flows, integrations | `security/threat-models/<feature>.yaml` |
| Authorization Policy (`authz-policy`) | per-feature | Threat model, route inventory, resource model, tenant model | `security/authz/<feature>.rego`, `security/authz/<feature>.yaml` |
| Service Trust Policy (`service-auth-trust-policy`) | per-feature | Service graph, service identities, endpoint trust map | `security/service-trust/<feature>.yaml` |
| Token Lifecycle Policy (`token-lifecycle-policy`) | per-feature | Auth design, service trust policy, session model, token classes | `security/tokens/<feature>.yaml` |
| Session and Cookie Policy (`session-cookie-policy`) | per-feature | Auth flow, token lifecycle policy, web app surfaces | `security/session/<app>.yaml` |
| Security Headers Policy (`security-headers-policy`) | per-feature | Endpoint trust map, app origin map, session policy | `security/headers/<app>.yaml` |
| CSP Policy (`csp-policy`) | per-feature | App page inventory, third-party origins, headers policy | `security/csp/<app>.yaml` |
| Input Validation Policy (`input-validation-policy`) | per-feature | OpenAPI spec, route schemas, threat model | `security/validation/<surface>.yaml` |
| Rate Limit and Abuse Policy (`rate-limit-abuse-policy`) | per-feature | Endpoint trust map, abuse cases, actor classes | `security/rate-limits/<surface>.yaml` |
| Webhook Verification Policy (`webhook-verification-policy`) | per-feature | Provider contract, endpoint trust map, secrets source | `security/webhooks/<provider>.yaml` |
| File Upload Security Policy (`file-upload-security-policy`) | per-feature | Upload surface spec, accepted file types, storage plan | `security/uploads/<surface>.yaml` |
| SSRF and Egress Policy (`ssrf-egress-policy`) | per-feature | Outbound fetch surfaces, integration domains, network zones | `security/egress/<feature>.yaml` |
| Third-Party Integration Security Contract (`third-party-integration-security-policy`) | per-feature | Vendor API contract, data exchanged, trust direction | `security/integrations/<vendor>.yaml` |
| LLM Abuse Guardrail Policy (`llm-abuse-guardrail-policy`) | per-feature | LLM feature spec, tool definitions, tenant model | `security/llm/<feature>.yaml` |
| Secure Code Review Spec (`secure-code-review-spec`) | per-feature | Threat model, changed files, stack metadata, active policies | `security/code-review/<feature>.yaml` |
| Secret Handling Policy (`secret-handling-policy`) | per-project | Service inventory, secret classes, runtime environments | `security/secrets/policy.yaml` |
| Encryption and Key Usage Policy (`encryption-key-usage-policy`) | per-project | Data classification, secret handling policy, storage surfaces | `security/crypto/key-usage.yaml` |
| PII and Data Classification Spec (`pii-data-classification-spec`) | per-project | Schemas, DB fields, events, file types, integration payloads | `security/data-classification.yaml` |
| Audit Logging Policy (`audit-logging-policy`) | per-project | Endpoint map, authz policy, data classification | `security/audit/policy.yaml` |
| Dependency Vulnerability Policy (`dependency-vulnerability-policy`) | daily | Package manifest, lockfiles, project risk posture | `security/dependencies/policy.yaml` |
| SAST Policy (`sast-semgrep-policy`) | daily | Tech stack, repo paths, threat model, custom sinks and sources | `security/sast/semgrep-policy.yaml`, `security/sast/custom-rules.yaml` |
| DAST Scan Config (`dast-scan-config`) | per-project | Endpoint trust map, auth profiles, headers and CSP policy | `security/dast/<app>.yaml` |
| SBOM and Provenance Policy (`sbom-provenance-policy`) | per-project | Build graph, release artifact types, signing identities | `security/supply-chain/provenance-policy.yaml` |
| Container Image Security Policy (`container-image-security-policy`) | per-project | Container manifests, base images, runtime class | `security/containers/image-policy.yaml` |
| IaC Security Policy (`iac-security-policy`) | per-project | Terraform or Pulumi or Kubernetes manifests, env baseline | `security/iac/policy.rego`, `security/iac/policy.yaml` |
| Runtime Security Guardrails (`runtime-security-guardrails-policy`) | per-project | Container policy, IaC policy, service trust, abuse policy | `security/runtime/guardrails.yaml` |
| Environment Security Baseline (`environment-security-baseline`) | per-project | Environment list, domain map, infra topology, deployment classes | `security/environments/baseline.yaml`, `security/environments/drift-allowlist.yaml` |
| Vulnerability Exception Record (`vulnerability-exception-record`) | per-incident | Concrete finding IDs, scope, compensating controls, approver | `security/exceptions/<id>.yaml` |

---

## Detailed breakdown

### 1. Endpoint Trust Classification

- **Name**: Endpoint Trust Classification (`endpoint-trust-classifier`)
- **Frequency**: per-feature
- **Input**:
  - `openapi.yaml`
  - route manifests from `api-route`
  - deployment metadata that says whether the surface is internet-facing, private, admin-only, callback-only, or service-only
  - environment list
- **Output**:
  - `security/endpoint-trust-map.yaml`
- **Correctness gates**:
  - Every route, webhook callback, admin path, and service endpoint present in OpenAPI or route manifests appears exactly once in the trust map.
  - Every surface has exactly one exposure class from an allowed enum such as `public`, `internal`, `admin`, `webhook`, `callback`, `m2m`.
  - Every non-public surface declares an allowed caller class.
  - Every surface declares whether it is tenant-scoped, global, or system-scoped.
  - Every surface declares whether authentication is required, optional, or forbidden.
  - No production-exposed route is left with `unknown` exposure.
- **Dependencies**:
  - `openapi-spec`
  - `api-route`
- **Downstream consumers**:
  - `threat-model-spec`
  - `authz-policy`
  - `service-auth-trust-policy`
  - `rate-limit-abuse-policy`
  - `webhook-verification-policy`
  - `dast-scan-config`
  - `audit-logging-policy`

### 2. Threat Model Spec

- **Name**: Threat Model Spec (`threat-model-spec`)
- **Frequency**: per-feature
- **Input**:
  - feature spec
  - endpoint trust map
  - architecture or data flow description
  - third-party integration list
  - known data classes
- **Output**:
  - `security/threat-models/<feature>.yaml`
- **Correctness gates**:
  - Every ingress and egress surface from the endpoint trust map is represented.
  - Every trust boundary is explicitly named.
  - Every data store and external dependency used by the feature is represented.
  - Every identified threat has a status from a fixed enum such as `mitigated`, `accepted`, `not-applicable`, `open`.
  - Every `accepted` or `open` risk above policy threshold references an exception record or blocks release.
  - If the feature is multi-tenant, the model explicitly marks tenant boundary crossing paths.
  - If the feature uses LLMs, tool use, retrieval, prompt injection, and cross-tenant context exposure are addressed.
- **Dependencies**:
  - `endpoint-trust-classifier`
  - optionally `third-party-integration-security-policy` if the integration already exists
- **Downstream consumers**:
  - `authz-policy`
  - `input-validation-policy`
  - `rate-limit-abuse-policy`
  - `file-upload-security-policy`
  - `ssrf-egress-policy`
  - `secure-code-review-spec`
  - `llm-abuse-guardrail-policy`

### 3. Authorization Policy

- **Name**: Authorization Policy (`authz-policy`)
- **Frequency**: per-feature
- **Input**:
  - threat model
  - endpoint trust map
  - resource and action model
  - actor classes such as end user, admin, support, service account, webhook provider
  - tenant model
- **Output**:
  - `security/authz/<feature>.yaml`
  - `security/authz/<feature>.rego`
- **Correctness gates**:
  - Every protected route or action has at least one authorization rule.
  - Every rule includes `subject`, `resource`, `action`, and `effect`.
  - Default deny exists.
  - Multi-tenant resources declare tenant matching semantics.
  - Global admin or support overrides are explicitly scoped and cannot be implicit.
  - Machine actors are represented separately from human actors.
  - Any route classified as `public` cannot require a hidden privileged role.
  - Any route classified as tenant-scoped cannot authorize access across tenants unless an explicit exception class exists.
- **Dependencies**:
  - `endpoint-trust-classifier`
  - `threat-model-spec`
  - `auth-middleware`
- **Downstream consumers**:
  - `audit-logging-policy`
  - `secure-code-review-spec`
  - `dast-scan-config`
  - application enforcement layers

### 4. Service Trust Policy

- **Name**: Service Trust Policy (`service-auth-trust-policy`)
- **Frequency**: per-feature
- **Input**:
  - service graph
  - service identities
  - endpoint trust map
  - environment baseline
- **Output**:
  - `security/service-trust/<feature>.yaml`
- **Correctness gates**:
  - Every service-to-service edge has a defined authentication mechanism such as `mTLS`, `JWT`, `signed-request`, or `private-network-only`.
  - Every service identity has a unique issuer or principal per environment.
  - Shared credentials across environments are forbidden.
  - Every trust edge declares an audience or target identity.
  - Every trust edge declares transport requirements such as TLS version or mTLS.
  - Every machine principal has rotation cadence and secret source.
- **Dependencies**:
  - `endpoint-trust-classifier`
  - `environment-security-baseline`
- **Downstream consumers**:
  - `token-lifecycle-policy`
  - `secret-handling-policy`
  - `runtime-security-guardrails-policy`
  - `third-party-integration-security-policy`

### 5. Token Lifecycle Policy

- **Name**: Token Lifecycle Policy (`token-lifecycle-policy`)
- **Frequency**: per-feature
- **Input**:
  - auth design
  - service trust policy
  - token classes such as access token, refresh token, API key, signed URL, password reset token
  - session model
- **Output**:
  - `security/tokens/<feature>.yaml`
- **Correctness gates**:
  - Every token class has explicit TTL.
  - Every token class declares issuer, audience, scope model, and revocation method.
  - Refresh tokens and long-lived API keys must have rotation policy.
  - Token classes allowed in browsers must declare storage location constraints.
  - No token class exceeds maximum TTL for its risk category unless it references an exception record.
  - Every token with privilege escalation semantics requires rotation on privilege change.
- **Dependencies**:
  - `service-auth-trust-policy`
  - `authz-policy`
- **Downstream consumers**:
  - `session-cookie-policy`
  - `secret-handling-policy`
  - `runtime-security-guardrails-policy`
  - auth enforcement implementations

### 6. Session and Cookie Policy

- **Name**: Session and Cookie Policy (`session-cookie-policy`)
- **Frequency**: per-feature
- **Input**:
  - web auth flow
  - token lifecycle policy
  - app origin map
  - route trust classes
- **Output**:
  - `security/session/<app>.yaml`
- **Correctness gates**:
  - Every session cookie declares `HttpOnly`, `Secure`, `SameSite`, `Path`, and domain scope.
  - `Secure=true` is mandatory for production cookies.
  - Any cookie-authenticated state-changing route declares CSRF protection mode.
  - Session identifiers rotate after login and privilege elevation.
  - Idle timeout and absolute timeout are both defined.
  - Cross-site usage is forbidden unless the same route class explicitly requires it.
- **Dependencies**:
  - `token-lifecycle-policy`
  - `endpoint-trust-classifier`
  - `auth-middleware`
- **Downstream consumers**:
  - `security-headers-policy`
  - `dast-scan-config`
  - web application enforcement

### 7. Security Headers Policy

- **Name**: Security Headers Policy (`security-headers-policy`)
- **Frequency**: per-feature
- **Input**:
  - endpoint trust map
  - app origin map
  - session and cookie policy
  - environment baseline
- **Output**:
  - `security/headers/<app>.yaml`
- **Correctness gates**:
  - Every browser-rendered surface has a header set assigned.
  - Required headers such as `X-Content-Type-Options`, `Referrer-Policy`, and appropriate framing control are present.
  - HSTS is enabled only for environments marked HTTPS-capable and public.
  - Admin surfaces use a frame policy that prevents clickjacking.
  - No header value conflicts with CSP or cookie policy.
  - Header modes can differ by environment only if declared in the environment baseline.
- **Dependencies**:
  - `endpoint-trust-classifier`
  - `session-cookie-policy`
  - `environment-security-baseline`
- **Downstream consumers**:
  - `csp-policy`
  - `dast-scan-config`
  - web delivery layer

### 8. CSP Policy

- **Name**: CSP Policy (`csp-policy`)
- **Frequency**: per-feature
- **Input**:
  - page inventory
  - script and style loading model
  - third-party origin inventory
  - security headers policy
- **Output**:
  - `security/csp/<app>.yaml`
- **Correctness gates**:
  - Every page group has a CSP profile.
  - `script-src` forbids `unsafe-inline` unless a nonce or hash mechanism is declared.
  - If inline scripts are allowed, nonce or hash generation mode is declared.
  - `connect-src`, `img-src`, `frame-src`, and `worker-src` only include declared first-party or third-party origins.
  - Production origins differ from staging only if declared in environment baseline or integration contract.
  - Report-only mode and enforced mode are explicitly distinguished.
- **Dependencies**:
  - `security-headers-policy`
  - `third-party-integration-security-policy`
  - `environment-security-baseline`
- **Downstream consumers**:
  - frontend app compiler outputs
  - `dast-scan-config`
  - runtime gateway config

### 9. Input Validation Policy

- **Name**: Input Validation Policy (`input-validation-policy`)
- **Frequency**: per-feature
- **Input**:
  - OpenAPI schemas
  - route input definitions
  - threat model
  - content-type expectations
- **Output**:
  - `security/validation/<surface>.yaml`
- **Correctness gates**:
  - Every ingress surface declares a schema reference or explicit structured validator source.
  - Every ingress surface declares allowed content types.
  - Unknown fields are either rejected or stripped, never unspecified.
  - Maximum size limits are defined for body, query, header, and path inputs where relevant.
  - Dangerous field classes such as URL, HTML, Markdown, SQL fragment, file path, prompt text, and regex are explicitly tagged when present.
  - Public and webhook endpoints cannot have `validation-mode: none`.
- **Dependencies**:
  - `openapi-spec`
  - `api-route`
  - `threat-model-spec`
  - `ts-schema`
- **Downstream consumers**:
  - `file-upload-security-policy`
  - `webhook-verification-policy`
  - `ssrf-egress-policy`
  - `secure-code-review-spec`
  - DAST assertions

### 10. Rate Limit and Abuse Policy

- **Name**: Rate Limit and Abuse Policy (`rate-limit-abuse-policy`)
- **Frequency**: per-feature
- **Input**:
  - endpoint trust map
  - threat model
  - actor classes
  - cost profile of routes
- **Output**:
  - `security/rate-limits/<surface>.yaml`
- **Correctness gates**:
  - Every public endpoint has a rate-limiting class or an explicit non-applicable reason.
  - Sensitive endpoints such as login, password reset, invite, OTP verify, and upload have stricter limits than ordinary read endpoints.
  - Limit keys are explicit and selected from an enum such as `ip`, `user`, `tenant`, `api-key`, `service`, `session`.
  - Any expensive AI or export endpoint has both request limits and cost or token quotas.
  - Internal-only endpoints that skip rate limits must be constrained by trusted caller class.
  - Burst and sustained limits are both defined.
- **Dependencies**:
  - `endpoint-trust-classifier`
  - `threat-model-spec`
- **Downstream consumers**:
  - `runtime-security-guardrails-policy`
  - `dast-scan-config`
  - API gateway config

### 11. Webhook Verification Policy

- **Name**: Webhook Verification Policy (`webhook-verification-policy`)
- **Frequency**: per-feature
- **Input**:
  - provider webhook contract
  - endpoint trust map
  - secrets source
  - replay handling requirements
- **Output**:
  - `security/webhooks/<provider>.yaml`
- **Correctness gates**:
  - Every inbound webhook declares a signature verification algorithm.
  - Every inbound webhook declares the exact signed components such as raw body, timestamp, headers.
  - Accepted clock skew is explicit.
  - Replay prevention window is explicit.
  - Secret rotation overlap window is explicit.
  - Event identifier deduplication is required if the provider can retry.
  - Webhook routes must be classified as `webhook` or `callback` in the trust map.
- **Dependencies**:
  - `endpoint-trust-classifier`
  - `secret-handling-policy`
- **Downstream consumers**:
  - `audit-logging-policy`
  - `third-party-integration-security-policy`
  - API enforcement implementations

### 12. File Upload Security Policy

- **Name**: File Upload Security Policy (`file-upload-security-policy`)
- **Frequency**: per-feature
- **Input**:
  - upload feature spec
  - file type requirements
  - data classification
  - storage plan
  - threat model
- **Output**:
  - `security/uploads/<surface>.yaml`
- **Correctness gates**:
  - Allowed file extensions, MIME types, and magic byte classes are all declared.
  - Maximum file size and maximum file count are declared.
  - Archive handling rules are explicit if archives are allowed.
  - Quarantine or malware scan mode is explicit for high-risk file classes.
  - Public download behavior is explicit and separate from private storage behavior.
  - Filename normalization rules are declared.
  - Metadata stripping rules are declared when images or documents are re-served.
- **Dependencies**:
  - `input-validation-policy`
  - `pii-data-classification-spec`
  - `threat-model-spec`
- **Downstream consumers**:
  - `dast-scan-config`
  - `secure-code-review-spec`
  - storage and delivery layers

### 13. SSRF and Egress Policy

- **Name**: SSRF and Egress Policy (`ssrf-egress-policy`)
- **Frequency**: per-feature
- **Input**:
  - outbound fetch surfaces
  - integration domains
  - network zones
  - threat model
- **Output**:
  - `security/egress/<feature>.yaml`
- **Correctness gates**:
  - Every outbound URL fetch or callback surface is represented.
  - Allowed destination classes are explicit such as `vendor-allowlist`, `public-internet`, `private-service`, `none`.
  - Direct access to loopback, link-local, metadata, and RFC1918 ranges is forbidden unless explicitly allowlisted.
  - Redirect following policy is explicit.
  - Allowed schemes are explicit.
  - DNS rebinding defense mode is explicit for dynamic destinations.
  - Workloads with no legitimate egress are marked `egress: denied`.
- **Dependencies**:
  - `threat-model-spec`
  - `third-party-integration-security-policy`
- **Downstream consumers**:
  - `runtime-security-guardrails-policy`
  - `secure-code-review-spec`
  - DAST and runtime probes

### 14. Third-Party Integration Security Contract

- **Name**: Third-Party Integration Security Contract (`third-party-integration-security-policy`)
- **Frequency**: per-feature
- **Input**:
  - vendor API contract
  - data exchanged
  - trust direction
  - callback and webhook details
  - credential type
- **Output**:
  - `security/integrations/<vendor>.yaml`
- **Correctness gates**:
  - Every external domain, callback URL, and webhook relation is declared.
  - Credential type and source are declared.
  - Sandbox and production credentials are explicitly separated.
  - Data classes sent to and received from the vendor are declared.
  - Retry and failure mode is declared for security-sensitive integration paths.
  - The contract declares whether the vendor is a caller, callee, or bidirectional peer.
  - Any inbound callback relation references a webhook verification policy.
- **Dependencies**:
  - `secret-handling-policy`
  - `pii-data-classification-spec`
  - `endpoint-trust-classifier`
- **Downstream consumers**:
  - `csp-policy`
  - `webhook-verification-policy`
  - `ssrf-egress-policy`
  - `audit-logging-policy`

### 15. LLM Abuse Guardrail Policy

- **Name**: LLM Abuse Guardrail Policy (`llm-abuse-guardrail-policy`)
- **Frequency**: per-feature
- **Input**:
  - LLM feature spec
  - model and tool inventory
  - tenant model
  - data classification
  - threat model
- **Output**:
  - `security/llm/<feature>.yaml`
- **Correctness gates**:
  - Every LLM endpoint declares whether tool use is allowed.
  - If tool use is allowed, tool allowlist is explicit.
  - Maximum input tokens, output tokens, and spend budget per actor class are declared.
  - Prompt injection handling mode is explicit.
  - Cross-tenant memory or retrieval access is forbidden unless explicitly modeled and authorized.
  - Secret classes forbidden from prompt context are explicitly listed.
  - Moderation or safety decision mode is explicit for user-generated prompts and generated output when relevant.
- **Dependencies**:
  - `threat-model-spec`
  - `authz-policy`
  - `pii-data-classification-spec`
  - `rate-limit-abuse-policy`
- **Downstream consumers**:
  - `runtime-security-guardrails-policy`
  - `secure-code-review-spec`
  - logging and monitoring rules

### 16. Secure Code Review Spec

- **Name**: Secure Code Review Spec (`secure-code-review-spec`)
- **Frequency**: per-feature
- **Input**:
  - threat model
  - changed files or code ownership map
  - active security policies for the feature
  - tech stack metadata
- **Output**:
  - `security/code-review/<feature>.yaml`
- **Correctness gates**:
  - Every checklist item references at least one concrete policy or threat ID.
  - Feature categories such as `auth`, `upload`, `crypto`, `webhook`, `outbound-fetch`, `llm`, `admin`, `multi-tenant` activate the corresponding review sections.
  - Every checklist item has a machine-readable severity and fail mode.
  - Every referenced file glob or component path resolves to at least one file or declared generated artifact.
  - No dangling references to retired rule IDs or policies exist.
- **Dependencies**:
  - `threat-model-spec`
  - `authz-policy`
  - `input-validation-policy`
  - `file-upload-security-policy`
  - `ssrf-egress-policy`
  - `llm-abuse-guardrail-policy`
- **Downstream consumers**:
  - PR review bots
  - release gate synthesis
  - human reviewers

### 17. Secret Handling Policy

- **Name**: Secret Handling Policy (`secret-handling-policy`)
- **Frequency**: per-project
- **Input**:
  - service inventory
  - secret classes
  - environment list
  - service trust model
- **Output**:
  - `security/secrets/policy.yaml`
- **Correctness gates**:
  - Every secret class declares an authoritative source such as KMS, secret manager, vault, or HSM-backed store.
  - Every secret class declares rotation cadence.
  - Secret material is forbidden in source control and container image layers.
  - Every runtime environment declares a retrieval method for secrets.
  - Shared production and staging secret values are forbidden.
  - Every secret class declares its consumers by service or workload identity.
- **Dependencies**:
  - `service-auth-trust-policy`
  - `environment-security-baseline`
- **Downstream consumers**:
  - `webhook-verification-policy`
  - `third-party-integration-security-policy`
  - `encryption-key-usage-policy`
  - `container-image-security-policy`
  - `runtime-security-guardrails-policy`

### 18. Encryption and Key Usage Policy

- **Name**: Encryption and Key Usage Policy (`encryption-key-usage-policy`)
- **Frequency**: per-project
- **Input**:
  - data classification
  - secret handling policy
  - data stores and transport surfaces
- **Output**:
  - `security/crypto/key-usage.yaml`
- **Correctness gates**:
  - Every sensitive data class declares whether encryption at rest is required.
  - Every sensitive transport path declares whether transport encryption is required.
  - Every cryptographic use case declares approved algorithm family and key source.
  - Key purpose separation is explicit. The same key class cannot be reused for incompatible purposes unless policy explicitly allows it.
  - Rotation cadence is defined for every managed key class.
  - Raw key material is never referenced directly in the policy. Only managed key identifiers or aliases are allowed.
- **Dependencies**:
  - `pii-data-classification-spec`
  - `secret-handling-policy`
- **Downstream consumers**:
  - storage implementation
  - `third-party-integration-security-policy`
  - `runtime-security-guardrails-policy`
  - `secure-code-review-spec`

### 19. PII and Data Classification Spec

- **Name**: PII and Data Classification Spec (`pii-data-classification-spec`)
- **Frequency**: per-project
- **Input**:
  - schemas
  - DB fields
  - events
  - file types
  - integration payloads
- **Output**:
  - `security/data-classification.yaml`
- **Correctness gates**:
  - Every persisted field, log field, emitted event field, and integration payload field has a classification label.
  - Every classification label comes from an approved enum.
  - Every field marked sensitive declares masking or handling rules for logs.
  - Every file type processed by the system is classified.
  - Every field with retention constraints declares a retention class.
  - No schema or migration introduces an unclassified new field.
- **Dependencies**:
  - `ts-schema`
  - `db-migration`
  - integration payload schemas where applicable
- **Downstream consumers**:
  - `encryption-key-usage-policy`
  - `audit-logging-policy`
  - `file-upload-security-policy`
  - `third-party-integration-security-policy`
  - `llm-abuse-guardrail-policy`

### 20. Audit Logging Policy

- **Name**: Audit Logging Policy (`audit-logging-policy`)
- **Frequency**: per-project
- **Input**:
  - endpoint trust map
  - authz policy
  - data classification
  - service trust model
- **Output**:
  - `security/audit/policy.yaml`
- **Correctness gates**:
  - Every security-sensitive action has an audit event definition.
  - Every audit event requires actor identity, action, target, result, timestamp, request ID, and environment.
  - Tenant-aware events require tenant ID.
  - Sensitive values such as passwords, tokens, secrets, and restricted PII are explicitly forbidden in event payloads.
  - Admin actions, permission changes, auth events, key operations, webhook verification failures, and exception usage are all covered.
  - Every event type has a retention class.
- **Dependencies**:
  - `authz-policy`
  - `endpoint-trust-classifier`
  - `pii-data-classification-spec`
- **Downstream consumers**:
  - runtime logging systems
  - incident analysis
  - `vulnerability-exception-record`

### 21. Dependency Vulnerability Policy

- **Name**: Dependency Vulnerability Policy (`dependency-vulnerability-policy`)
- **Frequency**: daily
- **Input**:
  - package manifests
  - lockfiles
  - project risk posture
  - release artifact classes
- **Output**:
  - `security/dependencies/policy.yaml`
- **Correctness gates**:
  - Fail thresholds by severity are explicit.
  - Reachability-aware policy is explicit if reachability data exists.
  - Exceptions require a waiver reference.
  - Direct and transitive dependency handling mode is explicit.
  - Registry allowlist is explicit if private registries are used.
  - Any dependency pinned outside policy rules must be justified by an exception record.
- **Dependencies**:
  - package manifests
  - release artifact inventory
- **Downstream consumers**:
  - `sbom-provenance-policy`
  - `container-image-security-policy`
  - CI release gates
  - `vulnerability-exception-record`

### 22. SAST Policy

- **Name**: SAST Policy (`sast-semgrep-policy`)
- **Frequency**: daily
- **Input**:
  - repo layout
  - tech stack
  - threat model
  - custom sources and sinks
- **Output**:
  - `security/sast/semgrep-policy.yaml`
  - `security/sast/custom-rules.yaml`
- **Correctness gates**:
  - Every enabled rule has a valid rule ID.
  - Every ignore entry includes rule ID, scoped path, reason, and expiry.
  - Custom rules validate against Semgrep schema.
  - Required rulesets for the declared stack are enabled.
  - Taint sources and sinks for auth, SSRF, deserialization, command execution, and secret exposure are enabled where relevant.
  - Any permanent ignore is forbidden without an exception record.
- **Dependencies**:
  - `threat-model-spec`
  - `input-validation-policy`
  - `authz-policy`
  - stack metadata
- **Downstream consumers**:
  - `secure-code-review-spec`
  - CI checks
  - `vulnerability-exception-record`

### 23. DAST Scan Config

- **Name**: DAST Scan Config (`dast-scan-config`)
- **Frequency**: per-project
- **Input**:
  - endpoint trust map
  - authenticated user profiles
  - session and cookie policy
  - security headers policy
  - CSP policy
- **Output**:
  - `security/dast/<app>.yaml`
- **Correctness gates**:
  - Every scan target host is in an approved environment list.
  - Authenticated and unauthenticated scan profiles are explicitly separated.
  - Destructive or stateful routes that must be excluded are explicitly listed.
  - Webhook callback routes are not scanned as browser routes unless explicitly declared test-safe.
  - Expected security headers and CSP assertions are encoded as scan checks when applicable.
  - Production scans use a production-safe mode if production targets are allowed at all.
- **Dependencies**:
  - `endpoint-trust-classifier`
  - `session-cookie-policy`
  - `security-headers-policy`
  - `csp-policy`
- **Downstream consumers**:
  - release gates
  - `vulnerability-exception-record`

### 24. SBOM and Provenance Policy

- **Name**: SBOM and Provenance Policy (`sbom-provenance-policy`)
- **Frequency**: per-project
- **Input**:
  - build graph
  - release artifact list
  - signing identities
  - dependency vulnerability policy
- **Output**:
  - `security/supply-chain/provenance-policy.yaml`
- **Correctness gates**:
  - Every release artifact type requires an SBOM format.
  - Every release artifact type requires a provenance attestation format.
  - Approved signing identities are explicitly listed.
  - Attestations must bind source revision to produced artifact digest.
  - Unsigned release artifacts are forbidden for artifact classes marked critical.
  - Base image and build material sources are included for containerized releases.
- **Dependencies**:
  - `dependency-vulnerability-policy`
  - build graph metadata
- **Downstream consumers**:
  - `container-image-security-policy`
  - release gates
  - `vulnerability-exception-record`

### 25. Container Image Security Policy

- **Name**: Container Image Security Policy (`container-image-security-policy`)
- **Frequency**: per-project
- **Input**:
  - container manifests
  - base image inventory
  - secret policy
  - supply chain policy
- **Output**:
  - `security/containers/image-policy.yaml`
- **Correctness gates**:
  - Base images must come from an allowlist.
  - The container must declare a non-root runtime user unless workload class explicitly permits otherwise.
  - Package manager use in final runtime image is either forbidden or explicitly scoped.
  - Maximum allowed vulnerability thresholds by severity are explicit.
  - Image signing requirement is explicit for production workloads.
  - Secret injection via baked image layers is forbidden.
- **Dependencies**:
  - `secret-handling-policy`
  - `dependency-vulnerability-policy`
  - `sbom-provenance-policy`
- **Downstream consumers**:
  - `runtime-security-guardrails-policy`
  - deployment admission checks
  - `vulnerability-exception-record`

### 26. IaC Security Policy

- **Name**: IaC Security Policy (`iac-security-policy`)
- **Frequency**: per-project
- **Input**:
  - infrastructure manifests
  - environment baseline
  - data classification
  - service trust model
- **Output**:
  - `security/iac/policy.rego`
  - `security/iac/policy.yaml`
- **Correctness gates**:
  - Public exposure rules are explicit for load balancers, buckets, queues, and databases.
  - Production IAM wildcard principals are forbidden unless waived.
  - Encryption requirements for storage classes are explicit.
  - Network segmentation rules for private workloads are explicit.
  - Security logging requirements for cloud resources are explicit where relevant.
  - Staging and production differences must be present in a declared drift allowlist if they affect security controls.
- **Dependencies**:
  - `environment-security-baseline`
  - `pii-data-classification-spec`
  - `service-auth-trust-policy`
- **Downstream consumers**:
  - `runtime-security-guardrails-policy`
  - deployment policy engines
  - `dast-scan-config`

### 27. Runtime Security Guardrails

- **Name**: Runtime Security Guardrails (`runtime-security-guardrails-policy`)
- **Frequency**: per-project
- **Input**:
  - container image policy
  - IaC policy
  - secret handling policy
  - service trust policy
  - rate limit policy
  - SSRF egress policy
  - LLM abuse policy where relevant
- **Output**:
  - `security/runtime/guardrails.yaml`
- **Correctness gates**:
  - Every workload class declares privilege mode, filesystem mode, network mode, and secret injection mode.
  - Workloads marked `no-egress` must not have open egress rules.
  - Privileged containers are forbidden unless explicitly waived.
  - Debug or admin-only runtime features are disabled in production unless explicitly allowed.
  - Services handling sensitive data or admin actions declare stronger runtime controls than baseline workloads.
  - Workloads with AI or export abuse risk declare kill switch or throttle mode.
- **Dependencies**:
  - `container-image-security-policy`
  - `iac-security-policy`
  - `secret-handling-policy`
  - `service-auth-trust-policy`
  - `rate-limit-abuse-policy`
  - `ssrf-egress-policy`
  - optionally `llm-abuse-guardrail-policy`
- **Downstream consumers**:
  - deployment admission checks
  - runtime policy engines
  - incident containment playbooks

### 28. Environment Security Baseline

- **Name**: Environment Security Baseline (`environment-security-baseline`)
- **Frequency**: per-project
- **Input**:
  - environment list
  - domain map
  - infra topology
  - deployment classes
- **Output**:
  - `security/environments/baseline.yaml`
  - `security/environments/drift-allowlist.yaml`
- **Correctness gates**:
  - Every deployable environment is declared.
  - Every environment declares domain or origin set, secret source, logging mode, and TLS expectations.
  - Production is at least as strict as staging for controls declared monotonic by policy, unless drift allowlist contains an approved exception.
  - No undeclared environment can appear in generated policy outputs.
  - Drift allowlist entries require exact field scope and justification ID.
- **Dependencies**:
  - deployment environment inventory
- **Downstream consumers**:
  - `service-auth-trust-policy`
  - `secret-handling-policy`
  - `security-headers-policy`
  - `csp-policy`
  - `iac-security-policy`
  - `dast-scan-config`

### 29. Vulnerability Exception Record

- **Name**: Vulnerability Exception Record (`vulnerability-exception-record`)
- **Frequency**: per-incident
- **Input**:
  - concrete finding IDs
  - asset scope
  - environment scope
  - rationale
  - compensating controls
  - approver identity
- **Output**:
  - `security/exceptions/<id>.yaml`
- **Correctness gates**:
  - The exception references at least one real finding ID or policy violation ID.
  - Scope is explicit down to asset or route or image or dependency, not just project-wide unless the source finding is truly project-wide.
  - Expiry date is mandatory.
  - Compensating controls are listed.
  - Approver and owner are both listed.
  - Expired exceptions are invalid automatically.
  - Any exception widening the blast radius beyond the source finding scope is invalid.
- **Dependencies**:
  - Any finding-producing compiler such as `sast-semgrep-policy`, `dast-scan-config`, `dependency-vulnerability-policy`, `container-image-security-policy`, `iac-security-policy`
  - base policy that was violated
- **Downstream consumers**:
  - CI and release gating
  - audit logging
  - risk dashboard synthesis

---

## Notes on coverage of requested edge cases

The compilers above explicitly cover the requested edge cases:

- **Public vs internal endpoints**: handled by `endpoint-trust-classifier`, then consumed by authz, DAST, headers, rate limits, and audit logging.
- **Machine-to-machine auth**: handled by `service-auth-trust-policy` and `token-lifecycle-policy`.
- **Multi-tenant authorization boundaries**: handled by `authz-policy` and `threat-model-spec`.
- **Service-to-service trust**: handled by `service-auth-trust-policy`.
- **Signed webhooks**: handled by `webhook-verification-policy`.
- **File uploads**: handled by `file-upload-security-policy`.
- **SSRF risk surfaces**: handled by `ssrf-egress-policy`.
- **CSP nonces**: handled by `csp-policy`.
- **Token rotation**: handled by `token-lifecycle-policy` and `secret-handling-policy`.
- **Temporary security exceptions**: handled by `vulnerability-exception-record`.
- **Staging vs production policy drift**: handled by `environment-security-baseline` and `iac-security-policy`.
- **Third-party integrations**: handled by `third-party-integration-security-policy`.
- **AI and LLM-specific abuse surfaces**: handled by `llm-abuse-guardrail-policy`.

---

## Recommended build order for the security compiler network

The best build order is not the same as the org chart. Build the compilers that create reusable source-of-truth maps first, then the compilers that derive enforcement policies from those maps, then the scanners and exception machinery.

### Tier 0 - assumed prerequisites already exist

These are upstream and should already be available:
- `openapi-spec`
- `api-route`
- `auth-middleware`
- `db-migration`
- `ts-schema`

### Tier 1 - foundational inventory compilers

Build these first because many other security compilers depend on them:

1. `environment-security-baseline`
2. `endpoint-trust-classifier`
3. `pii-data-classification-spec`
4. `threat-model-spec`

Why first:
- Without environment baselines, you cannot reason cleanly about staging vs production drift.
- Without endpoint trust classification, downstream authz, DAST, headers, and abuse policy all become guesswork.
- Without data classification, crypto, logging, uploads, and LLM controls are under-specified.
- Without threat models, feature-specific enforcement compilers miss risk context.

### Tier 2 - identity, trust, and data boundary compilers

These depend mainly on Tier 1 and create the core security contract for the system:

5. `authz-policy`
6. `service-auth-trust-policy`
7. `token-lifecycle-policy`
8. `secret-handling-policy`
9. `encryption-key-usage-policy`
10. `audit-logging-policy`

Dependency notes:
- `authz-policy` depends on `endpoint-trust-classifier` and `threat-model-spec`.
- `service-auth-trust-policy` depends on `environment-security-baseline` and `endpoint-trust-classifier`.
- `token-lifecycle-policy` depends on `authz-policy` and `service-auth-trust-policy`.
- `secret-handling-policy` depends on `service-auth-trust-policy` and `environment-security-baseline`.
- `encryption-key-usage-policy` depends on `pii-data-classification-spec` and `secret-handling-policy`.
- `audit-logging-policy` depends on `authz-policy`, `endpoint-trust-classifier`, and `pii-data-classification-spec`.

### Tier 3 - request and browser hardening compilers

These are the high-leverage per-feature protections:

11. `input-validation-policy`
12. `session-cookie-policy`
13. `security-headers-policy`
14. `third-party-integration-security-policy`
15. `csp-policy`
16. `rate-limit-abuse-policy`
17. `webhook-verification-policy`
18. `file-upload-security-policy`
19. `ssrf-egress-policy`
20. `llm-abuse-guardrail-policy`

Dependency notes:
- `session-cookie-policy` depends on `token-lifecycle-policy`.
- `security-headers-policy` depends on `session-cookie-policy` and `environment-security-baseline`.
- `csp-policy` depends on `security-headers-policy`, `third-party-integration-security-policy`, and `environment-security-baseline`.
- `webhook-verification-policy` depends on `secret-handling-policy`.
- `file-upload-security-policy` depends on `input-validation-policy`, `pii-data-classification-spec`, and `threat-model-spec`.
- `ssrf-egress-policy` depends on `threat-model-spec` and usually `third-party-integration-security-policy`.
- `llm-abuse-guardrail-policy` depends on `threat-model-spec`, `authz-policy`, `pii-data-classification-spec`, and `rate-limit-abuse-policy`.

### Tier 4 - assurance and scanning compilers

These transform policy into machine-verifiable release checks:

21. `dependency-vulnerability-policy`
22. `sast-semgrep-policy`
23. `secure-code-review-spec`
24. `dast-scan-config`

Dependency notes:
- `sast-semgrep-policy` should be built after you have at least threat model, authz, and input validation policies.
- `secure-code-review-spec` becomes much more valuable after authz, validation, upload, SSRF, and LLM policies exist.
- `dast-scan-config` depends on endpoint trust classification, session policy, headers, and CSP.

### Tier 5 - supply chain and platform hardening compilers

These are essential for production-grade delivery but depend on earlier contracts:

25. `sbom-provenance-policy`
26. `container-image-security-policy`
27. `iac-security-policy`
28. `runtime-security-guardrails-policy`

Dependency notes:
- `sbom-provenance-policy` depends on `dependency-vulnerability-policy`.
- `container-image-security-policy` depends on `secret-handling-policy`, `dependency-vulnerability-policy`, and `sbom-provenance-policy`.
- `iac-security-policy` depends on `environment-security-baseline`, `pii-data-classification-spec`, and `service-auth-trust-policy`.
- `runtime-security-guardrails-policy` depends on container, IaC, secrets, service trust, abuse, and egress policies.

### Tier 6 - exception compiler

Build this last because it depends on earlier compilers producing findings or policy violations:

29. `vulnerability-exception-record`

Why last:
- It is a downstream escape hatch and should encode exceptions to a mature policy network, not substitute for missing policy.

---

## Minimal viable first wave

If the goal is to maximize practical value quickly, the first wave should be:

1. `endpoint-trust-classifier`
2. `threat-model-spec`
3. `authz-policy`
4. `input-validation-policy`
5. `rate-limit-abuse-policy`
6. `webhook-verification-policy`
7. `file-upload-security-policy`
8. `ssrf-egress-policy`
9. `secret-handling-policy`
10. `pii-data-classification-spec`
11. `audit-logging-policy`
12. `sast-semgrep-policy`
13. `dast-scan-config`
14. `vulnerability-exception-record`

This set gives you:
- trust boundary coverage
- authorization coverage
- request hardening
- major edge-case coverage
- scanner policy outputs
- a formal exception path

That is usually enough to start deriving real release gates before the full network exists.

---

## Suggested directory layout

```text
security/
  endpoint-trust-map.yaml
  threat-models/
  authz/
  service-trust/
  tokens/
  session/
  headers/
  csp/
  validation/
  rate-limits/
  webhooks/
  uploads/
  egress/
  integrations/
  llm/
  code-review/
  secrets/
  crypto/
  audit/
  dependencies/
  sast/
  dast/
  supply-chain/
  containers/
  iac/
  runtime/
  environments/
  exceptions/
```

