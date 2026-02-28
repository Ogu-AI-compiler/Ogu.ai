/**
 * State Machine — generic FSM + feature lifecycle state machine.
 *
 * Exports:
 *   createStateMachine()       — generic FSM (backwards compat)
 *   createFeatureLifecycle()   — feature lifecycle FSM with guards, audit, persistence
 *   loadFeatureState()         — load persisted feature state
 *   saveFeatureState()         — persist feature state
 *   getFeaturePhase()          — quick lookup of current phase
 *   canTransitionFeature()     — check if transition is valid
 *   transitionFeature()        — execute transition with guards and side effects
 *
 * Feature lifecycle states (12 + 1 special):
 *   discovery → feature → architect → design → preflight → lock →
 *   building → verifying → enforcing → previewing → done → observing
 *   + failed (reachable from any state)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

// ── Constants ──────────────────────────────────────────────────────────────────

export const LIFECYCLE_PHASES = [
  'discovery',
  'feature',
  'architect',
  'design',
  'preflight',
  'lock',
  'building',
  'verifying',
  'enforcing',
  'previewing',
  'done',
  'observing',
];

const FAILED_STATE = 'failed';

/**
 * Build the ordered-index map for quick prev/next lookups.
 * @returns {Map<string, number>}
 */
function phaseIndex() {
  const map = new Map();
  for (let i = 0; i < LIFECYCLE_PHASES.length; i++) {
    map.set(LIFECYCLE_PHASES[i], i);
  }
  return map;
}

const PHASE_IDX = phaseIndex();

// ── Generic FSM (backwards compat) ────────────────────────────────────────────

/**
 * Create a finite state machine.
 *
 * @param {{ initial: string, transitions: { from: string, to: string, event: string }[] }} opts
 * @returns {object} Machine with transition/getState/canTransition/getHistory
 */
export function createStateMachine({ initial, transitions }) {
  let currentState = initial;
  const history = [];

  function getState() {
    return currentState;
  }

  function canTransition(event) {
    return transitions.some(t => t.from === currentState && t.event === event);
  }

  function transition(event) {
    const t = transitions.find(t => t.from === currentState && t.event === event);
    if (!t) {
      return { success: false, reason: `No transition for event "${event}" from state "${currentState}"` };
    }

    const from = currentState;
    currentState = t.to;
    history.push({ from, to: t.to, event, timestamp: Date.now() });
    return { success: true, from, to: t.to };
  }

  function getHistory() {
    return [...history];
  }

  return { getState, canTransition, transition, getHistory };
}

// ── Transition map ─────────────────────────────────────────────────────────────

/**
 * Build the full transition map for the feature lifecycle.
 * Returns a Map<fromState, Set<toState>>.
 */
function buildTransitionMap() {
  const map = new Map();

  const addEdge = (from, to) => {
    if (!map.has(from)) map.set(from, new Set());
    map.get(from).add(to);
  };

  // Forward transitions along the pipeline
  for (let i = 0; i < LIFECYCLE_PHASES.length - 1; i++) {
    addEdge(LIFECYCLE_PHASES[i], LIFECYCLE_PHASES[i + 1]);
  }

  // Rollback: any state (except discovery) can go back to the previous state
  for (let i = 1; i < LIFECYCLE_PHASES.length; i++) {
    addEdge(LIFECYCLE_PHASES[i], LIFECYCLE_PHASES[i - 1]);
  }

  // Retry: building→building, verifying→verifying
  addEdge('building', 'building');
  addEdge('verifying', 'verifying');

  // Fail: any phase can go to failed
  for (const phase of LIFECYCLE_PHASES) {
    addEdge(phase, FAILED_STATE);
  }

  // Resume: failed can return to any lifecycle phase (guard decides which)
  for (const phase of LIFECYCLE_PHASES) {
    addEdge(FAILED_STATE, phase);
  }

  return map;
}

const TRANSITION_MAP = buildTransitionMap();

// ── Persistence helpers ────────────────────────────────────────────────────────

/**
 * Resolve the state file path for a feature slug.
 */
function stateFilePath(root, slug) {
  return join(root, '.ogu', 'state', 'features', `${slug}.state.json`);
}

