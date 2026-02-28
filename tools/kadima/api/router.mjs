/**
 * Kadima HTTP API Router.
 *
 * Handles CLI and Studio requests.
 * Pure Node.js — no Express/Fastify dependency.
 *
 * Endpoints:
 *   GET  /health                     — daemon health
 *   GET  /api/events                 — SSE event stream
 *   GET  /api/dashboard              — aggregated snapshot
 *   GET  /api/features               — list features
 *   GET  /api/features/:slug/timeline — feature event timeline
 *   GET  /api/compile/:slug/report   — compile report
 *   GET  /api/metrics                — system metrics
 *   GET  /api/budget                 — budget summary
 *   GET  /api/scheduler/status       — scheduler queue stats
 *   GET  /api/runners                — runner pool status
 *   POST /api/enqueue                — enqueue task(s) to scheduler
 *   POST /api/command                — execute an ogu CLI command
 *   GET  /api/task/:taskId           — get single task details
 *   POST /api/task/:taskId/cancel    — cancel a queued/dispatched task
 *   POST /api/scheduler/force-tick   — trigger immediate scheduler tick
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fork } from 'node:child_process';

// Track running CLI commands
const activeCommands = new Map();

export function createApiRouter({ root, runnerPool, loops, emitAudit, config, broadcaster }) {
  return async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method;

    // CORS for Studio
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // ── SSE Event Stream ──

      // GET /api/events — SSE stream of real-time events
      if (url.pathname === '/api/events' && method === 'GET') {
        const featureFilter = url.searchParams.get('feature') || undefined;
        broadcaster.addClient(res, { feature: featureFilter });
        return; // Keep connection open — SSE is long-lived
      }

      // ── Dashboard API ──

      // GET /api/dashboard — aggregated system snapshot
      if (url.pathname === '/api/dashboard' && method === 'GET') {
        return json(res, 200, buildDashboard(root, runnerPool, loops));
      }

      // Health check — extended with circuit breakers, freeze, org health
      if (url.pathname === '/health' && method === 'GET') {
        const mem = process.memoryUsage();
        const guards = checkSystemGuards(root, 'health');
        const circuitBreakers = loadCircuitBreakerStatus(root);
        const freezeStatus = loadFreezeStatus(root);
        const metricsSnapshot = loadMetricsSnapshot(root);
        const consistencyLoop = loops.find(l => l.name === 'consistency');

        // Determine overall status
        let status = 'healthy';
        if (guards.blocked) status = 'blocked';
        else if (circuitBreakers.openCount > 0) status = 'degraded';
        else if (metricsSnapshot?.health?.status === 'critical') status = 'critical';
        else if (metricsSnapshot?.health?.status === 'degraded') status = 'degraded';

        return json(res, 200, {
          status,
          uptime: process.uptime(),
          pid: process.pid,
          loops: loops.map(l => ({
            name: l.name,
            running: l.isRunning,
            lastTick: l.lastTick,
            tickCount: l.tickCount,
          })),
          runners: runnerPool.status(),
          memory: {
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
            rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
          },
          circuitBreakers,
          freeze: freezeStatus,
          orgHealth: metricsSnapshot?.health || null,
          consistency: consistencyLoop?.lastReport || null,
        });
      }

      // ── Features API ──

      // GET /api/features — list all features with current state
      if (url.pathname === '/api/features' && method === 'GET') {
        const featuresDir = join(root, '.ogu/state/features');
        const features = [];
        if (existsSync(featuresDir)) {
          for (const file of readdirSync(featuresDir)) {
            if (!file.endsWith('.state.json')) continue;
            try {
              const state = JSON.parse(readFileSync(join(featuresDir, file), 'utf8'));
              features.push({
                slug: state.slug || file.replace('.state.json', ''),
                currentState: state.currentState,
                transitions: state.transitions?.length || 0,
                createdAt: state.transitions?.[0]?.timestamp || null,
                updatedAt: state.transitions?.[state.transitions.length - 1]?.timestamp || null,
              });
            } catch { /* skip corrupt files */ }
          }
        }
        return json(res, 200, { features });
      }

      // GET /api/features/:slug/timeline — event timeline from state + audit
      const timelineMatch = url.pathname.match(/^\/api\/features\/([^/]+)\/timeline$/);
      if (timelineMatch && method === 'GET') {
        const slug = timelineMatch[1];
        const events = [];

        // State transitions from audit trail
        const auditPathForTransitions = join(root, '.ogu/audit/current.jsonl');
        if (existsSync(auditPathForTransitions)) {
          const lines = readFileSync(auditPathForTransitions, 'utf8').split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const evt = JSON.parse(line);
              if (evt.type === 'feature.transition' &&
                  (evt.payload?.slug === slug || evt.feature?.slug === slug)) {
                events.push({
                  type: 'feature.transition',
                  timestamp: evt.timestamp,
                  from: evt.payload?.from,
                  to: evt.payload?.to,
                });
              }
            } catch { /* skip bad lines */ }
          }
        }

        // Audit events for this feature (match by payload.slug, payload.featureSlug, or feature.slug)
        const auditPath = join(root, '.ogu/audit/current.jsonl');
        if (existsSync(auditPath)) {
          const lines = readFileSync(auditPath, 'utf8').split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const evt = JSON.parse(line);
              const matchesFeature =
                evt.payload?.slug === slug ||
                evt.payload?.featureSlug === slug ||
                evt.feature?.slug === slug;
              if (matchesFeature && evt.type !== 'feature.transition') {
                events.push({
                  type: evt.type,
                  timestamp: evt.timestamp,
                  payload: evt.payload,
                });
              }
            } catch { /* skip bad lines */ }
          }
        }

        // Sort chronologically
        events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        return json(res, 200, { slug, events });
      }

      // ── Compile Report API ──

      // GET /api/compile/:slug/report — compile report
      const reportMatch = url.pathname.match(/^\/api\/compile\/([^/]+)\/report$/);
      if (reportMatch && method === 'GET') {
        const slug = reportMatch[1];
        const reportPath = join(root, `.ogu/reports/${slug}.compile.json`);
        if (!existsSync(reportPath)) {
          return json(res, 404, { error: 'Report not found', slug });
        }
        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        return json(res, 200, report);
      }

      // ── Metrics API ──

      // GET /api/metrics — system-wide metrics
      if (url.pathname === '/api/metrics' && method === 'GET') {
        // Features metrics
        const featuresDir = join(root, '.ogu/state/features');
        const byState = {};
        let totalFeatures = 0;
        if (existsSync(featuresDir)) {
          for (const file of readdirSync(featuresDir)) {
            if (!file.endsWith('.state.json')) continue;
            try {
              const state = JSON.parse(readFileSync(join(featuresDir, file), 'utf8'));
              totalFeatures++;
              const s = state.currentState || 'unknown';
              byState[s] = (byState[s] || 0) + 1;
            } catch { /* skip */ }
          }
        }

        // Budget metrics
        const today = new Date().toISOString().slice(0, 10);
        const budgetPath = join(root, '.ogu/budget/budget-state.json');
        let dailySpent = 0;
        let monthlySpent = 0;
        if (existsSync(budgetPath)) {
          const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
          if (budget.daily?.[today]) {
            dailySpent = budget.daily[today].spent || 0;
          }
          const month = today.slice(0, 7);
          if (budget.monthly?.[month]) {
            monthlySpent = budget.monthly[month].spent || 0;
          }
        }

        // Load limits from OrgSpec
        let dailyLimit = 100;
        let monthlyLimit = 2000;
        const orgSpecPath = join(root, '.ogu/org-spec.json');
        if (existsSync(orgSpecPath)) {
          try {
            const org = JSON.parse(readFileSync(orgSpecPath, 'utf8'));
            if (org.budget?.daily?.limit) dailyLimit = org.budget.daily.limit;
            if (org.budget?.monthly?.limit) monthlyLimit = org.budget.monthly.limit;
          } catch { /* use defaults */ }
        }

        // Scheduler metrics
        const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
        let totalTasks = 0;
        let completedTasks = 0;
        let pendingTasks = 0;
        let dispatchedTasks = 0;
        if (existsSync(schedulerPath)) {
          const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
          totalTasks = state.queue.length;
          completedTasks = state.queue.filter(t => t.status === 'completed').length;
          pendingTasks = state.queue.filter(t => t.status === 'pending').length;
          dispatchedTasks = state.queue.filter(t => t.status === 'dispatched').length;
        }

        return json(res, 200, {
          features: { total: totalFeatures, byState },
          budget: { dailySpent, dailyLimit, monthlySpent, monthlyLimit },
          scheduler: { totalTasks, completedTasks, pendingTasks, dispatchedTasks },
        });
      }

      // ── Budget API ──

      // GET /api/budget — budget summary
      if (url.pathname === '/api/budget' && method === 'GET') {
        const today = new Date().toISOString().slice(0, 10);
        const budgetPath = join(root, '.ogu/budget/budget-state.json');
        let dailySpent = 0;
        let monthlySpent = 0;
        let byModel = {};
        let byFeature = {};

        if (existsSync(budgetPath)) {
          const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
          if (budget.daily?.[today]) {
            dailySpent = budget.daily[today].spent || 0;
          }
          const month = today.slice(0, 7);
          if (budget.monthly?.[month]) {
            monthlySpent = budget.monthly[month].spent || 0;
          }
          byModel = budget.byModel || {};
          byFeature = budget.byFeature || {};
        }

        return json(res, 200, { dailySpent, monthlySpent, byModel, byFeature });
      }

      // ── Task Queueing API ──

      // POST /api/enqueue — enqueue task(s) directly to the scheduler
      if (url.pathname === '/api/enqueue' && method === 'POST') {
        const body = await readBody(req);

        // Check system guards (halt + freeze)
        const guardResult = checkSystemGuards(root, 'enqueue');
        if (guardResult.blocked) {
          emitAudit('api.enqueue_blocked', { reason: guardResult.reason });
          return json(res, 503, { error: guardResult.reason, blocked: true });
        }

        // Support single task or batch
        const tasks = Array.isArray(body.tasks) ? body.tasks : [body];

        if (!tasks.length || !tasks[0].taskId) {
          return json(res, 400, {
            error: 'Missing required field: taskId',
            usage: { taskId: 'string', featureSlug: 'string', priority: 'number (0-100)', estimatedCost: 'number', resourceType: 'string', blockedBy: 'string[]' },
          });
        }

        const results = [];
        for (const task of tasks) {
          try {
            const result = enqueueTaskToScheduler(root, {
              taskId: task.taskId,
              featureSlug: task.featureSlug || task.slug || 'unknown',
              priority: task.priority ?? 50,
              estimatedCost: task.estimatedCost ?? 0,
              resourceType: task.resourceType || 'model_call',
              blockedBy: task.blockedBy || [],
              teamId: task.teamId || null,
              taskSpec: task.taskSpec || null,
            });
            results.push(result);

            if (result.enqueued) {
              emitAudit('api.task_enqueued', {
                taskId: task.taskId,
                featureSlug: task.featureSlug,
                priority: task.priority ?? 50,
                source: 'http',
              });
              broadcaster.broadcast({
                type: 'task:enqueued',
                payload: { taskId: task.taskId, featureSlug: task.featureSlug, priority: task.priority ?? 50 },
              });
            }
          } catch (err) {
            results.push({ taskId: task.taskId, enqueued: false, error: err.message });
          }
        }

        const accepted = results.filter(r => r.enqueued).length;
        return json(res, accepted > 0 ? 200 : 400, {
          accepted,
          rejected: results.length - accepted,
          results,
        });
      }

      // POST /api/command — execute an ogu CLI command asynchronously
      if (url.pathname === '/api/command' && method === 'POST') {
        const body = await readBody(req);
        const { command: cmdName, args = [], requestId } = body;

        if (!cmdName) {
          return json(res, 400, { error: 'Missing required field: command' });
        }

        const rid = requestId || crypto.randomUUID();

        // Fork the CLI as a child process
        const cliPath = join(root, 'tools/ogu/cli.mjs');
        const cmdArgs = [cmdName, ...(Array.isArray(args) ? args : [args])];

        const child = fork(cliPath, cmdArgs, {
          cwd: root,
          env: { ...process.env, OGU_ROOT: root },
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        });

        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (chunk) => { stdout += chunk; });
        child.stderr?.on('data', (chunk) => { stderr += chunk; });

        // Track running commands
        const cmdStartedAt = new Date().toISOString();
        activeCommands.set(rid, { command: cmdName, args: cmdArgs, pid: child.pid, startedAt: cmdStartedAt, process: child });

        child.on('exit', (code) => {
          activeCommands.delete(rid);
          emitAudit('api.command_completed', {
            requestId: rid,
            command: cmdName,
            exitCode: code,
            durationMs: Date.now() - new Date(cmdStartedAt).getTime(),
          });
          broadcaster.broadcast({
            type: 'command:completed',
            payload: { requestId: rid, command: cmdName, exitCode: code },
          });
        });

        // Kill after 5 minutes
        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          emitAudit('api.command_timeout', { requestId: rid, command: cmdName });
        }, 300000);
        child.on('exit', () => clearTimeout(timeout));

        emitAudit('api.command_dispatched', { requestId: rid, command: cmdName, args: cmdArgs, pid: child.pid });

        return json(res, 202, {
          accepted: true,
          requestId: rid,
          command: cmdName,
          pid: child.pid,
          message: `Command "${cmdName}" dispatched`,
        });
      }

      // ── Single Task API ──

      // GET /api/task/:taskId — get single task details
      const taskGetMatch = url.pathname.match(/^\/api\/task\/([^/]+)$/);
      if (taskGetMatch && method === 'GET') {
        const taskId = decodeURIComponent(taskGetMatch[1]);
        const statePath = join(root, '.ogu/state/scheduler-state.json');
        if (!existsSync(statePath)) {
          return json(res, 404, { error: 'Task not found', taskId });
        }
        const state = JSON.parse(readFileSync(statePath, 'utf8'));
        const task = state.queue.find(t => t.taskId === taskId);
        if (!task) {
          return json(res, 404, { error: 'Task not found', taskId });
        }

        // Check if runner is active
        const runnerInfo = runnerPool.active.get(taskId);

        return json(res, 200, {
          ...task,
          runner: runnerInfo ? { pid: runnerInfo.pid, startedAt: runnerInfo.startedAt } : null,
        });
      }

      // POST /api/task/:taskId/cancel — cancel a queued or dispatched task
      const taskCancelMatch = url.pathname.match(/^\/api\/task\/([^/]+)\/cancel$/);
      if (taskCancelMatch && method === 'POST') {
        const taskId = decodeURIComponent(taskCancelMatch[1]);
        const statePath = join(root, '.ogu/state/scheduler-state.json');
        if (!existsSync(statePath)) {
          return json(res, 404, { error: 'Task not found', taskId });
        }
        const state = JSON.parse(readFileSync(statePath, 'utf8'));
        const task = state.queue.find(t => t.taskId === taskId);
        if (!task) {
          return json(res, 404, { error: 'Task not found', taskId });
        }
        if (task.status === 'completed') {
          return json(res, 400, { error: 'Cannot cancel completed task', taskId });
        }

        const previousStatus = task.status;

        // Kill runner if dispatched
        const runnerInfo = runnerPool.active.get(taskId);
        if (runnerInfo?.process) {
          runnerInfo.process.kill('SIGTERM');
        }

        task.status = 'cancelled';
        task.cancelledAt = new Date().toISOString();
        state.updatedAt = new Date().toISOString();
        writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

        emitAudit('api.task_cancelled', { taskId, previousStatus });
        broadcaster.broadcast({ type: 'task:cancelled', payload: { taskId } });

        return json(res, 200, { cancelled: true, taskId });
      }

      // ── Scheduler API ──

      // GET /api/scheduler/status
      if (url.pathname === '/api/scheduler/status' && method === 'GET') {
        const statePath = join(root, '.ogu/state/scheduler-state.json');
        if (!existsSync(statePath)) {
          return json(res, 200, { queue: [], total: 0 });
        }
        const state = JSON.parse(readFileSync(statePath, 'utf8'));
        return json(res, 200, {
          total: state.queue.length,
          pending: state.queue.filter(t => t.status === 'pending').length,
          dispatched: state.queue.filter(t => t.status === 'dispatched').length,
          completed: state.queue.filter(t => t.status === 'completed').length,
          cancelled: state.queue.filter(t => t.status === 'cancelled').length,
          updatedAt: state.updatedAt,
        });
      }

      // POST /api/scheduler/force-tick — trigger immediate scheduler tick
      if (url.pathname === '/api/scheduler/force-tick' && method === 'POST') {
        const schedulerLoop = loops.find(l => l.name === 'scheduler');
        if (!schedulerLoop) {
          return json(res, 404, { error: 'Scheduler loop not found' });
        }

        try {
          await schedulerLoop.forceTick();
          emitAudit('api.scheduler_force_tick', { tickCount: schedulerLoop.tickCount });
          return json(res, 200, { triggered: true, tickCount: schedulerLoop.tickCount });
        } catch (err) {
          return json(res, 500, { error: err.message });
        }
      }

      // Runners status
      if (url.pathname === '/api/runners' && method === 'GET') {
        return json(res, 200, runnerPool.status());
      }

      // ── Kadima Engine API ──

      // POST /api/allocate — allocate tasks via kadima-engine
      if (url.pathname === '/api/allocate' && method === 'POST') {
        const body = await readBody(req);
        const tasks = body.tasks || [];
        if (!tasks.length) {
          return json(res, 400, { error: 'Missing required field: tasks (array of { id, phase })' });
        }
        try {
          const { allocatePlan } = await import('../../ogu/commands/lib/kadima-engine.mjs');
          const results = allocatePlan(tasks, {
            root,
            featureSlug: body.featureSlug || 'unknown',
            persist: body.persist !== false,
            worktree: body.worktree || false,
          });
          emitAudit('api.allocate', { taskCount: tasks.length, allocated: results.length });
          return json(res, 200, { allocated: results.length, results });
        } catch (err) {
          return json(res, 500, { error: err.message });
        }
      }

      // GET /api/standup — generate standup report
      if (url.pathname === '/api/standup' && method === 'GET') {
        try {
          const { generateStandup } = await import('../../ogu/commands/lib/kadima-engine.mjs');
          const report = generateStandup(root, {
            eventLimit: parseInt(url.searchParams.get('eventLimit') || '50', 10),
            includeWorktrees: url.searchParams.get('worktrees') !== 'false',
          });
          return json(res, 200, report);
        } catch (err) {
          return json(res, 500, { error: err.message });
        }
      }

      // 404
      return json(res, 404, { error: 'Not found', path: url.pathname });

    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  };
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

