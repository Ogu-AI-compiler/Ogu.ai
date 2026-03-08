Security Engineer Compiler Network
Overview
This document decomposes the security engineer role into atomic, repeatable task types suitable for implementation as compilers in a Domain Compiler Network. Each compiler takes an intent (spec) as input and produces a verified, attested artifact. The focus is on application, product, and platform security artifacts that are machine-checkable, such as policies, configs, rules, and manifests. Tasks are prioritized by frequency: daily (few, if any), per-feature, per-project, then per-incident.
Excluded are already-built compilers (e.g., react-component, api-route) and shared ones (e.g., utility-fn, feature-flag). Dependencies and downstream consumers reference these where relevant, but this network is self-contained for security tasks.
The decomposition is exhaustive, covering core areas and edge cases like public vs. internal endpoints, machine-to-machine auth, multi-tenant boundaries, service-to-service trust, signed webhooks, file uploads, SSRF risks, CSP nonces, token rotation, temporary exceptions, staging vs. production drift, third-party integrations, and AI/LLM-specific abuse surfaces.
Summary Table

Task Name (Compiler ID)FrequencyInputOutputthreat-model-compilerper-featureFeature spec (e.g., openapi-spec artifact)threat_model.json (threats and mitigations)authz-policy-compilerper-featureAPI/feature spec, user rolesauthz_policy.yamlm2m-auth-policy-compilerper-featureService interaction specm2m_auth_policy.yamlmulti-tenant-boundary-compilerper-featureTenant isolation requirementsmulti_tenant_boundaries.jsonservice-trust-policy-compilerper-featureService graphservice_trust_policy.yamlinput-validation-compilerper-featureAPI schema (e.g., ts-schema)input_validation_rules.jsonrate-limit-compilerper-featureEndpoint usage patternsrate_limit_config.yamlwebhook-verify-compilerper-featureWebhook endpoint specwebhook_verify_policy.jsonfile-upload-policy-compilerper-featureUpload feature specfile_upload_policy.yamlaudit-log-policy-compilerper-featureFeature actions specaudit_log_rules.jsonssrf-protection-compilerper-featureExternal call sites specssrf_protection_rules.yamlthird-party-integration-compilerper-featureIntegration specthird_party_security_policy.jsonai-abuse-policy-compilerper-featureAI/LLM feature specai_abuse_protection.yamlsecret-policy-compilerper-projectProject secrets inventorysecret_handling_policy.yamldep-vuln-policy-compilerper-projectDependency listdep_vuln_rules.jsonsast-rules-compilerper-projectCodebase patternssast_rules.yaml (e.g., Semgrep)dast-config-compilerper-projectApplication URLsdast_config.jsoncsp-policy-compilerper-projectFrontend assets speccsp_policy.yamlsession-policy-compilerper-projectAuth flow specsession_cookie_policy.jsonencryption-policy-compilerper-projectData flow specencryption_key_policy.yamlpii-classify-compilerper-projectData schemapii_classification_manifest.jsoncode-review-checklist-compilerper-projectProject security requirementscode_review_checklist.yamlsbom-policy-compilerper-projectBuild pipeline specsbom_generation_policy.jsoncontainer-scan-policy-compilerper-projectContainer manifestcontainer_scan_rules.yamliac-security-policy-compilerper-projectIaC templatesiac_security_rules.jsonruntime-guardrail-compilerper-projectRuntime environment specruntime_guardrails.yamltoken-rotation-policy-compilerper-projectToken usage spectoken_rotation_policy.jsonpolicy-drift-check-compilerper-incidentStaging/prod configsdrift_report.jsonvuln-waiver-compilerper-incidentVulnerability detailsvuln_waiver_record.yamltemp-exception-compilerper-incidentException rationaletemp_exception_manifest.json
Detailed Breakdown
threat-model-compiler

Name: threat-model-compiler
Frequency: per-feature
Input: Feature spec (e.g., from openapi-spec or api-route), including data flows, endpoints, and assets.
Output: threat_model.json – a structured file listing threats, mitigations, and residual risks.
Correctness gates: All identified assets have at least one threat; each threat has a mitigation; no unmitigated high-severity threats (based on CVSS-like scoring); JSON schema validation.
Dependencies: openapi-spec, api-route.
Downstream consumers: authz-policy-compiler, input-validation-compiler, audit-log-policy-compiler.

