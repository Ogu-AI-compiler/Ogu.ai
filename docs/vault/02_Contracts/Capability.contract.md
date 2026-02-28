# Capability Registry Contract

> Formal contract for the capability system — separating roles from models via capabilities.

## Version

1.0

## Purpose

Decouple organizational roles from model providers via an intermediate capability layer. Swapping providers changes `providerCapabilities` only — roles and capabilities remain stable.

## Routing Chain

```
Role → Capability → Model

backend-dev → code_generation → claude-sonnet-4-6
security    → security_audit  → claude-opus-4-6
qa          → test_generation → claude-haiku-4-5
```

## State Files

| File | Purpose |
|------|---------|
| `.ogu/capabilities.json` | Capability definitions, provider traits, role-capability map |

## Capability Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique capability identifier |
| `name` | string | Human-readable name |
| `category` | string | review, generation, analysis, documentation |
| `requiredTraits` | string[] | Traits the model must have |
| `minTier` | number | Minimum model tier (1-3) |
| `preferredTier` | number | Preferred model tier |

## Provider Model Schema

| Field | Type | Description |
|-------|------|-------------|
| `tier` | number | Model tier (1=haiku, 2=sonnet, 3=opus) |
| `traits` | string[] | Model capabilities (coding, reasoning, vision, etc.) |
| `costFactor` | number | Relative cost multiplier |

## CLI Commands

| Command | Purpose |
|---------|---------|
| `capability:resolve` | Resolve capability → role → model chain |
| `capability:list` | List all registered capabilities |

## Invariants

1. Model swap = change `providerCapabilities` only. Roles and capabilities are stable.
2. Capability with unmet traits at current tier → escalate or error.
3. Role without a capability CANNOT request it.
4. Budget tier caps the maximum model tier.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU3001 | Unknown capability |
| OGU3002 | Role does not have capability |
| OGU3003 | Min tier exceeds budget tier |
| OGU3004 | No model available for capability at given tier |

## Implementation

| Component | Path |
|-----------|------|
| Capability registry | `tools/ogu/commands/lib/capability-registry.mjs` |
| Capability CLI | `tools/ogu/commands/capability-cmd.mjs` |
