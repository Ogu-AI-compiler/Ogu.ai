/**
 * Scheduler — Weighted Fair Queuing with Priority Classes.
 *
 * Algorithm: WFQ with 5 priority classes (P0-P4).
 * Fairness: Virtual clocks per feature — lowest clock gets scheduled next.
 * Starvation: Tasks waiting > maxWait get promoted (up to 2 promotions).
 * Preemption: P0 can preempt P3/P4. P1 can preempt old P2.
 * Quotas: Per-team + per-feature limits prevent monopolization.
 *
 * State file: .ogu/state/scheduler-state.json
 * Policy file: .ogu/scheduler-policy.json
 *
 * Also re-exports legacy createScheduler/PRIORITY_CLASSES from formal-scheduler.mjs.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';
import { resourceStatus, releaseResource } from './resource-governor.mjs';
import { checkEnvelope } from './feature-isolation.mjs';
import { getCheckpointsDir, getLocksDir, getStateDir, resolveOguPath } from './runtime-paths.mjs';

const STATE_PATH = (root) => join(getStateDir(root), 'scheduler-state.json');
const POLICY_PATH = (root) => resolveOguPath(root, 'scheduler-policy.json');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Default Policy ───────────────────────────────────────────────────

const DEFAULT_POLICY = {
  $schema: 'SchedulerPolicy/1.0',
  algorithm: 'Weighted Fair Queuing with Priority Classes',

  priorityClasses: [
    { class: 'P0-critical', range: [90, 100], preemptible: false, maxWaitMs: 0, guaranteedSlots: 1 },
    { class: 'P1-high',     range: [70, 89],  preemptible: false, maxWaitMs: 60000, guaranteedSlots: 0 },
    { class: 'P2-normal',   range: [40, 69],  preemptible: true,  maxWaitMs: 300000, guaranteedSlots: 0 },
    { class: 'P3-low',      range: [10, 39],  preemptible: true,  maxWaitMs: 600000, guaranteedSlots: 0 },
    { class: 'P4-background', range: [0, 9],  preemptible: true,  maxWaitMs: null, guaranteedSlots: 0 },
  ],

  fairness: {
    algorithm: 'WFQ',
    defaultWeight: 1.0,
    overrides: [
      { condition: 'feature.state==reviewing', weight: 1.5, reason: 'Almost done — accelerate' },
      { condition: 'feature.budget.remaining<0.2', weight: 0.5, reason: 'Low budget — slow down' },
      { condition: 'feature.failures.consecutive>=2', weight: 0.3, reason: 'Failing — reduce allocation' },
    ],
    tieBreaker: 'alphabetical',
  },

  starvationPrevention: {
    maxWaitBeforePromotion: { 'P3-low': 600000, 'P2-normal': 300000 },
    promotionStep: 10,
    maxPromotions: 2,
  },

  preemption: {
    enabled: true,
    rules: [
      {
        condition: 'incoming.class==P0-critical AND no_slots',
        action: 'preempt_lowest',
        target: 'P3-low or P4-background',
      },
      {
        condition: 'incoming.class==P1-high AND no_slots AND oldest_P2>600000',
        action: 'preempt_oldest_P2',
        target: 'P2 running longest',
      },
    ],
    neverPreempt: ['commit_phase', 'under_30s_remaining', 'mutex_resource'],
  },

  teamQuotas: [
    { teamId: 'engineering', maxConcurrentAgents: 4, maxDailyBudget: 500 },
    { teamId: 'product', maxConcurrentAgents: 1, maxDailyBudget: 100 },
    { teamId: 'quality', maxConcurrentAgents: 2, maxDailyBudget: 200 },
  ],

  featureQuotas: {
    maxConcurrentFeaturesBuilding: 5,
    maxConcurrentFeaturesReviewing: 3,
    maxTotalActiveFeatures: 10,
  },
};

// ── State Management ─────────────────────────────────────────────────

export function loadSchedulerState(root) {
  root = root || repoRoot();
  const path = STATE_PATH(root);
  if (!existsSync(path)) {
    return { version: 2, queue: [], virtualClocks: {}, updatedAt: new Date().toISOString() };
  }
  try {
    const state = JSON.parse(readFileSync(path, 'utf8'));
    if (!state.virtualClocks) state.virtualClocks = {};
    if (!state.queue) state.queue = [];
    return state;
  } catch { return { version: 2, queue: [], virtualClocks: {}, updatedAt: new Date().toISOString() }; }
}

export function saveSchedulerState(root, state) {
  root = root || repoRoot();
  state.updatedAt = new Date().toISOString();
  ensureDir(getStateDir(root));
  writeFileSync(STATE_PATH(root), JSON.stringify(state, null, 2), 'utf8');
}

export function loadSchedulerPolicy(root) {
  root = root || repoRoot();
  const path = POLICY_PATH(root);
  if (existsSync(path)) {
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { /* fall through */ }
  }
  return DEFAULT_POLICY;
}