authz-policy-compiler

Name: authz-policy-compiler
Frequency: per-feature
Input: API/feature spec, user roles, including public vs. internal endpoints.
Output: authz_policy.yaml – policy file defining permissions per endpoint/role.
Correctness gates: Every endpoint declares an auth policy; no public endpoint without explicit allow; policy syntax valid (e.g., OPA Rego check); coverage for all roles.
Dependencies: threat-model-compiler, openapi-spec.
Downstream consumers: api-route, auth-middleware.

m2m-auth-policy-compiler

Name: m2m-auth-policy-compiler
Frequency: per-feature
Input: Service interaction spec, including machine-to-machine auth requirements.
Output: m2m_auth_policy.yaml – config for tokens, certs, or keys in service calls.
Correctness gates: All m2m endpoints require mutual auth; key rotation referenced; no hardcoded credentials; YAML validation.
Dependencies: threat-model-compiler, service-trust-policy-compiler.
Downstream consumers: api-route, utility-fn.

multi-tenant-boundary-compiler

Name: multi-tenant-boundary-compiler
Frequency: per-feature
Input: Tenant isolation requirements, data schemas.
Output: multi_tenant_boundaries.json – manifest defining tenant scopes and isolation rules.
Correctness gates: All data accesses scoped to tenant ID; no cross-tenant queries without explicit allow; JSON schema check.
Dependencies: authz-policy-compiler, pii-classify-compiler.
Downstream consumers: db-migration, api-route.

service-trust-policy-compiler

Name: service-trust-policy-compiler
Frequency: per-feature
Input: Service graph, including service-to-service trust levels.
Output: service_trust_policy.yaml – policy for trust boundaries and auth between services.
Correctness gates: All inter-service calls authenticated; trust levels match threat model; no implicit trust for external services.
Dependencies: threat-model-compiler.
Downstream consumers: m2m-auth-policy-compiler, api-route.

input-validation-compiler

Name: input-validation-compiler
Frequency: per-feature
Input: API schema (e.g., from ts-schema), including user inputs.
Output: input_validation_rules.json – rules for sanitization and validation.
Correctness gates: All inputs have type checks; high-risk inputs (e.g., SQL) escaped; no unvalidated fields; schema validation.
Dependencies: threat-model-compiler, openapi-spec.
Downstream consumers: api-route, react-form.

rate-limit-compiler

Name: rate-limit-compiler
Frequency: per-feature
Input: Endpoint usage patterns, abuse scenarios.
Output: rate_limit_config.yaml – config for limits per user/IP/endpoint.
Correctness gates: All public endpoints have limits; burst and sustained rates defined; config syntax valid.
Dependencies: authz-policy-compiler.
Downstream consumers: api-route, utility-fn.

webhook-verify-compiler

Name: webhook-verify-compiler
Frequency: per-feature
Input: Webhook endpoint spec, including signed webhooks.
Output: webhook_verify_policy.json – verification rules (e.g., HMAC signatures).
Correctness gates: All webhooks require signature check; key references secure; no optional verification.
Dependencies: secret-policy-compiler.
Downstream consumers: api-route.

file-upload-policy-compiler

Name: file-upload-policy-compiler
Frequency: per-feature
Input: Upload feature spec, including file types and sizes.
Output: file_upload_policy.yaml – rules for scanning, storage, and access.
Correctness gates: All uploads scanned for malware; size/type limits enforced; no executable types without reason.
Dependencies: input-validation-compiler.
Downstream consumers: api-route, react-form.

audit-log-policy-compiler

Name: audit-log-policy-compiler
Frequency: per-feature
Input: Feature actions spec, sensitive operations.
Output: audit_log_rules.json – rules for what to log and retention.
Correctness gates: All authz decisions logged; PII masked; log format standard (e.g., JSON); coverage for all actions.
Dependencies: threat-model-compiler, pii-classify-compiler.
Downstream consumers: analytics-event, utility-fn.

ssrf-protection-compiler

