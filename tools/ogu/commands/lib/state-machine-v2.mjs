/**
 * Feature Lifecycle State Machine v2 — aligned to FeatureStates (contracts).
 *
 * This module provides:
 * - transition() with guards, audit, and history
 * - verifyInvariants() for current state
 * - checkTimeout() for stalled states
 * - checkAutoTransitions() for Kadima polling
 * - getAvailableTransitions() + getLifecycleInfo()
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';
import { FeatureStates, ValidTransitions } from '../../../contracts/schemas/feature-state.mjs';
import { resolveFeatureDir } from './feature-paths.mjs';
import { resolveRuntimePath } from './runtime-paths.mjs';

// ── State metadata ─────────────────────────────────────────────────────

const STATE_DESCRIPTIONS = {
  idea: 'Initial concept',
  specifying: 'Writing PRD + Spec',
  specified: 'PRD + Spec complete',
  planning: 'Creating Plan.json + IR',
  planned: 'Architecture complete',
  designing: 'Visual design phase',
  designed: 'Design complete',
  building: 'Agents implementing code',
  built: 'Implementation complete',
  verifying: 'Running gates + compile',
  verified: 'All gates pass',
  reviewing: 'Human review',
  approved: 'Human approved',
  deploying: 'Deploying to preview/prod',
  deployed: 'Live in production',
  observing: 'Production monitoring',
  completed: 'Feature fully done',
  failed: 'Unrecoverable failure',
  paused: 'Manually paused',
};

const STATE_TIMEOUTS = {
  specifying: { hours: 72, escalation: 'auto_suspend' },
  planning: { hours: 48, escalation: 'notify_architect' },
  designing: { hours: 24, escalation: 'auto_skip_design' },
  building: { hours: 168, escalation: 'auto_suspend' },
  verifying: { hours: 24, escalation: 'notify_tech_lead' },
  reviewing: { hours: 24, escalation: 'notify_tech_lead' },
};

const STATE_INVARIANTS = {
  specified: [
    { id: 'prd_exists', check: ({ root, slug }) => existsSync(join(resolveFeatureDir(root, slug), 'PRD.md'))
      ? { valid: true }
      : { valid: false, reason: `PRD.md missing for ${slug}` } },
    { id: 'spec_exists', check: ({ root, slug }) => existsSync(join(resolveFeatureDir(root, slug), 'Spec.md'))
      ? { valid: true }
      : { valid: false, reason: `Spec.md missing for ${slug}` } },
  ],
  planned: [
    { id: 'plan_exists', check: ({ root, slug }) => existsSync(join(resolveFeatureDir(root, slug), 'Plan.json'))
      ? { valid: true }
      : { valid: false, reason: `Plan.json missing for ${slug}` } },
  ],
  designed: [
    { id: 'design_exists', check: ({ root, slug }) => existsSync(join(resolveFeatureDir(root, slug), 'DESIGN.md'))
      ? { valid: true }
      : { valid: false, reason: `DESIGN.md missing for ${slug}` } },
  ],
  built: [
    { id: 'build_attempts', check: ({ state }) => (state.buildAttempts || 0) > 0
      ? { valid: true }
      : { valid: false, reason: 'No build attempts recorded' } },
  ],
  verified: [
    { id: 'built_first', check: ({ state }) => (state.buildAttempts || 0) > 0
      ? { valid: true }
      : { valid: false, reason: 'Never built — cannot be verified' } },
  ],
};

export const LIFECYCLE_STATES = Object.fromEntries(
  FeatureStates.map((state) => [state, {
    description: STATE_DESCRIPTIONS[state] || state,
    invariants: (STATE_INVARIANTS[state] || []).map(i => i.id),
    timeout: STATE_TIMEOUTS[state] || null,
  }])
);

const LEGACY_STATE_MAP = {
  draft: 'idea',
  specced: 'specified',
  allocated: 'building',
  production: 'deployed',
  monitoring: 'observing',
  optimizing: 'observing',
  deprecated: 'completed',
  suspended: 'paused',
  archived: 'completed',
};

// ── Transition definitions (semantic triggers) ─────────────────────────

export const TRANSITIONS = [
  { id: 'T01', from: 'specifying', to: 'specified', trigger: 'spec_complete', triggeredBy: { roles: ['pm'], automatic: false }, guard: 'has_PRD AND has_Spec', governanceHook: null },
  { id: 'T02', from: 'planning', to: 'planned', trigger: 'plan_complete', triggeredBy: { roles: ['architect'], automatic: false }, guard: 'has_Plan', governanceHook: null },
  { id: 'T03', from: 'designing', to: 'designed', trigger: 'design_complete', triggeredBy: { roles: ['designer'], automatic: false }, guard: 'has_DESIGN', governanceHook: null },
  { id: 'T04', from: 'planned', to: 'building', trigger: 'kadima_allocated', triggeredBy: { roles: ['kadima'], automatic: true, autoCondition: 'tasks_allocated' }, guard: null, governanceHook: null },
  { id: 'T05', from: 'designed', to: 'building', trigger: 'first_task_started', triggeredBy: { roles: ['kadima'], automatic: true, autoCondition: 'task_executing' }, guard: null, governanceHook: null },
  { id: 'T06', from: 'building', to: 'built', trigger: 'all_tasks_complete', triggeredBy: { roles: ['kadima'], automatic: true, autoCondition: 'all_outputs_produced' }, guard: null, governanceHook: null },
  { id: 'T07', from: 'verifying', to: 'verified', trigger: 'gates_passed', triggeredBy: { roles: ['tech-lead', 'qa'], automatic: true, autoCondition: 'gates_passed' }, guard: null, governanceHook: null },
  { id: 'T08', from: 'reviewing', to: 'approved', trigger: 'review_complete', triggeredBy: { roles: ['tech-lead', 'cto'], automatic: false }, guard: null, governanceHook: null },
  { id: 'T09', from: 'deploying', to: 'deployed', trigger: 'deploy_complete', triggeredBy: { roles: ['devops'], automatic: true, autoCondition: 'deploy_success' }, guard: null, governanceHook: null },
  { id: 'T10', from: 'deployed', to: 'observing', trigger: 'observe_started', triggeredBy: { roles: ['devops'], automatic: true, autoCondition: 'observe_configured' }, guard: null, governanceHook: null },
  { id: 'T11', from: 'observing', to: 'completed', trigger: 'complete', triggeredBy: { roles: ['cto', 'pm'], automatic: false }, guard: null, governanceHook: null },
  { id: 'T12', from: '*', to: 'paused', trigger: 'human_suspend', triggeredBy: { roles: ['cto', 'tech-lead'], automatic: false }, guard: 'override_record_created', governanceHook: null },
  { id: 'T13', from: '*', to: 'building', trigger: 'gate_failure_fixable', triggeredBy: { roles: ['tech-lead'], automatic: true, autoCondition: 'gate_failed' }, guard: 'fix_plan_created', governanceHook: null },
  { id: 'T14', from: 'paused', to: 'specifying', trigger: 'resume', triggeredBy: { roles: ['cto', 'tech-lead'], automatic: false }, guard: null, governanceHook: null },
];

const MISSION_RULES = [
  {
    onTrigger: 'gate_failure_fixable',
    generateMission: { type: 'fix', template: 'Fix gate failures for ${feature.slug}', assignTo: 'architect', budgetInherit: 0.5 },
  },
];

// ── State File Management ─────────────────────────────────────────────

function loadFeatureStateV2(root, slug) {
  const path = resolveRuntimePath(root, 'state', 'features', `${slug}.state.json`);
  if (!existsSync(path)) return null;
  try {
    const state = JSON.parse(readFileSync(path, 'utf8'));
    if (state?.currentState && !FeatureStates.includes(state.currentState) && LEGACY_STATE_MAP[state.currentState]) {
      state.legacyState = state.currentState;
      state.currentState = LEGACY_STATE_MAP[state.currentState];
    }
    return state;
  } catch {
    return null;
  }
}

function saveFeatureStateV2(root, slug, state) {
  const dir = resolveRuntimePath(root, 'state', 'features');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slug}.state.json`), JSON.stringify(state, null, 2), 'utf8');
}

// ── Core Transition Engine ─────────────────────────────────────────────

/**
 * Attempt a state transition.
 *
 * @param {string} root
 * @param {string} featureSlug
 * @param {string} trigger - trigger name OR target state
 * @param {object} [opts]
 * @param {string} [opts.actor]
 * @param {object} [opts.metadata]
 * @param {boolean} [opts.force]
 */
