import { z } from 'zod';

/**
 * Structured audit event — the atomic unit of the audit trail.
 * Written to .ogu/audit/current.jsonl (append-only).
 * Every state change in the system produces one or more audit events.
 */
export const AuditEventSchema = z.object({
  /** Unique event ID (UUID v4) */
  id: z.string().uuid(),

  /** ISO 8601 timestamp */
  timestamp: z.string().datetime(),

  /** Event type, dot-separated namespace */
  type: z.string().regex(/^[a-z]+\.[a-z_]+$/),

  /** Severity level */
  severity: z.enum(['info', 'warn', 'error', 'critical']),

  /** Source service that emitted this event */
  source: z.enum(['cli', 'kadima', 'runner', 'studio', 'system']),

  /** Agent or user that caused the event */
  actor: z.object({
    type: z.enum(['human', 'agent', 'system']),
    id: z.string(),
    role: z.string().optional(),
    sessionId: z.string().optional(),
  }),

  /** Feature context (if applicable) */
  feature: z.object({
    slug: z.string(),
    taskId: z.string().optional(),
  }).optional(),

  /** Event-specific payload — schema depends on event type */
  payload: z.record(z.unknown()),

  /** Idempotency key for deduplication */
  idempotencyKey: z.string().optional(),

  /** Previous event hash for chain integrity */
  prevHash: z.string().optional(),
});

/** @typedef {z.infer<typeof AuditEventSchema>} AuditEvent */

/**
 * Well-known audit event types.
 * Not exhaustive — new types can be added without schema changes.
 */
export const AuditEventTypes = {
  // Daemon lifecycle
  DAEMON_START: 'daemon.start',
  DAEMON_SHUTDOWN: 'daemon.shutdown',
  DAEMON_API_READY: 'daemon.api_ready',

  // Feature lifecycle
  FEATURE_CREATED: 'feature.created',
  FEATURE_TRANSITION: 'feature.transition',
  FEATURE_AUTO_TRANSITION: 'feature.auto_transition',
  FEATURE_COMPLETED: 'feature.completed',

  // Scheduler
  SCHEDULER_TASKS_CREATED: 'scheduler.tasks_created',
  SCHEDULER_DISPATCH: 'scheduler.dispatch',
  SCHEDULER_DISPATCH_FAILED: 'scheduler.dispatch_failed',
  SCHEDULER_PRIORITY_BUMP: 'scheduler.priority_bump',

  // Runner
  RUNNER_STARTED: 'runner.started',
  RUNNER_COMPLETED: 'runner.completed',
  RUNNER_FAILED: 'runner.failed',
  RUNNER_TIMEOUT: 'runner.timeout',
  RUNNER_EXIT: 'runner.exit',

  // Budget
  BUDGET_DEDUCTED: 'budget.deducted',
  BUDGET_EXCEEDED: 'budget.exceeded',
  BUDGET_RESET: 'budget.reset',

  // Governance
  GOVERNANCE_POLICY_EVALUATED: 'governance.policy_evaluated',
  GOVERNANCE_BLOCKED: 'governance.blocked',
  GOVERNANCE_APPROVED: 'governance.approved',
  GOVERNANCE_DENIED: 'governance.denied',

  // System
  SYSTEM_HALT: 'system.halt',
  SYSTEM_RESUME: 'system.resume',
  SYSTEM_FREEZE: 'system.freeze',
  SYSTEM_UNFREEZE: 'system.unfreeze',

  // Transaction
  TX_STARTED: 'transaction.started',
  TX_COMMITTED: 'transaction.committed',
  TX_ROLLED_BACK: 'transaction.rolled_back',
};