Name: ssrf-protection-compiler
Frequency: per-feature
Input: External call sites spec, SSRF risk surfaces.
Output: ssrf_protection_rules.yaml – allow/deny lists for URLs.
Correctness gates: All external calls validated; no internal IPs allowed; ruleset comprehensive.
Dependencies: input-validation-compiler.
Downstream consumers: api-route.

third-party-integration-compiler

Name: third-party-integration-compiler
Frequency: per-feature
Input: Integration spec, third-party APIs.
Output: third_party_security_policy.json – auth, data sharing rules.
Correctness gates: All integrations auth'd; data minimized; no unvetted vendors.
Dependencies: threat-model-compiler.
Downstream consumers: api-route.

ai-abuse-policy-compiler

Name: ai-abuse-policy-compiler
Frequency: per-feature
Input: AI/LLM feature spec, abuse surfaces (e.g., prompt injection).
Output: ai_abuse_protection.yaml – filters and monitoring rules.
Correctness gates: All inputs filtered for injection; rate limits applied; rules syntax valid.
Dependencies: rate-limit-compiler, input-validation-compiler.
Downstream consumers: api-route.

secret-policy-compiler

Name: secret-policy-compiler
Frequency: per-project
Input: Project secrets inventory.
Output: secret_handling_policy.yaml – config for storage, rotation.
Correctness gates: No hardcoded secrets; all secrets rotated; policy covers all types.
Dependencies: None (foundational).
Downstream consumers: encryption-policy-compiler, webhook-verify-compiler.

dep-vuln-policy-compiler

Name: dep-vuln-policy-compiler
Frequency: per-project
Input: Dependency list.
Output: dep_vuln_rules.json – scanning thresholds and auto-update rules.
Correctness gates: Critical vulns blocked; rules match CVE scores; JSON valid.
Dependencies: sbom-policy-compiler.
Downstream consumers: None (CI/CD consumer).

sast-rules-compiler

Name: sast-rules-compiler
Frequency: per-project
Input: Codebase patterns.
Output: sast_rules.yaml – custom Semgrep or similar rules.
Correctness gates: Rules compile; no false positives in test cases; coverage for OWASP top 10.
Dependencies: code-review-checklist-compiler.
Downstream consumers: None (CI/CD).

dast-config-compiler

Name: dast-config-compiler
Frequency: per-project
Input: Application URLs.
Output: dast_config.json – scan targets and auth.
Correctness gates: All endpoints covered; auth tokens included; config parses.
Dependencies: openapi-spec.
Downstream consumers: None.

csp-policy-compiler

Name: csp-policy-compiler
Frequency: per-project
Input: Frontend assets spec, including CSP nonces.
Output: csp_policy.yaml – content security policy directives.
Correctness gates: No unsafe-inline/eval; nonces for scripts; policy valid per spec.
Dependencies: react-page.
Downstream consumers: react-component.

session-policy-compiler

Name: session-policy-compiler
Frequency: per-project
Input: Auth flow spec.
Output: session_cookie_policy.json – secure flags, timeouts.
Correctness gates: HttpOnly and Secure flags set; expiration defined; no persistent without MFA.
Dependencies: authz-policy-compiler.
Downstream consumers: react-form.

encryption-policy-compiler

Name: encryption-policy-compiler
Frequency: per-project
Input: Data flow spec.
Output: encryption_key_policy.yaml – algorithms, key usage.
Correctness gates: Approved algos only (e.g., AES-256); keys not reused; policy covers transit/storage.
Dependencies: secret-policy-compiler.
Downstream consumers: db-migration.

pii-classify-compiler

Name: pii-classify-compiler
Frequency: per-project
Input: Data schema.
Output: pii_classification_manifest.json – labels per field.
Correctness gates: All fields classified; sensitive fields encrypted/logged appropriately.
Dependencies: ts-schema.
Downstream consumers: audit-log-policy-compiler, multi-tenant-boundary-compiler.

code-review-checklist-compiler

Name: code-review-checklist-compiler
Frequency: per-project
Input: Project security requirements.
Output: code_review_checklist.yaml – automated checklist items.
Correctness gates: Items binary-checkable; covers auth, input, etc.; YAML valid.
Dependencies: threat-model-compiler.
Downstream consumers: sast-rules-compiler.

