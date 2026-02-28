import { z } from 'zod';

/**
 * OrgSpec — the organizational specification.
 * Defines who the agents are, what roles exist, and how the company is structured.
 * Lives at .ogu/OrgSpec.json
 */

/** Single capability definition */
export const CapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

/** Model provider configuration */
export const ProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['anthropic', 'openai', 'google', 'local', 'custom']),
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
    capabilities: z.array(z.string()),
    costPer1kInput: z.number(),
    costPer1kOutput: z.number(),
    maxTokens: z.number(),
    tier: z.enum(['fast', 'standard', 'premium']),
  })),
  enabled: z.boolean().default(true),
});

/** Per-role model policy */
export const ModelPolicySchema = z.object({
  default: z.string(),
  maxTier: z.string(),
  escalationEnabled: z.boolean().default(true),
  escalationThreshold: z.number().int().nonnegative().default(3),
  escalationChain: z.array(z.string()).default(['haiku', 'sonnet', 'opus']),
});

/** Per-role budget quota */
export const BudgetQuotaSchema = z.object({
  dailyTokens: z.number().int().positive(),
  maxCostPerTask: z.number().positive(),
  currency: z.literal('USD').default('USD'),
});

/** Memory scope */
export const MemoryScopeSchema = z.object({
  read: z.array(z.string()).default([]),
  write: z.array(z.string()).default([]),
});

/** Agent role definition */
export const AgentRoleSchema = z.object({
  /** Unique role identifier */
  roleId: z.string().regex(/^[a-z][a-z0-9_-]*$/),

  /** Human-readable name */
  name: z.string(),

  /** Role description */
  description: z.string(),

  /** Department this role belongs to */
  department: z.enum([
    'engineering', 'architecture', 'testing', 'security',
    'devops', 'product', 'design', 'documentation'
  ]),

  /** Required capabilities for this role */
  capabilities: z.array(z.string()),

  /** Risk tier — determines policy strictness */
  riskTier: z.enum(['low', 'medium', 'high', 'critical']),

  /** Model preferences (legacy) */
  modelPreferences: z.object({
    preferred: z.string().optional(),
    minimum: z.enum(['fast', 'standard', 'premium']).default('standard'),
    escalation: z.array(z.string()).optional(),
  }).optional(),

  /** Per-role model policy */
  modelPolicy: ModelPolicySchema.optional(),

  /** Per-role budget quota */
  budgetQuota: BudgetQuotaSchema.optional(),

  /** Ownership scope — file patterns this role owns */
  ownershipScope: z.array(z.string()).optional(),

  /** Allowed CLI commands */
  allowedCommands: z.array(z.string()).optional(),

  /** Blocked CLI commands */
  blockedCommands: z.array(z.string()).optional(),

  /** Allowed tools */
  allowedTools: z.array(z.string()).optional(),

  /** Memory scope — read/write paths */
  memoryScope: MemoryScopeSchema.optional(),

  /** Pipeline phases this role is active in */
  phases: z.array(z.string()).optional(),

  /** Source skill this role derives from */
  sourceSkill: z.string().nullable().optional(),

  /** Sandbox policy */
  sandbox: z.object({
    allowedPaths: z.array(z.string()),
    blockedPaths: z.array(z.string()).default([]),
    networkAccess: z.enum(['none', 'internal', 'allowlist', 'full']).default('none'),
    maxConcurrency: z.number().int().positive().default(1),
  }),

  /** Maximum tokens per task for this role */
  maxTokensPerTask: z.number().int().positive().default(100000),

  /** Whether this role can approve actions */
  canApprove: z.boolean().default(false),

  /** Escalation path — role IDs to escalate to */
  escalationPath: z.union([z.string(), z.array(z.string())]).optional(),

  /** Whether this role is enabled */
  enabled: z.boolean().default(true),
});

/** Team definition */
export const TeamSchema = z.object({
  teamId: z.string(),
  name: z.string(),
  lead: z.string(),
  roles: z.array(z.string()),
  // Legacy fields kept for backwards compat
  id: z.string().optional(),
  members: z.array(z.string()).optional(),
  features: z.array(z.string()).default([]),
});

/** Budget configuration */
export const BudgetConfigSchema = z.object({
  dailyLimit: z.number().positive(),
  monthlyLimit: z.number().positive(),
  currency: z.literal('USD'),
  perFeatureLimit: z.number().positive().optional(),
  alertThreshold: z.number().min(0).max(1).default(0.8),
  alertThresholds: z.array(z.number().min(0).max(1)).optional(),
});

/** Governance defaults */
export const DefaultsSchema = z.object({
  modelPolicy: ModelPolicySchema.optional(),
  budgetQuota: BudgetQuotaSchema.optional(),
  riskTier: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
}).optional();

/** Full OrgSpec */
export const OrgSpecSchema = z.object({
  /** Schema version */
  version: z.number().int().positive(),

  /** Organization name */
  name: z.string(),

  /** Organization description */
  description: z.string().optional(),

  /** When this spec was last modified */
  updatedAt: z.string().datetime(),

  /** Agent roles */
  roles: z.array(AgentRoleSchema),

  /** Teams */
  teams: z.array(TeamSchema).default([]),

  /** Model providers */
  providers: z.array(ProviderConfigSchema),

  /** Global budget */
  budget: BudgetConfigSchema,

  /** Available capabilities */
  capabilities: z.array(CapabilitySchema),

  /** Governance settings */
  governance: z.object({
    requireApprovalForCrossBoundary: z.boolean().default(true),
    requireApprovalForSecurity: z.boolean().default(true),
    autoTransitionsEnabled: z.boolean().default(false),
    maxConcurrentFeatures: z.number().int().positive().default(5),
  }),

  /** Organization-wide defaults for new roles */
  defaults: DefaultsSchema,
});

/** @typedef {z.infer<typeof OrgSpecSchema>} OrgSpec */
/** @typedef {z.infer<typeof AgentRoleSchema>} AgentRole */
/** @typedef {z.infer<typeof ProviderConfigSchema>} ProviderConfig */
/** @typedef {z.infer<typeof BudgetConfigSchema>} BudgetConfig */
/** @typedef {z.infer<typeof ModelPolicySchema>} ModelPolicy */
/** @typedef {z.infer<typeof BudgetQuotaSchema>} BudgetQuota */
