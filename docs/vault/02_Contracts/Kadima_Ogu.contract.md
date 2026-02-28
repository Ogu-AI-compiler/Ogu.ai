# Kadima ↔ Ogu Contract

> Formal boundary contract between Kadima (orchestrator) and Ogu (compiler).

## Version

1.0

## Purpose

Define the strict communication protocol between Kadima and Ogu. Kadima decides *what* and *who*. Ogu decides *how*. Neither crosses the boundary.

## Envelope Types

| Direction | Envelope | When |
|-----------|----------|------|
| Kadima → Ogu | `InputEnvelope` | Dispatching a task to a runner |
| Ogu → Kadima | `OutputEnvelope` | Task completed (success or failure) |
| Ogu → Kadima | `ErrorEnvelope` | Unrecoverable failure requiring Kadima decision |

## InputEnvelope Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | yes | Schema version |
| `taskId` | string | yes | Task identifier |
| `featureSlug` | string | yes | Feature context |
| `taskName` | string | yes | Human-readable task name |
| `agent.roleId` | string | yes | Assigned agent role |
| `agent.sessionId` | string | yes | Agent session UUID |
| `agent.capabilities` | string[] | no | Required capabilities |
| `prompt` | string | yes | Full task prompt |
| `files` | object[] | no | Pre-loaded file contents |
| `routingDecision` | object | no | Model routing result |
| `budget` | object | no | Token/cost budget cap |
| `sandboxPolicy` | object | no | Filesystem/network/tool restrictions |
| `blastRadius` | object | no | Max file/line change limits |
| `isolationLevel` | string | no | L0-L3 isolation |
| `temperature` | number | no | Model temperature (default: 0) |
| `idempotencyKey` | string | yes | Dedup key |

## OutputEnvelope Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | yes | Schema version |
| `taskId` | string | yes | Task identifier |
| `featureSlug` | string | yes | Feature context |
| `status` | string | yes | success, error, partial, timeout |
| `files` | object[] | no | Files produced |
| `tokensUsed` | object | yes | input, output, total, cost |
| `gateResults` | object[] | no | Gate pass/fail results |
| `astHash` | string | no | Code AST hash |
| `conflicts` | object[] | no | Merge conflicts detected |
| `error` | object | no | Error code + message |
| `modelUsed` | string | no | Actual model used |
| `runner` | object | yes | PID, isolation, worktree, duration |

## ErrorEnvelope Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `envelopeId` | string | yes | Unique error envelope ID |
| `inReplyTo` | string | yes | Original InputEnvelope ID |
| `errorClass` | string | yes | budget_exhausted, governance_blocked, dependency_missing, max_escalation, timeout, internal_error |
| `errorCode` | string | yes | OGU error code |
| `message` | string | yes | Human-readable description |
| `context` | object | no | attemptsMap, totalCost, totalTokens |
| `recommendation` | string | yes | replan, manual_intervention, skip_task, change_spec |

## Escalation Protocol

| Trigger | Kadima Response Options |
|---------|------------------------|
| `failure_count >= 3 AND escalation_exhausted` | replan_task, reassign_agent, request_human_override, abort_feature |
| `budget_exceeded` | allocate_more_budget, downgrade_model, pause_feature |
| `governance_blocked AND timeout > 4h` | auto_approve_if_low_risk, escalate_to_human, abort_task |
| `dependency_missing AND no_producing_task` | replan_dag, create_missing_task, request_human_input |

## Authority Rules

| Domain | Authority |
|--------|-----------|
| Task assignment | Kadima |
| Budget allocation | Kadima |
| Approval routing | Kadima |
| Replan / abort | Kadima |
| Model selection within budget | Ogu |
| Retry strategy | Ogu |
| Gate execution | Ogu |
| Artifact validation | Ogu |

**Conflict resolution:** Kadima wins.

## Invariants

1. Ogu NEVER assigns tasks. Only Kadima assigns.
2. Kadima NEVER writes code. Only Ogu writes.
3. Every InputEnvelope produces exactly one OutputEnvelope or ErrorEnvelope.
4. ErrorEnvelope ALWAYS contains a recommendation.
5. Context snapshot hashes in InputEnvelope MUST match current state.

## Implementation

| Component | Path |
|-----------|------|
| InputEnvelope builder | `tools/contracts/envelopes/input.mjs` |
| OutputEnvelope builder | `tools/contracts/envelopes/output.mjs` |
| ErrorEnvelope builder | `tools/contracts/envelopes/output.mjs` |
| Escalation evaluator | `tools/contracts/envelopes/output.mjs` |
| InputEnvelope schema | `tools/contracts/schemas/input-envelope.mjs` |
| OutputEnvelope schema | `tools/contracts/schemas/output-envelope.mjs` |

## Error Codes

| Code | Meaning |
|------|---------|
| OGU2701 | Missing envelopeId |
| OGU2702 | Missing command |
| OGU2703 | Missing taskId |
| OGU2704 | Missing agent roleId |
| OGU2705 | Missing constraints |
| OGU2706 | Spec hash mismatch (context drift) |
