---
name: disaster-recovery
description: Designs and tests disaster recovery plans with defined RTO/RPO targets and runbooks for regional failover. Use when defining recovery objectives, designing backup strategies, or testing business continuity procedures. Triggers: "disaster recovery", "RTO/RPO", "failover", "backup and restore", "business continuity", "DR plan".
---

# Disaster Recovery

## When to Use
- Designing DR strategy for a new service or system
- Running a DR drill or business continuity test
- Responding to a regional outage or data loss event

## Workflow
1. Define RTO (recovery time objective) and RPO (recovery point objective) for each service
2. Design backup strategy: frequency, retention, and storage location (different region/account)
3. Implement automated failover for critical services; manual runbooks for the rest
4. Run DR drills quarterly: actually fail over, don't just review the runbook
5. Measure actual RTO/RPO during drills — they're usually worse than the targets

## Quality Bar
- All critical services have documented RTO/RPO targets approved by business stakeholders
- Backups are tested by restoring them, not just by verifying they were taken
- DR runbooks are clear enough for anyone on-call to execute, not just the author
- Last DR drill results documented and gaps addressed with action items
