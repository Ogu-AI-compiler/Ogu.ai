/**
 * Dispatch Engine — executes Plan.json tasks via the agent pipeline.
 *
 * Originally ported from dispatch.ts. WebSocket/manifest deps removed.
 * Broadcast is provided via initBroadcast() — decoupled from transport layer.
 *
 * Flow:
 *   1. Read Plan.json → build DAG waves from depends_on
 *   2. For each wave (sequential):
 *      - Check budget
 *      - Spawn `ogu agent:run` per task (parallel within wave, MAX_PARALLEL_TASKS)
 *      - On success: run local gates → mark done in Plan.json
 *      - Broadcast progress events after each task/wave
 *   3. After all waves: auto-continue pipeline (build → verifying)
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  preflightTaskSpec,
  runTaskGates,
  buildTaskFixNote,
  resolveTaskGroup,
  formatGateErrorsForFix,
} from '../../ogu/commands/lib/task-gates.mjs';
import {
  hasTaskGateEvidence,
  readRunnerOutput,
  hasRunnerGatePass,
  writeTaskGateEvidence,
} from '../../ogu/commands/lib/task-gate-evidence.mjs';
import {
  writeHandoffContext,
  buildHandoffKey,
} from '../../ogu/commands/lib/handoff-context.mjs';
import {
  getBudgetDir,
  getProjectsDir,
  getRunnersDir,
  getStateDir,
} from '../../ogu/commands/lib/runtime-paths.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = resolve(__dirname, '..', '..', 'ogu', 'commands', 'lib');

function getCliPath() {
  return resolve(__dirname, '..', '..', '..', 'ogu', 'cli.mjs');
}

// ── Broadcast singleton ──
// Call initBroadcast() once at daemon startup to wire in the SSE broadcaster.

let _broadcast = () => {};

/**
 * Wire the broadcast function. Call once from daemon.mjs after creating broadcaster.
 * @param {function} fn - (msg: {type, ...fields}) => void
 */
export function initBroadcast(fn) {
  _broadcast = fn;
}

function broadcast(msg) {
  try { _broadcast(msg); } catch { /* never block on broadcast */ }
}

// ── Per-slug pipeline mutex ──
const activePipelines = new Map(); // slug → { phase, startedAt }

// ── Abort / Pause state ──
const abortedPipelines = new Set();
const pausedPipelines = new Set();

// ── Active child processes per slug (for kill-on-abort) ──
const activeChildren = new Map(); // slug → Set<ChildProcess>

// ── Task failure store (enables learning candidate on retry) ──
// taskId → { errors, group, agentId, failedAt }
const taskFailureStore = new Map();

// ── Candidate dedup fingerprints (24h TTL) ──
const candidateFingerprints = new Map();
const FINGERPRINT_TTL_MS = 24 * 60 * 60 * 1000;

// ── Dispatch state stale threshold ──
const DISPATCH_STALE_MS = 30 * 60 * 1000;

// ── Config ──
const MAX_PARALLEL_TASKS = Math.max(1, parseInt(process.env.OGU_MAX_PARALLEL_TASKS || '4', 10));
const EXEC_MODE = process.env.OGU_EXEC_MODE || 'spawn';
const TASK_TIMEOUT_MS = Math.max(30000, parseInt(process.env.OGU_TASK_TIMEOUT_MS || '300000', 10));
const AUTO_RESUME_STALE_PAUSE = process.env.OGU_AUTO_RESUME_STALE_PAUSE !== '0';
const AUTO_RESUME_AFTER_MS = Math.max(30_000, parseInt(process.env.OGU_AUTO_RESUME_AFTER_MS || '120000', 10));

// ── Group → OrgSpec role mapping ──
const GROUP_ROLES = {
  setup: 'devops',
  core: 'backend-dev',
  ui: 'frontend-dev',
  integration: 'backend-dev',
  polish: 'qa',
};

const DEFAULT_AGENT_NAMES = {
  setup: 'Ops',
  core: 'Dev',
  ui: 'Design',
  integration: 'Integration',
  polish: 'QA',
};

// ── Helpers ──

function nowIso() {
  return new Date().toISOString();
}

function dispatchDir(root) {
  return join(getStateDir(root), 'dispatch');
}

function dispatchStatePath(root, slug) {
  return join(dispatchDir(root), `${slug}.json`);
}