export function saveSchedulerPolicy(root, policy) {
  root = root || repoRoot();
  writeFileSync(POLICY_PATH(root), JSON.stringify(policy, null, 2), 'utf8');
}

// ── Core: Schedule Next Task ─────────────────────────────────────────

/**
 * Schedule the next task from the global queue.
 * Returns the task to execute, or null if nothing can run.
 *
 * Algorithm: WFQ with Priority Classes.
 * 1. Apply starvation prevention
 * 2. Sort by priority class DESC, then virtual clock ASC
 * 3. Check quotas and envelopes
 * 4. Advance virtual clock for scheduled feature
 */
export function scheduleNext(root) {
  root = root || repoRoot();
  const policy = loadSchedulerPolicy(root);
  const state = loadSchedulerState(root);

  // Filter to pending, unblocked tasks
  const pendingTasks = state.queue.filter(t =>
    t.status === 'pending' &&
    (!t.blockedBy || t.blockedBy.length === 0)
  );

  if (pendingTasks.length === 0) return null;

  // Step 1: Starvation prevention
  applyStarvationPrevention(root, pendingTasks, policy);

  // Step 2: Sort — priority class DESC, then virtual clock ASC, then alphabetical
  pendingTasks.sort((a, b) => {
    const classA = getPriorityClass(a.priority || 50, policy);
    const classB = getPriorityClass(b.priority || 50, policy);

    // Higher priority class first (higher range[0] = higher priority)
    if (classA.range[0] !== classB.range[0]) {
      return classB.range[0] - classA.range[0];
    }

    // Same class: lowest virtual clock wins (fairness)
    const vtA = state.virtualClocks[a.featureSlug] || 0;
    const vtB = state.virtualClocks[b.featureSlug] || 0;
    if (vtA !== vtB) return vtA - vtB;

    // Tiebreaker: alphabetical slug (deterministic)
    return (a.featureSlug || '').localeCompare(b.featureSlug || '');
  });

  // Step 3: Find first task that can run
  for (const task of pendingTasks) {
    // Check team quota
    if (!checkTeamQuota(root, task, policy, state)) continue;

    // Check feature quota
    if (!checkFeatureQuota(root, task, policy, state)) continue;

    // Check resource availability
    let resourceAvailable = true;
    try {
      const resources = resourceStatus(root);
      const resType = task.resourceType || 'model_call';
      const res = resources.find(r => r.type === resType);
      if (res && res.available <= 0) {
        // Try preemption for P0/P1
        if (policy.preemption.enabled) {
          const preempted = attemptPreemption(root, task, policy, state);
          if (!preempted) resourceAvailable = false;
        } else {
          resourceAvailable = false;
        }
      }
    } catch { /* resource-governor error — allow task */ }

    if (!resourceAvailable) continue;

    // Check feature envelope (budget)
    try {
      const envelopeResult = checkEnvelope(root, task.featureSlug, {
        taskCost: task.estimatedCost || 0,
        resourceType: task.resourceType || 'model_call',
      });
      if (!envelopeResult.allowed) continue;
    } catch { /* feature-isolation error — allow task */ }

    // Task can run — advance virtual clock
    const weight = getFeatureWeight(root, task.featureSlug, policy);
    state.virtualClocks[task.featureSlug] =
      (state.virtualClocks[task.featureSlug] || 0) + (1.0 / weight);

    // Mark as scheduled in queue
    const queueTask = state.queue.find(t => t.taskId === task.taskId);
    if (queueTask) {
      queueTask.status = 'scheduled';
      queueTask.scheduledAt = new Date().toISOString();
    }

    saveSchedulerState(root, state);

    const priorityClass = getPriorityClass(task.priority || 50, policy);

    emitAudit('scheduler.scheduled', {
      taskId: task.taskId,
      featureSlug: task.featureSlug,
      priority: task.priority,
      priorityClass: priorityClass.class,
      virtualClock: state.virtualClocks[task.featureSlug],
      weight,
    }, {});

    return task;
  }

  return null; // Nothing can run right now
}

