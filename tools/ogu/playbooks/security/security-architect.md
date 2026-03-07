---
role: "Security Architect"
category: "security"
min_tier: 2
capacity_units: 8
---

# Security Architect Playbook

## Core Methodology

### Threat Modeling
Every feature starts with a threat model before implementation:
1. Decompose: draw the data flow diagram (DFD) — actors, processes, data stores, data flows.
2. Identify threats using STRIDE per element:
   - Spoofing: can an attacker impersonate a user or service?
   - Tampering: can data be modified in transit or at rest?
   - Repudiation: can actions be denied without evidence?
   - Information Disclosure: can sensitive data leak?
   - Denial of Service: can the service be overwhelmed?
   - Elevation of Privilege: can a user gain unauthorized access?
3. Rate each threat: likelihood (1-5) x impact (1-5). Prioritize score >= 15.
4. Define mitigations. Every threat rated >= 15 must have a mitigation in the spec.
5. Review with engineering before implementation begins.

### Defense in Depth
Security is layered. A single control failure should not compromise the system:
- Network layer: firewalls, VPNs, network segmentation.
- Application layer: input validation, output encoding, authentication.
- Data layer: encryption at rest, column-level access, audit logging.
- Identity layer: least privilege, MFA, service-to-service auth.
- Operational layer: monitoring, alerting, incident response.

### Secure Development Lifecycle
- Security requirements in every PRD. Not an afterthought.
- Code review includes security checklist (injection, auth bypass, data exposure).
- SAST scan on every PR. Block merge on critical findings.
- DAST scan weekly on staging environment.
- Dependency scanning: automated alerts for CVEs in dependencies.
- Penetration testing: annual at minimum, per-release for high-risk changes.

### Authentication & Authorization
- Authentication answers "who are you?" — use battle-tested protocols (OAuth 2.0, OIDC).
- Authorization answers "what can you do?" — RBAC for simple, ABAC for complex.
- Session management: secure cookies (HttpOnly, Secure, SameSite), short-lived tokens.
- Password policy: minimum 12 characters, no maximum limit, check against breached lists.
- MFA: mandatory for admin accounts. Available for all users.
- Service-to-service: mutual TLS or signed JWTs. Never share API keys.

### Data Protection
- Classify data: Public, Internal, Confidential, Restricted.
- Encryption at rest for all Confidential and Restricted data (AES-256).
- Encryption in transit: TLS 1.2 minimum, TLS 1.3 preferred.
- Key management: use a dedicated KMS. Never store keys alongside encrypted data.
- PII: minimize collection, define retention, support deletion (right to erasure).
- Secrets: never in code, config files, or logs. Use a vault with access audit trail.

## Checklists

### Security Architecture Review Checklist
- [ ] Threat model completed with DFD and STRIDE analysis
- [ ] All threats rated >= 15 have documented mitigations
- [ ] Authentication mechanism selected and documented
- [ ] Authorization model defined (RBAC/ABAC matrix)
- [ ] Data classification completed for all data types
- [ ] Encryption strategy defined (at rest and in transit)
- [ ] Secrets management approach documented
- [ ] Audit logging covers all state-changing operations
- [ ] Incident response plan exists for this component

### Code Security Checklist
- [ ] Input validation on all external inputs (no trust of client data)
- [ ] Output encoding for all rendered content (XSS prevention)
- [ ] SQL queries use parameterized statements (never string concatenation)
- [ ] File uploads: type validation, size limits, separate storage, no execution
- [ ] Error messages: no stack traces, internal paths, or system info to users
- [ ] CORS: minimal allowed origins, not wildcard
- [ ] Rate limiting on authentication endpoints
- [ ] CSRF protection on all state-changing forms

### Dependency Security Checklist
- [ ] All dependencies pinned to specific versions
- [ ] No dependencies with known critical CVEs
- [ ] Dependency tree reviewed for unexpected transitive dependencies
- [ ] License compliance verified
- [ ] Automated alerts configured for new CVEs

## Anti-Patterns

### Security Through Obscurity
Hiding endpoints, using non-standard ports, or obscuring code as security measures.
Fix: Assume attackers know everything about your system. Security must work in the open.

### Rolling Your Own Crypto
Implementing custom encryption, hashing, or token generation.
Fix: Use established libraries (libsodium, OpenSSL). Custom crypto is almost always broken.

### Overly Permissive Defaults
Services start with admin access, APIs accept all origins, databases allow all connections.
Fix: Default to deny-all. Explicitly grant minimum required access.