/**
 * Load persisted feature state from disk.
 *
 * @param {string} root - Repository root path
 * @param {string} slug - Feature slug
 * @returns {object|null} Persisted state or null if not found
 */
export function loadFeatureState(root, slug) {
  const filePath = stateFilePath(root, slug);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Persist feature state to disk.
 *
 * @param {string} root - Repository root path
 * @param {string} slug - Feature slug
 * @param {object} state - State object to persist
 */
export function saveFeatureState(root, slug, state) {
  const filePath = stateFilePath(root, slug);
  const dir = join(root, '.ogu', 'state', 'features');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Quick lookup of a feature's current phase.
 *
 * @param {string} root - Repository root path
 * @param {string} slug - Feature slug
 * @returns {string|null} Current phase or null if feature not found
 */
export function getFeaturePhase(root, slug) {
  const state = loadFeatureState(root, slug);
  return state ? state.currentPhase : null;
}

// ── Transition validation ──────────────────────────────────────────────────────

/**
 * Check if a feature can transition to a target phase.
 *
 * @param {string} root - Repository root path
 * @param {string} slug - Feature slug
 * @param {string} targetPhase - Desired target phase
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canTransitionFeature(root, slug, targetPhase) {
  const state = loadFeatureState(root, slug);
  if (!state) {
    return { allowed: false, reason: `Feature "${slug}" not found` };
  }

  const current = state.currentPhase;
  const allowed = TRANSITION_MAP.get(current);
  if (!allowed || !allowed.has(targetPhase)) {
    return { allowed: false, reason: `Transition from "${current}" to "${targetPhase}" is not allowed` };
  }

  return { allowed: true };
}

/**
 * Execute a feature transition with guards, side effects, and persistence.
 *
 * @param {string} root - Repository root path
 * @param {string} slug - Feature slug
 * @param {string} targetPhase - Desired target phase
 * @param {object} [options]
 * @param {string} [options.reason] - Human-readable reason for the transition
 * @param {string} [options.actor] - Who triggered this transition
 * @param {boolean} [options.force] - Skip guards (emergency override)
 * @returns {{ success: boolean, from?: string, to?: string, reason?: string }}
 */
export function transitionFeature(root, slug, targetPhase, options = {}) {
  const state = loadFeatureState(root, slug);
  if (!state) {
    return { success: false, reason: `Feature "${slug}" not found` };
  }

  const current = state.currentPhase;

  // Validate the transition edge exists
  const allowed = TRANSITION_MAP.get(current);
  if (!allowed || !allowed.has(targetPhase)) {
    return { success: false, reason: `Transition from "${current}" to "${targetPhase}" is not allowed` };
  }

  // Run guard (unless forced)
  if (!options.force && state.guards) {
    const guardKey = `${current}->${targetPhase}`;
    const guardResult = state.guards[guardKey];
    if (guardResult === false) {
      return { success: false, reason: `Guard blocked transition ${guardKey}` };
    }
  }

  // Determine transition type
  const transitionType = classifyTransition(current, targetPhase);

  // If entering failed, record the phase we failed from so resume works
  if (targetPhase === FAILED_STATE) {
    state.failedFrom = current;
  }

  // Execute transition
  const from = current;
  state.currentPhase = targetPhase;
  state.history.push({
    from,
    to: targetPhase,
    type: transitionType,
    reason: options.reason || null,
    actor: options.actor || process.env.USER || 'unknown',
    timestamp: new Date().toISOString(),
  });
  state.updatedAt = new Date().toISOString();

  // Persist
  saveFeatureState(root, slug, state);

  // Emit audit event
  try {
    emitAudit('feature.transition', {
      slug,
      from,
      to: targetPhase,
      type: transitionType,
      reason: options.reason || null,
    }, {
      feature: slug,
      source: 'state-machine',
      severity: targetPhase === FAILED_STATE ? 'warn' : 'info',
      tags: ['lifecycle', transitionType],
    });
  } catch {
    // Audit emission is best-effort — never block a transition
  }

  return { success: true, from, to: targetPhase, type: transitionType };
}

/**
 * Classify a transition as forward, rollback, retry, fail, or resume.
 */
function classifyTransition(from, to) {
  if (to === FAILED_STATE) return 'fail';
  if (from === FAILED_STATE) return 'resume';
  if (from === to) return 'retry';

  const fromIdx = PHASE_IDX.get(from);
  const toIdx = PHASE_IDX.get(to);
  if (fromIdx !== undefined && toIdx !== undefined) {
    return toIdx > fromIdx ? 'forward' : 'rollback';
  }
  return 'unknown';
}

// ── Feature Lifecycle FSM factory ──────────────────────────────────────────────

/**
 * Create a feature lifecycle FSM with guards, audit, persistence, and history.
 *
 * @param {string} slug - Feature slug (e.g. "auth-flow")
 * @param {object} [options]
 * @param {string} [options.initial] - Starting phase (default: 'discovery')
 * @param {Record<string, () => boolean>} [options.guards] - Guard functions keyed by "from->to"
 * @param {string} [options.root] - Repository root (default: repoRoot())
 * @returns {object} Lifecycle machine
 */
export function createFeatureLifecycle(slug, options = {}) {
  const root = options.root || repoRoot();
  const initialPhase = options.initial || 'discovery';
  const guardFns = options.guards || {};

  // Load existing state or create fresh
  let state = loadFeatureState(root, slug);
  if (!state) {
    state = {
      slug,
      currentPhase: initialPhase,
      failedFrom: null,
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveFeatureState(root, slug, state);

    // Audit the creation
    try {
      emitAudit('feature.created', { slug, initialPhase }, {
        feature: slug,
        source: 'state-machine',
        tags: ['lifecycle', 'created'],
      });
    } catch { /* best-effort */ }
  }

  // ── Public API ──

  function getPhase() {
    const s = loadFeatureState(root, slug);
    return s ? s.currentPhase : null;
  }

  function getHistory() {
    const s = loadFeatureState(root, slug);
    return s ? [...s.history] : [];
  }

  function getState() {
    return loadFeatureState(root, slug);
  }

  function canTransition(targetPhase) {
    const s = loadFeatureState(root, slug);
    if (!s) return false;
    const current = s.currentPhase;
    const allowed = TRANSITION_MAP.get(current);
    if (!allowed || !allowed.has(targetPhase)) return false;

    // Run guard function if registered
    const guardKey = `${current}->${targetPhase}`;
    if (guardFns[guardKey]) {
      try {
        return guardFns[guardKey](s);
      } catch {
        return false;
      }
    }
    return true;
  }

  function transition(targetPhase, transOpts = {}) {
    // Run guard function if registered and not forced
    if (!transOpts.force) {
      const s = loadFeatureState(root, slug);
      if (s) {
        const guardKey = `${s.currentPhase}->${targetPhase}`;
        if (guardFns[guardKey]) {
          try {
            const ok = guardFns[guardKey](s);
            if (!ok) {
              return { success: false, reason: `Guard "${guardKey}" rejected transition` };
            }
          } catch (err) {
            return { success: false, reason: `Guard "${guardKey}" threw: ${err.message}` };
          }
        }
      }
    }
    return transitionFeature(root, slug, targetPhase, transOpts);
  }

  function fail(reason) {
    return transition(FAILED_STATE, { reason });
  }

  function resume(opts = {}) {
    const s = loadFeatureState(root, slug);
    if (!s || s.currentPhase !== FAILED_STATE) {
      return { success: false, reason: 'Feature is not in failed state' };
    }
    const target = s.failedFrom || 'discovery';
    return transition(target, { reason: opts.reason || 'Resuming from failure', ...opts });
  }

  function availableTransitions() {
    const s = loadFeatureState(root, slug);
    if (!s) return [];
    const current = s.currentPhase;
    const allowed = TRANSITION_MAP.get(current);
    return allowed ? [...allowed] : [];
  }

  return {
    slug,
    getPhase,
    getState,
    getHistory,
    canTransition,
    transition,
    fail,
    resume,
    availableTransitions,
    phases: LIFECYCLE_PHASES,
  };
}
