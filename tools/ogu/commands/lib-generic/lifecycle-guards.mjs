import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lifecycle Guards — per-state invariants and transition validation.
 *
 * Ensures phase transitions are legal and prerequisites are met.
 */

const PHASE_ORDER = [
  'idea', 'feature', 'architect', 'design', 'preflight',
  'lock', 'build', 'verify-ui', 'smoke', 'vision',
  'enforce', 'preview', 'done', 'observe',
];

/**
 * Default invariants for each phase.
 * Each invariant checks that required artifacts exist.
 */
export const PHASE_INVARIANTS = {
  idea: {
    description: 'IDEA.md must exist',
    requires: [],
  },
  feature: {
    description: 'PRD.md and QA.md must exist',
    requires: ['PRD.md', 'QA.md'],
  },
  architect: {
    description: 'Spec.md and Plan.json must exist',
    requires: ['Spec.md', 'Plan.json'],
  },
  design: {
    description: 'DESIGN.md must exist',
    requires: ['DESIGN.md'],
  },
  build: {
    description: 'Feature must have spec and plan',
    requires: [],
  },
  'verify-ui': {
    description: 'Build phase must be complete',
    requires: [],
  },
  smoke: {
    description: 'UI verification must pass',
    requires: [],
  },
  vision: {
    description: 'Smoke tests must pass',
    requires: [],
  },
  enforce: {
    description: 'Visual verification must pass',
    requires: [],
  },
  preview: {
    description: 'Contract enforcement must pass',
    requires: [],
  },
  done: {
    description: 'Preview must be healthy',
    requires: [],
  },
  observe: {
    description: 'Compilation must be complete',
    requires: [],
  },
};

// Custom guards registry
const customGuards = {};

/**
 * Check invariants for a phase.
 *
 * @param {object} opts
 * @param {string} opts.phase
 * @param {string} opts.root
 * @param {string} opts.featureSlug
 * @returns {{ satisfied: boolean, violations: string[] }}
 */
export function checkInvariant({ phase, root, featureSlug }) {
  const invariant = PHASE_INVARIANTS[phase];
  if (!invariant) {
    return { satisfied: true, violations: [] };
  }

  const violations = [];
  const featDir = join(root, `docs/vault/features/${featureSlug}`);

  for (const req of invariant.requires) {
    if (!existsSync(join(featDir, req))) {
      violations.push(`Missing required file: ${req}`);
    }
  }

  // Check custom guards
  const guards = customGuards[phase] || [];
  for (const guard of guards) {
    try {
      const result = guard.check({ root, featureSlug });
      if (!result.ok) {
        violations.push(`Guard "${guard.name}": ${result.reason || 'failed'}`);
      }
    } catch (e) {
      violations.push(`Guard "${guard.name}" threw: ${e.message}`);
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

/**
 * Register a custom guard for a phase.
 *
 * @param {object} opts
 * @param {string} opts.phase
 * @param {string} opts.name
 * @param {Function} opts.check - ({ root, featureSlug }) => { ok: boolean, reason?: string }
 */
export function registerGuard({ phase, name, check }) {
  if (!customGuards[phase]) customGuards[phase] = [];
  customGuards[phase].push({ name, check });
}

/**
 * Get all guards for a phase (built-in + custom).
 *
 * @param {string} phase
 * @returns {Array<{ name: string, check: Function }>}
 */
export function getGuards(phase) {
  return customGuards[phase] || [];
}

/**
 * Check if a phase transition is legal.
 *
 * @param {object} opts
 * @param {string} opts.from
 * @param {string} opts.to
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkTransition({ from, to }) {
  const fromIdx = PHASE_ORDER.indexOf(from);
  const toIdx = PHASE_ORDER.indexOf(to);

  if (fromIdx < 0) return { allowed: false, reason: `Unknown phase: ${from}` };
  if (toIdx < 0) return { allowed: false, reason: `Unknown phase: ${to}` };

  // Can only go forward (or stay)
  if (toIdx < fromIdx) {
    return { allowed: false, reason: `Cannot go backwards: ${from} → ${to}` };
  }

  return { allowed: true };
}