/**
 * Enqueue a task into the formal scheduler.
 * Imports the scheduler lazily to avoid circular deps.
 */
function enqueueTaskToScheduler(root, taskDef) {
  const statePath = join(root, '.ogu/state/scheduler-state.json');
  let state;
  if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  } else {
    state = { version: 2, queue: [], virtualClocks: {}, updatedAt: new Date().toISOString() };
  }

  // Skip if already in queue
  if (state.queue.find(t => t.taskId === taskDef.taskId)) {
    return { taskId: taskDef.taskId, enqueued: false, reason: 'already in queue' };
  }

  state.queue.push({
    taskId: taskDef.taskId,
    featureSlug: taskDef.featureSlug,
    status: 'pending',
    priority: taskDef.priority || 50,
    estimatedCost: taskDef.estimatedCost || 0,
    resourceType: taskDef.resourceType || 'model_call',
    blockedBy: taskDef.blockedBy || [],
    enqueuedAt: new Date().toISOString(),
    promotions: 0,
    teamId: taskDef.teamId || null,
    taskSpec: taskDef.taskSpec || null,
  });

  state.updatedAt = new Date().toISOString();
  const dir = join(root, '.ogu/state');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  return {
    taskId: taskDef.taskId,
    enqueued: true,
    position: state.queue.filter(t => t.status === 'pending').length,
  };
}

