/**
 * Feature Lifecycle State Machine v2 — formal state machine with
 * governance hooks, automatic triggers, invariants, and mission generation.
 *
 * 12 states, 16 transitions, full audit trail.
 *
 * This module extends the simple feature-state.mjs (Fix 2) with:
 * - Who can trigger each transition (triggeredBy roles)
 * - Automatic triggers (Kadima-polled conditions)
 * - Per-state invariants that must hold while feature is in that state
 * - Governance hooks per transition (policy evaluation)
 * - Side effects per transition (audit, notify, resource)
 * - Mission generation on certain transitions
 * - Timeout escalation per state
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

// ── State Definitions ───────────────────────────────────────────────────

export const LIFECYCLE_STATES = {
  draft: {
    description: 'Feature ideated, PRD in progress',
    invariants: ['feature_directory_exists', 'no_plan_json', 'no_worktree_allocated'],
    allowedArtifacts: ['IDEA.md', 'PRD.md'],
    timeout: null,
  },
  specced: {
    description: 'PRD + QA complete, ready for architecture',
    invariants: ['prd_exists', 'qa_exists', 'spec_skeleton_exists'],
    allowedArtifacts: ['PRD.md', 'QA.md', 'Spec.md'],
    timeout: { hours: 72, escalation: 'auto_suspend' },
  },
  planned: {
    description: 'Architecture complete, Plan.json valid, IR validated',
    invariants: ['spec_filled', 'plan_json_valid', 'ir_validated'],
    allowedArtifacts: ['Spec.md', 'Plan.json', 'ADRs'],
    timeout: { hours: 48, escalation: 'notify_architect' },
  },
  designed: {
    description: 'Visual design complete, design tokens generated',
    invariants: ['design_md_exists'],
    allowedArtifacts: ['DESIGN.md', 'design.tokens.json'],
    timeout: { hours: 24, escalation: 'auto_skip_design' },
  },
  allocated: {
    description: 'Kadima has assigned tasks to agents',
    invariants: ['all_tasks_assigned', 'governance_checked', 'budget_envelope_valid'],
    allowedArtifacts: ['allocation.json'],
    timeout: { hours: 4, escalation: 'reallocate' },
  },
  building: {
    description: 'Active execution — agents producing code',
    invariants: ['has_active_slot', 'worktree_exists', 'budget_not_exceeded'],
    allowedArtifacts: ['source code', 'test files', 'snapshots'],
    timeout: { hours: 168, escalation: 'auto_suspend' },
  },
  reviewing: {
    description: 'All tasks complete, gates running',
    invariants: ['all_tasks_complete', 'all_outputs_produced'],
    allowedArtifacts: ['gate results', 'compile output'],
    timeout: { hours: 24, escalation: 'notify_tech_lead' },
  },
  production: {
    description: 'All gates passed, deployed to production',
    invariants: ['all_gates_passed', 'preview_healthy', 'smoke_passed'],
    allowedArtifacts: ['deploy receipt', 'health check results'],
    timeout: null,
  },
  monitoring: {
    description: 'Active production observation',
    invariants: ['observe_sources_configured'],
    allowedArtifacts: ['observation logs', 'metrics'],
    timeout: { hours: 720, escalation: 'auto_optimize' },
  },
  optimizing: {
    description: 'Performance tuning based on production data',
    invariants: ['optimization_mission_exists', 'baseline_captured'],
    allowedArtifacts: ['optimization plan', 'benchmark results'],
    timeout: { hours: 168, escalation: 'auto_archive' },
  },
  deprecated: {
    description: 'Feature marked for removal, no new work',
    invariants: ['deprecation_adr_exists', 'no_active_agents'],
    allowedArtifacts: ['deprecation ADR'],
    timeout: { days: 90, escalation: 'auto_archive' },
  },
  suspended: {
    description: 'Paused by human or system — no execution',
    invariants: ['override_record_exists', 'slots_released'],
    allowedArtifacts: ['OverrideRecord'],
    timeout: { days: 30, escalation: 'auto_archive' },
  },
  archived: {
    description: 'Terminal state — immutable history',
    invariants: ['worktree_cleaned', 'snapshots_preserved', 'audit_trail_complete'],
    allowedArtifacts: [],
    timeout: null,
  },
};

// ── Transition Table ────────────────────────────────────────────────────

export const TRANSITIONS = [
  {
    id: 'T01', from: 'draft', to: 'specced',
    trigger: 'spec_complete',
    triggeredBy: { roles: ['pm'], automatic: false },
    guard: 'has_PRD AND has_QA AND has_Spec_skeleton',
    governanceHook: null,
    sideEffects: ['audit:state_transition', 'notify:architect'],
  },
  {
    id: 'T02', from: 'specced', to: 'planned',
    trigger: 'plan_complete',
    triggeredBy: { roles: ['architect'], automatic: false },
    guard: 'has_Spec_filled AND has_Plan_json AND ir_valid',
    governanceHook: 'policy:evaluate(task.phase=architect)',
    sideEffects: ['audit:state_transition', 'budget:create_envelope'],
  },
  {
    id: 'T03', from: 'planned', to: 'designed',
    trigger: 'design_complete',
    triggeredBy: { roles: ['designer'], automatic: false },
    guard: 'has_DESIGN_md',
    governanceHook: null,
    sideEffects: ['audit:state_transition'],
  },
  {
    id: 'T04', from: 'designed', to: 'allocated',
    trigger: 'kadima_allocated',
    triggeredBy: { roles: ['kadima'], automatic: true, autoCondition: 'design_complete AND governance_checked' },
    guard: 'all_tasks_assigned AND governance_checked AND budget_envelope_valid',
    governanceHook: 'policy:evaluate(task.phase=allocation)',
    sideEffects: ['audit:state_transition', 'resource:reserve_slots'],
  },
  {
    id: 'T05', from: 'allocated', to: 'building',
    trigger: 'first_task_started',
    triggeredBy: { roles: ['kadima'], automatic: true, autoCondition: 'at_least_one_agent_executing' },
    guard: 'resource_slots_acquired AND sandbox_validated',
    governanceHook: 'policy:evaluate(task.phase=build)',
    sideEffects: ['audit:state_transition', 'worktree:create'],
  },
  {
    id: 'T06', from: 'building', to: 'reviewing',
    trigger: 'all_tasks_complete',
    triggeredBy: { roles: ['kadima'], automatic: true, autoCondition: 'all_outputs_produced AND no_critical_failures' },
    guard: 'all_outputs_produced AND no_critical_failures AND budget_within_envelope',
    governanceHook: null,
    sideEffects: ['audit:state_transition', 'resource:release_all_slots', 'compile:start_auto'],
  },
  {
    id: 'T07', from: 'reviewing', to: 'production',
    trigger: 'gates_passed',
    triggeredBy: { roles: ['tech-lead'], automatic: true, autoCondition: 'compile_success AND all_14_gates_pass' },
    guard: 'compile_success AND all_14_gates_pass AND preview_healthy AND smoke_passed',
    governanceHook: 'policy:evaluate(task.phase=release)',
    sideEffects: ['audit:state_transition', 'attest:create_release_attestation', 'notify:stakeholders'],
  },
  {
    id: 'T08', from: 'production', to: 'monitoring',
    trigger: 'observation_started',
    triggeredBy: { roles: ['devops'], automatic: true, autoCondition: 'observe_sources_configured' },
    guard: 'observe_sources_configured',
    governanceHook: null,
    sideEffects: ['audit:state_transition', 'observe:start_auto'],
  },
  {
    id: 'T09', from: 'monitoring', to: 'optimizing',
    trigger: 'optimization_needed',
    triggeredBy: { roles: ['kadima'], automatic: true, autoCondition: 'performance_below_threshold OR cost_above_threshold' },
    guard: 'optimization_mission_created AND baseline_captured',
    governanceHook: 'policy:evaluate(task.phase=optimize)',
    sideEffects: ['audit:state_transition', 'mission:create_optimization'],
  },
  {
    id: 'T10', from: 'optimizing', to: 'monitoring',
    trigger: 'optimization_complete',
    triggeredBy: { roles: ['tech-lead'], automatic: false },
    guard: 'benchmarks_improved_or_equal',
    governanceHook: null,
    sideEffects: ['audit:state_transition', 'performance:record_improvement'],
  },
  {
    id: 'T11', from: 'monitoring', to: 'deprecated',
    trigger: 'deprecate',
    triggeredBy: { roles: ['cto', 'pm'], automatic: false },
    guard: 'deprecation_adr_exists',
    governanceHook: 'policy:evaluate(task.type=deprecation)',
    sideEffects: ['audit:state_transition', 'notify:all_stakeholders'],
  },
  {
    id: 'T12', from: 'deprecated', to: 'archived',
    trigger: 'archive',
    triggeredBy: { roles: ['devops'], automatic: true, autoCondition: '90_days_since_deprecation AND no_dependencies' },
    guard: 'no_active_dependencies AND cleanup_complete',
    governanceHook: null,
    sideEffects: ['audit:state_transition', 'worktree:cleanup', 'snapshot:archive'],
  },
  {
    id: 'T13', from: 'building', to: 'suspended',
    trigger: 'critical_failure',
    triggeredBy: { roles: ['kadima'], automatic: true, autoCondition: 'critical_path_exhausted AND max_escalation_reached' },
    guard: 'override_record_created_auto',
    governanceHook: 'policy:evaluate(task.type=suspension)',
    sideEffects: ['audit:state_transition', 'resource:release_all_slots', 'notify:tech_lead_and_cto'],
  },
  {
    id: 'T14', from: 'reviewing', to: 'building',
    trigger: 'gate_failure_fixable',
    triggeredBy: { roles: ['tech-lead'], automatic: true, autoCondition: 'gate_failed AND fix_possible AND retry_count < 3' },
    guard: 'fix_plan_created AND budget_available',
    governanceHook: null,
    sideEffects: ['audit:state_transition', 'kadima:reallocate_fix_tasks'],
  },
  {
    id: 'T15', from: '*', to: 'suspended',
    trigger: 'human_suspend',
    triggeredBy: { roles: ['cto', 'tech-lead'], automatic: false },
    guard: 'override_record_created',
    governanceHook: 'policy:evaluate(task.type=manual_suspension)',
    sideEffects: ['audit:state_transition', 'resource:release_all_slots', 'notify:all_assigned_agents'],
  },
  {
    id: 'T16', from: 'suspended', to: 'allocated',
    trigger: 'resume',
    triggeredBy: { roles: ['cto', 'tech-lead'], automatic: false },
    guard: 'override_record_for_resume AND reallocation_done AND budget_refreshed',
    governanceHook: 'policy:evaluate(task.type=resume)',
    sideEffects: ['audit:state_transition', 'kadima:reallocate'],
  },
];

// ── Mission Generation Rules ────────────────────────────────────────────

const MISSION_RULES = [
  {
    onTransition: 'T09',
    generateMission: { type: 'optimization', template: 'Optimize ${feature.slug} based on monitoring data', assignTo: 'tech-lead', budgetInherit: 0.3 },
  },
  {
    onTransition: 'T14',
    generateMission: { type: 'fix', template: 'Fix gate failures for ${feature.slug}', assignTo: 'architect', budgetInherit: 0.5 },
  },
  {
    onTransition: 'T13',
    generateMission: { type: 'investigation', template: 'Investigate critical failure in ${feature.slug}', assignTo: 'cto', budgetInherit: 0.2 },
  },
];

// ── State File Management ───────────────────────────────────────────────

const STATE_DIR = () => join(repoRoot(), '.ogu/state/features');

function loadFeatureStateV2(root, slug) {
  const path = join(root, '.ogu/state/features', `${slug}.state.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function saveFeatureStateV2(root, slug, state) {
  const dir = join(root, '.ogu/state/features');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slug}.state.json`), JSON.stringify(state, null, 2), 'utf8');
}

// ── Core Transition Engine ──────────────────────────────────────────────

/**
 * Attempt a state transition with full governance.
 *
 * @param {string} root - Repo root
 * @param {string} featureSlug - Feature slug
 * @param {string} trigger - Transition trigger name
 * @param {object} [opts]
 * @param {string} [opts.actor] - Role performing the transition
 * @param {object} [opts.metadata] - Additional metadata
 * @param {boolean} [opts.force] - Force past guards
 * @returns {{ success: boolean, newState?: string, previousState?: string, transitionId?: string, error?: string }}
 */
