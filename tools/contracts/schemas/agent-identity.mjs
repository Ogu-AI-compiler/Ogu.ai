import { z } from 'zod';

/**
 * Agent Identity — formal identity contract for every agent in the system.
 * Maps to Closure 4 in the implementation plan.
 * Lives at .ogu/agents/{roleId}.state.json
 */

/** Agent session — tracks a single execution context */
export const AgentSessionSchema = z.object({
  /** Unique session ID (UUID v4) */
  sessionId: z.string().uuid(),

  /** Agent role that owns this session */
  roleId: z.string(),

  /** When this session was created */
  createdAt: z.string().datetime(),

  /** When this session expires */
  expiresAt: z.string().datetime(),

  /** Whether this session is still active */
  active: z.boolean().default(true),

  /** Feature this session is working on */
  featureSlug: z.string().optional(),

  /** Task ID within the feature */
  taskId: z.string().optional(),

  /** Model used in this session */
  model: z.string().optional(),

  /** Total tokens consumed in this session */
  tokensUsed: z.number().int().default(0),
});

/** Agent runtime state */
export const AgentStateSchema = z.object({
  /** Role ID (matches AgentRole.roleId from OrgSpec) */
  roleId: z.string(),

  /** Current status */
  status: z.enum(['idle', 'assigned', 'executing', 'cooldown', 'revoked', 'quarantined']),

  /** Currently active session (if executing) */
  currentSession: z.string().uuid().optional(),

  /** Performance metrics */
  performance: z.object({
    tasksCompleted: z.number().int().default(0),
    tasksFailed: z.number().int().default(0),
    avgTokensPerTask: z.number().default(0),
    avgDurationMs: z.number().default(0),
    successRate: z.number().min(0).max(1).default(1),
    lastTaskAt: z.string().datetime().optional(),
  }),

  /** If quarantined, reason and quarantined outputs */
  quarantine: z.object({
    reason: z.string(),
    quarantinedAt: z.string().datetime(),
    outputs: z.array(z.string()),
  }).optional(),

  /** State file last updated */
  updatedAt: z.string().datetime(),
});

/** @typedef {z.infer<typeof AgentSessionSchema>} AgentSession */
/** @typedef {z.infer<typeof AgentStateSchema>} AgentState */
