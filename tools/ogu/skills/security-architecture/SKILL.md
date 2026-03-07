---
name: security-architecture
description: Designs security controls, trust boundaries, and defense-in-depth strategies for systems and services. Use when architecting new systems, reviewing security posture, or designing security requirements for a feature. Triggers: "security architecture", "secure design", "trust boundaries", "zero trust", "defense in depth", "security review".
---

# Security Architecture

## When to Use
- Designing a new system or service with security requirements
- Reviewing an architecture for security risks before build
- Establishing security patterns for a new technology or integration

## Workflow
1. Map trust boundaries: what can communicate with what, with what credentials
2. Apply principle of least privilege to every service and IAM role
3. Encrypt data in transit (TLS 1.2+) and at rest (AES-256) everywhere
4. Design for zero trust: verify explicitly, assume breach, use least-privilege access
5. Document threat model: assets, threats, mitigations, residual risk

## Quality Bar
- No implicit trust between services — all calls are authenticated and authorized
- Credentials never hardcoded or logged — use secrets management
- Security controls are validated in CI (SAST, dependency scanning)
- Architecture review includes a security sign-off from security team
