import { z } from 'zod';

/**
 * Budget Entry — tracks spending per feature/agent/model.
 * Maps to Phase 2 in the implementation plan.
 * Ledger lives at .ogu/budget/budget-state.json
 * Transactions append to .ogu/budget/transactions.jsonl
 */

/** Single budget transaction */
export const BudgetTransactionSchema = z.object({
  /** Unique transaction ID */
  id: z.string().uuid(),

  /** ISO 8601 timestamp */
  timestamp: z.string().datetime(),

  /** Transaction type */
  type: z.enum(['deduct', 'refund', 'reset', 'adjust']),

  /** Feature that consumed tokens */
  featureSlug: z.string(),

  /** Task within the feature */
  taskId: z.string().optional(),

  /** Agent that consumed tokens */
  agentRoleId: z.string(),

  /** Model used */
  model: z.string(),

  /** Provider used */
  provider: z.string(),

  /** Tokens consumed */
  tokens: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),

  /** Dollar cost */
  cost: z.number().nonnegative(),

  /** Currency */
  currency: z.literal('USD'),
});

/** Aggregated budget state */
export const BudgetStateSchema = z.object({
  /** State version */
  version: z.number().int().positive(),

  /** Last updated */
  updatedAt: z.string().datetime(),

  /** Daily counters (reset at midnight) */
  daily: z.object({
    date: z.string(),
    tokensUsed: z.number().int().nonnegative().default(0),
    costUsed: z.number().nonnegative().default(0),
    limit: z.number().positive(),
  }),

  /** Monthly counters */
  monthly: z.object({
    month: z.string(),
    tokensUsed: z.number().int().nonnegative().default(0),
    costUsed: z.number().nonnegative().default(0),
    limit: z.number().positive(),
  }),

  /** Per-feature breakdown */
  features: z.record(z.object({
    tokensUsed: z.number().int().nonnegative().default(0),
    costUsed: z.number().nonnegative().default(0),
    limit: z.number().positive().optional(),
  })),

  /** Per-model breakdown */
  models: z.record(z.object({
    tokensUsed: z.number().int().nonnegative().default(0),
    costUsed: z.number().nonnegative().default(0),
    callCount: z.number().int().nonnegative().default(0),
  })),
});

/** @typedef {z.infer<typeof BudgetTransactionSchema>} BudgetTransaction */
/** @typedef {z.infer<typeof BudgetStateSchema>} BudgetState */