// ── Enqueue ──────────────────────────────────────────────────────────

/**
 * Add a task to the scheduler queue.
 */
export function enqueueTask(root, { taskId, featureSlug, priority, estimatedCost, resourceType, blockedBy, taskSpec, teamId }) {
  root = root || repoRoot();
  const state = loadSchedulerState(root);

  // Skip if already in queue
  if (state.queue.find(t => t.taskId === taskId)) {
    return { enqueued: false, reason: 'already in queue' };
  }

  state.queue.push({
    taskId,
    featureSlug,
    status: 'pending',
    priority: priority || 50,
    estimatedCost: estimatedCost || 0,
    resourceType: resourceType || 'model_call',
    blockedBy: blockedBy || [],
    enqueuedAt: new Date().toISOString(),
    promotions: 0,
    teamId: teamId || null,
    taskSpec: taskSpec || null,
  });

  saveSchedulerState(root, state);

  emitAudit('scheduler.enqueued', { taskId, featureSlug, priority: priority || 50 }, {});

  return { enqueued: true, position: state.queue.filter(t => t.status === 'pending').length };
}

/**
 * Mark a task as completed and unblock dependents.
 */
export function completeTask(root, taskId) {
  root = root || repoRoot();
  const state = loadSchedulerState(root);
  const task = state.queue.find(t => t.taskId === taskId);
  if (task) {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
  }

  // Unblock dependents
  for (const t of state.queue) {
    if (t.blockedBy) {
      t.blockedBy = t.blockedBy.filter(dep => dep !== taskId);
    }
  }

  saveSchedulerState(root, state);
}

// ── Starvation Prevention ────────────────────────────────────────────

function applyStarvationPrevention(root, tasks, policy) {
  const now = Date.now();

  for (const task of tasks) {
    const waitMs = now - new Date(task.enqueuedAt).getTime();
    const cls = getPriorityClass(task.priority || 50, policy);
    const maxWait = policy.starvationPrevention.maxWaitBeforePromotion[cls.class];

    if (maxWait && waitMs > maxWait && (task.promotions || 0) < policy.starvationPrevention.maxPromotions) {
      const oldPriority = task.priority;
      task.priority = Math.min((task.priority || 50) + policy.starvationPrevention.promotionStep, 89);
      task.promotions = (task.promotions || 0) + 1;

      emitAudit('scheduler.promoted', {
        taskId: task.taskId,
        oldPriority,
        newPriority: task.priority,
        waitMs,
        promotionCount: task.promotions,
        reason: 'starvation_prevention',
      }, {});
    }
  }
}

// ── Preemption ───────────────────────────────────────────────────────

function attemptPreemption(root, incomingTask, policy, state) {
  const incomingClass = getPriorityClass(incomingTask.priority || 50, policy);

  // Only P0 and P1 can preempt
  if (incomingClass.range[0] < 70) return false;

  // Find running tasks (scheduled but not completed)
  const running = state.queue.filter(t => t.status === 'scheduled' || t.status === 'dispatched');
  if (running.length === 0) return false;

  // Sort running by priority ASC (lowest first = best victim)
  running.sort((a, b) => (a.priority || 50) - (b.priority || 50));

  for (const victim of running) {
    const victimClass = getPriorityClass(victim.priority || 50, policy);

    // Can only preempt preemptible classes
    if (!victimClass.preemptible) continue;

    // Never preempt tasks in commit phase
    if (victim.phase === 'commit') continue;

    // P0 can preempt P3/P4
    if (incomingClass.range[0] >= 90 && victimClass.range[1] <= 39) {
      preemptVictim(root, victim, incomingTask, state);
      return true;
    }

    // P1 can preempt old P2 (running > 10 min)
    if (incomingClass.range[0] >= 70 && victimClass.range[0] >= 40 && victimClass.range[1] <= 69) {
      const runningMs = Date.now() - new Date(victim.scheduledAt || victim.enqueuedAt).getTime();
      if (runningMs > 600000) {
        preemptVictim(root, victim, incomingTask, state);
        return true;
      }
    }
  }

  return false;
}

