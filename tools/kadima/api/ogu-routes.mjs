/**
 * Ogu domain API routes — structured endpoints for all Ogu subsystems.
 * Part of the Kadima API.
 *
 * All GET endpoints read .ogu/ files directly (no CLI spawning).
 * POST endpoints wrap ogu CLI calls.
 *
 * Endpoints:
 *   GET  /api/ogu/org
 *   GET  /api/ogu/agents
 *   GET  /api/ogu/agents/stats
 *   GET  /api/ogu/agents/:roleId
 *   GET  /api/ogu/budget
 *   GET  /api/ogu/budget/history
 *   GET  /api/ogu/audit
 *   GET  /api/ogu/audit/types
 *   GET  /api/ogu/governance/pending
 *   GET  /api/ogu/governance/history
 *   GET  /api/ogu/governance/policies
 *   GET  /api/ogu/model/status
 *   GET  /api/ogu/determinism
 *   GET  /api/ogu/dag/:slug
 *   GET  /api/ogu/artifacts/:slug
 *   GET  /api/ogu/worktrees
 *   POST /api/ogu/org/init
 *   POST /api/ogu/agents
 *   POST /api/ogu/agents/:roleId/run
 *   POST /api/ogu/agents/:roleId/stop
 *   POST /api/ogu/agents/:roleId/escalate
 *   POST /api/ogu/governance/approve
 *   POST /api/ogu/governance/deny
 *   POST /api/ogu/kadima/allocate
 *   POST /api/ogu/kadima/standup
 *   POST /api/ogu/compile
 *   POST /api/ogu/orchestrate/:slug
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAgentsDir,
  getArtifactsDir,
  getAuditDir,
  getBudgetDir,
  getStateDir,
  resolveOguPath,
  resolveRuntimePath,
} from '../../ogu/commands/lib/runtime-paths.mjs';
import { hasTaskGateEvidence } from '../../ogu/commands/lib/task-gate-evidence.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getCliPath() {
  return resolve(__dirname, '..', '..', '..', 'ogu', 'cli.mjs');
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function runOguSync(root, command, args = []) {
  return new Promise((resolve_) => {
    const cli = getCliPath();
    const chunks = [];
    const child = spawn('node', [cli, command, ...args], {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => chunks.push(d.toString()));
    child.stderr.on('data', (d) => chunks.push(d.toString()));
    child.on('close', (code) => resolve_({ exitCode: code ?? 1, stdout: chunks.join('') }));
    setTimeout(() => { child.kill(); resolve_({ exitCode: 1, stdout: 'Timeout after 30s' }); }, 30000);
  });
}

function getBudgetStatus(root) {
  const budgetPath = join(getBudgetDir(root), 'budget-state.json');
  if (!existsSync(budgetPath)) return { status: 'ok', dailyLimit: 10, todaySpent: 0, remaining: 10 };
  try {
    const state = readJson(budgetPath) || {};
    const dailyLimit = state.dailyLimit || 10;
    const todaySpent = state.todaySpent || 0;
    const remaining = Math.max(0, dailyLimit - todaySpent);
    const status = todaySpent >= dailyLimit ? 'exhausted' : todaySpent >= dailyLimit * 0.8 ? 'warning' : 'ok';
    return { status, dailyLimit, todaySpent, remaining };
  } catch { return { status: 'ok', dailyLimit: 10, todaySpent: 0, remaining: 10 }; }
}

/**
 * Handle ogu-domain routes. Returns true if the request was handled.
 */
