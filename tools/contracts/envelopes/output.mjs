import { OutputEnvelopeSchema } from '../schemas/output-envelope.mjs';

/**
 * Build a validated OutputEnvelope.
 * Runner calls this after task execution before writing to disk.
 *
 * @param {string} taskId
 * @param {object} result - Execution result
 * @param {object} meta - Runner metadata
 * @returns {import('../schemas/output-envelope.mjs').OutputEnvelope}
 * @throws {z.ZodError} if validation fails
 */
export function buildOutputEnvelope(taskId, result, meta) {
  const envelope = {
    version: 1,
    taskId,
    featureSlug: meta.featureSlug,
    status: result.status,
    files: result.files || [],
    tokensUsed: result.tokensUsed || { input: 0, output: 0, total: 0, cost: 0, currency: 'USD' },
    gateResults: result.gateResults || [],
    astHash: result.astHash,
    conflicts: result.conflicts || [],
    error: result.error,
    modelUsed: result.modelUsed,
    runner: {
      pid: meta.pid || process.pid,
      isolationLevel: meta.isolationLevel || 'L0',
      worktreePath: meta.worktreePath,
      durationMs: meta.durationMs || 0,
    },
    startedAt: meta.startedAt,
    completedAt: new Date().toISOString(),
    idempotencyKey: meta.idempotencyKey,
  };

  // Validate against schema — throws if invalid
  return OutputEnvelopeSchema.parse(envelope);
}

/**
 * Build a failure OutputEnvelope (convenience).
 *
 * @param {string} taskId
 * @param {object} error - { code, message }
 * @param {object} meta - Runner metadata
 * @returns {import('../schemas/output-envelope.mjs').OutputEnvelope}
 */
export function buildFailureEnvelope(taskId, error, meta) {
  return buildOutputEnvelope(taskId, {
    status: 'error',
    error: { code: error.code, message: error.message },
    tokensUsed: { input: 0, output: 0, total: 0, cost: 0, currency: 'USD' },
  }, meta);
}

/**
 * Build an ErrorEnvelope for unrecoverable failures (Ogu → Kadima).
 *
 * @param {object} params
 * @param {string} params.inReplyTo - Original InputEnvelope ID
 * @param {string} params.errorClass - budget_exhausted | governance_blocked | dependency_missing | max_escalation | timeout | internal_error
 * @param {string} params.errorCode - OGU error code
 * @param {string} params.message - Human-readable message
 * @param {object} [params.context] - attemptsMap, totalCost, totalTokens
 * @param {string} [params.recommendation] - replan | manual_intervention | skip_task | change_spec
 * @returns {object} ErrorEnvelope
 */
export function buildErrorEnvelope(params) {
  return {
    $schema: 'KadimaOgu/ErrorEnvelope/1.0',
    envelopeId: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    inReplyTo: params.inReplyTo,
    timestamp: new Date().toISOString(),
    source: 'ogu',
    target: 'kadima',
    errorClass: params.errorClass,
    errorCode: params.errorCode,
    message: params.message,
    context: params.context || {},
    recommendation: params.recommendation || 'manual_intervention',
  };
}

/**
 * Escalation Protocol — defines when and how Ogu escalates to Kadima.
 *
 * @returns {object} Static protocol definition
 */
export function getEscalationProtocol() {
  return {
    $schema: 'KadimaOgu/EscalationProtocol/1.0',
    triggers: [
      {
        condition: 'ogu.failure_count >= 3 AND ogu.escalation_exhausted',
        action: 'escalate_to_kadima',
        kadimaResponse: 'replan_task | reassign_agent | request_human_override | abort_feature',
      },
      {
        condition: 'ogu.budget_exceeded',
        action: 'escalate_to_kadima',
        kadimaResponse: 'allocate_more_budget | downgrade_model | pause_feature',
      },
      {
        condition: 'ogu.governance_blocked AND timeout > 4h',
        action: 'escalate_to_kadima',
        kadimaResponse: 'auto_approve_if_low_risk | escalate_to_human | abort_task',
      },
      {
        condition: 'ogu.dependency_missing AND no_producing_task',
        action: 'escalate_to_kadima',
        kadimaResponse: 'replan_dag | create_missing_task | request_human_input',
      },
    ],
    authorityRules: {
      kadima_decides: ['task_assignment', 'budget_allocation', 'approval_routing', 'replan', 'abort'],
      ogu_decides: ['model_selection_within_budget', 'retry_strategy', 'gate_execution', 'artifact_validation'],
      conflict_resolution: 'kadima_wins',
    },
  };
}

/**
 * Evaluate whether an escalation trigger fires.
 *
 * @param {object} context - { failureCount, escalationExhausted, budgetExceeded, governanceBlocked, governanceBlockedHours, dependencyMissing }
 * @returns {{ shouldEscalate: boolean, trigger: string|null, kadimaResponse: string|null }}
 */
export function evaluateEscalation(context) {
  if (context.failureCount >= 3 && context.escalationExhausted) {
    return { shouldEscalate: true, trigger: 'max_escalation', kadimaResponse: 'replan_task' };
  }
  if (context.budgetExceeded) {
    return { shouldEscalate: true, trigger: 'budget_exceeded', kadimaResponse: 'allocate_more_budget' };
  }
  if (context.governanceBlocked && (context.governanceBlockedHours || 0) > 4) {
    return { shouldEscalate: true, trigger: 'governance_timeout', kadimaResponse: 'escalate_to_human' };
  }
  if (context.dependencyMissing) {
    return { shouldEscalate: true, trigger: 'dependency_missing', kadimaResponse: 'replan_dag' };
  }
  return { shouldEscalate: false, trigger: null, kadimaResponse: null };
}