/**
 * Check system halt and freeze guards before allowing write operations.
 */
function checkSystemGuards(root, operation) {
  // Check halt
  const haltPath = join(root, '.ogu/state/system-halt.json');
  if (existsSync(haltPath)) {
    try {
      const halt = JSON.parse(readFileSync(haltPath, 'utf8'));
      if (halt.halted) {
        return { blocked: true, reason: `System halted: ${halt.reason || 'no reason'}` };
      }
    } catch { /* ignore corrupt file */ }
  }

  // Check freeze
  const freezePath = join(root, '.ogu/state/company-freeze.json');
  if (existsSync(freezePath)) {
    try {
      const freeze = JSON.parse(readFileSync(freezePath, 'utf8'));
      if (freeze.frozen) {
        return { blocked: true, reason: `System frozen: ${freeze.reason || 'no reason'}` };
      }
    } catch { /* ignore corrupt file */ }
  }

  return { blocked: false };
}

/**
 * Load circuit breaker status summary.
 */
function loadCircuitBreakerStatus(root) {
  const path = join(root, '.ogu/state/circuit-breakers.json');
  if (!existsSync(path)) return { domains: {}, openCount: 0 };
  try {
    const breakers = JSON.parse(readFileSync(path, 'utf8'));
    const domains = {};
    let openCount = 0;
    for (const [id, b] of Object.entries(breakers)) {
      if (!b || typeof b !== 'object') continue;
      domains[id] = { state: b.state || 'closed', failureCount: b.failureCount || 0 };
      if (b.state === 'open' || b.state === 'half-open') openCount++;
    }
    return { domains, openCount };
  } catch { return { domains: {}, openCount: 0 }; }
}

