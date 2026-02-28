# Policy Determinism Contract

> Formal contract for the deterministic policy evaluation pipeline — AST compilation, evaluation order, conflict resolution, version pinning.

## Version

1.0

## Purpose

Guarantee that policy evaluation is deterministic: same input always produces same output. No "eventual consistency by hope" — the evaluator reads only from compiled AST, never from raw rules.json directly.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/policies/rules.json` | Raw policy rules (source) |
| `.ogu/policy/policy.ast.json` | Compiled AST (generated from rules.json) |
| `.ogu/policy/policy-version.json` | Version chain with hash history |

## AST Node Types

| Node | Fields | Description |
|------|--------|-------------|
| `RuleNode` | id, priority, group, when, unless, effects, version, hash | Top-level rule |
| `LogicalNode` | operator (AND/OR/NOT), children, shortCircuit | Logical grouping |
| `LeafNode` | field, op, value, fieldType, hash | Single condition |
| `EffectNode` | effect, params, group, merge | Action to take |

## Evaluation Pipeline

1. **Load compiled AST** — NOT raw rules. If no AST exists → OGU3601
2. **Verify freshness** — If rules.json hash ≠ AST rulesHash → OGU3602
3. **Walk AST** — Pre-sorted by priority DESC, then id ASC (deterministic tiebreak)
4. **Resolve conflicts** — Per-group merge strategies (max, min, union, replace, append)
5. **Apply invariants** — Hardcoded invariants that no rule can override
6. **Build receipt** — Full evaluation receipt with matched rules, resolution log, hashes

## Conflict Resolution

| Group | Merge Strategy | Description |
|-------|---------------|-------------|
| `approval` | max | Highest approval count wins |
| `execution` | replace | deny beats allow |
| `model_tier` | max (setMin) / min (downgrade) | Most restrictive wins |
| `gates` | union | All gates combined |
| `concurrency` | min | Most restrictive limit |
| `sandbox` | max | Strictest sandbox |
| `notification` | append | All alerts emitted |
| `audit` | union | All tags combined |

## Invariants

1. Explicit approval ALWAYS beats autoApprove.
2. deny/blockExecution is absolute — nothing can unblock except override.
3. Model tier cannot exceed org max (tier 3).
4. Policy version MUST NOT change during feature execution. If it does → OGU3603.
5. The evaluator reads ONLY from AST, NEVER from rules.json directly.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `ogu policy:compile` | Compile rules.json → AST + version bump |
| `ogu policy:compile --verify` | Compile + verify AST matches rules |
| `ogu policy:ast` | Show compiled AST tree |
| `ogu policy:conflicts --task <json>` | Show conflict resolutions for context |
| `ogu policy:version` | Show policy version chain |
| `ogu policy:version --history` | Show full version history |
| `ogu policy:freeze` | Lock policy during execution |
| `ogu policy:unfreeze` | Unlock policy |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU3600 | No rules.json found |
| OGU3601 | No compiled AST — run ogu policy:compile |
| OGU3602 | AST stale — rules.json changed since last compile |
| OGU3603 | Policy version changed during execution |

## Implementation

| Component | Path |
|-----------|------|
| AST compiler | `tools/ogu/commands/lib/policy-ast.mjs` |
| Conflict resolver | `tools/ogu/commands/lib/policy-resolver.mjs` |
| Policy engine | `tools/ogu/commands/lib/policy-engine.mjs` |
