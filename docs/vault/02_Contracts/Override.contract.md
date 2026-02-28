# Override Contract

> Formal contract for the override system — bypassing gates, policies, or constraints with authority.

## Version

1.0

## Purpose

Every override is a recorded, auditable deviation from normal rules. Overrides require authority (role-based), create audit trails, and track impact on determinism.

## Override Types

| Type | Allowed Roles | Requires ADR | Max Duration | Audit Level |
|------|---------------|--------------|--------------|-------------|
| `validation_skip` | tech-lead, cto | No | 24h | warning |
| `gate_skip` | cto | Yes | permanent | critical |
| `model_force` | tech-lead, architect, cto | No | session | info |
| `budget_extend` | tech-lead, cto | No | 24h | warning |
| `governance_bypass` | cto | Yes | permanent | critical |
| `state_force` | cto | Yes | permanent | critical |
| `spec_deviation` | architect, cto | Yes | permanent | warning |

## Impact Matrix

| Type | Determinism Broken | Gates Skipped | Invariants Violated |
|------|--------------------|---------------|---------------------|
| `validation_skip` | No | - | - |
| `gate_skip` | Yes | [target gate] | - |
| `model_force` | Yes | - | - |
| `budget_extend` | No | - | - |
| `governance_bypass` | Yes | - | governance_policy |
| `state_force` | Yes | - | state_machine |
| `spec_deviation` | Yes | - | spec_contract |

## State Files

| File | Purpose |
|------|---------|
| `.ogu/overrides/{id}.json` | Individual override records |

## CLI Commands

| Command | Purpose |
|---------|---------|
| `override:create` | Create an override with type, reason, authority |
| `override:list` | List overrides (active, expired, revoked) |
| `override:revoke` | Revoke an active override |

## Invariants

1. Override without authority ALWAYS fails.
2. Override with `requiresADR` and no ADR reference ALWAYS fails.
3. Every override creates an audit event.
4. Expired overrides auto-expire on read.
5. Override is an artifact — it has schema, ID, and lifecycle.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU2951 | Unknown override type |
| OGU2952 | Role not authorized for override type |
| OGU2953 | ADR reference required |
| OGU2954 | Reason required |

## Implementation

| Component | Path |
|-----------|------|
| Override handler | `tools/ogu/commands/lib/override-handler.mjs` |
| Override CLI | `tools/ogu/commands/override-cmd.mjs` |
