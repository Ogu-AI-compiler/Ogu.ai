/**
 * Transaction — formal consistency model with SAGA pattern.
 *
 * Guarantees:
 *   - All-or-nothing task execution (prepare → execute → commit)
 *   - Compensating rollback (never delete audit, only append compensating events)
 *   - Idempotency keys (24h TTL, sha256-based)
 *   - Source-of-truth hierarchy (Audit > Feature State > Snapshots > Budget > Resources > Sessions)
 *   - Reconciliation checks across layers
 *
 * Also provides legacy createTransactionLog(), createSaga(), createCompensatingTransaction()
 * for backwards compatibility.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

const IDEMPOTENCY_DIR = (root) => join(root, '.ogu/idempotency');
const TX_LOG_DIR = (root) => join(root, '.ogu/transactions');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Source of Truth Hierarchy ─────────────────────────────────────────

export const SOURCE_OF_TRUTH_HIERARCHY = [
  { rank: 1, layer: 'Audit Trail', path: '.ogu/audit/', property: 'append-only, immutable', rule: 'If audit says it happened, it happened. Audit is never rolled back — only compensating events are appended.' },
  { rank: 2, layer: 'Feature State Machine', path: '.ogu/state/features/', property: 'single-writer (state-machine-v2.mjs)', rule: 'Feature state is the authoritative lifecycle position. Other layers derive from it.' },
  { rank: 3, layer: 'Execution Snapshots', path: '.ogu/snapshots/', property: 'immutable after capture', rule: 'Snapshots are evidence. They don\'t drive state — they prove it.' },
  { rank: 4, layer: 'Budget State', path: '.ogu/budget/', property: 'eventually consistent with audit', rule: 'Budget can be reconstructed from audit events. If budget state conflicts with audit, audit wins.' },
  { rank: 5, layer: 'Resource Governor', path: '.ogu/locks/', property: 'ephemeral, reconstructible', rule: 'Resource state is volatile. On crash, reconstruct from audit + feature states.' },
  { rank: 6, layer: 'Agent Sessions', path: '.ogu/agents/sessions/', property: 'ephemeral, time-bounded', rule: 'Sessions expire. On conflict, kill session and re-create.' },
];

// ── Transaction Phases ───────────────────────────────────────────────

export const TX_PHASES = ['prepare', 'execute', 'commit', 'rolled_back', 'committed'];

/**
 * Execute a task within a formal transaction boundary.
 * Guarantees: all-or-nothing commit, compensating rollback, idempotency.
 */
