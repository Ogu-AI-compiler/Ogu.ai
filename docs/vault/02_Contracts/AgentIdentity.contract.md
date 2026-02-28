# Agent Identity Contract

> Formal contract for agent identity, session binding, capability validation, and revocation.

## Version

1.0

## Purpose

Every agent operates with a formal AgentId. Sessions bind agents to tasks and features. Role changes require re-creation. Revocation = immediate halt + quarantine.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/agents/credentials/{agentId}.json` | Agent credential |
| `.ogu/agents/sessions/{sessionId}.json` | Legacy session files |
| `.ogu/agents/revoked/{agentId}.json` | Revocation records |
| `.ogu/quarantine/{agentId}/` | Quarantined outputs |

## AgentId Format

```
{orgId}:{roleId}:{instanceId}
```

- `orgId`: SHA256(OrgSpec.org.name + version)[0:8]
- `roleId`: From OrgSpec.roles[].roleId
- `instanceId`: SHA256(roleId + timestamp + random)[0:8]

## Session Lifecycle

| State | Description |
|-------|-------------|
| `created` | Identity exists, no task assigned |
| `active` | Bound to a task, executing |
| `idle` | Task complete, no pending work |
| `expired` | Idle timeout (1h) or max duration (24h) |
| `revoked` | Manual or automatic revocation |

## Revocation Triggers

1. Manual: `ogu agent:revoke <agentId>`
2. OrgSpec role removed or changed
3. Budget exhausted
4. Security violation detected
5. Consecutive failure limit hit

## Invariants

1. Every agent has a formal AgentId.
2. Session = binding to task + feature.
3. Role change in OrgSpec = re-create identity (OGU3905).
4. Revocation = immediate halt + quarantine.
5. Local agents use file-system access as identity verification.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU3900 | OrgSpec not found |
| OGU3901 | Role not found in OrgSpec |
| OGU3902 | Agent not found |
| OGU3903 | Agent has been revoked |
| OGU3904 | Agent credential expired |
| OGU3905 | Role changed since agent was created |
| OGU3906 | Agent not found for revocation |

## Implementation

| Component | Path |
|-----------|------|
| Agent identity runtime | `tools/ogu/commands/lib/agent-identity.mjs` |