/**
 * Load freeze status.
 */
function loadFreezeStatus(root) {
  const path = join(root, '.ogu/state/company-freeze.json');
  if (!existsSync(path)) return { frozen: false };
  try {
    const freeze = JSON.parse(readFileSync(path, 'utf8'));
    return { frozen: !!freeze.frozen, reason: freeze.reason || null, frozenAt: freeze.frozenAt || null };
  } catch { return { frozen: false }; }
}

/**
 * Load latest metrics snapshot.
 */
function loadMetricsSnapshot(root) {
  const path = join(root, '.ogu/state/metrics-snapshot.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

/**
 * Build aggregated dashboard snapshot.
 */
function buildDashboard(root, runnerPool, loops) {
  // Health
  const mem = process.memoryUsage();
  const health = {
    status: 'healthy',
    uptime: process.uptime(),
    pid: process.pid,
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
    },
    loops: loops.map(l => ({
      name: l.name,
      running: l.isRunning,
      tickCount: l.tickCount,
    })),
  };

  // Features
  const featuresDir = join(root, '.ogu/state/features');
  const featureList = [];
  const byState = {};
  if (existsSync(featuresDir)) {
    for (const file of readdirSync(featuresDir)) {
      if (!file.endsWith('.state.json')) continue;
      try {
        const state = JSON.parse(readFileSync(join(featuresDir, file), 'utf8'));
        const slug = state.slug || file.replace('.state.json', '');
        featureList.push({ slug, currentState: state.currentState });
        const s = state.currentState || 'unknown';
        byState[s] = (byState[s] || 0) + 1;
      } catch { /* skip */ }
    }
  }

  // Scheduler
  const schedulerPath = join(root, '.ogu/state/scheduler-state.json');
  let totalTasks = 0, completedTasks = 0, pendingTasks = 0, dispatchedTasks = 0;
  if (existsSync(schedulerPath)) {
    const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
    totalTasks = state.queue.length;
    completedTasks = state.queue.filter(t => t.status === 'completed').length;
    pendingTasks = state.queue.filter(t => t.status === 'pending').length;
    dispatchedTasks = state.queue.filter(t => t.status === 'dispatched').length;
  }

  // Budget
  const today = new Date().toISOString().slice(0, 10);
  const budgetPath = join(root, '.ogu/budget/budget-state.json');
  let dailySpent = 0, monthlySpent = 0, dailyLimit = 100, monthlyLimit = 2000;
  let byModel = {}, byFeature = {};
  if (existsSync(budgetPath)) {
    const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
    if (budget.daily?.[today]) dailySpent = budget.daily[today].spent || 0;
    const month = today.slice(0, 7);
    if (budget.monthly?.[month]) monthlySpent = budget.monthly[month].spent || 0;
    byModel = budget.byModel || {};
    byFeature = budget.byFeature || {};
  }
  const orgSpecPath = join(root, '.ogu/org-spec.json');
  if (existsSync(orgSpecPath)) {
    try {
      const org = JSON.parse(readFileSync(orgSpecPath, 'utf8'));
      if (org.budget?.daily?.limit) dailyLimit = org.budget.daily.limit;
      if (org.budget?.monthly?.limit) monthlyLimit = org.budget.monthly.limit;
    } catch { /* defaults */ }
  }

  // Recent events (last 20 from audit)
  const recentEvents = [];
  const auditPath = join(root, '.ogu/audit/current.jsonl');
  if (existsSync(auditPath)) {
    const lines = readFileSync(auditPath, 'utf8').split('\n').filter(l => l.trim());
    const last20 = lines.slice(-20);
    for (const line of last20) {
      try {
        const evt = JSON.parse(line);
        recentEvents.push({ type: evt.type, timestamp: evt.timestamp, payload: evt.payload });
      } catch { /* skip */ }
    }
  }

  // Circuit breakers + freeze + org health
  const circuitBreakers = loadCircuitBreakerStatus(root);
  const freezeStatus = loadFreezeStatus(root);
  const metricsSnapshot = loadMetricsSnapshot(root);

  return {
    health,
    features: { total: featureList.length, list: featureList, byState },
    scheduler: { totalTasks, completedTasks, pendingTasks, dispatchedTasks, runners: runnerPool.status() },
    budget: { dailySpent, dailyLimit, monthlySpent, monthlyLimit, byModel, byFeature },
    circuitBreakers,
    freeze: freezeStatus,
    orgHealth: metricsSnapshot?.health || null,
    recentEvents,
  };
}