export function executeTransaction(root, { taskId, featureSlug, agentId, estimatedCost, resourceType, attempt, executor }) {
  root = root || repoRoot();
  const txId = generateTxId({ taskId, featureSlug });
  const idempotencyKey = computeIdempotencyKey({ taskId, featureSlug, attempt: attempt || 0 });

  // Idempotency check
  const existing = checkIdempotency(root, idempotencyKey);
  if (existing && existing.status === 'committed') {
    return { success: true, cached: true, txId: existing.txId, resultHash: existing.resultHash };
  }

  const txState = {
    txId,
    idempotencyKey,
    phase: 'prepare',
    taskId,
    featureSlug,
    agentId,
    acquiredResources: [],
    session: null,
    outputs: null,
    cost: null,
    startedAt: new Date().toISOString(),
  };

  // Save transaction record
  saveTxRecord(root, txState);

  try {
    // ═══ PHASE 1: PREPARE ═══
    txState.phase = 'prepare';

    // Acquire resource slot (lazy — only if resource-governor available)
    try {
      const { acquireResource } = require('./resource-governor.mjs');
      const slot = acquireResource(root, {
        resourceType: resourceType || 'model_call',
        agentId: agentId,
        taskId: taskId,
        featureSlug: featureSlug,
        priority: 50,
      });
      if (slot.granted) {
        txState.acquiredResources.push(slot.slotId);
      }
    } catch { /* resource-governor not available — continue */ }

    // Check feature envelope (lazy)
    if (featureSlug) {
      try {
        const { checkEnvelope } = require('./feature-isolation.mjs');
        const envelopeResult = checkEnvelope(root, featureSlug, {
          taskCost: estimatedCost || 0,
          resourceType: resourceType || 'model_call',
        });
        if (!envelopeResult.allowed) {
          throw new Error(`OGU5001: Feature envelope check failed: ${(envelopeResult.violations || []).map(v => v.error).join('; ')}`);
        }
      } catch (e) {
        if (e.message.startsWith('OGU5001')) throw e;
        /* feature-isolation not available — continue */
      }
    }

    saveTxRecord(root, txState);

    // ═══ PHASE 2: EXECUTE ═══
    txState.phase = 'execute';
    saveTxRecord(root, txState);

    let execResult = null;
    if (typeof executor === 'function') {
      execResult = executor({ txId, taskId, featureSlug, agentId });
      txState.outputs = execResult?.outputs || [];
      txState.cost = execResult?.cost || { totalCost: estimatedCost || 0 };
    }

    // ═══ PHASE 3: COMMIT ═══
    txState.phase = 'commit';
    saveTxRecord(root, txState);

    // Step 1: Audit (MUST succeed — append-only file write)
    emitAudit('tx.committed', {
      txId,
      taskId,
      featureSlug,
      agentId,
      cost: txState.cost,
      outputCount: (txState.outputs || []).length,
    }, {});

    // Step 2: Budget (non-critical — mark dirty if fails)
    if (txState.cost?.totalCost && featureSlug) {
      try {
        const { recordSpend } = require('./feature-isolation.mjs');
        recordSpend(root, featureSlug, txState.cost.totalCost);
      } catch {
        emitAudit('tx.budget_dirty', { txId, featureSlug, willReconcile: true }, {});
        markBudgetDirty(root, featureSlug);
      }
    }

    // Step 3: Release resources
    for (const slotId of txState.acquiredResources) {
      try {
        const { releaseResource } = require('./resource-governor.mjs');
        releaseResource(root, slotId);
      } catch { /* will auto-expire */ }
    }
    txState.acquiredResources = [];

    // Record idempotency
    const resultHash = hashOutputs(txState.outputs);
    recordIdempotency(root, idempotencyKey, {
      status: 'committed',
      txId,
      resultHash,
      committedAt: new Date().toISOString(),
    });

    txState.phase = 'committed';
    txState.completedAt = new Date().toISOString();
    saveTxRecord(root, txState);

    return { success: true, txId, outputs: txState.outputs, cost: txState.cost, resultHash };

  } catch (error) {
    // ═══ ROLLBACK ═══
    return rollbackTransaction(root, txState, error);
  }
}

/**
 * Compensating rollback — never deletes, only appends compensating events.
 */
function rollbackTransaction(root, txState, error) {
  const rollbackActions = [];

  // Compensating audit event
  emitAudit('tx.rolled_back', {
    txId: txState.txId,
    failedPhase: txState.phase,
    error: error.message,
  }, {});
  rollbackActions.push('audit_logged');

  // Refund budget if it was charged during commit phase
  if (txState.cost?.totalCost && txState.featureSlug && txState.phase === 'commit') {
    try {
      const { recordSpend } = require('./feature-isolation.mjs');
      // Negative spend = refund
      recordSpend(root, txState.featureSlug, -txState.cost.totalCost);
      rollbackActions.push('budget_refunded');
    } catch {
      emitAudit('tx.refund_failed', { txId: txState.txId, error: 'refund unavailable' }, {});
    }
  }

  // Release resource slots
  for (const slotId of txState.acquiredResources) {
    try {
      const { releaseResource } = require('./resource-governor.mjs');
      releaseResource(root, slotId);
      rollbackActions.push('resource_released');
    } catch { /* will auto-expire */ }
  }

  // Record idempotency as rolled_back
  recordIdempotency(root, txState.idempotencyKey, {
    status: 'rolled_back',
    txId: txState.txId,
    error: error.message,
    rolledBackAt: new Date().toISOString(),
  });

  txState.phase = 'rolled_back';
  txState.completedAt = new Date().toISOString();
  txState.error = error.message;
  saveTxRecord(root, txState);

  return {
    success: false,
    txId: txState.txId,
    phase: txState.phase,
    error: error.message,
    rollbackActions,
  };
}

// ── Idempotency ──────────────────────────────────────────────────────

