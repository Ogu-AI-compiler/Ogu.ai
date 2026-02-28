import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * ogu feature:state <slug> [target-state]
 *
 * Manages the formal lifecycle state machine for features.
 * Without target-state: shows current state.
 * With target-state: transitions to that state (if legal).
 */

// Import state definitions from contracts
import { FeatureStates, isValidTransition, checkStateInvariant } from '../../contracts/schemas/feature-state.mjs';

const STATES_DIR = () => join(repoRoot(), '.ogu/state/features');

function stateFilePath(slug) {
  return join(STATES_DIR(), `${slug}.state.json`);
}

function loadFeatureState(slug) {
  const path = stateFilePath(slug);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeFeatureState(slug, state) {
  const dir = STATES_DIR();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(stateFilePath(slug), JSON.stringify(state, null, 2), 'utf8');
}

export async function featureState() {
  const args = process.argv.slice(3);
  const slug = args.find(a => !a.startsWith('--'));
  const target = args.filter(a => !a.startsWith('--'))[1];

  if (!slug) {
    console.error('Usage: ogu feature:state <slug> [target-state]');
    console.error('');
    console.error('States:', FeatureStates.join(', '));
    return 1;
  }

  // Show current state
  if (!target) {
    const state = loadFeatureState(slug);
    if (!state) {
      console.error(`No state found for feature "${slug}". Set initial state:`);
      console.error(`  ogu feature:state ${slug} idea`);
      return 1;
    }
    console.log(`Feature "${slug}": ${state.currentState}`);
    console.log(`  Previous: ${state.previousState}`);
    console.log(`  Since:    ${state.enteredAt}`);
    console.log(`  Builds:   ${state.buildAttempts}`);
    return 0;
  }

  // Validate target state
  if (!FeatureStates.includes(target)) {
    console.error(`Invalid state: "${target}"`);
    console.error('Valid states:', FeatureStates.join(', '));
    return 1;
  }

  const existing = loadFeatureState(slug);

  // New feature — create initial state
  if (!existing) {
    if (target !== 'idea') {
      console.error(`New feature must start in "idea" state, not "${target}"`);
      return 1;
    }

    const state = {
      slug,
      currentState: 'idea',
      previousState: 'none',
      enteredAt: new Date().toISOString(),
      transitionedBy: { type: 'human', id: process.env.USER || 'unknown' },
      buildAttempts: 0,
      tasks: [],
      budgetUsed: { tokens: 0, cost: 0, currency: 'USD' },
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    writeFeatureState(slug, state);
    emitAudit('feature.transition', {
      slug,
      from: 'none',
      to: 'idea',
    }, {
      feature: { slug },
    });

    console.log(`Feature "${slug}": → idea`);
    return 0;
  }

  // Transition existing feature
  const from = existing.currentState;

  if (from === target) {
    console.log(`Feature "${slug}" is already in "${target}" state.`);
    return 0;
  }

  if (!isValidTransition(from, target)) {
    console.error(`Invalid transition: "${from}" → "${target}"`);
    const { ValidTransitions } = await import('../../contracts/schemas/feature-state.mjs');
    const allowed = ValidTransitions[from] || [];
    console.error(`Allowed from "${from}": ${allowed.join(', ') || 'none (terminal state)'}`);
    return 1;
  }

  // Check state invariants before transition
  const invariantCheck = checkStateInvariant(target, {
    root: repoRoot(),
    slug,
    state: existing,
  });
  if (!invariantCheck.valid) {
    const force = args.includes('--force');
    if (!force) {
      console.error(`State invariant failed for "${target}": ${invariantCheck.reason}`);
      console.error('Use --force to override.');
      return 1;
    }
    console.warn(`⚠ Overriding invariant: ${invariantCheck.reason}`);
  }

  // Apply transition
  existing.previousState = from;
  existing.currentState = target;
  existing.enteredAt = new Date().toISOString();
  existing.transitionedBy = { type: 'human', id: process.env.USER || 'unknown' };
  existing.updatedAt = new Date().toISOString();
  existing.version += 1;

  if (target === 'building') {
    existing.buildAttempts += 1;
  }

  writeFeatureState(slug, existing);
  emitAudit('feature.transition', {
    slug,
    from,
    to: target,
    version: existing.version,
  }, {
    feature: { slug },
  });

  console.log(`Feature "${slug}": ${from} → ${target}`);
  return 0;
}