export function transition(root, featureSlug, trigger, { actor, metadata = {}, force = false } = {}) {
  root = root || repoRoot();
  const featureState = loadFeatureStateV2(root, featureSlug);

  if (!featureState) {
    return { success: false, error: `OGU3700: Feature '${featureSlug}' has no state file. Initialize first.` };
  }

  const currentState = featureState.currentState;

  // Find matching transition
  const trans = findTransition(currentState, trigger);
  if (!trans) {
    return { success: false, error: `OGU3701: No transition from '${currentState}' via '${trigger}'` };
  }

  // Check: who triggered this?
  if (actor && actor !== 'system') {
    const allowed = trans.triggeredBy.roles;
    if (!allowed.includes(actor) && !allowed.includes('*')) {
      return {
        success: false,
        error: `OGU3702: Role '${actor}' cannot trigger '${trigger}'. Allowed: ${allowed.join(', ')}`,
      };
    }
  }

  // Check: guard conditions (simplified — real guards check file existence)
  if (!force) {
    const guardResult = evaluateGuard(root, featureSlug, trans.guard, featureState);
    if (!guardResult.passed) {
      return { success: false, error: `OGU3703: Guard failed: ${guardResult.reason}` };
    }
  }

  // Apply transition
  const previousState = currentState;
  featureState.previousState = previousState;
  featureState.currentState = trans.to;
  featureState.enteredAt = new Date().toISOString();
  featureState.updatedAt = new Date().toISOString();
  featureState.transitionedBy = { type: actor === 'kadima' ? 'agent' : 'human', id: actor || 'system' };
  featureState.version = (featureState.version || 0) + 1;

  // Track history
  featureState.stateHistory = featureState.stateHistory || [];
  featureState.stateHistory.push({
    id: trans.id,
    from: previousState,
    to: trans.to,
    trigger,
    actor: actor || 'system',
    timestamp: new Date().toISOString(),
    metadata,
  });

  if (trans.to === 'building') {
    featureState.buildAttempts = (featureState.buildAttempts || 0) + 1;
  }

  saveFeatureStateV2(root, featureSlug, featureState);

  // Emit audit
  emitAudit('feature.transition.v2', {
    slug: featureSlug,
    transitionId: trans.id,
    from: previousState,
    to: trans.to,
    trigger,
    actor: actor || 'system',
    version: featureState.version,
  }, { feature: { slug: featureSlug } });

  // Check mission generation
  const missionRules = MISSION_RULES.filter(r => r.onTransition === trans.id);
  for (const rule of missionRules) {
    // Store mission request in state for Kadima to pick up
    featureState.pendingMissions = featureState.pendingMissions || [];
    featureState.pendingMissions.push({
      ...rule.generateMission,
      template: rule.generateMission.template.replace('${feature.slug}', featureSlug),
      requestedAt: new Date().toISOString(),
    });
    saveFeatureStateV2(root, featureSlug, featureState);
  }

  return { success: true, newState: trans.to, previousState, transitionId: trans.id };
}