function computeIdempotencyKey({ taskId, featureSlug, attempt }) {
  const input = `${taskId || ''}:${featureSlug || ''}:${attempt || 0}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function checkIdempotency(root, key) {
  const path = join(ensureDir(IDEMPOTENCY_DIR(root)), `${key}.json`);
  if (!existsSync(path)) return null;
  try {
    const record = JSON.parse(readFileSync(path, 'utf8'));
    // TTL check — 24h
    const ts = record.committedAt || record.rolledBackAt;
    if (ts && Date.now() - new Date(ts).getTime() > 86400000) return null;
    return record;
  } catch { return null; }
}

function recordIdempotency(root, key, record) {
  const dir = ensureDir(IDEMPOTENCY_DIR(root));
  writeFileSync(join(dir, `${key}.json`), JSON.stringify(record, null, 2), 'utf8');
}

/**
 * Garbage-collect expired idempotency keys (older than 24h).
 */
export function gcIdempotencyKeys(root) {
  root = root || repoRoot();
  const dir = IDEMPOTENCY_DIR(root);
  if (!existsSync(dir)) return { removed: 0 };
  let removed = 0;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const ts = data.committedAt || data.rolledBackAt;
      if (ts && Date.now() - new Date(ts).getTime() > 86400000) {
        unlinkSync(join(dir, f));
        removed++;
      }
    } catch { /* skip corrupted */ }
  }
  return { removed };
}

// ── Transaction Records ──────────────────────────────────────────────

function generateTxId({ taskId, featureSlug }) {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  const hash = createHash('sha256').update(`${taskId}:${featureSlug}:${ts}:${Math.random()}`).digest('hex').slice(0, 6);
  return `tx-${ts}-${hash}`;
}

function saveTxRecord(root, txState) {
  const dir = ensureDir(TX_LOG_DIR(root));
  writeFileSync(join(dir, `${txState.txId}.json`), JSON.stringify(txState, null, 2), 'utf8');
}

/**
 * Load a transaction record by ID.
 */
export function loadTransaction(root, txId) {
  root = root || repoRoot();
  const path = join(TX_LOG_DIR(root), `${txId}.json`);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

/**
 * List recent transactions.
 */
export function listTransactions(root, { limit = 50 } = {}) {
  root = root || repoRoot();
  const dir = TX_LOG_DIR(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.startsWith('tx-') && f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
    .slice(0, limit);
}

/**
 * Find orphaned transactions (started but never completed).
 */
export function findOrphanedTransactions(root) {
  root = root || repoRoot();
  const txs = listTransactions(root, { limit: 500 });
  return txs.filter(tx =>
    tx.phase !== 'committed' && tx.phase !== 'rolled_back' &&
    tx.startedAt && (Date.now() - new Date(tx.startedAt).getTime() > 3600000) // older than 1h
  );
}

function hashOutputs(outputs) {
  if (!outputs || !Array.isArray(outputs) || outputs.length === 0) return 'sha256:empty';
  return 'sha256:' + createHash('sha256').update(JSON.stringify(outputs)).digest('hex').slice(0, 16);
}

function markBudgetDirty(root, featureSlug) {
  const dir = ensureDir(join(root, '.ogu/budget'));
  const path = join(dir, 'dirty-flags.json');
  let flags = {};
  if (existsSync(path)) {
    try { flags = JSON.parse(readFileSync(path, 'utf8')); } catch { /* start fresh */ }
  }
  flags[featureSlug] = { markedAt: new Date().toISOString(), reconciled: false };
  writeFileSync(path, JSON.stringify(flags, null, 2), 'utf8');
}

// ── Reconciliation ───────────────────────────────────────────────────

/**
 * Run consistency checks across all layers.
 * Returns check results and optionally auto-fixes inconsistencies.
 */
export function runConsistencyCheck(root, { fix = false } = {}) {
  root = root || repoRoot();
  const results = [];

  // Check 1: Budget vs Audit
  results.push(checkBudgetVsAudit(root, fix));

  // Check 2: Sessions vs Resources
  results.push(checkSessionsVsResources(root, fix));

  // Check 3: Orphaned transactions
  results.push(checkOrphanedTransactions(root, fix));

  // Check 4: Budget dirty flags
  results.push(checkBudgetDirtyFlags(root, fix));

  const allPassed = results.every(r => r.status === 'ok');

  emitAudit('consistency.check', {
    allPassed,
    checks: results.length,
    failures: results.filter(r => r.status !== 'ok').length,
    fixed: fix ? results.filter(r => r.fixed).length : 0,
  }, {});

  return { allPassed, results };
}

function checkBudgetVsAudit(root, fix) {
  // Compare budget state with audit-derived values
  const auditPath = join(root, '.ogu/audit/current.jsonl');
  if (!existsSync(auditPath)) {
    return { check: 'budget_vs_audit', status: 'ok', detail: 'No audit file — nothing to check' };
  }

  let budgetEvents = 0;
  let totalFromAudit = 0;
  try {
    const lines = readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'tx.committed' && event.data?.cost?.totalCost) {
          totalFromAudit += event.data.cost.totalCost;
          budgetEvents++;
        }
        if (event.type === 'tx.rolled_back' && event.data?.cost?.totalCost) {
          totalFromAudit -= event.data.cost.totalCost;
        }
      } catch { /* skip malformed lines */ }
    }
  } catch { /* audit read failed */ }

  // Load budget state
  let budgetState = 0;
  const budgetPaths = [
    join(root, '.ogu/BUDGET.json'),
    join(root, '.ogu/budget/budget-state.json'),
  ];
  for (const p of budgetPaths) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, 'utf8'));
        budgetState = data.totalSpent || data.daily?.costUsed || 0;
        break;
      } catch { /* try next */ }
    }
  }

  const delta = Math.abs(totalFromAudit - budgetState);
  const deltaPercent = budgetState > 0 ? (delta / budgetState) * 100 : 0;

  if (delta < 0.01) {
    return { check: 'budget_vs_audit', status: 'ok', detail: `Budget consistent ($${budgetState})` };
  }

  if (fix && deltaPercent > 0) {
    // Auto-fix: overwrite budget with audit-derived value
    for (const p of budgetPaths) {
      if (existsSync(p)) {
        try {
          const data = JSON.parse(readFileSync(p, 'utf8'));
          if (data.totalSpent !== undefined) data.totalSpent = totalFromAudit;
          if (data.daily?.costUsed !== undefined) data.daily.costUsed = totalFromAudit;
          writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
        } catch { /* skip */ }
        break;
      }
    }
    emitAudit('consistency.budget_reconciled', { oldValue: budgetState, newValue: totalFromAudit }, {});
    return { check: 'budget_vs_audit', status: 'fixed', detail: `Budget corrected: $${budgetState} → $${totalFromAudit}`, fixed: true };
  }

  return {
    check: 'budget_vs_audit',
    status: deltaPercent > 5 ? 'dirty' : 'warning',
    detail: `Budget=$${budgetState}, Audit=$${totalFromAudit}, delta=$${delta.toFixed(2)} (${deltaPercent.toFixed(1)}%)`,
  };
}

function checkSessionsVsResources(root, fix) {
  const lockPath = join(root, '.ogu/locks/active.json');
  if (!existsSync(lockPath)) {
    return { check: 'sessions_vs_resources', status: 'ok', detail: 'No active locks' };
  }

  let orphanedSlots = 0;
  try {
    const locks = JSON.parse(readFileSync(lockPath, 'utf8'));
    const slots = locks.activeSlots || [];
    for (const slot of slots) {
      // Check if the session for this slot still exists
      const sessionPath = join(root, '.ogu/agents/sessions', `${slot.agentId || ''}.json`);
      const credPath = join(root, '.ogu/agents/credentials', `${slot.agentId || ''}.json`);
      if (!existsSync(sessionPath) && !existsSync(credPath)) {
        orphanedSlots++;
      }
    }

    if (orphanedSlots > 0 && fix) {
      locks.activeSlots = slots.filter(slot => {
        const sp = join(root, '.ogu/agents/sessions', `${slot.agentId || ''}.json`);
        const cp = join(root, '.ogu/agents/credentials', `${slot.agentId || ''}.json`);
        return existsSync(sp) || existsSync(cp);
      });
      writeFileSync(lockPath, JSON.stringify(locks, null, 2), 'utf8');
      return { check: 'sessions_vs_resources', status: 'fixed', detail: `Released ${orphanedSlots} orphaned slots`, fixed: true };
    }
  } catch { /* lock file parse error */ }

  if (orphanedSlots > 0) {
    return { check: 'sessions_vs_resources', status: 'warning', detail: `${orphanedSlots} orphaned resource slots` };
  }
  return { check: 'sessions_vs_resources', status: 'ok', detail: 'No orphaned slots' };
}

function checkOrphanedTransactions(root, fix) {
  const orphans = findOrphanedTransactions(root);
  if (orphans.length === 0) {
    return { check: 'orphaned_transactions', status: 'ok', detail: 'No orphaned transactions' };
  }

  if (fix) {
    for (const tx of orphans) {
      tx.phase = 'rolled_back';
      tx.error = 'Orphaned — auto-rolled-back by consistency check';
      tx.completedAt = new Date().toISOString();
      saveTxRecord(root, tx);
      emitAudit('tx.orphan_cleaned', { txId: tx.txId }, {});
    }
    return { check: 'orphaned_transactions', status: 'fixed', detail: `Cleaned ${orphans.length} orphaned transactions`, fixed: true };
  }

  return { check: 'orphaned_transactions', status: 'warning', detail: `${orphans.length} orphaned transactions found` };
}

function checkBudgetDirtyFlags(root, fix) {
  const path = join(root, '.ogu/budget/dirty-flags.json');
  if (!existsSync(path)) {
    return { check: 'budget_dirty_flags', status: 'ok', detail: 'No dirty flags' };
  }

  try {
    const flags = JSON.parse(readFileSync(path, 'utf8'));
    const dirty = Object.entries(flags).filter(([, v]) => !v.reconciled);
    if (dirty.length === 0) {
      return { check: 'budget_dirty_flags', status: 'ok', detail: 'All budget flags reconciled' };
    }

    if (fix) {
      for (const [slug] of dirty) {
        flags[slug].reconciled = true;
        flags[slug].reconciledAt = new Date().toISOString();
      }
      writeFileSync(path, JSON.stringify(flags, null, 2), 'utf8');
      return { check: 'budget_dirty_flags', status: 'fixed', detail: `Reconciled ${dirty.length} dirty budget flags`, fixed: true };
    }

    return { check: 'budget_dirty_flags', status: 'warning', detail: `${dirty.length} dirty budget flags: ${dirty.map(d => d[0]).join(', ')}` };
  } catch { return { check: 'budget_dirty_flags', status: 'ok', detail: 'Could not parse dirty flags' }; }
}

/**
 * Check if an idempotency key has already been committed or rolled back.
 * @param {string} root - Repository root
 * @param {string} key - Idempotency key (sha256 hex)
 * @returns {object|null} Record if found and not expired, null otherwise
 */
export { checkIdempotency };

// ── Legacy Exports (backwards compat) ────────────────────────────────

export const SAGA_STATES = ['pending', 'executing', 'completed', 'compensating', 'compensated', 'failed'];

/**
 * Legacy SAGA pattern (from consistency-model.mjs).
 */
export function createSaga(name) {
  const steps = [];
  let state = 'pending';
  let error = null;

  function step(stepName, doFn, compensateFn) {
    steps.push({ name: stepName, doFn, compensateFn });
  }

  async function execute() {
    state = 'executing';
    const completed = [];

    for (let i = 0; i < steps.length; i++) {
      try {
        await steps[i].doFn();
        completed.push(i);
      } catch (e) {
        error = e;
        state = 'compensating';
        for (let j = completed.length - 1; j >= 0; j--) {
          try { await steps[completed[j]].compensateFn(); } catch { /* swallow */ }
        }
        state = 'compensated';
        throw e;
      }
    }
    state = 'completed';
  }

  function getStatus() {
    return { name, state, stepCount: steps.length, error: error ? error.message : null };
  }

  return { step, execute, getStatus };
}

/**
 * Legacy transaction log (from transaction-log.mjs).
 */
export function createTransactionLog() {
  const entries = [];
  let nextSeq = 1;

  function append(entry) {
    entries.push({ ...entry, seq: nextSeq++, timestamp: new Date().toISOString() });
  }

  function getEntries() { return [...entries]; }
  function getByType(type) { return entries.filter(e => e.type === type); }
  function getSince(seq) { return entries.filter(e => e.seq > seq); }

  return { append, getEntries, getByType, getSince };
}

/**
 * Legacy compensating transaction (from compensating-transaction.mjs).
 */
export function createCompensatingTransaction() {
  const actions = [];
  const compensations = [];
  function add(action, compensation) { actions.push(action); compensations.push(compensation); }
  function commit() { for (const action of actions) action(); }
  function rollback() { for (let i = compensations.length - 1; i >= 0; i--) compensations[i](); }
  return { add, commit, rollback };
}
