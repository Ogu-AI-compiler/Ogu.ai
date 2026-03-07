---
name: monitoring
description: Sets up metrics, dashboards, and alerts to track system health and detect anomalies. Use when instrumenting services, building operational dashboards, or configuring alerting rules. Triggers: "set up monitoring", "add metrics", "create dashboard", "configure alerts", "track performance", "SLO".
---

# Monitoring

## When to Use
- Instrumenting a new service or feature for production observability
- Building dashboards for a service or product area
- Configuring alerts based on SLO thresholds

## Workflow
1. Define the four golden signals: latency, traffic, errors, saturation
2. Add instrumentation for each signal at the service boundary
3. Build dashboards: service overview, then drill-down views per subsystem
4. Define SLOs and configure alert thresholds at the SLO error budget boundary
5. Test alerts fire correctly and route to the right on-call rotation

## Quality Bar
- Every service has dashboards covering all four golden signals
- Alerts are actionable — no alert without a runbook
- Alert thresholds derived from SLOs, not arbitrary percentages
- Dashboards have P50, P95, P99 latency breakdowns, not just averages
