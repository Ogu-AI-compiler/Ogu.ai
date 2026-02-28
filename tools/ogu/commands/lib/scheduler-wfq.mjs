/**
 * Scheduler WFQ — Weighted Fair Queueing with starvation prevention,
 * virtual clock, team/feature quotas, preemption, and disk persistence.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

// ---------------------------------------------------------------------------
// Legacy API — kept for backwards compatibility
// ---------------------------------------------------------------------------

/**
 * Create a WFQ (Weighted Fair Queueing) scheduler.
 *
 * @returns {object} Scheduler with enqueue/dequeue/peek/size/getStats
 */
export function createWFQScheduler() {
  const queue = []; // { item, weight }

  function enqueue(item, { weight = 1 } = {}) {
    queue.push({ item, weight });
    // Sort by weight descending
    queue.sort((a, b) => b.weight - a.weight);
  }

  function dequeue() {
    if (queue.length === 0) return null;
    return queue.shift().item;
  }

  function peek() {
    if (queue.length === 0) return null;
    return queue[0].item;
  }

  function size() {
    return queue.length;
  }

  function getStats() {
    const totalWeight = queue.reduce((s, e) => s + e.weight, 0);
    return {
      count: queue.length,
      totalWeight,
      avgWeight: queue.length > 0 ? totalWeight / queue.length : 0,
    };
  }

  return { enqueue, dequeue, peek, size, getStats };
}

// ---------------------------------------------------------------------------
// Formal WFQ Scheduler
// ---------------------------------------------------------------------------

/**
 * Default configuration for the formal scheduler.
 */
const DEFAULT_CONFIG = {
  /** Maximum virtual-time before the clock wraps (use a large safe integer). */
  maxVirtualTime: Number.MAX_SAFE_INTEGER,
  /** Starvation threshold in virtual-time ticks — tasks waiting longer get boosted. */
  starvationThreshold: 100,
  /** Boost amount applied to starving tasks (added to effective weight). */
  starvationBoost: 5,
  /** Enable disk persistence of the queue. */
  persist: false,
  /** Custom path to persistence file (defaults to .ogu/state/scheduler-queue.json). */
  persistPath: null,
};

/**
 * Create a formal WFQ scheduler with virtual clock, quotas, preemption,
 * starvation prevention, fair-share tracking, and optional disk persistence.
 *
 * @param {object} [config] - Scheduler configuration (merged with defaults)
 * @returns {object} Formal scheduler API
 */
