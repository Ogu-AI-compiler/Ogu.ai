/**
 * State Machine Tests — v1 (createStateMachine) + v2 (feature lifecycle).
 *
 * 38 tests covering:
 *   Section 1: v1 createStateMachine (6 tests)
 *   Section 2: v2 LIFECYCLE_STATES & TRANSITIONS definitions (4 tests)
 *   Section 3: v2 transition() engine (10 tests)
 *   Section 4: v2 verifyInvariants (5 tests)
 *   Section 5: v2 checkTimeout (4 tests)
 *   Section 6: v2 getAvailableTransitions + getLifecycleInfo (4 tests)
 *   Section 7: v2 checkAutoTransitions + mission generation (5 tests)
 */

import { createStateMachine } from '../commands/lib/state-machine.mjs';
import {
  LIFECYCLE_STATES, TRANSITIONS,
  transition, verifyInvariants, checkTimeout,
  getAvailableTransitions, getLifecycleInfo,
  checkAutoTransitions,
} from '../commands/lib/state-machine-v2.mjs';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${passed + failed}. ${name}`);
  } else {
    failed++;
    results.push(`  FAIL  ${passed + failed}. ${name}`);
  }
}

function makeTmpRoot() {
  const root = join(tmpdir(), `ogu-sm-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/state/features'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  return root;
}

function createFeatureState(root, slug, currentState, extras = {}) {
  const state = {
    currentState,
    previousState: null,
    enteredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    stateHistory: [],
    buildAttempts: 0,
    ...extras,
  };
  writeFileSync(
    join(root, `.ogu/state/features/${slug}.state.json`),
    JSON.stringify(state, null, 2), 'utf8'
  );
  return state;
}

function createFeatureDir(root, slug, files = []) {
  const dir = join(root, `docs/vault/04_Features/${slug}`);
  mkdirSync(dir, { recursive: true });
  for (const f of files) {
    writeFileSync(join(dir, f), `# ${f}\n`, 'utf8');
  }
  return dir;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: v1 createStateMachine
// ═══════════════════════════════════════════════════════════════════════

// 1. Basic state machine creation
{
  const sm = createStateMachine({
    initial: 'idle',
    transitions: [
      { from: 'idle', to: 'running', event: 'start' },
      { from: 'running', to: 'done', event: 'finish' },
    ],
  });
  assert(sm.getState() === 'idle', 'v1: initial state is set correctly');
}

// 2. Successful transition
{
  const sm = createStateMachine({
    initial: 'idle',
    transitions: [
      { from: 'idle', to: 'running', event: 'start' },
      { from: 'running', to: 'done', event: 'finish' },
    ],
  });
  const result = sm.transition('start');
  assert(result.success === true && result.from === 'idle' && result.to === 'running',
    'v1: transition returns success with from/to');
  assert(sm.getState() === 'running', 'v1: state updates after transition');
}

// 3. Invalid transition
{
  const sm = createStateMachine({
    initial: 'idle',
    transitions: [
      { from: 'idle', to: 'running', event: 'start' },
    ],
  });
  const result = sm.transition('finish');
  assert(result.success === false && result.reason.includes('No transition'),
    'v1: invalid transition returns failure with reason');
}

// 4. canTransition
{
  const sm = createStateMachine({
    initial: 'idle',
    transitions: [
      { from: 'idle', to: 'running', event: 'start' },
      { from: 'running', to: 'done', event: 'finish' },
    ],
  });
  assert(sm.canTransition('start') === true, 'v1: canTransition true for valid event');
  assert(sm.canTransition('finish') === false, 'v1: canTransition false for invalid event from current state');
}

// 5. History tracking
{
  const sm = createStateMachine({
    initial: 'a',
    transitions: [
      { from: 'a', to: 'b', event: 'go' },
      { from: 'b', to: 'c', event: 'go' },
    ],
  });
  sm.transition('go');
  sm.transition('go');
  const history = sm.getHistory();
  assert(history.length === 2 && history[0].from === 'a' && history[1].to === 'c',
    'v1: getHistory tracks all transitions with timestamps');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: v2 LIFECYCLE_STATES & TRANSITIONS definitions
// ═══════════════════════════════════════════════════════════════════════

// 6. All 12 lifecycle states defined
{
  const expected = ['draft', 'specced', 'planned', 'designed', 'allocated', 'building',
    'reviewing', 'production', 'monitoring', 'optimizing', 'deprecated', 'suspended', 'archived'];
  const allPresent = expected.every(s => s in LIFECYCLE_STATES);
  assert(allPresent, 'v2: all 12+ lifecycle states are defined');
}

// 7. Each state has invariants and description
{
  const allHaveInvariants = Object.values(LIFECYCLE_STATES).every(s =>
    Array.isArray(s.invariants) && typeof s.description === 'string'
  );
  assert(allHaveInvariants, 'v2: every state has invariants array and description');
}

// 8. 16 transitions defined
{
  assert(TRANSITIONS.length >= 16, 'v2: at least 16 transitions defined');
}

// 9. Transition T15 uses wildcard from='*'
{
  const t15 = TRANSITIONS.find(t => t.id === 'T15');
  assert(t15 && t15.from === '*' && t15.trigger === 'human_suspend',
    'v2: T15 wildcard transition (human_suspend from any state)');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: v2 transition() engine
// ═══════════════════════════════════════════════════════════════════════

// 10. Valid transition: draft → specced
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'QA.md', 'Spec.md']);

  const result = transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  assert(result.success === true && result.newState === 'specced' && result.previousState === 'draft',
    'v2 transition: draft → specced succeeds');
  rmSync(root, { recursive: true, force: true });
}

