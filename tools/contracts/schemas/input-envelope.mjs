import { z } from 'zod';

/**
 * InputEnvelope — the complete context package sent from Kadima to a Runner.
 * This is the single most important contract in the system.
 * Every task execution starts by reading an InputEnvelope.
 *
 * Lives at .ogu/runners/{taskId}.input.json
 */

/** Model routing decision */
const RoutingDecisionSchema = z.object({
  provider: z.string(),
  model: z.string(),
  tier: z.enum(['fast', 'standard', 'premium']),
  reason: z.string(),
  escalationChain: z.array(z.string()).default([]),
});

/** Budget allocation for this task */
const TaskBudgetSchema = z.object({
  maxTokens: z.number().int().positive(),
  maxCost: z.number().positive(),
  remainingDaily: z.number().nonnegative(),
  currency: z.literal('USD'),
});

/** Sandbox policy for this task */
const SandboxPolicySchema = z.object({
  allowedPaths: z.array(z.string()),
  blockedPaths: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default(['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash']),
  blockedTools: z.array(z.string()).default([]),
  envFilter: z.array(z.string()).default([]),
  networkAccess: z.enum(['none', 'internal', 'allowlist', 'full']).default('none'),
  networkAllowlist: z.array(z.string()).default([]),
});

/** Blast radius — limits what the task can affect */
const BlastRadiusSchema = z.object({
  allowed_write: z.array(z.string()),
  allowed_delete: z.array(z.string()).default([]),
  max_files_changed: z.number().int().positive().default(50),
  max_lines_changed: z.number().int().positive().default(5000),
});

/** RAG-injected context from Knowledge Graph (Closure 10) */
const RelevantHistorySchema = z.object({
  /** Knowledge entities injected */
  entities: z.array(z.object({
    type: z.enum(['contract', 'adr', 'failure', 'pattern', 'invariant']),
    id: z.string(),
    title: z.string(),
    content: z.string(),
    relevanceScore: z.number().min(0).max(1),
  })).default([]),

  /** Total token budget spent on RAG context */
  ragTokens: z.number().int().nonnegative().default(0),
});

export const InputEnvelopeSchema = z.object({
  /** Envelope schema version */
  version: z.number().int().positive().default(1),

  /** Unique task ID */
  taskId: z.string(),

  /** Feature this task belongs to */
  featureSlug: z.string(),

  /** Task name/description */
  taskName: z.string(),

  /** Agent role assigned to this task */
  agent: z.object({
    roleId: z.string(),
    sessionId: z.string().uuid(),
    capabilities: z.array(z.string()),
  }),

  /** The prompt to send to the LLM */
  prompt: z.string(),

  /** Files relevant to this task (for context) */
  files: z.array(z.object({
    path: z.string(),
    content: z.string().optional(),
    role: z.enum(['read', 'write', 'reference']),
  })).default([]),

  /** Model routing decision */
  routingDecision: RoutingDecisionSchema,

  /** Budget constraints */
  budget: TaskBudgetSchema,

  /** Sandbox policy */
  sandboxPolicy: SandboxPolicySchema,

  /** Blast radius limits */
  blastRadius: BlastRadiusSchema,

  /** Isolation level (Closure 12) */
  isolationLevel: z.enum(['L0', 'L1', 'L2', 'L3']).default('L0'),

  /** Merge strategy (Closure 9) */
  mergeStrategy: z.enum(['auto', 'ast', 'manual']).default('auto'),

  /** RAG-injected knowledge context (Closure 10) */
  relevantHistory: RelevantHistorySchema.default({ entities: [], ragTokens: 0 }),

  /** Temperature for LLM call */
  temperature: z.number().min(0).max(2).default(0),

  /** Validation rules for output */
  validationRules: z.object({
    maxFileSize: z.number().int().positive().default(1048576),
    bannedPatterns: z.array(z.string()).default([]),
    requiredGates: z.array(z.string()).default([]),
  }).default({}),

  /** Policy evaluation results (pre-computed by Kadima) */
  policyResults: z.array(z.object({
    ruleId: z.string(),
    effect: z.string(),
    params: z.record(z.unknown()),
  })).default([]),

  /** When this envelope was created */
  createdAt: z.string().datetime(),

  /** Idempotency key */
  idempotencyKey: z.string().optional(),
});

/** @typedef {z.infer<typeof InputEnvelopeSchema>} InputEnvelope */