export function createFormalScheduler(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Virtual clock — monotonically increasing counter representing fair time.
  let virtualTime = 0;

  // Ready queue — sorted by virtual finish time (ascending).
  // Each entry: { id, item, team, feature, weight, priority, enqueuedAt, virtualStart, virtualFinish }
  let readyQueue = [];

  // The currently running task (or null).
  let running = null;

  // Per-team and per-feature usage tracking: { [key]: { allocated, used, weight } }
  const teamStats = {};
  const featureStats = {};

  // Global scheduling stats for fairness computation.
  const schedulingHistory = []; // { id, team, feature, virtualStart, virtualFinish }

  // Monotonic id counter.
  let nextId = 1;

  // ---- Persistence helpers ------------------------------------------------

  function persistPath() {
    if (cfg.persistPath) return cfg.persistPath;
    const root = repoRoot();
    return join(root, '.ogu', 'state', 'scheduler-queue.json');
  }

  function save() {
    if (!cfg.persist) return;
    const p = persistPath();
    const dir = join(p, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const snapshot = {
      virtualTime,
      nextId,
      readyQueue,
      running,
      teamStats,
      featureStats,
      schedulingHistory,
    };
    writeFileSync(p, JSON.stringify(snapshot, null, 2));
  }

  function load() {
    if (!cfg.persist) return;
    const p = persistPath();
    if (!existsSync(p)) return;
    try {
      const data = JSON.parse(readFileSync(p, 'utf-8'));
      virtualTime = data.virtualTime ?? 0;
      nextId = data.nextId ?? 1;
      readyQueue = data.readyQueue ?? [];
      running = data.running ?? null;
      Object.assign(teamStats, data.teamStats ?? {});
      Object.assign(featureStats, data.featureStats ?? {});
      if (data.schedulingHistory) schedulingHistory.push(...data.schedulingHistory);
    } catch {
      // Corrupted file — start fresh.
    }
  }

  // Load persisted state on creation.
  load();

  // ---- Internal helpers ---------------------------------------------------

  function ensureStats(map, key, weight) {
    if (!map[key]) {
      map[key] = { allocated: weight, used: 0, weight };
    }
    // Update weight if it changed.
    map[key].weight = weight;
    map[key].allocated = weight;
  }

  function effectiveWeight(entry) {
    const waitTime = virtualTime - entry.enqueuedAt;
    let boost = 0;
    if (waitTime > cfg.starvationThreshold) {
      boost = cfg.starvationBoost;
    }
    return entry.weight + boost;
  }

  function computeVirtualFinish(entry) {
    const w = effectiveWeight(entry);
    // Virtual finish = virtual start + (cost / weight). Cost is 1 per task unit.
    return entry.virtualStart + (1 / w);
  }

  function sortQueue() {
    readyQueue.sort((a, b) => {
      // Primary: virtual finish ascending (smaller = should run sooner).
      const vDiff = computeVirtualFinish(a) - computeVirtualFinish(b);
      if (Math.abs(vDiff) > 1e-12) return vDiff;
      // Tie-break: higher priority first.
      return (b.priority || 0) - (a.priority || 0);
    });
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Enqueue a task.
   *
   * @param {*} item - The task payload.
   * @param {object} [opts]
   * @param {number}  [opts.weight=1]    - Task weight (higher = more share).
   * @param {number}  [opts.priority=0]  - Numeric priority (higher = preempts more).
   * @param {string}  [opts.team]        - Owning team.
   * @param {string}  [opts.feature]     - Owning feature slug.
   * @returns {{ id: number }} The assigned task id.
   */
  function enqueue(item, { weight = 1, priority = 0, team = 'default', feature = 'default' } = {}) {
    const id = nextId++;
    const entry = {
      id,
      item,
      team,
      feature,
      weight,
      priority,
      enqueuedAt: virtualTime,
      virtualStart: virtualTime,
      virtualFinish: 0,
    };
    entry.virtualFinish = computeVirtualFinish(entry);

    ensureStats(teamStats, team, weight);
    ensureStats(featureStats, feature, weight);

    readyQueue.push(entry);
    sortQueue();
    save();
    return { id };
  }

  /**
   * Dequeue the next task to run according to WFQ order.
   * Advances the virtual clock. If a task is currently running it is considered
   * finished (call complete() explicitly for richer tracking).
   *
   * @returns {object|null} { id, item, team, feature } or null if empty.
   */
  function dequeue() {
    if (readyQueue.length === 0) return null;

    // Re-sort with latest starvation boosts.
    sortQueue();

    const entry = readyQueue.shift();

    // Advance virtual clock to the entry's virtual finish time.
    virtualTime = Math.max(virtualTime, entry.virtualFinish);

    // Track usage.
    if (teamStats[entry.team]) teamStats[entry.team].used += 1;
    if (featureStats[entry.feature]) featureStats[entry.feature].used += 1;

    // Record history.
    schedulingHistory.push({
      id: entry.id,
      team: entry.team,
      feature: entry.feature,
      virtualStart: entry.virtualStart,
      virtualFinish: entry.virtualFinish,
    });

    running = entry;
    save();
    return { id: entry.id, item: entry.item, team: entry.team, feature: entry.feature };
  }

  /**
   * Mark the currently running task as complete. Resets `running` and persists.
   */
  function complete() {
    const finished = running;
    running = null;
    save();
    return finished;
  }

  /**
   * Attempt to preempt the running task with a higher-priority candidate from the queue.
   * If a candidate with strictly higher priority exists it replaces the running task,
   * and the preempted task is re-enqueued.
   *
   * @returns {{ preempted: object|null, promoted: object|null }}
   */
  function preempt() {
    if (!running) return { preempted: null, promoted: null };
    if (readyQueue.length === 0) return { preempted: null, promoted: null };

    sortQueue();
    const candidate = readyQueue[0];

    if ((candidate.priority || 0) > (running.priority || 0)) {
      // Remove candidate from ready queue.
      readyQueue.shift();

      // Re-enqueue the preempted running task.
      const preempted = running;
      preempted.virtualStart = virtualTime;
      preempted.virtualFinish = computeVirtualFinish(preempted);
      readyQueue.push(preempted);
      sortQueue();

      running = candidate;
      save();
      return {
        preempted: { id: preempted.id, item: preempted.item, team: preempted.team, feature: preempted.feature },
        promoted: { id: candidate.id, item: candidate.item, team: candidate.team, feature: candidate.feature },
      };
    }

    return { preempted: null, promoted: null };
  }

  /**
   * Peek at the next task without dequeuing.
   */
  function peek() {
    if (readyQueue.length === 0) return null;
    sortQueue();
    const entry = readyQueue[0];
    return { id: entry.id, item: entry.item, team: entry.team, feature: entry.feature };
  }

  /**
   * Number of tasks in the ready queue.
   */
  function size() {
    return readyQueue.length;
  }

  /**
   * Return current scheduler statistics.
   */
  function getStats() {
    return {
      virtualTime,
      queueSize: readyQueue.length,
      running: running ? { id: running.id, team: running.team, feature: running.feature } : null,
      teamStats: { ...teamStats },
      featureStats: { ...featureStats },
      historyLength: schedulingHistory.length,
    };
  }

  /**
   * Set or update a team/feature quota weight.
   *
   * @param {'team'|'feature'} kind
   * @param {string} key
   * @param {number} weight
   */
  function setQuota(kind, key, weight) {
    const map = kind === 'team' ? teamStats : featureStats;
    ensureStats(map, key, weight);
    save();
  }

  /**
   * Get per-team or per-feature share information.
   */
  function getQuotas(kind) {
    const map = kind === 'team' ? teamStats : featureStats;
    return { ...map };
  }

  /**
   * Reset the scheduler state entirely.
   */
  function reset() {
    virtualTime = 0;
    nextId = 1;
    readyQueue = [];
    running = null;
    Object.keys(teamStats).forEach(k => delete teamStats[k]);
    Object.keys(featureStats).forEach(k => delete featureStats[k]);
    schedulingHistory.length = 0;
    save();
  }

  return {
    enqueue,
    dequeue,
    complete,
    preempt,
    peek,
    size,
    getStats,
    setQuota,
    getQuotas,
    reset,
  };
}

// ---------------------------------------------------------------------------
// Fairness computation
// ---------------------------------------------------------------------------

/**
 * Compute Jain's fairness index from resource-usage stats.
 *
 * Jain's index = (sum(xi))^2 / (n * sum(xi^2))
 * Returns a value in (0, 1] where 1 means perfectly fair.
 *
 * @param {object} stats - Map of { [key]: { allocated, used } } or array of numbers.
 * @returns {number} Fairness index between 0 and 1.
 */
export function computeFairness(stats) {
  let shares;

  if (Array.isArray(stats)) {
    shares = stats;
  } else if (typeof stats === 'object' && stats !== null) {
    // Extract normalized share ratios: used / allocated (or 0 if allocated is 0).
    shares = Object.values(stats).map(s => {
      if (typeof s === 'number') return s;
      const allocated = s.allocated || s.weight || 1;
      const used = s.used ?? 0;
      return used / allocated;
    });
  } else {
    return 1;
  }

  const n = shares.length;
  if (n === 0) return 1;

  const sum = shares.reduce((a, b) => a + b, 0);
  const sumSq = shares.reduce((a, b) => a + b * b, 0);

  if (sumSq === 0) return 1; // No usage yet — perfectly fair by definition.

  return (sum * sum) / (n * sumSq);
}

// ---------------------------------------------------------------------------
// Schedule simulation
// ---------------------------------------------------------------------------

/**
 * Dry-run simulation of task scheduling.
 *
 * Runs the WFQ algorithm on the provided tasks without side-effects,
 * producing a predicted execution order and timing.
 *
 * @param {Array<{ id?: string|number, item: *, weight?: number, priority?: number, team?: string, feature?: string, cost?: number }>} tasks
 * @param {object} [config] - Same config shape as createFormalScheduler.
 * @returns {{ order: Array<{ id, item, team, feature, startTime, endTime }>, fairness: number, totalTime: number }}
 */
export function simulateSchedule(tasks, config = {}) {
  // Create an ephemeral scheduler (never persisted).
  const scheduler = createFormalScheduler({ ...config, persist: false });

  // Enqueue all tasks.
  const idMap = new Map();
  for (const task of tasks) {
    const result = scheduler.enqueue(task.item, {
      weight: task.weight ?? 1,
      priority: task.priority ?? 0,
      team: task.team ?? 'default',
      feature: task.feature ?? 'default',
    });
    idMap.set(result.id, { originalId: task.id ?? result.id, cost: task.cost ?? 1 });
  }

  // Dequeue in order, building the timeline.
  const order = [];
  let currentTime = 0;

  while (scheduler.size() > 0) {
    const entry = scheduler.dequeue();
    if (!entry) break;

    const meta = idMap.get(entry.id) || { originalId: entry.id, cost: 1 };
    const startTime = currentTime;
    const endTime = currentTime + meta.cost;

    order.push({
      id: meta.originalId,
      item: entry.item,
      team: entry.team,
      feature: entry.feature,
      startTime,
      endTime,
    });

    currentTime = endTime;
    scheduler.complete();
  }

  // Compute fairness from the simulation stats.
  const stats = scheduler.getStats();
  const fairness = computeFairness(stats.teamStats);
  const totalTime = currentTime;

  return { order, fairness, totalTime };
}
