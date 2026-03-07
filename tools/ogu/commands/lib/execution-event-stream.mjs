/**
 * execution-event-stream.mjs — Slice 434
 * Full lifecycle event stream for the execution engine.
 *
 * Wraps event-bus (in-process pub/sub) + audit-emitter (persistent JSONL)
 * to provide a unified event API for task execution observability.
 *
 * Event taxonomy:
 *   task.started        — task execution begins
 *   task.completed      — task finishes successfully
 *   task.failed         — task finishes with failure
 *   gate.checking       — gate check begins
 *   gate.passed         — gate check passed
 *   gate.failed         — gate check failed (includes structured feedback)
 *   retry.started       — retry attempt begins
 *   retry.exhausted     — all retries exhausted
 *   compile.started     — compile begins
 *   compile.gate        — compile gate result
 *   compile.finished    — compile completed
 *   escalation.triggered — model tier escalation
 *   feedback.created    — structured feedback record created
 *   learning.candidate  — learning candidate generated
 *
 * Exports:
 *   createExecutionStream(opts?) → ExecutionStream
 *   EXECUTION_EVENTS — event type constants
 *   formatEventForLog(event) → string
 */

import { createEventBus } from './event-bus.mjs';
import { emitAudit } from './audit-emitter.mjs';

// ── Event type constants ─────────────────────────────────────────────────────

export const EXECUTION_EVENTS = {
  TASK_STARTED:        'task.started',
  TASK_COMPLETED:      'task.completed',
  TASK_FAILED:         'task.failed',
  GATE_CHECKING:       'gate.checking',
  GATE_PASSED:         'gate.passed',
  GATE_FAILED:         'gate.failed',
  RETRY_STARTED:       'retry.started',
  RETRY_EXHAUSTED:     'retry.exhausted',
  COMPILE_STARTED:     'compile.started',
  COMPILE_GATE:        'compile.gate',
  COMPILE_FINISHED:    'compile.finished',
  ESCALATION_TRIGGERED:'escalation.triggered',
  FEEDBACK_CREATED:    'feedback.created',
  LEARNING_CANDIDATE:  'learning.candidate',
};

// ── Event formatter ──────────────────────────────────────────────────────────

/**
 * formatEventForLog(event) → string
 * Human-readable one-liner for terminal/log output.
 */
export function formatEventForLog(event) {
  if (!event) return '[empty event]';
  const ts = event.timestamp ? event.timestamp.slice(11, 19) : '??:??:??';
  const type = event.type || 'unknown';
  const taskId = event.taskId || event.payload?.taskId || '';
  const extra = [];

  if (event.gate) extra.push(`gate=${event.gate}`);
  if (event.passed !== undefined) extra.push(event.passed ? 'PASS' : 'FAIL');
  if (event.attempt) extra.push(`attempt=${event.attempt}`);
  if (event.durationMs) extra.push(`${event.durationMs}ms`);
  if (event.error) extra.push(`err=${String(event.error).slice(0, 60)}`);

  const suffix = extra.length > 0 ? ` (${extra.join(', ')})` : '';
  return `[${ts}] ${type} ${taskId}${suffix}`;
}

// ── Execution Stream factory ─────────────────────────────────────────────────

/**
 * createExecutionStream(opts?) → ExecutionStream
 *
 * opts:
 *   persistToAudit — write events to audit JSONL (default true)
 *   featureSlug    — default feature slug for all events
 *   projectId      — project ID for event grouping
 */
