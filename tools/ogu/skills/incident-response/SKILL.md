---
name: incident-response
description: Coordinates response to production incidents using structured triage, mitigation, and postmortem processes. Use when a service is down, degraded, or experiencing anomalies requiring immediate action. Triggers: "incident", "production down", "service degraded", "on-call", "outage", "p0", "p1".
---

# Incident Response

## When to Use
- A service is unavailable or returning errors at scale
- Error rate or latency has breached an SLO threshold
- A customer-facing issue requires immediate investigation

## Workflow
1. Acknowledge the incident and assign an incident commander
2. Assess impact: who is affected, how many users, what functionality
3. Implement the fastest mitigation first (rollback, feature flag, rate limit)
4. Communicate status to stakeholders every 15 minutes during active incidents
5. Restore service, then investigate root cause (in that order)
6. Write postmortem within 48 hours: timeline, root cause, action items

## Quality Bar
- Time-to-mitigate is prioritized over time-to-resolve
- All actions during the incident are logged with timestamps
- Postmortem is blameless and focuses on system improvements
- Action items have owners and due dates