/**
 * Preempt a victim task: checkpoint state, release resource slot, requeue as pending.
 */
function preemptVictim(root, victim, incomingTask, state) {
  // Checkpoint: save victim's progress to a checkpoint file
  try {
    const checkpointDir = getCheckpointsDir(root);
    ensureDir(checkpointDir);
    writeFileSync(
      join(checkpointDir, `${victim.taskId}.checkpoint.json`),
      JSON.stringify({
        taskId: victim.taskId,
        featureSlug: victim.featureSlug,
        preemptedAt: new Date().toISOString(),
        preemptedBy: incomingTask.taskId,
        previousStatus: victim.status,
        scheduledAt: victim.scheduledAt,
      }, null, 2),
      'utf8'
    );
  } catch { /* checkpoint is best-effort */ }

  // Release resource slot if the victim holds one
  try {
    const activePath = join(getLocksDir(root), 'active.json');
    if (existsSync(activePath)) {
      const active = JSON.parse(readFileSync(activePath, 'utf8'));
      const slot = (active.slots || []).find(s => s.taskId === victim.taskId);
      if (slot) {
        releaseResource(root, slot.id);
      }
    }
  } catch { /* resource release best-effort */ }

  // Requeue as pending
  victim.status = 'pending';
  victim.preemptedAt = new Date().toISOString();
  victim.preemptedBy = incomingTask.taskId;
  // Re-enqueue time stays original (preserves starvation clock)

  saveSchedulerState(root, state);

  emitAudit('scheduler.preempted', {
    preemptedTask: victim.taskId,
    byTask: incomingTask.taskId,
    victimPriority: victim.priority,
    incomingPriority: incomingTask.priority,
    checkpointed: true,
    resourceReleased: true,
  }, {});
}

// ── Quotas ───────────────────────────────────────────────────────────

function checkTeamQuota(root, task, policy, state) {
  if (!task.teamId || !policy.teamQuotas?.length) return true;

  const quota = policy.teamQuotas.find(q => q.teamId === task.teamId);
  if (!quota) return true;

  const activeForTeam = state.queue.filter(t =>
    t.teamId === task.teamId &&
    (t.status === 'scheduled' || t.status === 'dispatched')
  ).length;

  return activeForTeam < quota.maxConcurrentAgents;
}

function checkFeatureQuota(root, task, policy, state) {
  if (!policy.featureQuotas) return true;

  const activeFeatures = new Set(
    state.queue
      .filter(t => t.status === 'scheduled' || t.status === 'dispatched')
      .map(t => t.featureSlug)
  );

  // If this feature already has active tasks, it's fine
  if (activeFeatures.has(task.featureSlug)) return true;

  // Check if adding a new feature would exceed total limit
  return activeFeatures.size < (policy.featureQuotas.maxTotalActiveFeatures || 10);
}

// ── Priority & Weight Helpers ────────────────────────────────────────

export function getPriorityClass(priority, policy) {
  policy = policy || DEFAULT_POLICY;
  return policy.priorityClasses.find(c => priority >= c.range[0] && priority <= c.range[1])
    || policy.priorityClasses[policy.priorityClasses.length - 1];
}

function getFeatureWeight(root, featureSlug, policy) {
  let weight = policy.fairness.defaultWeight || 1.0;

  // Check feature state for weight overrides
  try {
    const statePath = join(getStateDir(root), 'features', `${featureSlug}.state.json`);
    if (existsSync(statePath)) {
      const featureState = JSON.parse(readFileSync(statePath, 'utf8'));
      for (const override of (policy.fairness.overrides || [])) {
        if (evaluateWeightCondition(featureState, override.condition)) {
          weight = override.weight;
        }
      }
    }
  } catch { /* skip — use default weight */ }

  return weight;
}

function evaluateWeightCondition(featureState, condition) {
  if (!condition) return false;
  // Simple condition evaluation: "feature.state==reviewing"
  if (condition.includes('feature.state==')) {
    const target = condition.split('==')[1];
    return (featureState.currentState || featureState.state) === target;
  }
  if (condition.includes('feature.budget.remaining<')) {
    const threshold = parseFloat(condition.split('<')[1]);
    const budget = featureState.budget || {};
    const remaining = budget.remaining || 1;
    const max = budget.maxTotalCost || 1;
    return (remaining / max) < threshold;
  }
  if (condition.includes('feature.failures.consecutive>=')) {
    const threshold = parseInt(condition.split('>=')[1]);
    return (featureState.consecutiveFailures || 0) >= threshold;
  }
  return false;
}