export function transition(root, featureSlug, trigger, { actor, metadata = {}, force = false } = {}) {
  root = root || repoRoot();
  const featureState = loadFeatureStateV2(root, featureSlug);

  if (!featureState) {
    return { success: false, error: `OGU3700: Feature '${featureSlug}' has no state file. Initialize first.` };
  }

  const currentState = featureState.currentState;

  let trans = null;
  let targetState = null;

  if (FeatureStates.includes(trigger)) {
    targetState = trigger;
    trans = { id: `T-direct-${trigger}`, from: currentState, to: targetState, trigger, triggeredBy: { roles: ['*'], automatic: false }, guard: null };
  } else if (trigger === 'resume') {
    const resumeTarget = featureState.pausedFrom || featureState.previousState || 'specifying';
    targetState = resumeTarget;
    trans = TRANSITIONS.find(t => t.trigger === 'resume') || { id: 'T-resume', from: 'paused', to: targetState, trigger: 'resume', triggeredBy: { roles: ['cto', 'tech-lead'], automatic: false }, guard: null };
  } else {
    trans = findTransition(currentState, trigger);
    if (trans) targetState = trans.to;
  }

  if (!trans || !targetState) {
    return { success: false, error: `OGU3701: No transition from '${currentState}' via '${trigger}'` };
  }

  // Role check
  if (actor && actor !== 'system') {
    const allowed = trans.triggeredBy?.roles || ['*'];
    if (!allowed.includes(actor) && !allowed.includes('*')) {
      return { success: false, error: `OGU3702: Role '${actor}' cannot trigger '${trigger}'. Allowed: ${allowed.join(', ')}` };
    }
  }

  // Check transition validity against contract map
  const allowedTargets = ValidTransitions[currentState] || [];
  if (!allowedTargets.includes(targetState)) {
    return { success: false, error: `OGU3701: Transition from '${currentState}' to '${targetState}' is not allowed` };
  }

  // Guard + invariants (unless forced)
  if (!force) {
    const guardResult = evaluateGuard(root, featureSlug, trans.guard, featureState, targetState);
    if (!guardResult.passed) {
      return { success: false, error: `OGU3703: Guard failed: ${guardResult.reason}` };
    }

    const invariantResult = checkInvariantsForState(root, featureSlug, featureState, targetState);
    if (!invariantResult.valid) {
      const first = invariantResult.violations[0];
      return { success: false, error: `OGU3703: Invariant failed: ${first?.message || 'unknown'}` };
    }
  }

  // Apply transition
  const previousState = currentState;
  featureState.previousState = previousState || featureState.previousState || 'none';
  featureState.currentState = targetState;
  featureState.enteredAt = new Date().toISOString();
  featureState.updatedAt = new Date().toISOString();
  featureState.transitionedBy = { type: actor === 'kadima' ? 'agent' : (actor ? 'human' : 'system'), id: actor || 'system' };
  featureState.version = (featureState.version || 0) + 1;

  if (targetState === 'building') {
    featureState.buildAttempts = (featureState.buildAttempts || 0) + 1;
  }

  if (targetState === 'paused') {
    featureState.pausedFrom = previousState;
  }

  // History
  featureState.stateHistory = featureState.stateHistory || [];
  featureState.stateHistory.push({
    id: trans.id,
    from: previousState,
    to: targetState,
    trigger,
    actor: actor || 'system',
    timestamp: new Date().toISOString(),
    metadata,
  });

  saveFeatureStateV2(root, featureSlug, featureState);

  emitAudit('feature.transition.v2', {
    slug: featureSlug,
    transitionId: trans.id,
    from: previousState,
    to: targetState,
    trigger,
    actor: actor || 'system',
    version: featureState.version,
  }, { feature: { slug: featureSlug } });

  // Mission generation
  const missionRules = MISSION_RULES.filter(r => r.onTrigger === trigger);
  if (missionRules.length > 0) {
    featureState.pendingMissions = featureState.pendingMissions || [];
    for (const rule of missionRules) {
      featureState.pendingMissions.push({
        ...rule.generateMission,
        template: rule.generateMission.template.replace('${feature.slug}', featureSlug),
        requestedAt: new Date().toISOString(),
      });
    }
    saveFeatureStateV2(root, featureSlug, featureState);
  }

  return { success: true, newState: targetState, previousState, transitionId: trans.id };
}

