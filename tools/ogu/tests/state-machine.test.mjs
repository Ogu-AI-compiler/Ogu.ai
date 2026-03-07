/**
 * State Machine Tests — v1 (createStateMachine) + v2 (feature lifecycle).
 */

import { createStateMachine } from '../commands/lib/state-machine.mjs';
import {
  LIFECYCLE_STATES, TRANSITIONS,
  transition, verifyInvariants, checkTimeout,
  getAvailableTransitions, getLifecycleInfo,
  checkAutoTransitions,
} from '../commands/lib/state-machine-v2.mjs';
import { FeatureStates } from '../../contracts/schemas/feature-state.mjs';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
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
    previousState: 'none',
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
  const dir = join(root, `docs/vault/features/${slug}`);
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

// 6. All contract states defined
{
  const expected = FeatureStates;
  const allPresent = expected.every(s => s in LIFECYCLE_STATES);
  assert(allPresent, 'v2: all contract states are defined');
}

// 7. Each state has invariants and description
{
  const allHaveInvariants = Object.values(LIFECYCLE_STATES).every(s =>
    Array.isArray(s.invariants) && typeof s.description === 'string'
  );
  assert(allHaveInvariants, 'v2: every state has invariants array and description');
}

// 8. Transitions defined
{
  assert(TRANSITIONS.length >= 10, 'v2: at least 10 transitions defined');
}

// 9. human_suspend uses wildcard from='*'
{
  const t = TRANSITIONS.find(t => t.trigger === 'human_suspend');
  assert(t && t.from === '*', 'v2: human_suspend wildcard transition from any state');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: v2 transition() engine
// ═══════════════════════════════════════════════════════════════════════

// 10. Valid transition: specifying → specified
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specifying');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'Spec.md']);

  const result = transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  assert(result.success === true && result.newState === 'specified' && result.previousState === 'specifying',
    'v2 transition: specifying → specified succeeds');
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
  createFeatureState(root, 'test-feat', 'idea');
  const result = transition(root, 'test-feat', 'gates_passed');
  assert(result.success === false && result.error.includes('OGU3701'),
    'v2 transition: invalid trigger returns OGU3701');
  rmSync(root, { recursive: true, force: true });
}

// 13. Role not allowed → error
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specifying');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'Spec.md']);

  const result = transition(root, 'test-feat', 'spec_complete', { actor: 'developer' });
  assert(result.success === false && result.error.includes('OGU3702'),
    'v2 transition: wrong role returns OGU3702');
  rmSync(root, { recursive: true, force: true });
}

// 14. Guard fails when PRD missing
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specifying');
  createFeatureDir(root, 'test-feat', ['Spec.md']); // no PRD.md

  const result = transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  assert(result.success === false && result.error.includes('OGU3703') && result.error.includes('PRD.md'),
    'v2 transition: guard fails when PRD.md missing');
  rmSync(root, { recursive: true, force: true });
}

// 15. Force flag bypasses guards
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specifying');
  createFeatureDir(root, 'test-feat'); // no files

  const result = transition(root, 'test-feat', 'spec_complete', { actor: 'pm', force: true });
  assert(result.success === true && result.newState === 'specified',
    'v2 transition: force=true bypasses guard failures');
  rmSync(root, { recursive: true, force: true });
}

// 16. State history is appended
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specifying');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'Spec.md']);

  transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.stateHistory.length === 1 && state.stateHistory[0].from === 'specifying' && state.stateHistory[0].to === 'specified',
    'v2 transition: state history records transition');
  rmSync(root, { recursive: true, force: true });
}

// 17. Version increments on transition
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specifying', { version: 3 });
  createFeatureDir(root, 'test-feat', ['PRD.md', 'Spec.md']);

  transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.version === 4, 'v2 transition: version increments');
  rmSync(root, { recursive: true, force: true });
}

// 18. buildAttempts increments when entering building state
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'designed', { buildAttempts: 1 });
  createFeatureDir(root, 'test-feat');

  const result = transition(root, 'test-feat', 'first_task_started', { actor: 'kadima' });
  assert(result.success === true, 'v2 transition: designed → building succeeds');
  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.buildAttempts === 2, 'v2 transition: buildAttempts increments when entering building');
  rmSync(root, { recursive: true, force: true });
}

// 19. Wildcard human_suspend from any state
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'building');
  createFeatureDir(root, 'test-feat');

  const result = transition(root, 'test-feat', 'human_suspend', { actor: 'cto' });
  assert(result.success === true && result.newState === 'paused',
    'v2 transition: wildcard human_suspend works from building state');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 4: v2 verifyInvariants
// ═══════════════════════════════════════════════════════════════════════

// 20. Specified state passes when PRD + Spec exist
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specified');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'Spec.md']);
  const result = verifyInvariants(root, 'test-feat');
  assert(result.valid === true, 'v2 invariants: specified passes when PRD/Spec exist');
  rmSync(root, { recursive: true, force: true });
}

