/**
 * Circuit Breaker + System Halt Tests.
 *
 * 32 tests covering:
 *   Section 1: FAILURE_DOMAINS definitions (3 tests)
 *   Section 2: State management (3 tests)
 *   Section 3: callWithBreaker — closed state (4 tests)
 *   Section 4: callWithBreaker — open + half-open states (5 tests)
 *   Section 5: No circuit breaker domain (FD-AUDIT) (2 tests)
 *   Section 6: resetBreaker + getAllBreakerStatus (3 tests)
 *   Section 7: getProviderHealth + testFailover (2 tests)
 *   Section 8: Legacy createBreaker + createCircuitBreaker (4 tests)
 *   Section 9: System halt (3 tests)
 *   Section 10: System resume + health (3 tests)
 */

import {
  FAILURE_DOMAINS, loadBreakerState, saveBreakerState,
  callWithBreaker, resetBreaker, getAllBreakerStatus,
  getProviderHealth, testFailover,
  BREAKER_STATES, createBreaker, createCircuitBreaker,
} from '../commands/lib/circuit-breaker.mjs';
import { halt, resume, getSystemHealth, getHaltLog } from '../commands/lib/system-halt.mjs';
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
  const root = join(tmpdir(), `ogu-cb-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, '.ogu/state'), { recursive: true });
  mkdirSync(join(root, '.ogu/audit'), { recursive: true });
  mkdirSync(join(root, '.ogu/locks'), { recursive: true });
  // Create STATE.json for system-halt
  writeFileSync(join(root, '.ogu/STATE.json'), JSON.stringify({}), 'utf8');
  return root;
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1: FAILURE_DOMAINS definitions
// ═══════════════════════════════════════════════════════════════════════

// 1. Five failure domains defined
{
  const domains = Object.keys(FAILURE_DOMAINS);
  assert(domains.length === 5 &&
         domains.includes('FD-PROVIDER') && domains.includes('FD-FILESYSTEM') &&
         domains.includes('FD-AUDIT') && domains.includes('FD-BUDGET') &&
         domains.includes('FD-SCHEDULER'),
    'FAILURE_DOMAINS: 5 domains defined (PROVIDER, FILESYSTEM, AUDIT, BUDGET, SCHEDULER)');
}

// 2. FD-AUDIT has no circuit breaker (haltOnFailure = true)
{
  const audit = FAILURE_DOMAINS['FD-AUDIT'];
  assert(audit.circuitBreaker === null && audit.haltOnFailure === true,
    'FD-AUDIT: no circuit breaker, haltOnFailure=true');
}

// 3. FD-PROVIDER has failover chain
{
  const provider = FAILURE_DOMAINS['FD-PROVIDER'];
  assert(Array.isArray(provider.failover.chain) && provider.failover.chain.length >= 3,
    'FD-PROVIDER: failover chain has >= 3 providers');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: State management
// ═══════════════════════════════════════════════════════════════════════

// 4. loadBreakerState returns default when no state file
{
  const root = makeTmpRoot();
  const state = loadBreakerState(root);
  assert(state.version === 1 && typeof state.breakers === 'object',
    'loadBreakerState: default state with empty breakers');
  rmSync(root, { recursive: true, force: true });
}

// 5. saveBreakerState persists state
{
  const root = makeTmpRoot();
  const state = { version: 1, breakers: { 'FD-TEST': { state: 'open' } } };
  saveBreakerState(root, state);
  const loaded = loadBreakerState(root);
  assert(loaded.breakers['FD-TEST']?.state === 'open',
    'saveBreakerState: persists breaker state to disk');
  rmSync(root, { recursive: true, force: true });
}

// 6. BREAKER_STATES constant
{
  assert(BREAKER_STATES.length === 3 &&
         BREAKER_STATES.includes('closed') && BREAKER_STATES.includes('open') &&
         BREAKER_STATES.includes('half-open'),
    'BREAKER_STATES: 3 states (closed, open, half-open)');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: callWithBreaker — closed state
// ═══════════════════════════════════════════════════════════════════════

// 7. Success through closed breaker
{
  const root = makeTmpRoot();
  const result = await callWithBreaker(root, 'FD-PROVIDER', async () => 42);
  assert(result.success === true && result.result === 42 && result.breakerState === 'closed',
    'callWithBreaker: success returns result, stays closed');
  rmSync(root, { recursive: true, force: true });
}

// 8. Single failure stays closed (under threshold)
{
  const root = makeTmpRoot();
  const result = await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('fail'); });
  assert(result.success === false && result.breakerState === 'closed',
    'callWithBreaker: single failure stays closed (threshold=3)');
  rmSync(root, { recursive: true, force: true });
}

// 9. Unknown domain returns error
{
  const root = makeTmpRoot();
  const result = await callWithBreaker(root, 'FD-NONEXISTENT', async () => 1);
  assert(result.success === false && result.error.includes('Unknown failure domain'),
    'callWithBreaker: unknown domain returns error');
  rmSync(root, { recursive: true, force: true });
}

// 10. Trip breaker after threshold failures
{
  const root = makeTmpRoot();
  // FD-PROVIDER threshold = 3
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('1'); });
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('2'); });
  const result = await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('3'); });
  assert(result.success === false && result.breakerState === 'open' && result.tripped === true,
    'callWithBreaker: trips open after 3 failures (FD-PROVIDER threshold)');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 4: callWithBreaker — open + half-open states
// ═══════════════════════════════════════════════════════════════════════

// 11. Open breaker rejects calls
{
  const root = makeTmpRoot();
  // Force breaker open
  const state = loadBreakerState(root);
  state.breakers['FD-PROVIDER'] = {
    domainId: 'FD-PROVIDER', state: 'open',
    failures: [], lastFailure: null, lastSuccess: null,
    openedAt: new Date().toISOString(), halfOpenAt: null,
    totalFailures: 3, totalSuccesses: 0, totalTrips: 1,
  };
  saveBreakerState(root, state);

  const result = await callWithBreaker(root, 'FD-PROVIDER', async () => 42);
  assert(result.success === false && result.breakerState === 'open' && result.retryAfterMs > 0,
    'callWithBreaker: open breaker rejects with retryAfterMs');
  rmSync(root, { recursive: true, force: true });
}

// 12. Open breaker transitions to half-open after cooldown
{
  const root = makeTmpRoot();
  // Force breaker open with cooldown expired
  const state = loadBreakerState(root);
  state.breakers['FD-PROVIDER'] = {
    domainId: 'FD-PROVIDER', state: 'open',
    failures: [], lastFailure: null, lastSuccess: null,
    openedAt: new Date(Date.now() - 200000).toISOString(), // 200s ago (cooldown is 120s)
    halfOpenAt: null,
    totalFailures: 3, totalSuccesses: 0, totalTrips: 1,
  };
  saveBreakerState(root, state);

  const result = await callWithBreaker(root, 'FD-PROVIDER', async () => 'recovered');
  assert(result.success === true && result.breakerState === 'closed' && result.recovered === true,
    'callWithBreaker: open → half-open → closed on success after cooldown');
  rmSync(root, { recursive: true, force: true });
}

// 13. Half-open probe failure re-opens breaker
{
  const root = makeTmpRoot();
  // Force half-open state with cooldown expired
  const state = loadBreakerState(root);
  state.breakers['FD-PROVIDER'] = {
    domainId: 'FD-PROVIDER', state: 'open',
    failures: [], lastFailure: null, lastSuccess: null,
    openedAt: new Date(Date.now() - 200000).toISOString(),
    halfOpenAt: null,
    totalFailures: 3, totalSuccesses: 0, totalTrips: 1,
  };
  saveBreakerState(root, state);

  const result = await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('still failing'); });
  assert(result.success === false && result.breakerState === 'open' && result.tripped === true,
    'callWithBreaker: half-open probe failure re-opens breaker');
  rmSync(root, { recursive: true, force: true });
}

// 14. Successful call resets failure count
{
  const root = makeTmpRoot();
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('1'); });
  await callWithBreaker(root, 'FD-PROVIDER', async () => 'ok'); // success resets
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('2'); });
  // Should still be closed — previous success "reset" the failure window
  const state = loadBreakerState(root);
  assert(state.breakers['FD-PROVIDER'].state === 'closed',
    'callWithBreaker: success between failures keeps breaker closed');
  rmSync(root, { recursive: true, force: true });
}

// 15. totalTrips increments on each trip
{
  const root = makeTmpRoot();
  // Trip breaker
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('1'); });
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('2'); });
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('3'); });

  const state = loadBreakerState(root);
  assert(state.breakers['FD-PROVIDER'].totalTrips === 1 &&
         state.breakers['FD-PROVIDER'].totalFailures === 3,
    'callWithBreaker: totalTrips=1 and totalFailures=3 after first trip');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 5: No circuit breaker domain (FD-AUDIT)
// ═══════════════════════════════════════════════════════════════════════

// 16. FD-AUDIT success passes through directly
{
  const root = makeTmpRoot();
  const result = await callWithBreaker(root, 'FD-AUDIT', async () => 'audit-ok');
  assert(result.success === true && result.result === 'audit-ok' && result.breakerState === 'none',
    'FD-AUDIT: success passes through with breakerState=none');
  rmSync(root, { recursive: true, force: true });
}

// 17. FD-AUDIT failure triggers halt action
{
  const root = makeTmpRoot();
  const result = await callWithBreaker(root, 'FD-AUDIT', async () => { throw new Error('audit fail'); });
  assert(result.success === false && result.action === 'halt_system' &&
         result.reason.includes('system halt'),
    'FD-AUDIT: failure triggers halt_system action');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 6: resetBreaker + getAllBreakerStatus
// ═══════════════════════════════════════════════════════════════════════

// 18. resetBreaker closes an open breaker
{
  const root = makeTmpRoot();
  // Trip the breaker
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('1'); });
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('2'); });
  await callWithBreaker(root, 'FD-PROVIDER', async () => { throw new Error('3'); });

  const result = resetBreaker(root, 'FD-PROVIDER');
  assert(result.previousState === 'open' && result.newState === 'closed',
    'resetBreaker: closes open breaker, returns previous state');
  rmSync(root, { recursive: true, force: true });
}

// 19. getAllBreakerStatus returns all 5 domains
{
  const root = makeTmpRoot();
  const statuses = getAllBreakerStatus(root);
  assert(statuses.length === 5 && statuses.every(s => s.domainId && s.name),
    'getAllBreakerStatus: returns status for all 5 failure domains');
  rmSync(root, { recursive: true, force: true });
}

// 20. getAllBreakerStatus shows domain details
{
  const root = makeTmpRoot();
  const statuses = getAllBreakerStatus(root);
  const provider = statuses.find(s => s.domainId === 'FD-PROVIDER');
  assert(provider.hasBreaker === true && provider.haltOnFailure === false &&
         provider.failoverStrategy === 'next_provider_same_capability',
    'getAllBreakerStatus: shows hasBreaker, haltOnFailure, failoverStrategy');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 7: getProviderHealth + testFailover
// ═══════════════════════════════════════════════════════════════════════

// 21. getProviderHealth returns FD-PROVIDER status
{
  const root = makeTmpRoot();
  const health = getProviderHealth(root);
  assert(health.domain === 'Model Provider' && Array.isArray(health.failoverChain) &&
         health.circuit.threshold === 3,
    'getProviderHealth: returns domain name, failover chain, circuit config');
  rmSync(root, { recursive: true, force: true });
}

// 22. testFailover runs dry-run simulation
{
  const root = makeTmpRoot();
  const result = testFailover(root, 'FD-PROVIDER');
  assert(result.dryRun === true && result.results.length >= 3 &&
         result.results[0].status === 'simulated_ok',
    'testFailover: dry-run simulation returns results for failover chain');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 8: Legacy createBreaker + createCircuitBreaker
// ═══════════════════════════════════════════════════════════════════════

// 23. createBreaker returns struct
{
  const b = createBreaker({ name: 'test', threshold: 5, resetTimeMs: 30000 });
  assert(b.name === 'test' && b.state === 'closed' && b.threshold === 5,
    'Legacy createBreaker: returns initial struct');
}

// 24. createCircuitBreaker execute success → closed
{
  const cb = createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  const result = cb.execute(() => 42);
  assert(result.executed === true && result.value === 42 && result.state === 'closed',
    'Legacy createCircuitBreaker: execute success stays closed');
}

// 25. createCircuitBreaker trips after failureThreshold
{
  const cb = createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
  cb.execute(() => { throw new Error('1'); });
  cb.execute(() => { throw new Error('2'); });
  const result = cb.execute(() => 42);
  assert(result.executed === false && result.rejected === true && result.state === 'open',
    'Legacy createCircuitBreaker: rejects after threshold trips');
}

// 26. createCircuitBreaker getState
{
  const cb = createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  const s = cb.getState();
  assert(s.state === 'closed' && s.failures === 0 && s.failureThreshold === 3,
    'Legacy createCircuitBreaker: getState returns current stats');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 9: System halt
// ═══════════════════════════════════════════════════════════════════════

// 27. halt sets STATE.json as halted + frozen
{
  const root = makeTmpRoot();
  const result = halt(root, { reason: 'test halt', actor: 'admin' });
  assert(result.halted === true, 'system halt: returns halted=true');

  const state = JSON.parse(readFileSync(join(root, '.ogu/STATE.json'), 'utf8'));
  assert(state.halted === true && state.frozen === true && state.haltRecord.reason === 'test halt',
    'system halt: STATE.json marked halted+frozen with halt record');
  rmSync(root, { recursive: true, force: true });
}

// 28. Double halt returns already halted
{
  const root = makeTmpRoot();
  halt(root, { reason: 'first halt' });
  const result = halt(root, { reason: 'second halt' });
  assert(result.halted === false && result.reason === 'System already halted',
    'system halt: double halt returns already halted');
  rmSync(root, { recursive: true, force: true });
}

// 29. halt creates halt log entry
{
  const root = makeTmpRoot();
  halt(root, { reason: 'logged halt', actor: 'test' });
  const log = getHaltLog(root);
  assert(log.length === 1 && log[0].action === 'halt' && log[0].reason === 'logged halt',
    'system halt: creates halt log entry');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Section 10: System resume + health
// ═══════════════════════════════════════════════════════════════════════

// 30. resume without actor fails
{
  const root = makeTmpRoot();
  halt(root, { reason: 'test halt' });
  const result = resume(root, {});
  assert(result.resumed === false && result.reason.includes('actor'),
    'system resume: fails without actor identification');
  rmSync(root, { recursive: true, force: true });
}

// 31. resume succeeds with actor
{
  const root = makeTmpRoot();
  halt(root, { reason: 'test halt' });
  const result = resume(root, { actor: 'cto' });
  assert(result.resumed === true, 'system resume: succeeds with actor');

  const state = JSON.parse(readFileSync(join(root, '.ogu/STATE.json'), 'utf8'));
  assert(state.halted === false && state.frozen === false,
    'system resume: clears halted and frozen flags');
  rmSync(root, { recursive: true, force: true });
}

// 32. getSystemHealth returns HEALTHY when not halted
{
  const root = makeTmpRoot();
  const health = getSystemHealth(root);
  assert(health.overallHealth === 'HEALTHY' && health.halted === false,
    'getSystemHealth: HEALTHY when not halted');
  rmSync(root, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════

console.log('\nCircuit Breaker + System Halt Tests\n');
for (const r of results) console.log(r);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
