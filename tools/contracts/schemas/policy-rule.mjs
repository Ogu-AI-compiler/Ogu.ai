import { z } from 'zod';

/**
 * Policy Rule — declarative governance rules.
 * Maps to Stone 1 + Closure 1 in the implementation plan.
 * Lives at .ogu/policies/rules.json
 */

/** Condition operand — a single comparison */
const ConditionLeafSchema = z.object({
  field: z.string(),
  op: z.enum(['eq', 'neq', 'in', 'not_in', 'gt', 'lt', 'gte', 'lte', 'matches', 'matches_any', 'exists']),
  value: z.unknown(),
});

/** Condition group — AND/OR composite */
const ConditionGroupSchema = z.lazy(() =>
  z.object({
    operator: z.enum(['AND', 'OR', 'NOT']),
    conditions: z.array(z.union([ConditionLeafSchema, ConditionGroupSchema])),
  })
);

/** Policy effect — what happens when the rule matches */
export const PolicyEffectSchema = z.object({
  effect: z.enum([
    'allow',
    'deny',
    'requireApprovals',
    'addGates',
    'setIsolationLevel',
    'limitBudget',
    'escalateModel',
    'notify',
    'log',
  ]),
  params: z.record(z.unknown()).default({}),
});

/** Single policy rule */
export const PolicyRuleSchema = z.object({
  /** Unique rule ID */
  id: z.string(),

  /** Human-readable name */
  name: z.string(),

  /** Rule version (for hash chain) */
  version: z.number().int().positive(),

  /** Whether the rule is active */
  enabled: z.boolean().default(true),

  /** Priority (higher = evaluated first) */
  priority: z.number().int().default(100),

  /** When this rule applies */
  when: ConditionGroupSchema,

  /** What happens when the rule matches */
  then: z.array(PolicyEffectSchema),

  /** Optional description */
  description: z.string().optional(),

  /** Tags for organization */
  tags: z.array(z.string()).default([]),
});

/** Policy rule set — the full rules.json file */
export const PolicyRuleSetSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  rules: z.array(PolicyRuleSchema),
});

/** @typedef {z.infer<typeof PolicyRuleSchema>} PolicyRule */
/** @typedef {z.infer<typeof PolicyRuleSetSchema>} PolicyRuleSet */
/** @typedef {z.infer<typeof PolicyEffectSchema>} PolicyEffect */