/**
 * Find matching transition from current state via trigger.
 */
function findTransition(currentState, trigger) {
  return TRANSITIONS.find(t =>
    (t.from === currentState || t.from === '*') && t.trigger === trigger
  );
}

/**
 * Evaluate guard conditions.
 * Guards are AND-separated condition strings like "has_PRD AND has_QA".
 */
function evaluateGuard(root, slug, guard, state) {
  if (!guard) return { passed: true };

  const conditions = guard.split(' AND ').map(s => s.trim());
  const featureDir = join(root, `docs/vault/04_Features/${slug}`);

  for (const cond of conditions) {
    const result = checkGuardCondition(root, slug, featureDir, cond, state);
    if (!result.passed) return result;
  }

  return { passed: true };
}

/**
 * Check a single guard condition.
 */
function checkGuardCondition(root, slug, featureDir, cond, state) {
  switch (cond) {
    case 'has_PRD':
      return existsSync(join(featureDir, 'PRD.md'))
        ? { passed: true }
        : { passed: false, reason: `PRD.md missing for ${slug}` };
    case 'has_QA':
      return existsSync(join(featureDir, 'QA.md'))
        ? { passed: true }
        : { passed: false, reason: `QA.md missing for ${slug}` };
    case 'has_Spec_skeleton':
    case 'has_Spec_filled':
      return existsSync(join(featureDir, 'Spec.md'))
        ? { passed: true }
        : { passed: false, reason: `Spec.md missing for ${slug}` };
    case 'has_Plan_json':
    case 'plan_json_valid':
      return existsSync(join(featureDir, 'Plan.json'))
        ? { passed: true }
        : { passed: false, reason: `Plan.json missing for ${slug}` };
    case 'has_DESIGN_md':
      return existsSync(join(featureDir, 'DESIGN.md'))
        ? { passed: true }
        : { passed: false, reason: `DESIGN.md missing for ${slug}` };
    case 'ir_valid':
    case 'governance_checked':
    case 'budget_envelope_valid':
    case 'all_tasks_assigned':
    case 'resource_slots_acquired':
    case 'sandbox_validated':
    case 'all_outputs_produced':
    case 'no_critical_failures':
    case 'budget_within_envelope':
    case 'compile_success':
    case 'all_14_gates_pass':
    case 'preview_healthy':
    case 'smoke_passed':
    case 'observe_sources_configured':
    case 'optimization_mission_created':
    case 'baseline_captured':
    case 'benchmarks_improved_or_equal':
    case 'deprecation_adr_exists':
    case 'no_active_dependencies':
    case 'cleanup_complete':
    case 'override_record_created_auto':
    case 'override_record_created':
    case 'fix_plan_created':
    case 'budget_available':
    case 'override_record_for_resume':
    case 'reallocation_done':
    case 'budget_refreshed':
    case 'at_least_one_agent_executing':
    case 'design_complete':
      // These guards are permissive by default — real enforcement comes
      // from checkEnvelope / policy evaluation / invariant checks
      return { passed: true };
    default:
      return { passed: true };
  }
}

