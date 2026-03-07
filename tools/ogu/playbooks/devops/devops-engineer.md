---
role: "DevOps Engineer"
category: "devops"
min_tier: 1
capacity_units: 8
---

# DevOps Engineer Playbook

## Core Methodology

### CI/CD Pipeline Design
The pipeline is the product delivery mechanism. Treat it as production code:
- Every commit triggers a pipeline. No manual builds.
- Pipeline stages: lint → test → build → security scan → deploy staging → smoke test → deploy production.
- Fast feedback: unit tests complete in <2 minutes. Full pipeline in <15 minutes.
- Fail fast: if lint fails, don't run tests. If tests fail, don't build.
- Artifacts: immutable, versioned, stored in a registry. Never rebuild for production.

### Infrastructure as Code
All infrastructure is version-controlled, reviewed, and tested:
- Terraform for cloud infrastructure. No manual console changes.
- Module pattern: reusable modules for common infrastructure (VPC, RDS, ECS).
- State management: remote backend with locking (S3 + DynamoDB).
- Plan before apply: `terraform plan` output reviewed in PR.
- Drift detection: weekly automated plan to detect manual changes.
- Environment parity: staging mirrors production. Same modules, different variables.

### Deployment Strategy
Choose based on risk tolerance and rollback needs:
- Blue-green: full environment switch. Best for zero-downtime with instant rollback.
- Canary: gradual traffic shift (1% → 10% → 50% → 100%). Best for detecting issues early.
- Rolling: update instances sequentially. Best for stateful services.
- Feature flags: deploy code, control activation separately. Best for decoupling deploy from release.
- Always: automated rollback trigger on error rate > threshold.

### Monitoring and Alerting
You cannot fix what you cannot see:
- Four golden signals: latency, traffic, errors, saturation.
- Structured logging: JSON format, correlation IDs, consistent field names.
- Distributed tracing across all services (OpenTelemetry).
- Dashboards: one per service showing RED metrics (Rate, Errors, Duration).
- Alerts: page on symptoms (high error rate), not causes (high CPU).
- On-call runbooks: every alert links to a runbook with troubleshooting steps.

### Container Strategy
- One process per container. Containers are not VMs.
- Base images: minimal (distroless or alpine). Pin exact versions.
- Build: multi-stage builds. Dev dependencies not in production image.
- Security: scan images for CVEs in CI. Block deploy on critical findings.
- Resource limits: always set CPU and memory limits. No unbounded containers.
- Health checks: liveness (is it alive?) and readiness (can it serve traffic?) probes.

## Checklists

### New Service Deployment Checklist
- [ ] Dockerfile follows multi-stage build pattern
- [ ] Image scanned for vulnerabilities (0 critical, 0 high)
- [ ] Resource limits defined (CPU, memory)
- [ ] Health check endpoints implemented (/healthz, /readyz)
- [ ] Logging configured (structured JSON, correlation ID)
- [ ] Metrics endpoint exposed (/metrics)
- [ ] Secrets injected from vault (not environment variables)
- [ ] Auto-scaling rules defined
- [ ] Alert rules configured for error rate and latency

### CI/CD Pipeline Checklist
- [ ] Pipeline runs on every PR
- [ ] Lint + format check as first stage
- [ ] Unit tests with coverage threshold (>80%)
- [ ] Integration tests against test dependencies
- [ ] Security scan (SAST + dependency check)
- [ ] Artifact built and pushed to registry
- [ ] Staging deploy automatic on merge to main
- [ ] Production deploy requires approval (or canary passes)

### Incident Response Checklist
- [ ] Acknowledge alert within SLA (5min P1, 30min P2)
- [ ] Check monitoring dashboard for affected service
- [ ] Review recent deployments (last 24h)
- [ ] Check dependent services for cascading failures
- [ ] Rollback if recent deploy is suspected cause
- [ ] Communicate status to stakeholders
- [ ] Post-incident review within 48 hours

## Anti-Patterns

### Snowflake Servers
Servers configured manually with undocumented changes.
Fix: Immutable infrastructure. Destroy and recreate, never patch in place.

### The Pipeline of Pain
A CI/CD pipeline that takes 45 minutes, fails randomly, and nobody understands.
Fix: Measure each stage. Parallelize tests. Fix flaky tests. Cache dependencies.

### Alert Fatigue
Hundreds of alerts, most ignorable, so real alerts get missed.
Fix: Every alert must be actionable. If you routinely ignore an alert, delete it.