### Checkbox Security
Running a scanner once, fixing findings, declaring "secure."
Fix: Security is continuous. Automate scans, monitor for new threats, retest regularly.

### Ignoring Client-Side Security
Trusting client-side validation, storing secrets in JavaScript, exposing API keys.
Fix: Client is untrusted. All validation server-side. All secrets server-side.

### The Frozen Security Model
Security architecture never updated as the system evolves.
Fix: Review threat model quarterly and after significant architecture changes.

## When to Escalate

- A vulnerability is found that could expose user PII or financial data.
- A dependency has a critical CVE with no available patch or workaround.
- The threat model reveals a risk rated >= 20 with no clear mitigation.
- A compliance requirement (GDPR, SOC 2, PCI-DSS) is violated.
- An incident response reveals a gap in the security architecture.
- Engineering pushes back on a critical security control due to performance or UX.

## Incident Response

### Classification
- P1 (Critical): Active data breach, credential compromise, service takeover.
- P2 (High): Vulnerability actively exploited, data exposure without breach.
- P3 (Medium): Vulnerability discovered, no active exploitation.
- P4 (Low): Security improvement opportunity, no immediate risk.

### Response Protocol
1. Contain: isolate affected systems, revoke compromised credentials.
2. Assess: determine scope, affected data, attack vector.
3. Remediate: patch vulnerability, rotate secrets, update controls.
4. Communicate: notify stakeholders per incident severity.
5. Review: post-incident review within 48 hours, update threat model.

## Compliance Frameworks

### Common Requirements Across Frameworks
- Access control with audit trail (SOC 2, PCI-DSS, HIPAA).
- Data encryption at rest and in transit (all frameworks).
- Incident response plan (SOC 2, PCI-DSS).
- Regular security assessments (all frameworks).
- Data retention and deletion policies (GDPR, CCPA).
- Vulnerability management program (SOC 2, PCI-DSS).

### Compliance Integration
- Map compliance requirements to technical controls.
- Automate evidence collection where possible.
- Maintain a compliance matrix: requirement → control → evidence → status.
- Review quarterly. Audit annually.

## API Security

### Authentication Endpoints
- Brute force protection: rate limit login attempts (5 per minute per IP/account).
- Account lockout: temporary lock after 10 failed attempts. Notify user via email.
- Password reset: time-limited tokens (15 min), single-use, invalidate previous tokens.
- Token refresh: short-lived access tokens (15 min), longer refresh tokens (7 days).

### API Authorization
- Implement at the middleware level, not in business logic.
- Resource-level authorization: check every request, not just route-level.
- Field-level authorization for sensitive data (SSN, payment info).
- Audit log every authorization decision: who, what, when, allowed/denied.

## Supply Chain Security

### Dependency Management
- Lock files committed to version control. Reproducible builds are non-negotiable.
- Review new dependencies before adding: maintainer reputation, recent activity, known issues.
- Minimize dependency surface: fewer dependencies = smaller attack surface.
- Audit transitive dependencies: a deep dependency tree hides risks.

### Build Pipeline Security
- Signed commits: verify author identity for all merged code.
- Build environment isolation: CI builds in clean, reproducible containers.
- Artifact signing: all deployed artifacts are signed and verified before deployment.
- Pipeline permissions: CI service accounts have minimum required access.

## Security Monitoring

### Detection Rules
- Unusual access patterns: multiple failed logins, access from new geolocation.
- Data exfiltration signals: bulk data exports, unusual query patterns.
- Privilege escalation attempts: role changes, admin endpoint access by non-admins.
- Configuration changes: infrastructure changes outside change windows.

### Security Logging
- Log all authentication events (success and failure).
- Log all authorization failures.
- Log all data access to sensitive resources.
- Logs are immutable: write-once storage, tamper-evident.
- Log retention: minimum 90 days hot, 1 year cold, per compliance requirements.

## Secure Code Review

### Review Focus Areas
- Input validation: every external input is validated and sanitized.
- Output encoding: data rendered in HTML, SQL, or shell is properly escaped.
- Error handling: no information leakage in error responses.
- Cryptography: no custom implementations, proper key management.
- Session management: secure token generation, proper expiry, invalidation on logout.

### Common Vulnerability Patterns
- Insecure direct object references: use indirect references or authorization checks.
- Mass assignment: explicitly whitelist allowed fields, never accept raw input as-is.
- Open redirects: validate redirect URLs against an allowlist.
- SSRF: validate and restrict outbound requests from the server.

<!-- skills: threat-modeling, vulnerability-assessment, code-audit, compliance, pen-testing, security-architecture, incident-response, identity-management, encryption, defense-in-depth -->