export function createExecutionStream(opts = {}) {
  const {
    persistToAudit = true,
    featureSlug = null,
    projectId = null,
  } = opts;

  const bus = createEventBus();
  const history = [];
  const MAX_HISTORY = 500;

  function emit(type, payload = {}) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      featureSlug: payload.featureSlug || featureSlug,
      projectId: payload.projectId || projectId,
      ...payload,
    };

    // Store in memory ring buffer
    history.push(event);
    if (history.length > MAX_HISTORY) history.shift();

    // Publish to in-process subscribers (event-bus handles wildcard internally)
    bus.emit(type, event);

    // Persist to audit log
    if (persistToAudit) {
      try {
        emitAudit(type, payload, {
          feature: event.featureSlug,
          source: 'execution-stream',
          severity: type.includes('failed') || type.includes('exhausted') ? 'warn' : 'info',
        });
      } catch { /* audit write is best-effort */ }
    }

    return event;
  }

  // ── Convenience emitters ─────────────────────────────────────────────────

  function taskStarted(taskId, details = {}) {
    return emit(EXECUTION_EVENTS.TASK_STARTED, { taskId, ...details });
  }

  function taskCompleted(taskId, details = {}) {
    return emit(EXECUTION_EVENTS.TASK_COMPLETED, { taskId, ...details });
  }

  function taskFailed(taskId, error, details = {}) {
    return emit(EXECUTION_EVENTS.TASK_FAILED, { taskId, error: String(error), ...details });
  }

  function gateChecking(taskId, gate) {
    return emit(EXECUTION_EVENTS.GATE_CHECKING, { taskId, gate });
  }

  function gatePassed(taskId, gate, details = {}) {
    return emit(EXECUTION_EVENTS.GATE_PASSED, { taskId, gate, passed: true, ...details });
  }

  function gateFailed(taskId, gate, details = {}) {
    return emit(EXECUTION_EVENTS.GATE_FAILED, { taskId, gate, passed: false, ...details });
  }

  function retryStarted(taskId, attempt, details = {}) {
    return emit(EXECUTION_EVENTS.RETRY_STARTED, { taskId, attempt, ...details });
  }

  function retryExhausted(taskId, attempts, details = {}) {
    return emit(EXECUTION_EVENTS.RETRY_EXHAUSTED, { taskId, attempts, ...details });
  }

  function compileStarted(slug, details = {}) {
    return emit(EXECUTION_EVENTS.COMPILE_STARTED, { featureSlug: slug, ...details });
  }

  function compileGate(slug, gate, passed, details = {}) {
    return emit(EXECUTION_EVENTS.COMPILE_GATE, { featureSlug: slug, gate, passed, ...details });
  }

  function compileFinished(slug, passed, details = {}) {
    return emit(EXECUTION_EVENTS.COMPILE_FINISHED, { featureSlug: slug, passed, ...details });
  }

  function escalationTriggered(taskId, fromTier, toTier, details = {}) {
    return emit(EXECUTION_EVENTS.ESCALATION_TRIGGERED, { taskId, fromTier, toTier, ...details });
  }

  function feedbackCreated(taskId, recordId, details = {}) {
    return emit(EXECUTION_EVENTS.FEEDBACK_CREATED, { taskId, recordId, ...details });
  }

  function learningCandidate(taskId, eventId, trigger, details = {}) {
    return emit(EXECUTION_EVENTS.LEARNING_CANDIDATE, { taskId, eventId, trigger, ...details });
  }

  // ── Subscriber API ───────────────────────────────────────────────────────

  function on(eventType, handler) { bus.on(eventType, handler); }
  function once(eventType, handler) { bus.once(eventType, handler); }
  function off(eventType, handler) { bus.off(eventType, handler); }

  function getHistory(filter = {}) {
    let result = [...history];
    if (filter.type) result = result.filter(e => e.type === filter.type);
    if (filter.taskId) result = result.filter(e => e.taskId === filter.taskId);
    if (filter.featureSlug) result = result.filter(e => e.featureSlug === filter.featureSlug);
    if (filter.since) result = result.filter(e => e.timestamp >= filter.since);
    if (filter.limit) result = result.slice(-filter.limit);
    return result;
  }

  function getStats() {
    const stats = { total: history.length, byType: {} };
    for (const e of history) {
      stats.byType[e.type] = (stats.byType[e.type] || 0) + 1;
    }
    return stats;
  }

  return {
    // Raw emit
    emit,
    // Convenience emitters
    taskStarted, taskCompleted, taskFailed,
    gateChecking, gatePassed, gateFailed,
    retryStarted, retryExhausted,
    compileStarted, compileGate, compileFinished,
    escalationTriggered,
    feedbackCreated, learningCandidate,
    // Subscriber API
    on, once, off,
    // History
    getHistory, getStats,
    // Constants
    EVENTS: EXECUTION_EVENTS,
  };
}
