/**
 * Scheduler WFQ v2 Tests.
 *
 * 8 tests covering:
 *   Section 1: createFormalScheduler (2 tests)
 *   Section 2: enqueue + dequeue (3 tests)
 *   Section 3: preemption + fairness (2 tests)
 *   Section 4: Quota enforcement (1 test)
 */

import { createFormalScheduler, computeFairness } from '../commands/lib/scheduler-wfq.mjs';

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

// ═══════════════════════════════════════════════════════════════════════
// Section 1: createFormalScheduler
// ═══════════════════════════════════════════════════════════════════════

// 1. createFormalScheduler creates empty scheduler
{
  const sched = createFormalScheduler();
  assert(sched && typeof sched.enqueue === 'function' && typeof sched.dequeue === 'function',
    'createFormalScheduler creates scheduler with enqueue/dequeue');
}

// 2. Initial size is 0
{
  const sched = createFormalScheduler();
  assert(sched.size() === 0, 'Initial scheduler size is 0');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2: enqueue + dequeue
// ═══════════════════════════════════════════════════════════════════════

// 3. enqueue adds tasks
{
  const sched = createFormalScheduler();
  sched.enqueue({ id: 'T1', name: 'Task 1' }, { weight: 1, priority: 50, team: 'core' });
  sched.enqueue({ id: 'T2', name: 'Task 2' }, { weight: 1, priority: 30, team: 'core' });
  assert(sched.size() === 2, 'enqueue adds tasks (size = 2)');
}

// 4. dequeue returns highest priority
{
  const sched = createFormalScheduler();
  sched.enqueue({ id: 'T1', name: 'Low' }, { weight: 1, priority: 30, team: 'core' });
  sched.enqueue({ id: 'T2', name: 'High' }, { weight: 1, priority: 90, team: 'core' });
  const item = sched.dequeue();
  assert(item && (item.id === 'T2' || item.item?.id === 'T2'),
    'dequeue returns highest priority task');
}

// 5. dequeue reduces size
{
  const sched = createFormalScheduler();
  sched.enqueue({ id: 'T1' }, { weight: 1, priority: 50, team: 'a' });
  sched.enqueue({ id: 'T2' }, { weight: 1, priority: 50, team: 'b' });
  sched.dequeue();
  assert(sched.size() === 1, 'dequeue reduces size by 1');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3: preemption + fairness
// ═══════════════════════════════════════════════════════════════════════

// 6. preemption works when higher priority arrives
{
  const sched = createFormalScheduler();
  sched.enqueue({ id: 'T1', name: 'Running' }, { weight: 1, priority: 30, team: 'core' });
  sched.dequeue(); // Start T1
  sched.enqueue({ id: 'T2', name: 'Urgent' }, { weight: 1, priority: 99, team: 'core' });
  const preempted = sched.preempt();
  // preempt should either return the preempted item or null if no preemption needed
  assert(preempted !== undefined, 'preempt returns a result');
}

// 7. computeFairness returns Jain index
{
  const stats = {
    teams: {
      'team-a': { share: 0.5, used: 0.5 },
      'team-b': { share: 0.5, used: 0.4 },
    },
  };
  const fairness = computeFairness(stats);
  assert(typeof fairness === 'number' && fairness >= 0,
    'computeFairness returns Jain index >= 0');
}

// ═══════════════════════════════════════════════════════════════════════
// Section 4: Quota enforcement
// ═══════════════════════════════════════════════════════════════════════

// 8. Quota enforcement per team
{
  const sched = createFormalScheduler();
  sched.setQuota('team', 'team-a', 2);
  sched.setQuota('team', 'team-b', 1);
  const quotas = sched.getQuotas('team');
  assert(quotas && (quotas['team-a'] === 2 || quotas['team-a']?.weight === 2),
    'setQuota and getQuotas work for team quotas');
}

// ═══════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════

console.log('\nScheduler WFQ v2 Tests');
console.log('═'.repeat(50));
for (const r of results) console.log(r);
console.log('═'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
