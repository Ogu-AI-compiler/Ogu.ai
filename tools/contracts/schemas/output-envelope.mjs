import { z } from 'zod';

/**
 * OutputEnvelope — the result package written by a Runner after task execution.
 * Kadima reads this to complete the SAGA transaction.
 *
 * Lives at .ogu/runners/{taskId}.output.json
 */

/** Token usage breakdown */
const TokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  cost: z.number().nonnegative(),
  currency: z.literal('USD').default('USD'),
});

/** Single file change produced by the runner */
const FileChangeSchema = z.object({
  path: z.string(),
  action: z.enum(['created', 'modified', 'deleted']),
  content: z.string().optional(),
  linesAdded: z.number().int().nonnegative().default(0),
  linesRemoved: z.number().int().nonnegative().default(0),
});

/** Gate check result */
const GateResultSchema = z.object({
  gate: z.string(),
  passed: z.boolean(),
  message: z.string().optional(),
  duration: z.number().nonnegative().optional(),
});

/** Merge conflict (if AST merge couldn't resolve) */
const MergeConflictSchema = z.object({
  file: z.string(),
  region: z.string(),
  base: z.string(),
  incoming: z.string(),
  type: z.enum(['structural', 'semantic', 'formatting']),
});

export const OutputEnvelopeSchema = z.object({
  /** Envelope schema version */
  version: z.number().int().positive().default(1),

  /** Task ID (matches InputEnvelope.taskId) */
  taskId: z.string(),

  /** Feature slug (matches InputEnvelope.featureSlug) */
  featureSlug: z.string(),

  /** Execution result status */
  status: z.enum([
    'success',           // Task completed successfully
    'partial',           // Some outputs produced but not all
    'conflict',          // AST merge conflicts need resolution
    'validation_failed', // Output failed validation rules
    'error',             // Runtime error during execution
    'timeout',           // Task exceeded time limit
    'budget_exceeded',   // Ran out of tokens mid-task
    'sandbox_violation', // Tried to escape sandbox
  ]),

  /** Files produced/modified by the task */
  files: z.array(FileChangeSchema).default([]),

  /** Token usage */
  tokensUsed: TokenUsageSchema,

  /** Gate check results (if validation was run) */
  gateResults: z.array(GateResultSchema).default([]),

  /** AST hash of the output (Closure 11 — functional determinism) */
  astHash: z.string().optional(),

  /** Merge conflicts (if status === 'conflict') */
  conflicts: z.array(MergeConflictSchema).default([]),

  /** Error details (if status === 'error') */
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  }).optional(),

  /** Model used (confirmed, not just planned) */
  modelUsed: z.object({
    provider: z.string(),
    model: z.string(),
    escalated: z.boolean().default(false),
  }).optional(),

  /** Runner metadata */
  runner: z.object({
    pid: z.number().int(),
    isolationLevel: z.enum(['L0', 'L1', 'L2', 'L3']),
    worktreePath: z.string().optional(),
    durationMs: z.number().int().nonnegative(),
  }),

  /** When execution started and finished */
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),

  /** Idempotency key (echoed from InputEnvelope) */
  idempotencyKey: z.string().optional(),
});

/** @typedef {z.infer<typeof OutputEnvelopeSchema>} OutputEnvelope */
