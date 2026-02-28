# Kadima Adapter Contract

> Formal contract for the strict boundary between Kadima and Ogu — all communication through the adapter.

## Version

1.0

## Purpose

ALL communication between Kadima and Ogu MUST pass through the adapter. No direct function calls across the boundary. Static analysis enforces this.

## Communication Protocol

| Direction | Method | Format |
|-----------|--------|--------|
| Kadima → Ogu | `dispatch(inputEnvelope)` | InputEnvelope |
| Ogu → Kadima | `respond(outputEnvelope)` | OutputEnvelope / ErrorEnvelope |

## Inbound Validation Pipeline

1. Schema validation (InputEnvelope fields)
2. Agent identity check (agentId + signature)
3. Feature envelope check (budget, blast radius)
4. Policy evaluation (governance hook)
5. Audit event logged

## Forbidden Patterns

1. Kadima importing any function from `tools/ogu/commands/*.mjs` directly
2. Ogu importing any function from `tools/kadima/*.mjs` directly
3. Kadima reading `.ogu/agents/` directly
4. Any module bypassing the adapter

## Static Analysis

Enforced by `ogu validate`:
- Pattern: `from ['"].*tools/ogu/commands/` in `tools/kadima/**/*.mjs` → OGU4010
- Pattern: `from ['"].*tools/kadima/` in `tools/ogu/**/*.mjs` → OGU4011

## Invariants

1. Kadima calls `dispatch()`. Ogu returns `respond()`. No direct imports.
2. Every dispatch is audited.
3. Feature envelope violations block dispatch.
4. Agent identity violations block dispatch.

## Error Codes

| Code | Meaning |
|------|---------|
| OGU4001 | Invalid InputEnvelope schema |
| OGU4002 | Agent identity invalid or revoked |
| OGU4003 | Feature envelope check failed |
| OGU4004 | Task not found in plan |
| OGU4005 | Policy blocked this action |
| OGU4006 | Invalid OutputEnvelope schema |
| OGU4010 | Kadima imports Ogu directly |
| OGU4011 | Ogu imports Kadima directly |

## Implementation

| Component | Path |
|-----------|------|
| Kadima adapter | `tools/ogu/commands/lib/kadima-adapter.mjs` |