// 21. Specified state fails when PRD missing
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specified');
  createFeatureDir(root, 'test-feat', ['Spec.md']);
  const result = verifyInvariants(root, 'test-feat');
  assert(result.valid === false && result.violations.some(v => v.invariant === 'prd_exists'),
    'v2 invariants: specified fails when PRD.md missing');
  rmSync(root, { recursive: true, force: true });
}

// 22. Planned state fails without Plan.json
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'planned');
  createFeatureDir(root, 'test-feat', ['Spec.md']);
  const result = verifyInvariants(root, 'test-feat');
  assert(result.valid === false && result.violations.some(v => v.invariant === 'plan_exists'),
    'v2 invariants: planned fails without Plan.json');
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

// 24. Designed state fails without DESIGN.md
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'designed');
  createFeatureDir(root, 'test-feat', []); // missing DESIGN.md
  const result = verifyInvariants(root, 'test-feat');
  assert(result.valid === false && result.violations.some(v => v.invariant === 'design_exists'),
    'v2 invariants: designed fails when DESIGN.md missing');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 5: v2 checkTimeout
// ═══════════════════════════════════════════════════════════════════════

// 25. No timeout defined for idea state
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'idea');
  const result = checkTimeout(root, 'test-feat');
  assert(result === null, 'v2 timeout: null when state has no timeout defined (idea)');
  rmSync(root, { recursive: true, force: true });
}

// 26. Not timed out — specifying within 72h
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specifying', { enteredAt: new Date().toISOString() });
  const result = checkTimeout(root, 'test-feat');
  assert(result !== null && result.timedOut === false && result.remainingMs > 0,
    'v2 timeout: not timed out when within window');
  rmSync(root, { recursive: true, force: true });
}

// 27. Timed out — specifying for > 72h
{
  const root = makeTmpRoot();
  const enteredAt = new Date(Date.now() - 73 * 3600000).toISOString(); // 73 hours ago
  createFeatureState(root, 'test-feat', 'specifying', { enteredAt });
  const result = checkTimeout(root, 'test-feat');
  assert(result !== null && result.timedOut === true && result.escalation === 'auto_suspend',
    'v2 timeout: timed out after 72h in specifying state → auto_suspend');
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

// 29. getAvailableTransitions from specifying
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specifying');
  const transitions = getAvailableTransitions(root, 'test-feat');
  assert(transitions.some(t => t.trigger === 'specified') &&
         transitions.some(t => t.trigger === 'human_suspend'),
    'v2 available: specifying shows specified + human_suspend');
  rmSync(root, { recursive: true, force: true });
}

// 30. getAvailableTransitions from building (multiple exits)
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'building');
  const transitions = getAvailableTransitions(root, 'test-feat');
  const triggers = transitions.map(t => t.trigger);
  assert(triggers.includes('built') && triggers.includes('gate_failure_fixable') && triggers.includes('human_suspend'),
    'v2 available: building shows built, gate_failure_fixable, human_suspend');
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

// 35. Mission generation on gate_failure_fixable
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'verifying');
  createFeatureDir(root, 'test-feat');
  const result = transition(root, 'test-feat', 'gate_failure_fixable', { actor: 'tech-lead', force: true });
  assert(result.success === true && result.newState === 'building', 'v2 mission: gate_failure_fixable transition succeeds');

  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.pendingMissions && state.pendingMissions.some(m => m.type === 'fix'),
    'v2 mission: gate_failure_fixable generates fix mission');
  rmSync(root, { recursive: true, force: true });
}

// 36. Direct target transition works (specified → planning)
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'specified');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'Spec.md']);
  const result = transition(root, 'test-feat', 'planning', { actor: 'pm' });
  assert(result.success === true && result.newState === 'planning', 'v2 transition: direct target transition works');
  rmSync(root, { recursive: true, force: true });
}

// 37. Full lifecycle slice: idea → specifying → specified → planning → planned
{
  const root = makeTmpRoot();
  createFeatureState(root, 'test-feat', 'idea');
  createFeatureDir(root, 'test-feat', ['PRD.md', 'Spec.md', 'Plan.json']);

  const r1 = transition(root, 'test-feat', 'specifying', { actor: 'pm' });
  assert(r1.success && r1.newState === 'specifying', 'v2 lifecycle: idea → specifying');

  const r2 = transition(root, 'test-feat', 'spec_complete', { actor: 'pm' });
  assert(r2.success && r2.newState === 'specified', 'v2 lifecycle: specifying → specified');

  const r3 = transition(root, 'test-feat', 'planning', { actor: 'pm' });
  assert(r3.success && r3.newState === 'planning', 'v2 lifecycle: specified → planning');

  const r4 = transition(root, 'test-feat', 'plan_complete', { actor: 'architect' });
  assert(r4.success && r4.newState === 'planned', 'v2 lifecycle: planning → planned');

  const state = JSON.parse(readFileSync(join(root, '.ogu/state/features/test-feat.state.json'), 'utf8'));
  assert(state.stateHistory.length === 4, 'v2 lifecycle: 4 transitions recorded in history');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════

console.log('\nState Machine Tests\n');
for (const r of results) console.log(r);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