export async function handleOguRoutes(url, method, readBody, res, root, broadcaster, json) {
  const p = url.pathname;

  // ── OrgSpec ──

  if (p === '/api/ogu/org' && method === 'GET') {
    const orgSpec = readJson(resolveOguPath(root, 'OrgSpec.json'));
    if (!orgSpec) { json(res, 404, { error: 'OrgSpec not initialized. Run: ogu org:init' }); return true; }
    json(res, 200, {
      orgId: orgSpec.orgId || orgSpec.$schema,
      roles: orgSpec.roles || [],
      teams: orgSpec.teams || [],
      providers: orgSpec.providers || [],
      escalation: orgSpec.escalation || {},
      defaults: orgSpec.defaults || {},
    });
    return true;
  }

  if (p === '/api/ogu/org/init' && method === 'POST') {
    const body = await readBody();
    const args = [];
    if (body.orgId) args.push('--org-id', body.orgId);
    const result = await runOguSync(root, 'org:init', args);
    if (result.exitCode === 0) {
      const orgSpec = readJson(resolveOguPath(root, 'OrgSpec.json'));
      broadcaster.broadcast({ type: 'org:changed', payload: orgSpec });
    }
    json(res, 200, result);
    return true;
  }

  // ── Agents ──

  if (p === '/api/ogu/agents' && method === 'GET') {
    const orgSpec = readJson(resolveOguPath(root, 'OrgSpec.json'));
    const roles = orgSpec?.roles || [];
    const agents = roles.map((role) => {
      const state = readJson(join(getAgentsDir(root), `${role.roleId}.state.json`)) || {};
      return {
        roleId: role.roleId,
        name: role.name,
        department: role.department,
        enabled: role.enabled,
        riskTier: role.riskTier,
        capabilities: role.capabilities || [],
        state: {
          tasksCompleted: state.tasksCompleted || 0,
          tasksFailed: state.tasksFailed || 0,
          tokensUsed: state.tokensUsed || 0,
          costUsed: state.costUsed || 0,
          currentTask: state.currentTask || null,
          lastActiveAt: state.lastActiveAt || null,
        },
      };
    });
    json(res, 200, { agents, count: agents.length });
    return true;
  }

  if (p === '/api/ogu/agents/stats' && method === 'GET') {
    const orgSpec = readJson(resolveOguPath(root, 'OrgSpec.json'));
    const roles = orgSpec?.roles || [];
    let totalCompleted = 0, totalFailed = 0, totalTokens = 0, totalCost = 0, escalations = 0;
    const byDepartment = {};
    for (const role of roles) {
      const state = readJson(join(getAgentsDir(root), `${role.roleId}.state.json`)) || {};
      const completed = state.tasksCompleted || 0;
      const failed = state.tasksFailed || 0;
      const tokens = state.tokensUsed || 0;
      const cost = state.costUsed || 0;
      totalCompleted += completed; totalFailed += failed; totalTokens += tokens; totalCost += cost;
      if (state.escalationCount) escalations += state.escalationCount;
      const dept = role.department || 'unassigned';
      if (!byDepartment[dept]) byDepartment[dept] = { agents: 0, completed: 0, failed: 0, cost: 0 };
      byDepartment[dept].agents++;
      byDepartment[dept].completed += completed;
      byDepartment[dept].failed += failed;
      byDepartment[dept].cost += cost;
    }
    const total = totalCompleted + totalFailed;
    json(res, 200, {
      totalAgents: roles.length,
      totalCompleted, totalFailed, totalTokens, totalCost,
      successRate: total > 0 ? Math.round((totalCompleted / total) * 100) : 100,
      avgCostPerTask: total > 0 ? totalCost / total : 0,
      escalations, byDepartment,
    });
    return true;
  }

  if (p === '/api/ogu/agents' && method === 'POST') {
    const body = await readBody();
    const { roleId, name, department, capabilities, risk, model, phases } = body;
    if (!roleId) { json(res, 400, { error: 'roleId is required' }); return true; }
    const args = [roleId];
    if (name) args.push('--name', name);
    if (department) args.push('--dept', department);
    if (capabilities) args.push('--capabilities', Array.isArray(capabilities) ? capabilities.join(',') : capabilities);
    if (risk) args.push('--risk', risk);
    if (model) args.push('--model', model);
    if (phases) args.push('--phases', Array.isArray(phases) ? phases.join(',') : phases);
    const result = await runOguSync(root, 'agent:create', args);
    if (result.exitCode === 0) broadcaster.broadcast({ type: 'agent:updated', payload: { roleId, state: { action: 'created' } } });
    json(res, 200, result);
    return true;
  }

  const agentRoleMatch = p.match(/^\/api\/ogu\/agents\/([^/]+)$/);
  if (agentRoleMatch && method === 'GET') {
    const roleId = agentRoleMatch[1];
    const orgSpec = readJson(resolveOguPath(root, 'OrgSpec.json'));
    const role = orgSpec?.roles?.find((r) => r.roleId === roleId);
    if (!role) { json(res, 404, { error: `Agent ${roleId} not found` }); return true; }
    const state = readJson(join(getAgentsDir(root), `${roleId}.state.json`)) || {};
    json(res, 200, { ...role, state });
    return true;
  }

  const agentRunMatch = p.match(/^\/api\/ogu\/agents\/([^/]+)\/(run|stop|escalate)$/);
  if (agentRunMatch && method === 'POST') {
    const roleId = agentRunMatch[1];
    const action = agentRunMatch[2];
    const body = await readBody();

    if (action === 'run') {
      const { taskId, featureSlug } = body;
      if (!taskId || !featureSlug) { json(res, 400, { error: 'taskId and featureSlug are required' }); return true; }
      const result = await runOguSync(root, 'agent:run', [taskId, '--feature', featureSlug, '--role', roleId]);
      if (result.exitCode === 0) broadcaster.broadcast({ type: 'agent:started', payload: { roleId, taskId, featureSlug } });
      json(res, 200, result);
    } else if (action === 'stop') {
      const args = [roleId];
      if (body.force) args.push('--force');
      const result = await runOguSync(root, 'agent:stop', args);
      if (result.exitCode === 0) broadcaster.broadcast({ type: 'agent:updated', payload: { roleId, state: { action: 'stopped' } } });
      json(res, 200, result);
    } else if (action === 'escalate') {
      const args = [roleId];
      if (body.targetTier) args.push('--tier', body.targetTier);
      const result = await runOguSync(root, 'agent:escalate', args);
      if (result.exitCode === 0) broadcaster.broadcast({ type: 'agent:escalated', payload: { roleId, toTier: body.targetTier || '' } });
      json(res, 200, result);
    }
    return true;
  }

  // ── Budget ──

  if (p === '/api/ogu/budget' && method === 'GET') {
    const status = getBudgetStatus(root);
    const budgetState = readJson(join(getBudgetDir(root), 'budget-state.json')) || {};
    json(res, 200, { ...status, daily: budgetState.daily || {}, lastUpdated: budgetState.lastUpdated || null });
    return true;
  }

  if (p === '/api/ogu/budget/history' && method === 'GET') {
    const days = parseInt(url.searchParams.get('days') || '7', 10);
    const txPath = join(getBudgetDir(root), 'transactions.jsonl');
    if (!existsSync(txPath)) { json(res, 200, { transactions: [], days }); return true; }

    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const lines = readFileSync(txPath, 'utf-8').trim().split('\n').filter(Boolean);
    const transactions = lines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((t) => t !== null && t.timestamp >= cutoff);

    const byDay = {}, byModel = {}, byRole = {}, byFeature = {};
    for (const tx of transactions) {
      const day = tx.timestamp.slice(0, 10);
      const model = tx.model || 'unknown';
      const role = tx.agentRoleId || tx.roleId || tx.role || 'unassigned';
      const feature = tx.featureSlug || 'general';
      const cost = tx.cost || 0;
      const tokens = (tx.inputTokens || 0) + (tx.outputTokens || 0);
      for (const [map, key] of [[byDay, day], [byModel, model], [byRole, role], [byFeature, feature]]) {
        if (!map[key]) map[key] = { spent: 0, tokens: 0, calls: 0 };
        map[key].spent += cost; map[key].tokens += tokens; map[key].calls++;
      }
    }
    json(res, 200, { transactions: transactions.slice(-100), byDay, byModel, byRole, byFeature, days });
    return true;
  }

  // ── Audit ──

  if (p === '/api/ogu/audit' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const type = url.searchParams.get('type');
    const feature = url.searchParams.get('feature');
    const auditPath = join(getAuditDir(root), 'current.jsonl');
    if (!existsSync(auditPath)) { json(res, 200, { events: [], count: 0 }); return true; }

    const lines = readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
    let events = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    if (type) events = events.filter((e) => e.type === type || e.type.startsWith(type + '.'));
    if (feature) events = events.filter((e) => e.payload?.featureSlug === feature);
    const total = events.length;
    json(res, 200, { events: events.slice(-limit), count: total, showing: Math.min(events.length, limit) });
    return true;
  }

  if (p === '/api/ogu/audit/types' && method === 'GET') {
    const auditPath = join(getAuditDir(root), 'current.jsonl');
    if (!existsSync(auditPath)) { json(res, 200, { types: [] }); return true; }
    const lines = readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
    const types = new Set();
    for (const line of lines) { try { const e = JSON.parse(line); if (e.type) types.add(e.type); } catch {} }
    json(res, 200, { types: [...types].sort() });
    return true;
  }

  // ── Governance ──

  if (p === '/api/ogu/governance/pending' && method === 'GET') {
    const approvalsDir = resolveRuntimePath(root, 'approvals');
    if (!existsSync(approvalsDir)) { json(res, 200, { pending: [], count: 0 }); return true; }
    const files = readdirSync(approvalsDir).filter((f) => f.endsWith('.json'));
    const pending = files.map((f) => readJson(join(approvalsDir, f))).filter((a) => a?.status === 'pending').map((a, i) => ({ file: files[i], ...a }));
    json(res, 200, { pending, count: pending.length });
    return true;
  }

  if (p === '/api/ogu/governance/history' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const approvalsDir = resolveRuntimePath(root, 'approvals');
    if (!existsSync(approvalsDir)) { json(res, 200, { history: [], count: 0 }); return true; }
    const files = readdirSync(approvalsDir).filter((f) => f.endsWith('.json'));
    const history = files.map((f) => ({ file: f, ...readJson(join(approvalsDir, f)) })).filter((a) => a !== null);
    history.sort((a, b) => (b.approvedAt || b.deniedAt || b.createdAt || '').localeCompare(a.approvedAt || a.deniedAt || a.createdAt || ''));
    json(res, 200, { history: history.slice(0, limit), count: history.length });
    return true;
  }

  if (p === '/api/ogu/governance/policies' && method === 'GET') {
    const policies = readJson(resolveOguPath(root, 'policies.json')) || { rules: [] };
    json(res, 200, policies);
    return true;
  }

  if (p === '/api/ogu/governance/approve' && method === 'POST') {
    const body = await readBody();
    const { taskId, actor } = body;
    if (!taskId) { json(res, 400, { error: 'taskId is required' }); return true; }
    const args = [taskId];
    if (actor) args.push('--actor', actor);
    const result = await runOguSync(root, 'approve', args);
    if (result.exitCode === 0) broadcaster.broadcast({ type: 'governance:approved', payload: { taskId, approvedBy: actor || 'kadima' } });
    json(res, 200, result);
    return true;
  }

  if (p === '/api/ogu/governance/deny' && method === 'POST') {
    const body = await readBody();
    const { taskId, reason, actor } = body;
    if (!taskId) { json(res, 400, { error: 'taskId is required' }); return true; }
    const args = [taskId];
    if (reason) args.push('--reason', reason);
    if (actor) args.push('--actor', actor);
    const result = await runOguSync(root, 'deny', args);
    if (result.exitCode === 0) broadcaster.broadcast({ type: 'governance:denied', payload: { taskId, deniedBy: actor || 'kadima', reason: reason || '' } });
    json(res, 200, result);
    return true;
  }

  // ── Model Router ──

  if (p === '/api/ogu/model/status' && method === 'GET') {
    const logPath = resolveRuntimePath(root, 'model-log.jsonl');
    if (!existsSync(logPath)) { json(res, 200, { decisions: 0, byModel: {}, recent: [] }); return true; }
    const lines = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
    const entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const byModel = {};
    let escalations = 0;
    for (const e of entries) {
      const m = e.model || e.selectedModel || 'unknown';
      byModel[m] = (byModel[m] || 0) + 1;
      if (e.reason === 'escalation') escalations++;
    }
    json(res, 200, { decisions: entries.length, byModel, escalations, recent: entries.slice(-20) });
    return true;
  }

  // ── Determinism ──

  if (p === '/api/ogu/determinism' && method === 'GET') {
    const ledgerPath = resolveRuntimePath(root, 'determinism/ledger.jsonl');
    if (!existsSync(ledgerPath)) { json(res, 200, { violations: 0, entries: [] }); return true; }
    const lines = readFileSync(ledgerPath, 'utf-8').trim().split('\n').filter(Boolean);
    const entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const byType = {};
    for (const e of entries) { byType[e.type] = (byType[e.type] || 0) + 1; }
    json(res, 200, { violations: entries.length, byType, entries: entries.slice(-50) });
    return true;
  }

  // ── DAG ──

  const dagMatch = p.match(/^\/api\/ogu\/dag\/([^/]+)$/);
  if (dagMatch && method === 'GET') {
    const slug = dagMatch[1];
    const dagPath = resolveRuntimePath(root, `orchestrate/${slug}/PLAN_DAG.json`);
    if (!existsSync(dagPath)) { json(res, 404, { error: `No DAG found for ${slug}. Run: ogu orchestrate ${slug}` }); return true; }
    const dag = readJson(dagPath);
    if (!dag) { json(res, 500, { error: 'Failed to parse DAG file' }); return true; }

    const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
    const plan = readJson(planPath);
    const taskMap = {};
    if (plan?.tasks) {
      for (const task of plan.tasks) {
        taskMap[task.id] = { id: task.id, title: task.title || task.id, touches: task.touches || [], depends_on: task.depends_on || [], resources: task.resources || [] };
      }
    }

    const schedulerState = readJson(join(getStateDir(root), 'scheduler-state.json'));
    const statusMap = {};
    if (schedulerState?.queue) {
      for (const entry of schedulerState.queue) {
        if (entry.featureSlug === slug) statusMap[entry.taskId] = entry.status;
      }
    }
    if (plan?.tasks) {
      for (const task of plan.tasks) {
        if (!statusMap[task.id] && hasTaskGateEvidence(root, task.id)) statusMap[task.id] = 'completed';
      }
    }
    json(res, 200, { ...dag, taskDetails: taskMap, taskStatuses: statusMap });
    return true;
  }

  const orchestrateMatch = p.match(/^\/api\/ogu\/orchestrate\/([^/]+)$/);
  if (orchestrateMatch && method === 'POST') {
    const slug = orchestrateMatch[1];
    const body = await readBody();
    const args = [slug];
    if (body.validate) args.push('--validate');
    const result = await runOguSync(root, 'orchestrate', args);
    json(res, 200, result);
    return true;
  }

  // ── Artifacts ──

  const artifactsMatch = p.match(/^\/api\/ogu\/artifacts\/([^/]+)$/);
  if (artifactsMatch && method === 'GET') {
    const slug = artifactsMatch[1];
    const artifactsDir = join(getArtifactsDir(root), slug);
    if (!existsSync(artifactsDir)) { json(res, 200, { artifacts: [], count: 0 }); return true; }
    const files = readdirSync(artifactsDir).filter((f) => f.endsWith('.json') && f !== 'index.json');
    const artifacts = files.map((f) => readJson(join(artifactsDir, f))).filter(Boolean);
    const index = readJson(join(artifactsDir, 'index.json'));
    json(res, 200, { artifacts, count: artifacts.length, index });
    return true;
  }

  // ── Worktrees ──

  if (p === '/api/ogu/worktrees' && method === 'GET') {
    const worktreeBase = join(root, '.claude/worktrees');
    if (!existsSync(worktreeBase)) { json(res, 200, { worktrees: [], count: 0 }); return true; }
    const dirs = readdirSync(worktreeBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    json(res, 200, { worktrees: dirs, count: dirs.length });
    return true;
  }

  // ── Kadima / Compile ──

  if (p === '/api/ogu/kadima/allocate' && method === 'POST') {
    const body = await readBody();
    const { slug, enqueue, dryRun } = body;
    if (!slug) { json(res, 400, { error: 'slug is required' }); return true; }
    const args = [slug];
    if (enqueue) args.push('--enqueue');
    if (dryRun) args.push('--dry-run');
    const result = await runOguSync(root, 'kadima:allocate', args);
    json(res, 200, result);
    return true;
  }

  if (p === '/api/ogu/kadima/standup' && method === 'POST') {
    const result = await runOguSync(root, 'kadima:standup');
    json(res, 200, result);
    return true;
  }

  if (p === '/api/ogu/compile' && method === 'POST') {
    const body = await readBody();
    const { slug, fix, gate, verbose } = body;
    if (!slug) { json(res, 400, { error: 'slug is required' }); return true; }
    broadcaster.broadcast({ type: 'compile:started', payload: { featureSlug: slug } });
    const args = [slug];
    if (fix) args.push('--fix');
    if (gate != null) args.push('--gate', String(gate));
    if (verbose) args.push('--verbose');
    const result = await runOguSync(root, 'compile', args);
    broadcaster.broadcast({ type: 'compile:completed', payload: { featureSlug: slug, passed: result.exitCode === 0, errors: result.exitCode === 0 ? 0 : 1 } });
    json(res, 200, result);
    return true;
  }

  return false;
}