### The Hero Deploy
One person who knows how to deploy, and it requires 47 manual steps.
Fix: Automate the entire process. Document what remains. Cross-train the team.

### Configuration Drift
Production diverges from staging because of hotfixes and manual changes.
Fix: Drift detection. Automated reconciliation. All changes through version control.

### Logging Everything
Logging every request body, response body, and stack trace in production.
Fix: Log at the right level. Debug in dev, info in production. Rotate and retain.

## When to Escalate

- Production is down and automated rollback failed.
- A security scan reveals a critical vulnerability in production infrastructure.
- Cloud provider is experiencing an outage affecting the deployment region.
- Cost spike detected (>2x normal daily spend) with no known cause.
- Pipeline is broken on main branch for >2 hours, blocking all deployments.
- Secrets may have been exposed (logs, error messages, public repos).

## Cost Management

### Cost Optimization Principles
- Right-size first: most instances are over-provisioned. Profile actual usage.
- Reserved capacity for steady-state workloads (60-70% savings).
- Spot/preemptible for batch processing and non-critical workloads.
- Auto-scaling: scale down as aggressively as you scale up.
- Clean up: zombie resources (unattached volumes, old snapshots, idle load balancers).

### Cost Monitoring
- Tag all resources by team, service, and environment.
- Weekly cost review per service team.
- Budget alerts at 80% and 100% of monthly budget.
- Cost anomaly detection: alert on >20% day-over-day increase.

## Disaster Recovery

### RPO and RTO
- Define Recovery Point Objective: how much data can you lose? (minutes/hours)
- Define Recovery Time Objective: how long can you be down? (minutes/hours)
- Test disaster recovery quarterly. Untested DR is wishful thinking.

### Backup Strategy
- Automated backups for all data stores.
- Backups stored in a different region from production.
- Backup restoration tested monthly.
- Backup encryption with separate key management.

### Runbook Template
1. Symptom: what does the alert/report say?
2. Verify: how to confirm the issue is real?
3. Immediate action: what stops the bleeding?
4. Root cause investigation: where to look?
5. Resolution: how to fix permanently?
6. Prevention: what change prevents recurrence?

## Secret Management

### Secret Lifecycle
- Generation: use cryptographically secure random generators. Never derive from predictable inputs.
- Storage: dedicated secret manager (Vault, AWS Secrets Manager). Never in code or config files.
- Rotation: automated rotation on schedule. Minimum quarterly for production secrets.
- Revocation: immediate revocation capability. Revoke before rotate when compromised.
- Audit: log all secret access. Alert on unusual access patterns.

### Secret Injection
- Runtime injection: secrets loaded at startup, not baked into images.
- Environment-specific: different secrets per environment. Never share production secrets.
- Least privilege: each service accesses only its own secrets.
- No secret in logs: sanitize log output. Mask secrets in debug output.

## Networking

### Network Architecture
- VPC design: separate subnets for public, private, and data tiers.
- Security groups: default deny, explicit allow. No 0.0.0.0/0 ingress.
- NAT gateways for outbound internet access from private subnets.
- DNS: internal service discovery via private DNS zones.

### Load Balancing
- Health check configuration: appropriate intervals, thresholds, and timeout.
- Connection draining: allow in-flight requests to complete during deployment.
- SSL termination: at the load balancer for centralized certificate management.
- Sticky sessions: avoid when possible. Use when required by stateful applications.

## Configuration Management

### Config Strategy
- Environment variables for runtime configuration.
- Config maps/secrets for container orchestration.
- Feature flags for behavior toggles (separate from infrastructure config).
- Config validation: schema validation at startup. Fail fast on invalid config.

### Config Hygiene
- No hardcoded values: all environment-specific values externalized.
- Default values for non-critical settings. Required values fail explicitly.
- Config changes are versioned and auditable.
- Configuration drift detection: compare running config against source of truth.

## Capacity Management

### Resource Right-Sizing
- Review resource utilization monthly. Downsize underutilized resources.
- Track waste: instances running at <20% CPU for >7 days are candidates for downsizing.
- Reservation planning: analyze 90-day usage trends for reserved instance purchases.
- Spot instance strategy: use for fault-tolerant workloads (batch, CI, dev environments).

### Growth Planning
- Capacity forecast: correlate resource usage with business metrics.
- Threshold alerts: warn at 70% utilization, critical at 85%.
- Scale testing: verify auto-scaling works before peak events.

<!-- skills: ci-cd, infrastructure-as-code, monitoring, deployment, containerization, cost-optimization, incident-response, disaster-recovery, security-operations, automation -->
