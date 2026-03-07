# Execution Graph Hash Contract

> Formal contract for execution graph integrity verification — deterministic hashing of the full DAG execution chain for replay guarantees and drift detection.

## Version

1.0

## Purpose

The execution graph hash captures the complete execution environment as a single SHA-256 digest. If the hash matches between two runs, the execution is provably identical (given same model responses). Drift during a build is detected by comparing pre-build and post-build hashes.

## State Files

| File | Purpose |
|------|---------|
| `.ogu/state/graph-hashes/{slug}.json` | Stored graph hash per feature |

## Components

| Component | Path |
|-----------|------|
| Graph hash engine | `tools/ogu/commands/lib/execution-graph-hash.mjs` |

## Hash Computation

The graph hash is a SHA-256 of the following 7 normalized components:

| Component | Source | Description |
|-----------|--------|-------------|
| Plan hash | `Plan.json` | SHA-256 of normalized plan (tasks, dependencies, outputs) |
| Policy version | `.ogu/policy/policy-version.json` | Policy version string at execution time |
| Policy AST hash | `.ogu/policy/policy.ast.json` | SHA-256 of compiled policy AST |
| OrgSpec version | `.ogu/OrgSpec.json` | Organization spec version |
| OrgSpec hash | `.ogu/OrgSpec.json` | SHA-256 of normalized OrgSpec |
| Model routing decisions | Routing log | All model routing decisions for the feature |
| Task snapshot chain | `.ogu/snapshots/` | SHA-256 chain of all task snapshot hashes in DAG order |

**Algorithm**: `SHA-256(JSON.stringify([planHash, policyVersion, policyASTHash, orgSpecVersion, orgSpecHash, modelDecisionSetHash, taskSnapshotChainHash]))`

## Drift Detection

| Phase | Action |
|-------|--------|
| Pre-build | Compute graph hash and store as `preHash` |
| Post-build | Recompute graph hash and store as `postHash` |
| Compare | If `preHash !== postHash`, emit drift warning |

**Drift causes**: Policy change during build, OrgSpec modification, model routing reconfiguration, or plan mutation.

## Integration with Compile Gates

| Gate | Check |
|------|-------|
| Gate 5 (Pre-build) | Compute and record `preHash` |
| Gate 10 (Post-build) | Compute `postHash`, compare with `preHash` |
| Gate 14 (Final) | Verify graph hash stored and no unresolved drift |

## Invariants

1. Hash is deterministic: same inputs always produce the same hash.
2. Hash is version-independent: the normalization strips formatting and ordering noise.
3. Hash components are individually verifiable via `graph:verify`.
4. Drift during build produces a warning, not a hard failure (policy may legitimately change).
5. Graph hash is always stored after successful compilation.

## CLI Commands

| Command | Purpose |
|---------|---------|
| `ogu graph:hash <slug>` | Compute execution graph hash for a feature |
| `ogu graph:verify <slug> <hash>` | Verify graph hash matches expected value |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU-GRAPH-001 | Plan.json not found or unparseable |
| OGU-GRAPH-002 | Policy AST not compiled — run `ogu policy:compile` first |
| OGU-GRAPH-003 | Graph hash drift detected during build |
| OGU-GRAPH-004 | Graph hash verification failed — mismatch |
| OGU-GRAPH-005 | Missing component for hash computation (OrgSpec, snapshots, etc.) |