// ── Status & Query Functions ─────────────────────────────────────────

/**
 * Get full scheduler status for CLI display.
 */
export function getSchedulerStatus(root) {
  root = root || repoRoot();
  const policy = loadSchedulerPolicy(root);
  const state = loadSchedulerState(root);

  const pending = state.queue.filter(t => t.status === 'pending');
  const scheduled = state.queue.filter(t => t.status === 'scheduled' || t.status === 'dispatched');
  const completed = state.queue.filter(t => t.status === 'completed');

  // Per-class breakdown
  const classCounts = {};
  for (const cls of policy.priorityClasses) {
    const classQueued = pending.filter(t => {
      const tc = getPriorityClass(t.priority || 50, policy);
      return tc.class === cls.class;
    });
    const classRunning = scheduled.filter(t => {
      const tc = getPriorityClass(t.priority || 50, policy);
      return tc.class === cls.class;
    });
    const promoted = classQueued.filter(t => (t.promotions || 0) > 0);

    let maxWait = null;
    if (classQueued.length > 0) {
      const oldest = classQueued.reduce((min, t) =>
        new Date(t.enqueuedAt) < new Date(min.enqueuedAt) ? t : min
      );
      maxWait = Date.now() - new Date(oldest.enqueuedAt).getTime();
    }

    classCounts[cls.class] = {
      queued: classQueued.length,
      running: classRunning.length,
      maxWaitMs: maxWait,
      promoted: promoted.length,
    };
  }

  // Virtual clocks per feature
  const featureFairness = {};
  const featureSlugs = [...new Set(state.queue.map(t => t.featureSlug).filter(Boolean))];
  for (const slug of featureSlugs) {
    const weight = getFeatureWeight(root, slug, policy);
    const queued = state.queue.filter(t => t.featureSlug === slug && t.status === 'pending').length;
    const run = state.queue.filter(t => t.featureSlug === slug && (t.status === 'scheduled' || t.status === 'dispatched')).length;
    featureFairness[slug] = {
      virtualClock: state.virtualClocks[slug] || 0,
      weight,
      queued,
      running: run,
    };
  }

  // Team quotas
  const teamStatus = {};
  for (const quota of (policy.teamQuotas || [])) {
    const active = scheduled.filter(t => t.teamId === quota.teamId).length;
    teamStatus[quota.teamId] = {
      active,
      max: quota.maxConcurrentAgents,
      maxDailyBudget: quota.maxDailyBudget,
    };
  }

  return {
    totalPending: pending.length,
    totalScheduled: scheduled.length,
    totalCompleted: completed.length,
    totalInQueue: state.queue.length,
    classCounts,
    featureFairness,
    teamStatus,
    algorithm: policy.algorithm,
  };
}

/**
 * Get the pending task queue for CLI display.
 */