// 11. No state file → error
{
  const root = makeTmpRoot();
  const result = transition(root, 'nonexistent', 'spec_complete');
  assert(result.success === false && result.error.includes('OGU3700'),
    'v2 transition: missing state file returns OGU3700');
  rmSync(root, { recursive: true, force: true });
}

// 12. Invalid trigger from current state → error
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  const result = transition(root, 'test-feat', 'gates_passed');
  assert(result.success === false && result.error.includes('OGU3701'),
    'v2 transition: invalid trigger returns OGU3701');
  rmSync(root, { recursive: true, force: true });
}

// 13. Role not allowed → error
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'QA.md', 'Spec.md']);

  const result = transition(root, 'test-feat', 'spec_complete', { actor: 'developer' });
  assert(result.success === false && result.error.includes('OGU3702'),
    'v2 transition: wrong role returns OGU3702');
  rmSync(root, { recursive: true, force: true });
}

// 14. Guard fails when PRD missing
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  createFeatureDir(root, 'test-feat', ['QA.md', 'Spec.md']); // no PRD.md

  const result = transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  assert(result.success === false && result.error.includes('OGU3703') && result.error.includes('PRD.md'),
    'v2 transition: guard fails when PRD.md missing');
  rmSync(root, { recursive: true, force: true });
}

// 15. Force flag bypasses guards
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  createFeatureDir(root, 'test-feat'); // no files at all

  const result = transition(root, 'test-feat', 'spec_complete', { actor: 'pm', force: true });
  assert(result.success === true && result.newState === 'specced',
    'v2 transition: force=true bypasses guard failures');
  rmSync(root, { recursive: true, force: true });
}

// 16. State history is appended
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'QA.md', 'Spec.md']);

  transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.stateHistory.length === 1 && state.stateHistory[0].from === 'draft' && state.stateHistory[0].to === 'specced',
    'v2 transition: state history records transition');
  rmSync(root, { recursive: true, force: true });
}

// 17. Version increments on transition
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft', { version: 3 });
  createFeatureDir(root, 'test-feat', ['PRD.md', 'QA.md', 'Spec.md']);

  transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.version === 4, 'v2 transition: version increments');
  rmSync(root, { recursive: true, force: true });
}

// 18. buildAttempts increments when entering building state
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'allocated', { buildAttempts: 1 });
  createFeatureDir(root, 'test-feat');

  const result = transition(root, 'test-feat', 'first_task_started', { actor: 'kadima' });
  assert(result.success === true, 'v2 transition: allocated → building succeeds');
  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.buildAttempts === 2, 'v2 transition: buildAttempts increments when entering building');
  rmSync(root, { recursive: true, force: true });
}