function findTransition(currentState, trigger) {
  return TRANSITIONS.find(t =>
    (t.from === currentState || t.from === '*' || (Array.isArray(t.from) && t.from.includes(currentState))) &&
    t.trigger === trigger
  );
}

function evaluateGuard(root, slug, guard, state, targetState) {
  if (!guard) return { passed: true };
  const featureDir = resolveFeatureDir(root, slug);

  const conds = guard.split(' AND ').map(s => s.trim());
  for (const cond of conds) {
    const res = checkGuardCondition(featureDir, cond, state, targetState);
    if (!res.passed) return res;
  }
  return { passed: true };
}

function checkGuardCondition(featureDir, cond, state, targetState) {
  switch (cond) {
    case 'has_PRD':
      return existsSync(join(featureDir, 'PRD.md')) ? { passed: true } : { passed: false, reason: 'PRD.md missing' };
    case 'has_Spec':
      return existsSync(join(featureDir, 'Spec.md')) ? { passed: true } : { passed: false, reason: 'Spec.md missing' };
    case 'has_Plan':
      return existsSync(join(featureDir, 'Plan.json')) ? { passed: true } : { passed: false, reason: 'Plan.json missing' };
    case 'has_DESIGN':
      return existsSync(join(featureDir, 'DESIGN.md')) ? { passed: true } : { passed: false, reason: 'DESIGN.md missing' };
    case 'fix_plan_created':
    case 'override_record_created':
    case 'tasks_allocated':
    case 'task_executing':
    case 'all_outputs_produced':
    case 'gates_passed':
    case 'deploy_success':
    case 'observe_configured':
      return { passed: true };
    default:
      // Unknown guard — permissive
      return { passed: true };
  }
}