export function getSchedulerQueue(root) {
  root = root || repoRoot();
  const policy = loadSchedulerPolicy(root);
  const state = loadSchedulerState(root);

  return state.queue
    .filter(t => t.status === 'pending')
    .map(t => ({
      taskId: t.taskId,
      featureSlug: t.featureSlug,
      priority: t.priority || 50,
      priorityClass: getPriorityClass(t.priority || 50, policy).class,
      enqueuedAt: t.enqueuedAt,
      waitMs: Date.now() - new Date(t.enqueuedAt).getTime(),
      promotions: t.promotions || 0,
      blockedBy: t.blockedBy || [],
      teamId: t.teamId,
    }))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Simulate scheduling N tasks (dry-run for testing).
 */
export function simulateScheduling(root, { taskCount = 10 } = {}) {
  root = root || repoRoot();
  const policy = loadSchedulerPolicy(root);
  const state = loadSchedulerState(root);

  // Create simulated tasks
  const simTasks = [];
  for (let i = 0; i < taskCount; i++) {
    const priority = Math.floor(Math.random() * 100);
    const featureSlug = `sim-feature-${(i % 3) + 1}`;
    simTasks.push({
      taskId: `sim-task-${i}`,
      featureSlug,
      status: 'pending',
      priority,
      enqueuedAt: new Date(Date.now() - Math.random() * 600000).toISOString(),
      promotions: 0,
      blockedBy: [],
    });
  }

  // Run through scheduling algorithm (dry-run)
  const scheduled = [];
  const simState = { ...state, queue: simTasks, virtualClocks: {} };
  const simPending = [...simTasks];

  for (let round = 0; round < Math.min(taskCount, 20); round++) {
    if (simPending.filter(t => t.status === 'pending').length === 0) break;

    applyStarvationPrevention(root, simPending.filter(t => t.status === 'pending'), policy);

    simPending.sort((a, b) => {
      const classA = getPriorityClass(a.priority, policy);
      const classB = getPriorityClass(b.priority, policy);
      if (classA.range[0] !== classB.range[0]) return classB.range[0] - classA.range[0];
      const vtA = simState.virtualClocks[a.featureSlug] || 0;
      const vtB = simState.virtualClocks[b.featureSlug] || 0;
      if (vtA !== vtB) return vtA - vtB;
      return a.featureSlug.localeCompare(b.featureSlug);
    });

    const next = simPending.find(t => t.status === 'pending');
    if (next) {
      next.status = 'scheduled';
      const weight = policy.fairness.defaultWeight || 1.0;
      simState.virtualClocks[next.featureSlug] = (simState.virtualClocks[next.featureSlug] || 0) + (1.0 / weight);
      scheduled.push({
        round,
        taskId: next.taskId,
        featureSlug: next.featureSlug,
        priority: next.priority,
        priorityClass: getPriorityClass(next.priority, policy).class,
        virtualClock: simState.virtualClocks[next.featureSlug],
      });
    }
  }

  return {
    simulated: true,
    taskCount,
    scheduledOrder: scheduled,
    finalVirtualClocks: simState.virtualClocks,
  };
}

// ── Legacy Re-exports ────────────────────────────────────────────────

export const PRIORITY_CLASSES = {
  critical: { level: 3, weight: 8, description: 'Urgent, blocks everything' },
  high:     { level: 2, weight: 4, description: 'Important, should run soon' },
  normal:   { level: 1, weight: 2, description: 'Standard priority' },
  low:      { level: 0, weight: 1, description: 'Background, can wait' },
};

export function createScheduler({ starvationThreshold = 10 } = {}) {
  const queue = [];
  return {
    enqueue(item) {
      queue.push({
        ...item,
        priority: item.priority || 'normal',
        enqueuedAt: item.enqueuedAt || Date.now(),
        promotedFrom: null,
      });
    },
    dequeue() {
      if (queue.length === 0) return null;
      queue.sort((a, b) => {
        const pa = PRIORITY_CLASSES[a.priority]?.level ?? 1;
        const pb = PRIORITY_CLASSES[b.priority]?.level ?? 1;
        if (pa !== pb) return pb - pa;
        return a.enqueuedAt - b.enqueuedAt;
      });
      return queue.shift();
    },
    peek() {
      if (queue.length === 0) return null;
      queue.sort((a, b) => {
        const pa = PRIORITY_CLASSES[a.priority]?.level ?? 1;
        const pb = PRIORITY_CLASSES[b.priority]?.level ?? 1;
        if (pa !== pb) return pb - pa;
        return a.enqueuedAt - b.enqueuedAt;
      });
      return queue[0];
    },
    size() { return queue.length; },
    checkStarvation() {
      const now = Date.now();
      for (const item of queue) {
        const waitTime = now - item.enqueuedAt;
        if (waitTime > starvationThreshold * 1000 && item.priority === 'low') {
          item.promotedFrom = item.priority;
          item.priority = 'high';
        } else if (waitTime > starvationThreshold * 2000 && item.priority === 'normal') {
          item.promotedFrom = item.priority;
          item.priority = 'critical';
        }
      }
    },
  };
}

export function computeWFQWeights(counts) {
  const totalWeight = Object.entries(counts).reduce((sum, [cls, count]) => {
    return sum + count * (PRIORITY_CLASSES[cls]?.weight || 1);
  }, 0);
  const weights = {};
  for (const [cls, count] of Object.entries(counts)) {
    const classWeight = PRIORITY_CLASSES[cls]?.weight || 1;
    weights[cls] = totalWeight > 0 ? (count * classWeight) / totalWeight : 0;
  }
  return weights;
}