// 19. Wildcard T15 (human_suspend) from any state
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'building');
  createFeatureDir(root, 'test-feat');

  const result = transition(root, 'test-feat', 'human_suspend', { actor: 'cto' });
  assert(result.success === true && result.newState === 'suspended',
    'v2 transition: wildcard T15 human_suspend works from building state');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 4: v2 verifyInvariants
// ═══════════════════════════════════════════════════════════════════════

// 20. Draft state: feature_directory_exists passes when dir exists
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  createFeatureDir(root, 'test-feat');
  const result = verifyInvariants(root, 'test-feat');
  assert(result.valid === true, 'v2 invariants: draft state passes when feature dir exists');
  rmSync(root, { recursive: true, force: true });
}

// 21. Draft state: feature_directory_exists fails when dir missing
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  // Don't create feature dir
  const result = verifyInvariants(root, 'test-feat');
  assert(result.valid === false && result.violations.some(v => v.invariant === 'feature_directory_exists'),
    'v2 invariants: draft state fails when feature dir missing');
  rmSync(root, { recursive: true, force: true });
}

// 22. Specced state: prd_exists, qa_exists
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specced');
  createFeatureDir(root, 'test-feat', ['PRD.md']); // QA.md missing
  const result = verifyInvariants(root, 'test-feat');
  assert(result.valid === false && result.violations.some(v => v.invariant === 'qa_exists'),
    'v2 invariants: specced state fails when QA.md missing');
  rmSync(root, { recursive: true, force: true });
}

// 23. No state file → valid (no state = no invariants to check)
{
  const root = makeTmpRoot();
  const result = verifyInvariants(root, 'nonexistent');
  assert(result.valid === true && result.violations.length === 0,
    'v2 invariants: no state file returns valid (nothing to check)');
  rmSync(root, { recursive: true, force: true });
}

// 24. Planned state: plan_json_valid fails without Plan.json
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'planned');
  createFeatureDir(root, 'test-feat', ['Spec.md']); // no Plan.json
  const result = verifyInvariants(root, 'test-feat');
  assert(result.valid === false && result.violations.some(v => v.invariant === 'plan_json_valid'),
    'v2 invariants: planned state fails without Plan.json');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 5: v2 checkTimeout
// ═══════════════════════════════════════════════════════════════════════

// 25. No timeout defined for draft state
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  const result = checkTimeout(root, 'test-feat');
  assert(result === null, 'v2 timeout: null when state has no timeout defined (draft)');
  rmSync(root, { recursive: true, force: true });
}

// 26. Not timed out — feature in specced within 72h
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specced', { enteredAt: new Date().toISOString() });
  const result = checkTimeout(root, 'test-feat');
  assert(result !== null && result.timedOut === false && result.remainingMs > 0,
    'v2 timeout: not timed out when within window');
  rmSync(root, { recursive: true, force: true });
}

// 27. Timed out — feature in specced for > 72h
{
  const root = makeTmpRoot();
  const enteredAt = new Date(Date.now() - 73 * 3600000).toISOString(); // 73 hours ago
  createFeatureState(root, 'test-feat', 'specced', { enteredAt });
  const result = checkTimeout(root, 'test-feat');
  assert(result !== null && result.timedOut === true && result.escalation === 'auto_suspend',
    'v2 timeout: timed out after 72h in specced state → auto_suspend');
  rmSync(root, { recursive: true, force: true });
}

// 28. No state file → null
{
  const root = makeTmpRoot();
  const result = checkTimeout(root, 'nonexistent');
  assert(result === null, 'v2 timeout: null when no state file');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 6: v2 getAvailableTransitions + getLifecycleInfo
// ═══════════════════════════════════════════════════════════════════════

// 29. getAvailableTransitions from draft
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  const transitions = getAvailableTransitions(root, 'test-feat');
  // Should include T01 (spec_complete) + T15 (human_suspend wildcard)
  assert(transitions.some(t => t.trigger === 'spec_complete') &&
         transitions.some(t => t.trigger === 'human_suspend'),
    'v2 available: draft shows spec_complete + wildcard human_suspend');
  rmSync(root, { recursive: true, force: true });
}