function checkInvariantsForState(root, slug, state, targetState) {
  const defs = STATE_INVARIANTS[targetState] || [];
  if (defs.length === 0) return { valid: true, violations: [] };

  const violations = [];
  for (const inv of defs) {
    const res = inv.check({ root, slug, state });
    if (!res.valid) {
      violations.push({ state: targetState, invariant: inv.id, message: res.reason || 'invariant failed' });
    }
  }
  return { valid: violations.length === 0, violations };
}

// ── Automatic Trigger Engine ───────────────────────────────────────────

export function checkAutoTransitions(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return null;

  const currentState = state.currentState;
  const autoTransitions = TRANSITIONS.filter(t =>
    (t.from === currentState || t.from === '*') && t.triggeredBy?.automatic === true
  );

  for (const trans of autoTransitions) {
    const conditionMet = evaluateAutoCondition(root, featureSlug, trans.triggeredBy.autoCondition, state);
    if (conditionMet) {
      const result = transition(root, featureSlug, trans.trigger, { actor: 'kadima' });
      if (result.success) return result;
    }
  }
  return null;
}

function evaluateAutoCondition(root, slug, condition, state) {
  if (!condition) return false;
  return false;
}

// ── Invariant Verification ─────────────────────────────────────────────

export function verifyInvariants(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return { valid: true, violations: [] };

  const currentState = state.currentState;
  const result = checkInvariantsForState(root, featureSlug, state, currentState);

  if (!result.valid && result.violations.length > 0) {
    emitAudit('feature.invariant_violation', {
      slug: featureSlug,
      state: currentState,
      violations: result.violations,
    }, { feature: { slug: featureSlug } });
  }

  return result;
}

// ── Timeout Checker ───────────────────────────────────────────────────

export function checkTimeout(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return null;

  const timeout = STATE_TIMEOUTS[state.currentState];
  if (!timeout) return null;

  const enteredAt = new Date(state.enteredAt || state.updatedAt || Date.now()).getTime();
  const now = Date.now();
  const elapsedMs = now - enteredAt;

  let timeoutMs;
  if (timeout.hours) timeoutMs = timeout.hours * 3600000;
  else if (timeout.days) timeoutMs = timeout.days * 86400000;
  else return null;

  if (elapsedMs >= timeoutMs) {
    return {
      timedOut: true,
      state: state.currentState,
      escalation: timeout.escalation,
      elapsedMs,
      timeoutMs,
    };
  }

  return {
    timedOut: false,
    state: state.currentState,
    remainingMs: timeoutMs - elapsedMs,
  };
}

// ── Query Helpers ─────────────────────────────────────────────────────

export function getAvailableTransitions(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return [];

  const current = state.currentState;
  const allowedTargets = ValidTransitions[current] || [];

  const base = allowedTargets.map(to => ({
    id: `T-direct-${to}`,
    trigger: to,
    to,
    automatic: false,
    roles: ['*'],
    autoCondition: null,
    guard: null,
    governanceHook: null,
  }));

  const extras = TRANSITIONS.filter(t => (t.from === current || t.from === '*')).map(t => ({
    id: t.id,
    trigger: t.trigger,
    to: t.to,
    automatic: t.triggeredBy?.automatic || false,
    roles: t.triggeredBy?.roles || ['*'],
    autoCondition: t.triggeredBy?.autoCondition || null,
    guard: t.guard,
    governanceHook: t.governanceHook,
  }));

  const seen = new Set();
  const merged = [];
  for (const item of [...base, ...extras]) {
    const key = `${item.trigger}:${item.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function getLifecycleInfo(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return null;

  const meta = LIFECYCLE_STATES[state.currentState] || {};
  const invariants = verifyInvariants(root, featureSlug);
  const available = getAvailableTransitions(root, featureSlug);
  const timeout = checkTimeout(root, featureSlug);

  return {
    slug: featureSlug,
    currentState: state.currentState,
    description: meta.description || '',
    since: state.enteredAt,
    buildAttempts: state.buildAttempts || 0,
    version: state.version,
    invariants: {
      defined: meta.invariants || [],
      result: invariants,
    },
    availableTransitions: available,
    timeout,
    history: state.stateHistory || [],
    pendingMissions: state.pendingMissions || [],
  };
}
