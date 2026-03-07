---
name: threat-modeling
description: Identifies attack surfaces, threat actors, and mitigations using STRIDE or similar frameworks. Use when designing new features, architecting systems, or conducting security design reviews. Triggers: "threat model", "STRIDE", "attack surface", "security review", "identify threats", "what could go wrong".
---

# Threat Modeling

## When to Use
- Designing a new feature that handles sensitive data or authentication
- Reviewing an existing system's security posture
- Preparing for a penetration test or security audit

## Workflow
1. Draw the data flow diagram: actors, processes, data stores, external entities
2. Identify trust boundaries on the DFD
3. Apply STRIDE to each element: Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation
4. Rate each threat by likelihood × impact
5. Define mitigations for medium and high risks; document accepted risks

## Quality Bar
- All external-facing interfaces are included in the model
- High-severity threats have mitigations with owners and timelines
- Model is reviewed by the security team before feature launch
- Threat model updated when architecture changes significantly