sbom-policy-compiler

Name: sbom-policy-compiler
Frequency: per-project
Input: Build pipeline spec.
Output: sbom_generation_policy.json – format and attestation rules.
Correctness gates: SBOM format standard (e.g., CycloneDX); provenance included; all deps covered.
Dependencies: None.
Downstream consumers: dep-vuln-policy-compiler.

container-scan-policy-compiler

Name: container-scan-policy-compiler
Frequency: per-project
Input: Container manifest.
Output: container_scan_rules.yaml – vuln thresholds.
Correctness gates: Base images approved; no root users; rules match severity.
Dependencies: sbom-policy-compiler.
Downstream consumers: None.

iac-security-policy-compiler

Name: iac-security-policy-compiler
Frequency: per-project
Input: IaC templates.
Output: iac_security_rules.json – linting rules.
Correctness gates: No public resources without justification; encryption enforced; JSON valid.
Dependencies: encryption-policy-compiler.
Downstream consumers: None.

runtime-guardrail-compiler

Name: runtime-guardrail-compiler
Frequency: per-project
Input: Runtime environment spec.
Output: runtime_guardrails.yaml – WAF rules, anomaly detection.
Correctness gates: All endpoints guarded; rules testable; no bypasses.
Dependencies: rate-limit-compiler.
Downstream consumers: None.

token-rotation-policy-compiler

Name: token-rotation-policy-compiler
Frequency: per-project
Input: Token usage spec.
Output: token_rotation_policy.json – schedules and alerts.
Correctness gates: Rotation intervals defined; auto-revoke on compromise; covers all token types.
Dependencies: secret-policy-compiler.
Downstream consumers: m2m-auth-policy-compiler.

policy-drift-check-compiler

Name: policy-drift-check-compiler
Frequency: per-incident
Input: Staging/prod configs.
Output: drift_report.json – differences and risks.
Correctness gates: No unapproved drifts; report lists all variances; JSON schema valid.
Dependencies: All policy compilers (e.g., authz-policy-compiler).
Downstream consumers: None.

vuln-waiver-compiler

Name: vuln-waiver-compiler
Frequency: per-incident
Input: Vulnerability details.
Output: vuln_waiver_record.yaml – rationale, expiration.
Correctness gates: Expiration date set; mitigation plan included; approver attested.
Dependencies: dep-vuln-policy-compiler.
Downstream consumers: None.

temp-exception-compiler

Name: temp-exception-compiler
Frequency: per-incident
Input: Exception rationale, duration.
Output: temp_exception_manifest.json – scope and revert plan.
Correctness gates: Duration < threshold (e.g., 30 days); revert automated; manifest valid.
Dependencies: policy-drift-check-compiler.
Downstream consumers: None.

Recommended Build Order
Considering the dependency graph (e.g., foundational policies before feature-specific ones) and priority (daily none identified, then per-feature, per-project, per-incident), the build order is:

Foundational (no deps): secret-policy-compiler, sbom-policy-compiler, threat-model-compiler.
Per-feature core (depend on foundational): authz-policy-compiler, service-trust-policy-compiler, input-validation-compiler.
Per-feature extensions (depend on core): m2m-auth-policy-compiler, multi-tenant-boundary-compiler, rate-limit-compiler, webhook-verify-compiler, file-upload-policy-compiler, audit-log-policy-compiler, ssrf-protection-compiler, third-party-integration-compiler, ai-abuse-policy-compiler.
Per-project setup (depend on per-feature or foundational): dep-vuln-policy-compiler, sast-rules-compiler, dast-config-compiler, csp-policy-compiler, session-policy-compiler, encryption-policy-compiler, pii-classify-compiler, code-review-checklist-compiler, container-scan-policy-compiler, iac-security-policy-compiler, runtime-guardrail-compiler, token-rotation-policy-compiler.
Per-incident (depend on all above): policy-drift-check-compiler, vuln-waiver-compiler, temp-exception-compiler.

This order ensures dependencies are built first, starting with high-frequency (per-feature) compilers after foundations.
