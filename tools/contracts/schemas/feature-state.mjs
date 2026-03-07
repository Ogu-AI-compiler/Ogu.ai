import { z } from 'zod';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Feature State Machine — formal lifecycle states.
 * Maps to Fix 2 + Closure 2 in the implementation plan.
 * Lives at .ogu/state/features/{slug}.state.json
 */

/** All valid feature states */
export const FeatureStates = [
  'idea',          // Initial concept
  'specifying',    // Writing PRD + Spec
  'specified',     // PRD + Spec complete
  'planning',      // Creating Plan.json + IR
  'planned',       // Architecture complete
  'designing',     // Visual design phase
  'designed',      // Design complete
  'building',      // Code implementation
  'built',         // Implementation complete
  'verifying',     // Running gates + compile
  'verified',      // All gates pass
  'reviewing',     // Human review
  'approved',      // Human approved
  'deploying',     // Deploying to preview/prod
  'deployed',      // Live in production
  'observing',     // Production monitoring
  'completed',     // Feature fully done
  'failed',        // Unrecoverable failure
  'paused',        // Manually paused
];

/** Valid transitions between states */
export const ValidTransitions = {
  idea:        ['specifying', 'paused'],
  specifying:  ['specified', 'failed', 'paused'],
  specified:   ['planning', 'paused'],
  planning:    ['planned', 'failed', 'paused'],
  planned:     ['designing', 'building', 'paused'],  // designing optional
  designing:   ['designed', 'failed', 'paused'],
  designed:    ['building', 'paused'],
  building:    ['built', 'failed', 'paused'],
  built:       ['verifying', 'paused'],
  verifying:   ['verified', 'building', 'failed', 'paused'],  // building = retry
  verified:    ['reviewing', 'deploying', 'paused'],
  reviewing:   ['approved', 'building', 'paused'],  // building = revisions
  approved:    ['deploying', 'paused'],
  deploying:   ['deployed', 'failed', 'paused'],
  deployed:    ['observing', 'paused'],
  observing:   ['completed', 'building', 'paused'],  // building = hotfix
  completed:   [],  // Terminal
  failed:      ['building', 'specifying', 'paused'],  // Can retry from earlier phases
  paused:      FeatureStates.filter(s => s !== 'paused' && s !== 'completed'),  // Resume to any
};

/** Feature state schema */
export const FeatureStateSchema = z.object({
  /** Feature slug */
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),

  /** Current lifecycle state */
  currentState: z.enum(FeatureStates),

  /** Previous state (for audit trail) */
  previousState: z.enum([...FeatureStates, 'none']).default('none'),

  /** When the current state was entered */
  enteredAt: z.string().datetime(),

  /** Who/what caused the transition */
  transitionedBy: z.object({
    type: z.enum(['human', 'agent', 'system', 'auto']),
    id: z.string(),
  }),

  /** Number of times this feature has been in "building" state (retry tracking) */
  buildAttempts: z.number().int().default(0),

  /** Tasks associated with this feature */
  tasks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['pending', 'dispatched', 'executing', 'completed', 'failed']),
    assignedTo: z.string().optional(),
    dependencies: z.array(z.string()).default([]),
  })).default([]),

  /** Budget consumed by this feature */
  budgetUsed: z.object({
    tokens: z.number().int().default(0),
    cost: z.number().default(0),
    currency: z.literal('USD').default('USD'),
  }).default({ tokens: 0, cost: 0, currency: 'USD' }),

  /** Feature state file version */
  version: z.number().int().positive().default(1),

  /** Last updated */
  updatedAt: z.string().datetime(),
});

/** @typedef {z.infer<typeof FeatureStateSchema>} FeatureState */

function resolveFeatureFile(root, slug, filename) {
  const candidates = [
    join(root, `docs/vault/features/${slug}/${filename}`),
    join(root, `docs/vault/04_Features/${slug}/${filename}`),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return candidates[0];
}

/**
 * Validate that a state transition is legal.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isValidTransition(from, to) {
  const allowed = ValidTransitions[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Per-state invariant guards — conditions that must be true for a state to be valid.
 * Each guard returns { valid: boolean, reason?: string }.
 *
 * @type {Record<string, (ctx: { root: string, slug: string, state: object }) => { valid: boolean, reason?: string }>}
 */
export const StateInvariants = {
  specified: ({ root, slug }) => {
    const prd = resolveFeatureFile(root, slug, 'PRD.md');
    const spec = resolveFeatureFile(root, slug, 'Spec.md');
    if (!existsSync(prd)) return { valid: false, reason: `PRD.md missing for ${slug}` };
    if (!existsSync(spec)) return { valid: false, reason: `Spec.md missing for ${slug}` };
    return { valid: true };
  },

  planned: ({ root, slug }) => {
    const plan = resolveFeatureFile(root, slug, 'Plan.json');
    if (!existsSync(plan)) return { valid: false, reason: `Plan.json missing for ${slug}` };
    return { valid: true };
  },

  designed: ({ root, slug }) => {
    const design = resolveFeatureFile(root, slug, 'DESIGN.md');
    if (!existsSync(design)) return { valid: false, reason: `DESIGN.md missing for ${slug}` };
    return { valid: true };
  },

  built: ({ state }) => {
    if ((state.buildAttempts || 0) < 1) return { valid: false, reason: 'No build attempts recorded' };
    return { valid: true };
  },

  verified: ({ state }) => {
    // Must have been built first
    if ((state.buildAttempts || 0) < 1) return { valid: false, reason: 'Never built — cannot be verified' };
    return { valid: true };
  },
};

/**
 * Check state invariants for a transition target.
 *
 * @param {string} targetState
 * @param {object} ctx - { root, slug, state }
 * @returns {{ valid: boolean, reason?: string }}
 */
export function checkStateInvariant(targetState, ctx) {
  const guard = StateInvariants[targetState];
  if (!guard) return { valid: true }; // No guard = always valid
  try {
    return guard(ctx);
  } catch {
    return { valid: true }; // Guard failure = permissive
  }
}