export function readDispatchState(root, slug) {
  const path = dispatchStatePath(root, slug);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function writeDispatchState(root, slug, state) {
  const dir = dispatchDir(root);
  mkdirSync(dir, { recursive: true });
  const next = { ...state, slug, updatedAt: nowIso() };
  writeFileSync(dispatchStatePath(root, slug), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function updateDispatchState(root, slug, patch, opts = {}) {
  const base = readDispatchState(root, slug) || { slug };
  const next = { ...base, ...patch, slug };
  if (opts.heartbeat) next.lastHeartbeat = nowIso();
  if (next.dispatchStatus === 'running' && !next.dispatchStartedAt) next.dispatchStartedAt = nowIso();
  if (next.pipelineActive && !next.pipelineStartedAt) next.pipelineStartedAt = nowIso();
  if (patch.activeChildPids) {
    next.activeChildPids = [...new Set(patch.activeChildPids.filter((n) => Number.isFinite(n)))];
  }
  next.updatedAt = nowIso();
  return writeDispatchState(root, slug, next);
}

function touchDispatchState(root, slug, patch = {}) {
  return updateDispatchState(root, slug, patch, { heartbeat: true });
}

function addChildPid(root, slug, pid) {
  if (!pid) return;
  const state = readDispatchState(root, slug);
  const current = new Set(state?.activeChildPids || []);
  current.add(pid);
  updateDispatchState(root, slug, { activeChildPids: [...current] }, { heartbeat: true });
}

function removeChildPid(root, slug, pid) {
  if (!pid) return;
  const state = readDispatchState(root, slug);
  const current = new Set(state?.activeChildPids || []);
  current.delete(pid);
  updateDispatchState(root, slug, { activeChildPids: [...current] }, { heartbeat: true });
}

function pruneStaleChildPids(root, slug) {
  const state = readDispatchState(root, slug);
  const pids = state?.activeChildPids || [];
  if (pids.length === 0) return 0;
  const alive = [];
  for (const pid of pids) {
    try { process.kill(pid, 0); alive.push(pid); } catch { /* gone */ }
  }
  if (alive.length !== pids.length) {
    updateDispatchState(root, slug, { activeChildPids: alive }, { heartbeat: true });
  }
  return alive.length;
}

function registerChild(root, slug, child) {
  if (!activeChildren.has(slug)) activeChildren.set(slug, new Set());
  activeChildren.get(slug).add(child);
  addChildPid(root, slug, child.pid);
}

function unregisterChild(root, slug, child) {
  activeChildren.get(slug)?.delete(child);
  removeChildPid(root, slug, child.pid);
}

function killAllChildren(slug) {
  const children = activeChildren.get(slug);
  if (!children) return;
  for (const child of children) {
    try { child.kill('SIGTERM'); } catch { /* ignore */ }
  }
  children.clear();
}

function readJsonSafe(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function getAliasPrefixes(root) {
  const tsconfig = readJsonSafe(join(root, 'tsconfig.json')) || readJsonSafe(join(root, 'jsconfig.json')) || {};
  const paths = tsconfig?.compilerOptions?.paths || {};
  const prefixes = new Set();
  for (const key of Object.keys(paths)) {
    let prefix = key;
    if (prefix.endsWith('/*')) prefix = prefix.slice(0, -1);
    else if (prefix.endsWith('*')) prefix = prefix.slice(0, -1);
    if (prefix) prefixes.add(prefix);
  }
  return [...prefixes];
}

function extractMissingDeps(errorText, aliasPrefixes) {
  if (!errorText) return [];
  const deps = [];
  const re = /imports '([^']+)' which is not in package\.json/g;
  let match;
  while ((match = re.exec(errorText)) !== null) {
    const dep = match[1];
    if (!dep) continue;
    if (dep.startsWith('@/') || dep.startsWith('~/')) continue;
    if (aliasPrefixes.some((p) => dep.startsWith(p))) continue;
    deps.push(dep);
  }
  return deps;
}

function getLockfileTouches(root) {
  const locks = [];
  if (existsSync(join(root, 'pnpm-lock.yaml'))) locks.push('pnpm-lock.yaml');
  else if (existsSync(join(root, 'yarn.lock'))) locks.push('yarn.lock');
  else if (existsSync(join(root, 'package-lock.json'))) locks.push('package-lock.json');
  return locks;
}

const GROUP_TO_TEAM_ROLE = {
  setup: 'devops',
  core: 'backend_engineer',
  ui: 'frontend_engineer',
  integration: 'backend_engineer',
  polish: 'qa',
};

// ── Pipeline state exports ──

export function isPipelineActive(slug, root) {
  const entry = activePipelines.get(slug);
  if (entry) {
    if (Date.now() - entry.startedAt > 15 * 60 * 1000) {
      console.warn(`[pipeline] Lock for ${slug} expired after 15 min — force-releasing`);
      activePipelines.delete(slug);
    } else {
      return true;
    }
  }

  const resolvedRoot = root || process.env.OGU_ROOT || process.cwd();
  const state = readDispatchState(resolvedRoot, slug);
  if (!state?.pipelineActive) return false;

  const lastBeat = state.lastHeartbeat ? new Date(state.lastHeartbeat).getTime() : 0;
  if (lastBeat && Date.now() - lastBeat > DISPATCH_STALE_MS) {
    console.warn(`[pipeline] Durable lock for ${slug} stale — clearing`);
    updateDispatchState(resolvedRoot, slug, {
      pipelineActive: false,
      pipelineStatus: 'failed',
      lastError: 'stale pipeline lock',
    });
    return false;
  }
  return true;
}

export function acquirePipelineLock(slug, phase, root) {
  if (isPipelineActive(slug, root)) return false;
  activePipelines.set(slug, { phase, startedAt: Date.now() });
  updateDispatchState(root, slug, {
    pipelineActive: true,
    pipelinePhase: phase,
    pipelineStatus: 'running',
    pipelineStartedAt: nowIso(),
    aborted: false,
    paused: false,
  }, { heartbeat: true });
  return true;
}

export function releasePipelineLock(slug, root, patch = {}) {
  activePipelines.delete(slug);
  pausedPipelines.delete(slug);
  activeChildren.delete(slug);
  updateDispatchState(root, slug, {
    pipelineActive: false,
    pipelinePhase: patch.pipelinePhase ?? null,
    pipelineStatus: patch.pipelineStatus ?? 'completed',
    pipelineCompletedAt: patch.pipelineCompletedAt ?? nowIso(),
    lastError: patch.lastError ?? null,
  }, { heartbeat: true });
}

export function abortPipeline(slug, root) {
  const resolvedRoot = root || process.env.OGU_ROOT || process.cwd();
  abortedPipelines.add(slug);
  killAllChildren(slug);

  const state = readDispatchState(resolvedRoot, slug);
  if (state?.activeChildPids?.length) {
    for (const pid of state.activeChildPids) {
      try { process.kill(pid, 'SIGTERM'); } catch { /* ignore */ }
    }
  }

  const dispatchPatch = {};
  if (state?.dispatchStatus === 'running') {
    dispatchPatch.dispatchStatus = 'aborted';
    dispatchPatch.dispatchCompletedAt = nowIso();
    dispatchPatch.lastError = 'aborted';
  }

  activePipelines.delete(slug);
  pausedPipelines.delete(slug);
  updateDispatchState(resolvedRoot, slug, {
    ...dispatchPatch,
    aborted: true,
    paused: false,
    abortRequestedAt: nowIso(),
    pipelineActive: false,
    pipelineStatus: 'aborted',
  }, { heartbeat: true });

  if (root) {
    try {
      const dir = join(getStateDir(root), 'features');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${slug}.aborted`), String(Date.now()));
    } catch {}
  }
}

export function pausePipeline(slug, root) {
  const resolvedRoot = root || process.env.OGU_ROOT || process.cwd();
  pausedPipelines.add(slug);
  updateDispatchState(resolvedRoot, slug, {
    paused: true,
    pauseRequestedAt: nowIso(),
    pipelineStatus: 'running',
  }, { heartbeat: true });
}

export function resumePipeline(slug, root) {
  const resolvedRoot = root || process.env.OGU_ROOT || process.cwd();
  pausedPipelines.delete(slug);
  updateDispatchState(resolvedRoot, slug, {
    paused: false,
    pipelineStatus: 'running',
  }, { heartbeat: true });
}

export function isPipelineAborted(slug, root) {
  if (abortedPipelines.has(slug)) return true;
  const resolvedRoot = root || process.env.OGU_ROOT || process.cwd();
  const state = readDispatchState(resolvedRoot, slug);
  return !!state?.aborted || state?.pipelineStatus === 'aborted';
}

export function isPipelinePaused(slug, root) {
  if (pausedPipelines.has(slug)) return true;
  const resolvedRoot = root || process.env.OGU_ROOT || process.cwd();
  const state = readDispatchState(resolvedRoot, slug);
  return !!state?.paused;
}

async function waitIfPaused(slug, root) {
  while (isPipelinePaused(slug, root)) {
    touchDispatchState(root, slug, { paused: true });
    if (AUTO_RESUME_STALE_PAUSE) {
      const state = readDispatchState(root, slug);
      const pausedAt = state?.pauseRequestedAt ? Date.parse(state.pauseRequestedAt) : 0;
      const ageMs = pausedAt ? (Date.now() - pausedAt) : 0;
      const remaining = pruneStaleChildPids(root, slug);
      if (remaining === 0 && ageMs > AUTO_RESUME_AFTER_MS) {
        resumePipeline(slug, root);
        broadcast({ type: 'dispatch:resumed', slug });
        return true;
      }
    }
    if (isPipelineAborted(slug, root)) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
  return !isPipelineAborted(slug, root);
}

// ── Candidate dedup ──

function normalizeGateErrors(errors, group) {
  return errors.slice(0, 5).map((err) => {
    const stripped = err
      .replace(/[\w./-]+\.(tsx?|jsx?|json|mjs|md|css|env)\s*[:，]/gi, '')
      .replace(/\b[\w-]+\/[\w/-]+/g, '')
      .replace(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g, 'Component')
      .replace(/["'`][^"'`]{0,40}["'`]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9:-]/g, '')
      .slice(0, 60);
    return `${group}:${stripped || 'gate-failure'}`;
  });
}

export function computeCandidateFingerprint(agentId, group, normalizedSignals) {
  return `${agentId ?? 'noagent'}:${group}:${normalizedSignals.slice(0, 3).join('|')}`;
}

export function isDuplicateCandidate(fingerprint) {
  const now = Date.now();
  for (const [fp, ts] of candidateFingerprints) {
    if (now - ts > FINGERPRINT_TTL_MS) candidateFingerprints.delete(fp);
  }
  if (candidateFingerprints.has(fingerprint)) return true;
  candidateFingerprints.set(fingerprint, now);
  return false;
}

// ── Team loading ──

function loadTeamAgentIds(root, slug) {
  const ids = { setup: null, core: null, ui: null, integration: null, polish: null };
  try {
    const teamPath = join(getProjectsDir(root), slug, 'team.json');
    if (!existsSync(teamPath)) return ids;
    const team = JSON.parse(readFileSync(teamPath, 'utf-8'));
    const members = team?.members?.filter((m) => m.status === 'active' && m.agent_id) || [];
    const used = new Set();
    const pick = (keywords) => {
      const keys = keywords.map((k) => k.toLowerCase());
      const roleText = (m) => [m.role_id, m.role_display, m.roleId, m.roleDisplay].filter(Boolean).map((s) => s.toLowerCase()).join(' ');
      let m = members.find((m) => !used.has(m.agent_id) && keys.some((k) => roleText(m).split(' ').includes(k)));
      if (!m) m = members.find((m) => !used.has(m.agent_id) && keys.some((k) => roleText(m).includes(k)));
      if (!m) m = members.find((m) => !used.has(m.agent_id));
      if (m) { used.add(m.agent_id); return m.agent_id; }
      return null;
    };
    ids['setup'] = pick(['devops', 'ops', 'infra', 'platform']);
    ids['core'] = pick(['backend_engineer', 'backend', 'engineer', 'developer']);
    ids['ui'] = pick(['frontend_engineer', 'frontend', 'designer', 'ui']);
    ids['integration'] = pick(['backend_engineer', 'backend', 'integration', 'api']);
    ids['polish'] = pick(['qa', 'quality', 'test']);
  } catch { /* fallback to nulls */ }
  return ids;
}

function loadTeamAgentNames(root, slug) {
  const names = { ...DEFAULT_AGENT_NAMES };
  try {
    let teamPath = join(getProjectsDir(root), slug, 'team.json');
    if (!existsSync(teamPath)) {
      const oguRoot = process.env.OGU_ROOT;
      if (oguRoot && oguRoot !== root) teamPath = join(getProjectsDir(oguRoot), slug, 'team.json');
    }
    if (!existsSync(teamPath)) return names;
    const team = JSON.parse(readFileSync(teamPath, 'utf-8'));
    const members = team?.members?.filter((m) => m.status === 'active' && m.agent_name) || [];
    if (members.length === 0) return names;

    const used = new Set();
    const pick = (keywords) => {
      const roleOf = (m) => [m.role_id, m.role_display, m.roleId, m.roleDisplay].filter(Boolean).map((s) => s.toLowerCase()).join(' ');
      let m = members.find((m) => !used.has(m.agent_id) && keywords.some((k) => roleOf(m).split(' ').includes(k)));
      if (!m) m = members.find((m) => !used.has(m.agent_id) && keywords.some((k) => roleOf(m).includes(k)));
      if (!m) m = members.find((m) => !used.has(m.agent_id));
      if (!m) m = members[0];
      if (m) { used.add(m.agent_id); return m.agent_name; }
      return null;
    };

    const n = pick(['devops', 'ops', 'infra', 'platform']); if (n) names['setup'] = n;
    const n2 = pick(['backend_engineer', 'backend', 'engineer', 'developer', 'fullstack']); if (n2) names['core'] = n2;
    const n3 = pick(['frontend_engineer', 'frontend', 'designer', 'ui', 'ux']); if (n3) names['ui'] = n3;
    const n4 = pick(['backend_engineer', 'backend', 'integration', 'api']); if (n4) names['integration'] = n4;
    const n5 = pick(['qa', 'quality', 'test']); if (n5) names['polish'] = n5;
  } catch { /* fallback */ }
  return names;
}

// ── DAG Wave Builder ──

function buildWaves(tasks, isDone) {
  const pending = tasks.filter((t) => !isDone(t));
  const resolved = new Set(tasks.filter((t) => isDone(t)).map((t) => t.id));
  const waves = [];
  const remaining = new Set(pending.map((t) => t.id));

  while (remaining.size > 0) {
    const wave = [];
    for (const t of pending) {
      if (!remaining.has(t.id)) continue;
      const deps = t.depends_on || [];
      if (deps.every((d) => resolved.has(d))) wave.push(t);
    }
    if (wave.length === 0) {
      for (const t of pending) {
        if (remaining.has(t.id)) wave.push(t);
      }
    }
    for (const t of wave) {
      remaining.delete(t.id);
      resolved.add(t.id);
    }
    waves.push(wave);
  }
  return waves;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const safeLimit = Math.max(1, limit);
  const runners = Array.from({ length: Math.min(items.length, safeLimit) }, async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) break;
      try {
        results[current] = { status: 'fulfilled', value: await worker(items[current]) };
      } catch (err) {
        results[current] = { status: 'rejected', reason: err };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

// ── Mark task done in Plan.json ──

function markTaskDone(root, slug, taskId) {
  const planPath = join(root, 'docs/vault/04_Features', slug, 'Plan.json');
  try {
    const plan = JSON.parse(readFileSync(planPath, 'utf-8'));
    const task = plan.tasks.find((t) => t.id === taskId);
    if (task) {
      task.done = true;
      writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', 'utf-8');
    }
  } catch { /* best effort */ }
}

// ── Budget check ──

function checkBudget(root) {
  try {
    const budgetPath = join(getBudgetDir(root), 'budget-state.json');
    if (!existsSync(budgetPath)) return { ok: true };
    const state = JSON.parse(readFileSync(budgetPath, 'utf-8'));
    const limit = state.dailyLimit || 10;
    const spent = state.todaySpent || 0;
    if (spent >= limit) {
      return { ok: false, reason: `Daily budget exhausted ($${spent.toFixed(2)}/$${limit.toFixed(2)})` };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

// ── Local Task Gates ──

function resolveGroup(task) {
  return resolveTaskGroup({
    group: task.group,
    title: task.title,
    name: task.id,
    touches: task.touches || [],
  });
}

function getContextKeys(task) {
  const deps = [
    ...(Array.isArray(task.depends_on) ? task.depends_on : []),
    ...(Array.isArray(task.dependsOn) ? task.dependsOn : []),
  ].filter(Boolean);
  return [...new Set(deps.map((id) => buildHandoffKey(id)))];
}

function buildHandoffSummary(task, output, localGates) {
  const files = Array.isArray(output?.files) ? output.files.map((f) => f.path).filter(Boolean) : [];
  const gateResults = Array.isArray(output?.gateResults)
    ? output.gateResults
    : localGates
      ? [{ gate: `task-${resolveGroup(task)}`, passed: localGates.passed === true, message: (localGates.errors || []).join('; ').slice(0, 2000) }]
      : [];
  return {
    taskId: task.id,
    title: task.title || task.id,
    group: resolveGroup(task),
    status: output?.status || (localGates?.passed ? 'success' : 'unknown'),
    files,
    gateResults,
    warnings: localGates?.warnings || [],
    completedAt: new Date().toISOString(),
  };
}

async function runLocalGates(root, task) {
  const warnings = [];
  const preflight = preflightTaskSpec(root, task);
  if (!preflight.ok) {
    return { passed: false, errors: preflight.errors, warnings: preflight.warnings || [] };
  }
  warnings.push(...(preflight.warnings || []));
  const gateTask = {
    ...task,
    title: task.title || task.id,
    touches: preflight.touches || task.touches || [],
    group: preflight.group || task.group,
  };
  const gateCheck = await runTaskGates(root, gateTask, { runTests: true });
  warnings.push(...(gateCheck.warnings || []));
  return { passed: gateCheck.passed, errors: gateCheck.errors || [], warnings };
}

function buildActionableFixNote(task, rawErr, root) {
  const preflight = preflightTaskSpec(root, task);
  const taskForFix = {
    ...task,
    title: task.title || task.id,
    touches: preflight.touches || task.touches || [],
    group: preflight.group || task.group,
  };
  return buildTaskFixNote(taskForFix, { rawError: rawErr, errors: [] }, root);
}

// ── Execute single task via CLI ──

function executeTask(root, slug, task, fixNote, tierOverride, extraTouches, agentId, contextKeys) {
  return new Promise((resolve_) => {
    if (isPipelineAborted(slug, root)) {
      return resolve_({ taskId: task.id, success: false, error: 'Aborted' });
    }

    const cli = getCliPath();
    const role = GROUP_ROLES[resolveGroup(task)] || 'backend-dev';

    const MODEL_TO_TIER = { haiku: 'fast', sonnet: 'standard', opus: 'premium' };
    const tier = tierOverride || MODEL_TO_TIER[task.model || ''] || null;

    const args = [cli, 'agent:run', '--feature', slug, '--task', task.id, '--role', role];
    if (tier) args.push('--tier', tier);

    const allTouches = [...new Set([...(task.touches || []), ...(extraTouches || [])])];
    if (allTouches.length > 0) args.push('--touches', allTouches.join(','));
    if (fixNote) args.push('--fix-note', fixNote);

    const contextList = (contextKeys && contextKeys.length > 0) ? contextKeys : getContextKeys(task);
    for (const key of contextList) args.push('--context', key);

    broadcast({ type: 'task:dispatched', taskId: task.id, title: task.title, roleId: role, model: task.model || 'sonnet' });

    const heartbeat = setInterval(() => {
      touchDispatchState(root, slug, { dispatchStatus: 'running' });
    }, 15000);

    const handleSuccess = async () => {
      let runnerGatesPassed = false;
      let output = null;
      try {
        output = readRunnerOutput(root, task.id);
        if (hasRunnerGatePass(output)) {
          runnerGatesPassed = true;
          writeTaskGateEvidence(root, task.id, { passed: true, source: 'runner', gateResults: output?.gateResults || [] });
        }
      } catch { /* fall back to local gates */ }

      if (runnerGatesPassed) {
        try { writeHandoffContext(root, slug, task.id, buildHandoffSummary(task, output)); } catch { /* best effort */ }
        resolve_({ taskId: task.id, success: true });
        return;
      }

      const localGates = await runLocalGates(root, task);
      if (localGates.warnings.length > 0) {
        console.warn(`[local-gates] ${task.id} warnings: ${localGates.warnings.join(', ')}`);
      }
      if (!localGates.passed) {
        console.error(`[local-gates] ${task.id} FAILED: ${localGates.errors.join(', ')}`);
        taskFailureStore.set(task.id, {
          errors: localGates.errors,
          group: resolveGroup(task),
          agentId: agentId || null,
          failedAt: Date.now(),
        });
        writeTaskGateEvidence(root, task.id, { passed: false, source: 'local', errors: localGates.errors, warnings: localGates.warnings });
        resolve_({ taskId: task.id, success: false, error: formatGateErrorsForFix(localGates.errors) });
      } else {
        writeTaskGateEvidence(root, task.id, { passed: true, source: 'local', warnings: localGates.warnings });
        try {
          const output2 = output || readRunnerOutput(root, task.id);
          writeHandoffContext(root, slug, task.id, buildHandoffSummary(task, output2, localGates));
        } catch { /* best effort */ }
        resolve_({ taskId: task.id, success: true });
      }
    };

    if (EXEC_MODE === 'inproc') {
      (async () => {
        try {
          const { runAgentTask } = await import(`${LIB_DIR}/agent-run.mjs`);
          const result = await Promise.race([
            runAgentTask({ root, feature: slug, task: task.id, role, tier, dryRun: false, simulate: false, simulateFailure: 0, risk: undefined, touches: allTouches, contextKeys: contextList, fixNote }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Task timeout')), TASK_TIMEOUT_MS)),
          ]);
          clearInterval(heartbeat);
          if (result?.exitCode === 0) {
            await handleSuccess();
          } else {
            resolve_({ taskId: task.id, success: false, error: result?.error || 'Task failed' });
          }
        } catch (err) {
          clearInterval(heartbeat);
          resolve_({ taskId: task.id, success: false, error: err.message || 'Task failed' });
        }
      })();
      return;
    }

    const child = spawn('node', args, {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    registerChild(root, slug, child);

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => { child.kill('SIGTERM'); }, TASK_TIMEOUT_MS);

    child.on('close', async (code) => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      unregisterChild(root, slug, child);
      if (code === 0) {
        await handleSuccess();
      } else {
        const outTail = stdout.slice(-800).trim();
        const errTail = stderr.slice(-400).trim();
        const errorReport = [outTail ? `STDOUT:\n${outTail}` : '', errTail ? `STDERR:\n${errTail}` : ''].filter(Boolean).join('\n\n') || `Exit code ${code}`;
        console.error(`[dispatch] Task ${task.id} failed (exit ${code}): ${errTail || outTail.slice(-200)}`);
        resolve_({ taskId: task.id, success: false, error: errorReport });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      unregisterChild(root, slug, child);
      resolve_({ taskId: task.id, success: false, error: err.message });
    });
  });
}

// ── Broadcast state helper ──
// Simplified — broadcasts dispatch state directly without loading project-state.js

async function broadcastState(root, slug) {
  try {
    const state = readDispatchState(root, slug);
    if (state) {
      broadcast({ type: 'project:state_changed', slug, state });
    }
  } catch { /* best effort */ }
}

// ── Retry failed tasks ──

export async function retryFailedTasks(root, slug) {
  const planPath = join(root, 'docs/vault/04_Features', slug, 'Plan.json');
  if (!existsSync(planPath)) return { retried: [], errors: ['Plan.json not found'] };

  let plan;
  try {
    plan = JSON.parse(readFileSync(planPath, 'utf-8'));
  } catch {
    return { retried: [], errors: ['Failed to parse Plan.json'] };
  }

  const failed = plan.tasks.filter((t) => !hasTaskGateEvidence(root, t.id));
  const runnersDir = getRunnersDir(root);
  const toRetry = failed.filter((t) => {
    const inputExists = existsSync(join(runnersDir, `${t.id}.input.json`));
    if (!inputExists) return false;
    const output = readRunnerOutput(root, t.id);
    const gatePassed = hasTaskGateEvidence(root, t.id);
    if (!output) return true;
    if (gatePassed) return false;
    return output.status !== 'success';
  });

  if (toRetry.length === 0) return { retried: [], errors: ['No failed tasks to retry'] };

  const think = (text) => broadcast({ type: 'cto:thinking_line', slug, text });
  think(`Retrying ${toRetry.length} failed task(s): ${toRetry.map((t) => t.title).join(', ')}`);

  const mainRoot = process.env.OGU_MAIN_ROOT || root;
  const agentIds = loadTeamAgentIds(mainRoot, slug);

  const results = await runWithConcurrency(toRetry, MAX_PARALLEL_TASKS, (task) => {
    const group = resolveGroup(task);
    broadcast({ type: 'task:dispatched', taskId: task.id, title: task.title, roleId: GROUP_ROLES[group] || 'backend-dev', model: task.model || 'sonnet' });
    return executeTask(root, slug, task, undefined, undefined, undefined, agentIds[group] || null);
  });

  const retried = [];
  const errors = [];
  let candidatesCreated = 0;

  for (const result of results) {
    const res = result.status === 'fulfilled' ? result.value : { taskId: '?', success: false, error: 'Promise rejected' };
    const taskObj = toRetry.find((t) => t.id === res.taskId);
    const group = taskObj ? resolveGroup(taskObj) : 'core';
    if (res.success) {
      retried.push(res.taskId);
      markTaskDone(root, slug, res.taskId);
      think(`Retry succeeded: "${taskObj?.title || res.taskId}"`);
      broadcast({ type: 'task:completed', taskId: res.taskId, title: taskObj?.title || '', roleId: GROUP_ROLES[group] || '', result: 'done' });

      const storedFailure = taskFailureStore.get(res.taskId);
      if (storedFailure?.agentId) {
        try {
          const normalizedSignals = normalizeGateErrors(storedFailure.errors, storedFailure.group);
          const fingerprint = computeCandidateFingerprint(storedFailure.agentId, storedFailure.group, normalizedSignals);
          if (!isDuplicateCandidate(fingerprint)) {
            const { createLearningCandidate } = await import(`${LIB_DIR}/learning-event.mjs`);
            createLearningCandidate(root, {
              agentId: storedFailure.agentId,
              taskType: GROUP_ROLES[storedFailure.group] || 'backend-dev',
              contextSignature: [`gate:local-${storedFailure.group}`, `group:${storedFailure.group}`],
              failureSignals: normalizedSignals,
              resolutionSummary: `Resolved local ${storedFailure.group} gate on retry. Signals: ${normalizedSignals.slice(0, 2).join('; ')}`,
              iterationCount: 2,
              trigger: 'local_gate_failure',
            });
            candidatesCreated++;
          }
        } catch { /* best-effort */ }
        taskFailureStore.delete(res.taskId);
      }
    } else {
      errors.push(`${res.taskId}: ${res.error}`);
      think(`Retry failed: "${taskObj?.title || res.taskId}"`);
      broadcast({ type: 'task:failed', taskId: res.taskId, title: taskObj?.title || '', roleId: GROUP_ROLES[group] || '', error: res.error || 'Unknown' });
    }
  }

  if (candidatesCreated > 0) {
    console.log(`[learning] ${candidatesCreated} candidate(s) written — training will run in batch`);
  }

  await broadcastState(root, slug);
  return { retried, errors };
}

// ── Auto-pipeline phases ──

const PIPELINE_PHASES = [
  {
    phase: 'building',
    next: 'verifying',
    label: 'Build complete — ready for verification',
    successMsg: 'Build complete — run verification to validate quality',
    failMsg: 'Build phase failed',
    // args: undefined = pass-through phase (no CLI run)
  },
];

async function autoContinuePipeline(root, slug) {
  if (!isPipelineActive(slug, root)) {
    if (!acquirePipelineLock(slug, 'auto-pipeline', root)) {
      console.log(`[pipeline] Already running for ${slug}, skipping auto-pipeline`);
      return;
    }
  }

  const think = (text) => broadcast({ type: 'cto:thinking_line', slug, text });
  let finalStatus = 'completed';
  let finalError = null;

  try {
    for (const step of PIPELINE_PHASES) {
      updateDispatchState(root, slug, { pipelinePhase: step.phase, pipelineStatus: 'running' }, { heartbeat: true });
      think(step.label);

      if (!step.args) {
        // Pass-through phase — just transition FSM state
        try {
          const { transitionFeature } = await import(`${LIB_DIR}/state-machine.mjs`);
          transitionFeature(root, slug, step.next, {
            reason: `Auto-pipeline: ${step.phase} → ${step.next}`,
            actor: 'pipeline',
          });
        } catch { /* best effort */ }

        think(step.successMsg);
        await broadcastState(root, slug);

        if (step.next === 'verifying') {
          // Auto-install dependencies if missing
          if (!existsSync(join(root, 'node_modules')) && existsSync(join(root, 'package.json'))) {
            think('Installing dependencies...');
            try {
              const pkgMgr = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm install'
                           : existsSync(join(root, 'yarn.lock'))      ? 'yarn install'
                           : 'npm install';
              await new Promise((res) => {
                const parts = pkgMgr.split(' ');
                const proc = spawn(parts[0], parts.slice(1), {
                  cwd: root, stdio: 'ignore', env: { ...process.env, CI: 'true' },
                });
                proc.on('close', () => res());
                proc.on('error', () => res());
              });
              think('Dependencies installed');
            } catch { think('npm install failed — continuing anyway'); }
          }
          broadcast({ type: 'build:complete', slug });
        }
        continue;
      }

      // Phase with CLI args — run with iterative auto-fix loop
      const MAX_FIX_CYCLES = 2;
      let stepPassed = false;
      for (let cycle = 0; cycle <= MAX_FIX_CYCLES; cycle++) {
        if (cycle > 0) think(`Gate fix applied — retrying ${step.label}`);
        touchDispatchState(root, slug, { pipelinePhase: step.phase, pipelineStatus: 'running' });
        const success = await runPipelineStep(root, slug, step, think);
        if (success) { stepPassed = true; break; }
        think(`Gates failed (cycle ${cycle + 1}/${MAX_FIX_CYCLES + 1}) — attempting auto-fix...`);
        const fixed = await autoFixGateFailure(root, slug, step.phase, think, cycle);
        if (!fixed) break;
      }

      if (stepPassed) {
        try {
          const { transitionFeature } = await import(`${LIB_DIR}/state-machine.mjs`);
          transitionFeature(root, slug, step.next, {
            reason: `Auto-pipeline: ${step.phase} → ${step.next}`,
            actor: 'pipeline',
          });
        } catch { /* best effort */ }
        think(step.successMsg);
        broadcast({ type: 'compile:completed', slug, phase: step.phase });
      } else {
        finalStatus = 'failed';
        finalError = step.failMsg;
        think(step.failMsg);
        broadcast({ type: 'compile:failed', slug, phase: step.phase });
        break;
      }
    }
  } catch (err) {
    finalStatus = 'failed';
    finalError = err.message;
    console.error('[pipeline] Auto-pipeline error:', err);
  } finally {
    releasePipelineLock(slug, root, { pipelineStatus: finalStatus, lastError: finalError });
    await broadcastState(root, slug);
  }
}

async function runPipelineStep(root, slug, step, think) {
  return new Promise((resolve_) => {
    think(`Running ${step.phase}...`);
    const cli = getCliPath();
    const args = [cli, ...(step.args ? step.args(slug) : [])];
    const child = spawn('node', args, {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => { stdout += c; });
    child.stderr?.on('data', (c) => { stderr += c; });
    child.on('close', (code) => {
      if (code === 0) {
        resolve_(true);
      } else {
        console.error(`[pipeline] ${step.phase} failed: ${stderr.slice(-300)}`);
        resolve_(false);
      }
    });
    child.on('error', () => resolve_(false));
  });
}

async function autoFixGateFailure(root, slug, phase, think, cycle) {
  // Placeholder — for now we can't auto-fix without knowing which gate failed
  // This will be enhanced when gate output is parseable
  return false;
}

// ── Main dispatcher ──

export async function dispatchProject(root, slug) {
  const planPath = join(root, 'docs/vault/04_Features', slug, 'Plan.json');
  if (!existsSync(planPath)) {
    console.error(`[dispatch] Plan.json not found: ${planPath}`);
    return;
  }

  let plan;
  try {
    plan = JSON.parse(readFileSync(planPath, 'utf-8'));
  } catch (err) {
    console.error(`[dispatch] Failed to parse Plan.json:`, err);
    return;
  }

  if (!plan.tasks?.length) {
    console.log(`[dispatch] No tasks in Plan.json for ${slug}`);
    return;
  }

  // Team must be approved before dispatch
  try {
    const teamPath = join(getProjectsDir(root), slug, 'team.json');
    if (!existsSync(teamPath)) {
      console.warn(`[dispatch] Team not found for ${slug} — approval required`);
      broadcast({ type: 'dispatch:error', slug, error: 'Team not approved' });
      return;
    }
    const team = JSON.parse(readFileSync(teamPath, 'utf-8'));
    if (!team?.approved && !team?.approved_at) {
      console.warn(`[dispatch] Team not approved for ${slug}`);
      broadcast({ type: 'dispatch:error', slug, error: 'Team not approved' });
      return;
    }
  } catch { /* best effort */ }

  abortedPipelines.delete(slug);

  const isTaskDone = (task) => hasTaskGateEvidence(root, task.id);
  const waves = buildWaves(plan.tasks, isTaskDone);
  console.log(`[dispatch] ${slug}: ${plan.tasks.length} tasks in ${waves.length} waves`);

  updateDispatchState(root, slug, {
    dispatchStatus: 'running',
    dispatchStartedAt: nowIso(),
    dispatchCompletedAt: null,
    lastError: null,
    totalTasks: plan.tasks.length,
    totalWaves: waves.length,
    waveIndex: 0,
    completedCount: 0,
    failedCount: 0,
    aborted: false,
    paused: false,
  }, { heartbeat: true });

  const mainRoot = process.env.OGU_MAIN_ROOT || root;
  const agentNames = loadTeamAgentNames(mainRoot, slug);
  const agentIds = loadTeamAgentIds(mainRoot, slug);

  const think = (text) => broadcast({ type: 'cto:thinking_line', slug, text });

  think(`Building project in ${waves.length} wave${waves.length > 1 ? 's' : ''} (${plan.tasks.length} tasks total)`);
  broadcast({ type: 'dispatch:started', slug, totalTasks: plan.tasks.length, totalWaves: waves.length });

  let completedCount = 0;
  let failedCount = 0;

  const WAVE_DESCRIPTIONS = [
    'Setting up project foundation',
    'Building core features',
    'Adding UI and interactions',
    'Wiring up integrations',
    'Final polish and quality checks',
  ];

  for (let wi = 0; wi < waves.length; wi++) {
    // Abort check
    if (abortedPipelines.has(slug)) {
      think('Execution aborted by user');
      broadcast({ type: 'dispatch:aborted', slug });
      updateDispatchState(root, slug, { dispatchStatus: 'aborted', dispatchCompletedAt: nowIso(), lastError: 'aborted' }, { heartbeat: true });
      await broadcastState(root, slug);
      return;
    }

    // Pause check
    if (isPipelinePaused(slug, root)) {
      think('Execution paused — waiting for resume...');
      broadcast({ type: 'dispatch:paused', slug });
      await broadcastState(root, slug);
      const resumed = await waitIfPaused(slug, root);
      if (!resumed) {
        think('Execution aborted while paused');
        broadcast({ type: 'dispatch:aborted', slug });
        updateDispatchState(root, slug, { dispatchStatus: 'aborted', dispatchCompletedAt: nowIso(), lastError: 'aborted' }, { heartbeat: true });
        await broadcastState(root, slug);
        return;
      }
      think('Execution resumed');
      broadcast({ type: 'dispatch:resumed', slug });
    }

    const wave = waves[wi];
    const waveDesc = WAVE_DESCRIPTIONS[wi] || `Processing wave ${wi + 1}`;
    think(`Wave ${wi + 1}/${waves.length}: ${waveDesc} (${wave.length} task${wave.length > 1 ? 's' : ''})`);

    touchDispatchState(root, slug, { dispatchStatus: 'running', waveIndex: wi, completedCount, failedCount });

    const budget = checkBudget(root);
    if (!budget.ok) {
      think('Budget limit reached — pausing execution');
      broadcast({ type: 'budget:exhausted', dailyLimit: 0, spent: 0 });
      updateDispatchState(root, slug, { dispatchStatus: 'failed', dispatchCompletedAt: nowIso(), lastError: budget.reason || 'budget exhausted' }, { heartbeat: true });
      break;
    }

    broadcast({ type: 'wave:started', waveIndex: wi, taskCount: wave.length });

    const results = await runWithConcurrency(
      wave,
      MAX_PARALLEL_TASKS,
      (task) => executeTask(root, slug, task, undefined, undefined, undefined, agentIds[resolveGroup(task)] || null),
    );

    let waveSuccess = 0;
    let waveFail = 0;
    const waveResultMap = new Map();
    const toRetryItems = [];

    for (const result of results) {
      const res = result.status === 'fulfilled' ? result.value : { taskId: '?', success: false, error: 'Promise rejected' };
      const taskObj = wave.find((t) => t.id === res.taskId);
      const taskGroup = taskObj?.group || 'core';
      const taskRole = GROUP_ROLES[taskGroup] || '';
      const agentName = agentNames[taskGroup] || DEFAULT_AGENT_NAMES[taskGroup] || 'Agent';

      if (res.success) {
        completedCount++;
        waveSuccess++;
        waveResultMap.set(res.taskId, true);
        markTaskDone(root, slug, res.taskId);
        think(`${agentName} completed: "${taskObj?.title || res.taskId}"`);
        broadcast({ type: 'task:completed', taskId: res.taskId, title: taskObj?.title || '', roleId: taskRole, result: 'done' });
      } else {
        failedCount++;
        waveFail++;
        waveResultMap.set(res.taskId, false);
        think(`${agentName} encountered an issue on "${taskObj?.title || res.taskId}"`);
        broadcast({ type: 'task:failed', taskId: res.taskId, title: taskObj?.title || '', roleId: taskRole, error: res.error || 'Unknown error' });
        if (taskObj) {
          const fixNote = buildActionableFixNote(taskObj, res.error || 'Unknown error', root);
          toRetryItems.push({ task: taskObj, fixNote, agentName, taskRole });
        }
      }
    }

    // Dependency sync (single pass)
    if (toRetryItems.length > 0 && !isPipelineAborted(slug, root) && !isPipelinePaused(slug, root)) {
      const aliasPrefixes = getAliasPrefixes(root);
      const missingDeps = new Set();
      for (const result of results) {
        const res = result.status === 'fulfilled' ? result.value : { taskId: '?', success: false, error: '' };
        if (res.success) continue;
        for (const dep of extractMissingDeps(String(res.error || ''), aliasPrefixes)) missingDeps.add(dep);
      }
      if (missingDeps.size > 0) {
        const depList = [...missingDeps];
        const lockTouches = getLockfileTouches(root);
        const depTask = {
          id: `deps-sync-${slug}-w${wi + 1}`,
          title: `Sync dependencies for wave ${wi + 1}`,
          group: 'setup',
          touches: ['package.json', ...lockTouches],
        };
        const depFixNote = ['DEPENDENCY SYNC:', 'Update package.json to include ALL of these dependencies under "dependencies":', ...depList.map((d) => `- ${d}`), '', 'Use compatible versions; if unsure, use "latest". Do not remove existing deps.', 'After updating package.json, run the package manager install to update lockfiles.'].join('\n');
        think(`Resolving missing dependencies before retry: ${depList.join(', ')}`);
        await executeTask(root, slug, depTask, depFixNote, undefined, depTask.touches, agentIds['setup'] || null);
      }
    }

    // Auto-retry pass 1
    if (toRetryItems.length > 0 && !isPipelineAborted(slug, root) && !isPipelinePaused(slug, root)) {
      think(`Reviewing ${toRetryItems.length} failed task(s) — sending fix notes and retrying...`);
      broadcast({ type: 'wave:retry_started', waveIndex: wi, count: toRetryItems.length });

      const retryResults = await runWithConcurrency(
        toRetryItems,
        MAX_PARALLEL_TASKS,
        ({ task, fixNote }) => executeTask(root, slug, task, fixNote, undefined, undefined, agentIds[resolveGroup(task)] || null),
      );

      const toRetry2 = [];

      for (let ri = 0; ri < retryResults.length; ri++) {
        const rr = retryResults[ri];
        const item = toRetryItems[ri];
        const res = rr.status === 'fulfilled' ? rr.value : { taskId: item.task.id, success: false, error: 'Promise rejected on retry' };

        if (res.success) {
          completedCount++; failedCount--; waveFail--; waveSuccess++;
          waveResultMap.set(res.taskId, true);
          markTaskDone(root, slug, res.taskId);
          think(`${item.agentName} fixed "${item.task.title}" on retry`);
          broadcast({ type: 'task:completed', taskId: res.taskId, title: item.task.title || '', roleId: item.taskRole, result: 'retry-success' });
        } else {
          const fixNote2 = buildActionableFixNote(item.task, res.error || item.fixNote, root);
          toRetry2.push({ ...item, fixNote: fixNote2 });
        }
      }

      // Auto-retry pass 2 (premium tier)
      if (toRetry2.length > 0 && !isPipelineAborted(slug, root) && !isPipelinePaused(slug, root)) {
        think(`${toRetry2.length} task(s) still failing — final retry attempt...`);
        const retry2Results = await runWithConcurrency(
          toRetry2,
          MAX_PARALLEL_TASKS,
          ({ task, fixNote }) => executeTask(root, slug, task, fixNote, 'premium', undefined, agentIds[resolveGroup(task)] || null),
        );
        for (let ri = 0; ri < retry2Results.length; ri++) {
          const rr = retry2Results[ri];
          const item = toRetry2[ri];
          const res = rr.status === 'fulfilled' ? rr.value : { taskId: item.task.id, success: false, error: 'Promise rejected on retry 2' };
          if (res.success) {
            completedCount++; failedCount--; waveFail--; waveSuccess++;
            waveResultMap.set(res.taskId, true);
            markTaskDone(root, slug, res.taskId);
            think(`${item.agentName} fixed "${item.task.title}" on second retry`);
            broadcast({ type: 'task:completed', taskId: res.taskId, title: item.task.title || '', roleId: item.taskRole, result: 'retry2-success' });
          } else {
            console.error(`[dispatch] Retry 2 failed for ${item.task.id}: ${res.error}`);
            think(`${item.agentName} could not fix "${item.task.title}" — skipping`);
          }
        }
      }

      await broadcastState(root, slug);
    }

    // Wave summary
    if (waveFail === 0) {
      think(`Wave ${wi + 1} complete — ${waveSuccess}/${wave.length} tasks passed`);
    } else {
      think(`Wave ${wi + 1} finished — ${waveSuccess} passed, ${waveFail} still failing after retry`);
    }

    updateDispatchState(root, slug, { dispatchStatus: 'running', waveIndex: wi, completedCount, failedCount }, { heartbeat: true });
    await broadcastState(root, slug);

    const finalResults = wave.map((t) => ({ taskId: t.id, success: waveResultMap.get(t.id) === true }));
    broadcast({ type: 'wave:completed', waveIndex: wi, results: finalResults, passed: waveSuccess, total: wave.length });
  }

  console.log(`[dispatch] ${slug}: Complete. ${completedCount} done, ${failedCount} failed.`);

  const currentDispatch = readDispatchState(root, slug);
  const finalizedStatus = currentDispatch?.dispatchStatus && currentDispatch.dispatchStatus !== 'running'
    ? currentDispatch.dispatchStatus
    : (failedCount === 0 ? 'completed' : 'failed');
  const finalizedError = currentDispatch?.dispatchStatus && currentDispatch.dispatchStatus !== 'running'
    ? (currentDispatch.lastError ?? null)
    : (failedCount > 0 ? `${failedCount} task(s) failed` : null);

  updateDispatchState(root, slug, {
    dispatchStatus: finalizedStatus,
    dispatchCompletedAt: currentDispatch?.dispatchCompletedAt ?? nowIso(),
    completedCount,
    failedCount,
    waveIndex: Math.max(0, waves.length - 1),
    lastError: finalizedError,
  }, { heartbeat: true });

  // Batch training
  try {
    const { trainAll } = await import(`${LIB_DIR}/agent-trainer.mjs`);
    const trainResult = await trainAll(root, { playbooksDir: join(mainRoot, 'tools/ogu/playbooks') });
    if (trainResult.trained > 0) {
      console.log(`[learning] Batch training: ${trainResult.trained} agent(s) updated`);
    }
  } catch { /* best-effort */ }

  if (failedCount === 0) {
    think(`All ${completedCount} tasks completed successfully`);
    think('Preparing for verification and quality gates...');
  } else {
    think(`Execution complete: ${completedCount} passed, ${failedCount} failed`);
  }

  broadcast({ type: 'dispatch:completed', slug, completedCount, failedCount });

  if (completedCount > 0) {
    try {
      const { transitionFeature } = await import(`${LIB_DIR}/state-machine.mjs`);
      think('Transitioning to build phase...');
      transitionFeature(root, slug, 'building', { reason: `Dispatch complete: ${completedCount} tasks done`, actor: 'dispatch' });
    } catch { /* best effort */ }

    if (failedCount > 0) {
      think(`${failedCount} task(s) could not be completed — proceeding to verification to assess overall quality`);
    } else {
      think('All tasks done — starting automated pipeline...');
    }

    acquirePipelineLock(slug, 'auto-pipeline', root);
    await broadcastState(root, slug);
    autoContinuePipeline(root, slug).catch((err) => {
      console.error('[dispatch] Auto-pipeline failed:', err);
      broadcast({ type: 'pipeline:error', slug, error: String(err?.message || err) });
    });
  } else {
    await broadcastState(root, slug);
  }
}