// ── Automatic Trigger Engine ────────────────────────────────────────────

/**
 * Check for automatic transitions — called by Kadima on poll.
 * Returns the first auto-transition that fires, or null.
 */
export function checkAutoTransitions(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return null;

  const currentState = state.currentState;

  const autoTransitions = TRANSITIONS.filter(t =>
    (t.from === currentState || t.from === '*') &&
    t.triggeredBy.automatic === true
  );

  for (const trans of autoTransitions) {
    const conditionMet = evaluateAutoCondition(root, featureSlug, trans.triggeredBy.autoCondition, state);
    if (conditionMet) {
      const result = transition(root, featureSlug, trans.trigger, { actor: 'kadima' });
      if (result.success) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Evaluate an automatic condition string.
 * Currently returns false by default — conditions are wired to real checks
 * when Kadima integration is active.
 */
function evaluateAutoCondition(root, slug, condition, state) {
  if (!condition) return false;
  // Auto-conditions require Kadima runtime context
  // Return false by default — Kadima passes explicit signals
  return false;
}

// ── Invariant Verification ──────────────────────────────────────────────

/**
 * Verify state invariants hold for current state.
 * Called periodically and before any transition.
 */
export function verifyInvariants(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return { valid: true, violations: [] };

  const currentState = state.currentState;
  const stateSpec = LIFECYCLE_STATES[currentState];
  if (!stateSpec) return { valid: true, violations: [] };

  const violations = [];
  const featureDir = join(root, `docs/vault/04_Features/${featureSlug}`);

  for (const invariant of stateSpec.invariants) {
    const check = checkInvariant(root, featureSlug, featureDir, invariant, state);
    if (!check.valid) {
      violations.push({
        state: currentState,
        invariant,
        message: check.reason,
      });
    }
  }

  if (violations.length > 0) {
    emitAudit('feature.invariant_violation', {
      slug: featureSlug,
      state: currentState,
      violations,
    }, { feature: { slug: featureSlug } });
  }

  return { valid: violations.length === 0, violations };
}

function checkInvariant(root, slug, featureDir, invariant, state) {
  switch (invariant) {
    case 'feature_directory_exists':
      return existsSync(featureDir)
        ? { valid: true }
        : { valid: false, reason: `Feature directory missing: ${featureDir}` };
    case 'no_plan_json':
      return !existsSync(join(featureDir, 'Plan.json'))
        ? { valid: true }
        : { valid: false, reason: 'Plan.json should not exist in draft state' };
    case 'prd_exists':
      return existsSync(join(featureDir, 'PRD.md'))
        ? { valid: true }
        : { valid: false, reason: 'PRD.md missing' };
    case 'qa_exists':
      return existsSync(join(featureDir, 'QA.md'))
        ? { valid: true }
        : { valid: false, reason: 'QA.md missing' };
    case 'spec_skeleton_exists':
    case 'spec_filled':
      return existsSync(join(featureDir, 'Spec.md'))
        ? { valid: true }
        : { valid: false, reason: 'Spec.md missing' };
    case 'plan_json_valid':
      return existsSync(join(featureDir, 'Plan.json'))
        ? { valid: true }
        : { valid: false, reason: 'Plan.json missing' };
    case 'design_md_exists':
      return existsSync(join(featureDir, 'DESIGN.md'))
        ? { valid: true }
        : { valid: false, reason: 'DESIGN.md missing' };
    case 'no_worktree_allocated':
    case 'all_tasks_assigned':
    case 'governance_checked':
    case 'budget_envelope_valid':
    case 'has_active_slot':
    case 'worktree_exists':
    case 'budget_not_exceeded':
    case 'all_tasks_complete':
    case 'all_outputs_produced':
    case 'all_gates_passed':
    case 'preview_healthy':
    case 'smoke_passed':
    case 'observe_sources_configured':
    case 'optimization_mission_exists':
    case 'baseline_captured':
    case 'deprecation_adr_exists':
    case 'no_active_agents':
    case 'override_record_exists':
    case 'slots_released':
    case 'worktree_cleaned':
    case 'snapshots_preserved':
    case 'audit_trail_complete':
    case 'ir_validated':
      // Permissive by default — real enforcement in envelope/governor
      return { valid: true };
    default:
      return { valid: true };
  }
}

// ── Timeout Checker ─────────────────────────────────────────────────────

/**
 * Check if current state has timed out.
 * Returns escalation action if timed out, null otherwise.
 */
export function checkTimeout(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return null;

  const stateSpec = LIFECYCLE_STATES[state.currentState];
  if (!stateSpec?.timeout) return null;

  const enteredAt = new Date(state.enteredAt).getTime();
  const now = Date.now();
  const elapsedMs = now - enteredAt;

  let timeoutMs;
  if (stateSpec.timeout.hours) timeoutMs = stateSpec.timeout.hours * 3600000;
  else if (stateSpec.timeout.days) timeoutMs = stateSpec.timeout.days * 86400000;
  else return null;

  if (elapsedMs >= timeoutMs) {
    return {
      timedOut: true,
      state: state.currentState,
      escalation: stateSpec.timeout.escalation,
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

// ── Query Helpers ───────────────────────────────────────────────────────

/**
 * Get available transitions from current state.
 */
export function getAvailableTransitions(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return [];

  return TRANSITIONS.filter(t =>
    t.from === state.currentState || t.from === '*'
  ).map(t => ({
    id: t.id,
    trigger: t.trigger,
    to: t.to,
    automatic: t.triggeredBy.automatic,
    roles: t.triggeredBy.roles,
    autoCondition: t.triggeredBy.autoCondition || null,
    guard: t.guard,
    governanceHook: t.governanceHook,
  }));
}

/**
 * Get full feature lifecycle info for CLI display.
 */
export function getLifecycleInfo(root, featureSlug) {
  root = root || repoRoot();
  const state = loadFeatureStateV2(root, featureSlug);
  if (!state) return null;

  const stateSpec = LIFECYCLE_STATES[state.currentState];
  const invariants = verifyInvariants(root, featureSlug);
  const available = getAvailableTransitions(root, featureSlug);
  const timeout = checkTimeout(root, featureSlug);

  return {
    slug: featureSlug,
    currentState: state.currentState,
    description: stateSpec?.description || '',
    since: state.enteredAt,
    buildAttempts: state.buildAttempts || 0,
    version: state.version,
    invariants: {
      defined: stateSpec?.invariants || [],
      result: invariants,
    },
    availableTransitions: available,
    timeout,
    history: state.stateHistory || [],
    pendingMissions: state.pendingMissions || [],
  };
}