// 30. getAvailableTransitions from building (multiple exits)
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'building');
  const transitions = getAvailableTransitions(root, 'test-feat');
  const triggers = transitions.map(t => t.trigger);
  assert(triggers.includes('all_tasks_complete') && triggers.includes('critical_failure') && triggers.includes('human_suspend'),
    'v2 available: building shows all_tasks_complete, critical_failure, human_suspend');
  rmSync(root, { recursive: true, force: true });
}

// 31. getAvailableTransitions for nonexistent feature → empty
{
  const root = makeTmpRoot();
  const result = getAvailableTransitions(root, 'nonexistent');
  assert(Array.isArray(result) && result.length === 0,
    'v2 available: nonexistent feature returns empty array');
  rmSync(root, { recursive: true, force: true });
}

// 32. getLifecycleInfo returns full info
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'building', { buildAttempts: 2, version: 5 });
  createFeatureDir(root, 'test-feat');
  const info = getLifecycleInfo(root, 'test-feat');
  assert(info !== null &&
         info.currentState === 'building' &&
         info.buildAttempts === 2 &&
         info.version === 5 &&
         Array.isArray(info.availableTransitions) &&
         info.timeout !== null,
    'v2 lifecycle: getLifecycleInfo returns complete state info');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 7: v2 checkAutoTransitions + mission generation
// ═══════════════════════════════════════════════════════════════════════

// 33. checkAutoTransitions returns null when no auto conditions met
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'building');
  createFeatureDir(root, 'test-feat');
  const result = checkAutoTransitions(root, 'test-feat');
  // Auto conditions return false by default (require Kadima runtime)
  assert(result === null, 'v2 auto: returns null when no auto conditions met');
  rmSync(root, { recursive: true, force: true });
}

// 34. checkAutoTransitions returns null for nonexistent feature
{
  const root = makeTmpRoot();
  const result = checkAutoTransitions(root, 'nonexistent');
  assert(result === null, 'v2 auto: returns null for nonexistent feature');
  rmSync(root, { recursive: true, force: true });
}

// 35. Mission generation on T09 (monitoring → optimizing)
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'monitoring');
  createFeatureDir(root, 'test-feat');
  // T09 requires role kadima, but we use force to bypass guards
  const result = transition(root, 'test-feat', 'optimization_needed', { actor: 'kadima', force: true });
  assert(result.success === true && result.newState === 'optimizing', 'v2 mission: T09 transition succeeds');

  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.pendingMissions && state.pendingMissions.length > 0 &&
         state.pendingMissions[0].type === 'optimization',
    'v2 mission: T09 generates optimization mission');
  rmSync(root, { recursive: true, force: true });
}

// 36. Mission generation on T14 (reviewing → building fix)
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'reviewing');
  createFeatureDir(root, 'test-feat');
  const result = transition(root, 'test-feat', 'gate_failure_fixable', { actor: 'tech-lead', force: true });
  assert(result.success === true && result.newState === 'building', 'v2 mission: T14 transition succeeds');

  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.pendingMissions && state.pendingMissions.some(m => m.type === 'fix'),
    'v2 mission: T14 generates fix mission');
  rmSync(root, { recursive: true, force: true });
}

// 37. Full lifecycle: draft → specced → planned → designed
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'draft');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'QA.md', 'Spec.md', 'Plan.json', 'DESIGN.md']);

  const r1 = transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  assert(r1.success && r1.newState === 'specced', 'v2 lifecycle: draft → specced');

  const r2 = transition(root, 'test-feat', 'plan_complete', { actor: 'architect' });
  assert(r2.success && r2.newState === 'planned', 'v2 lifecycle: specced → planned');

  const r3 = transition(root, 'test-feat', 'design_complete', { actor: 'designer' });
  assert(r3.success && r3.newState === 'designed', 'v2 lifecycle chain: draft → specced → planned → designed');

  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.stateHistory.length === 3, 'v2 lifecycle: 3 transitions recorded in history');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════

console.log('\nState Machine Tests\n');
for (const r of results) console.log(r);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
