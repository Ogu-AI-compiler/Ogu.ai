/**
 * Ogu Domain API — structured endpoints for all Ogu subsystems.
 *
 * Reads data directly from .ogu/ state files (no CLI spawning needed).
 * Endpoints:
 *   /org          — OrgSpec data
 *   /agents       — agent list and status
 *   /agents/:id   — single agent details
 *   /budget       — budget status and history
 *   /audit        — audit log with search
 *   /governance   — governance pending approvals
 *   /model        — model routing status
 */

import { Hono } from "hono";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { getBudgetStatus } from "./model-bridge.js";
import { broadcast } from "../ws/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getCliPath() {
  return join(__dirname, "..", "..", "..", "ogu", "cli.mjs");
}

/** Run an ogu CLI command and return { exitCode, stdout } */
function runOguSync(command: string, args: string[] = []): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolve) => {
    const root = getRoot();
    const cli = getCliPath();
    const chunks: string[] = [];

    const child = spawn("node", [cli, command, ...args], {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (d) => chunks.push(d.toString()));
    child.stderr.on("data", (d) => chunks.push(d.toString()));
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout: chunks.join("") });
    });

    setTimeout(() => { child.kill(); resolve({ exitCode: 1, stdout: "Timeout after 30s" }); }, 30000);
  });
}

function getRoot() { return process.env.OGU_ROOT || process.cwd(); }

function readJson(path: string): any {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

export function createOguApi() {
  const api = new Hono();

  // ── OrgSpec ──

  api.get("/org", (c) => {
    const root = getRoot();
    const orgSpec = readJson(join(root, ".ogu/OrgSpec.json"));
    if (!orgSpec) return c.json({ error: "OrgSpec not initialized. Run: ogu org:init" }, 404);
    return c.json({
      orgId: orgSpec.orgId || orgSpec.$schema,
      roles: orgSpec.roles || [],
      teams: orgSpec.teams || [],
      providers: orgSpec.providers || [],
      escalation: orgSpec.escalation || {},
      defaults: orgSpec.defaults || {},
    });
  });

  // ── Agents ──

  api.get("/agents", (c) => {
    const root = getRoot();
    const orgSpec = readJson(join(root, ".ogu/OrgSpec.json"));
    const roles = orgSpec?.roles || [];

    const agents = roles.map((role: any) => {
      const statePath = join(root, ".ogu/agents", `${role.roleId}.state.json`);
      const state = readJson(statePath) || {};
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

    return c.json({ agents, count: agents.length });
  });

  api.get("/agents/stats", (c) => {
    const root = getRoot();
    const orgSpec = readJson(join(root, ".ogu/OrgSpec.json"));
    const roles = orgSpec?.roles || [];

    let totalCompleted = 0, totalFailed = 0, totalTokens = 0, totalCost = 0, escalations = 0;
    const byDepartment: Record<string, { agents: number; completed: number; failed: number; cost: number }> = {};

    for (const role of roles) {
      const state = readJson(join(root, ".ogu/agents", `${role.roleId}.state.json`)) || {};
      const completed = state.tasksCompleted || 0;
      const failed = state.tasksFailed || 0;
      const tokens = state.tokensUsed || 0;
      const cost = state.costUsed || 0;
      totalCompleted += completed;
      totalFailed += failed;
      totalTokens += tokens;
      totalCost += cost;
      if (state.escalationCount) escalations += state.escalationCount;

      const dept = role.department || "unassigned";
      if (!byDepartment[dept]) byDepartment[dept] = { agents: 0, completed: 0, failed: 0, cost: 0 };
      byDepartment[dept].agents++;
      byDepartment[dept].completed += completed;
      byDepartment[dept].failed += failed;
      byDepartment[dept].cost += cost;
    }

    const total = totalCompleted + totalFailed;
    const successRate = total > 0 ? Math.round((totalCompleted / total) * 100) : 100;
    const avgCostPerTask = total > 0 ? totalCost / total : 0;

    return c.json({
      totalAgents: roles.length,
      totalCompleted,
      totalFailed,
      totalTokens,
      totalCost,
      successRate,
      avgCostPerTask,
      escalations,
      byDepartment,
    });
  });

  api.get("/agents/:roleId", (c) => {
    const roleId = c.req.param("roleId");
    const root = getRoot();
    const orgSpec = readJson(join(root, ".ogu/OrgSpec.json"));
    const role = orgSpec?.roles?.find((r: any) => r.roleId === roleId);
    if (!role) return c.json({ error: `Agent ${roleId} not found` }, 404);

    const statePath = join(root, ".ogu/agents", `${roleId}.state.json`);
    const state = readJson(statePath) || {};

    return c.json({ ...role, state });
  });

  // ── Budget ──

  api.get("/budget", (c) => {
    const root = getRoot();
    const status = getBudgetStatus(root);
    const budgetState = readJson(join(root, ".ogu/budget/budget-state.json")) || {};

    return c.json({
      ...status,
      daily: budgetState.daily || {},
      lastUpdated: budgetState.lastUpdated || null,
    });
  });

  api.get("/budget/history", (c) => {
    const root = getRoot();
    const days = parseInt(c.req.query("days") || "7", 10);
    const txPath = join(root, ".ogu/budget/transactions.jsonl");

    if (!existsSync(txPath)) return c.json({ transactions: [], days });

    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const lines = readFileSync(txPath, "utf-8").trim().split("\n").filter(Boolean);
    const transactions = lines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((t): t is any => t !== null && t.timestamp >= cutoff);

    // Aggregate by day
    const byDay: Record<string, { spent: number; tokens: number; calls: number }> = {};
    const byModel: Record<string, { spent: number; tokens: number; calls: number }> = {};
    const byRole: Record<string, { spent: number; tokens: number; calls: number }> = {};
    const byFeature: Record<string, { spent: number; tokens: number; calls: number }> = {};

    for (const tx of transactions) {
      const day = tx.timestamp.slice(0, 10);
      if (!byDay[day]) byDay[day] = { spent: 0, tokens: 0, calls: 0 };
      byDay[day].spent += tx.cost || 0;
      byDay[day].tokens += (tx.inputTokens || 0) + (tx.outputTokens || 0);
      byDay[day].calls += 1;

      const model = tx.model || "unknown";
      if (!byModel[model]) byModel[model] = { spent: 0, tokens: 0, calls: 0 };
      byModel[model].spent += tx.cost || 0;
      byModel[model].tokens += (tx.inputTokens || 0) + (tx.outputTokens || 0);
      byModel[model].calls += 1;

      const role = tx.roleId || tx.role || "unassigned";
      if (!byRole[role]) byRole[role] = { spent: 0, tokens: 0, calls: 0 };
      byRole[role].spent += tx.cost || 0;
      byRole[role].tokens += (tx.inputTokens || 0) + (tx.outputTokens || 0);
      byRole[role].calls += 1;

      const feature = tx.featureSlug || "general";
      if (!byFeature[feature]) byFeature[feature] = { spent: 0, tokens: 0, calls: 0 };
      byFeature[feature].spent += tx.cost || 0;
      byFeature[feature].tokens += (tx.inputTokens || 0) + (tx.outputTokens || 0);
      byFeature[feature].calls += 1;
    }

    return c.json({ transactions: transactions.slice(-100), byDay, byModel, byRole, byFeature, days });
  });

  // ── Audit ──

  api.get("/audit", (c) => {
    const root = getRoot();
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const type = c.req.query("type");
    const feature = c.req.query("feature");
    const auditPath = join(root, ".ogu/audit/current.jsonl");

    if (!existsSync(auditPath)) return c.json({ events: [], count: 0 });

    const lines = readFileSync(auditPath, "utf-8").trim().split("\n").filter(Boolean);
    let events = lines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e): e is any => e !== null);

    if (type) events = events.filter((e) => e.type === type || e.type.startsWith(type + "."));
    if (feature) events = events.filter((e) => e.payload?.featureSlug === feature);

    const total = events.length;
    events = events.slice(-limit);

    return c.json({ events, count: total, showing: events.length });
  });

  api.get("/audit/types", (c) => {
    const root = getRoot();
    const auditPath = join(root, ".ogu/audit/current.jsonl");
    if (!existsSync(auditPath)) return c.json({ types: [] });

    const lines = readFileSync(auditPath, "utf-8").trim().split("\n").filter(Boolean);
    const types = new Set<string>();
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        if (e.type) types.add(e.type);
      } catch { /* skip */ }
    }

    return c.json({ types: [...types].sort() });
  });

  // ── Governance ──

  api.get("/governance/pending", (c) => {
    const root = getRoot();
    const approvalsDir = join(root, ".ogu/approvals");
    if (!existsSync(approvalsDir)) return c.json({ pending: [], count: 0 });

    const files = readdirSync(approvalsDir).filter((f) => f.endsWith(".json"));
    const pending: any[] = [];

    for (const file of files) {
      const approval = readJson(join(approvalsDir, file));
      if (approval && approval.status === "pending") {
        pending.push({ file, ...approval });
      }
    }

    return c.json({ pending, count: pending.length });
  });

  api.get("/governance/history", (c) => {
    const root = getRoot();
    const approvalsDir = join(root, ".ogu/approvals");
    if (!existsSync(approvalsDir)) return c.json({ history: [], count: 0 });

    const files = readdirSync(approvalsDir).filter((f) => f.endsWith(".json"));
    const history: any[] = [];

    for (const file of files) {
      const approval = readJson(join(approvalsDir, file));
      if (approval) {
        history.push({ file, ...approval });
      }
    }

    // Sort by timestamp descending
    history.sort((a, b) => {
      const ta = a.approvedAt || a.deniedAt || a.createdAt || "";
      const tb = b.approvedAt || b.deniedAt || b.createdAt || "";
      return tb.localeCompare(ta);
    });

    const limit = parseInt(c.req.query("limit") || "50", 10);

    return c.json({ history: history.slice(0, limit), count: history.length });
  });

  api.get("/governance/policies", (c) => {
    const root = getRoot();
    const policiesPath = join(root, ".ogu/policies.json");
    const policies = readJson(policiesPath) || { rules: [] };
    return c.json(policies);
  });

  // ── Model Router ──

  api.get("/model/status", (c) => {
    const root = getRoot();
    const logPath = join(root, ".ogu/model-log.jsonl");
    if (!existsSync(logPath)) return c.json({ decisions: 0, byModel: {}, recent: [] });

    const lines = readFileSync(logPath, "utf-8").trim().split("\n").filter(Boolean);
    const entries = lines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e): e is any => e !== null);

    const byModel: Record<string, number> = {};
    let escalations = 0;
    for (const e of entries) {
      const m = e.model || e.selectedModel || "unknown";
      byModel[m] = (byModel[m] || 0) + 1;
      if (e.reason === "escalation") escalations++;
    }

    return c.json({
      decisions: entries.length,
      byModel,
      escalations,
      recent: entries.slice(-20),
    });
  });

  // ── Determinism ──

  api.get("/determinism", (c) => {
    const root = getRoot();
    const ledgerPath = join(root, ".ogu/determinism/ledger.jsonl");
    if (!existsSync(ledgerPath)) return c.json({ violations: 0, entries: [] });

    const lines = readFileSync(ledgerPath, "utf-8").trim().split("\n").filter(Boolean);
    const entries = lines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e): e is any => e !== null);

    const byType: Record<string, number> = {};
    for (const e of entries) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }

    return c.json({ violations: entries.length, byType, entries: entries.slice(-50) });
  });

  // ── DAG / Orchestration ──

  api.get("/dag/:featureSlug", (c) => {
    const slug = c.req.param("featureSlug");
    const root = getRoot();
    const dagPath = join(root, `.ogu/orchestrate/${slug}/PLAN_DAG.json`);
    if (!existsSync(dagPath)) return c.json({ error: `No DAG found for ${slug}. Run: ogu orchestrate ${slug}` }, 404);

    const dag = readJson(dagPath);
    if (!dag) return c.json({ error: "Failed to parse DAG file" }, 500);

    // Enrich with Plan.json task details if available
    const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
    const plan = readJson(planPath);
    const taskMap: Record<string, any> = {};
    if (plan?.tasks) {
      for (const task of plan.tasks) {
        taskMap[task.id] = {
          id: task.id,
          title: task.title || task.id,
          touches: task.touches || [],
          depends_on: task.depends_on || [],
          resources: task.resources || [],
        };
      }
    }

    // Read scheduler state for live task statuses
    const schedulerPath = join(root, ".ogu/state/scheduler-state.json");
    const schedulerState = readJson(schedulerPath);
    const statusMap: Record<string, string> = {};
    if (schedulerState?.queue) {
      for (const entry of schedulerState.queue) {
        if (entry.featureSlug === slug) {
          statusMap[entry.taskId] = entry.status;
        }
      }
    }

    return c.json({
      ...dag,
      taskDetails: taskMap,
      taskStatuses: statusMap,
    });
  });

  api.post("/orchestrate/:featureSlug", async (c) => {
    const slug = c.req.param("featureSlug");
    const body = await c.req.json().catch(() => ({}));
    const args = [slug];
    if (body.validate) args.push("--validate");

    const result = await runOguSync("orchestrate", args);
    return c.json(result);
  });

  // ── Artifacts ──

  api.get("/artifacts/:featureSlug", (c) => {
    const slug = c.req.param("featureSlug");
    const root = getRoot();
    const artifactsDir = join(root, ".ogu/artifacts", slug);
    if (!existsSync(artifactsDir)) return c.json({ artifacts: [], count: 0 });

    const files = readdirSync(artifactsDir).filter((f) => f.endsWith(".json") && f !== "index.json");
    const artifacts = files
      .map((f) => readJson(join(artifactsDir, f)))
      .filter((a): a is any => a !== null);

    const index = readJson(join(artifactsDir, "index.json"));

    return c.json({ artifacts, count: artifacts.length, index });
  });

  // ── Worktrees ──

  api.get("/worktrees", (c) => {
    const root = getRoot();
    const worktreeBase = join(root, ".claude/worktrees");
    if (!existsSync(worktreeBase)) return c.json({ worktrees: [], count: 0 });

    const dirs = readdirSync(worktreeBase, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    return c.json({ worktrees: dirs, count: dirs.length });
  });

  // ═══════════════════════════════════════════════════
  // POST endpoints — mutations via ogu CLI
  // ═══════════════════════════════════════════════════

  // ── Org init ──

  api.post("/org/init", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const args: string[] = [];
    if (body.orgId) args.push("--org-id", body.orgId);
    const result = await runOguSync("org:init", args);
    if (result.exitCode === 0) {
      const root = getRoot();
      const orgSpec = readJson(join(root, ".ogu/OrgSpec.json"));
      broadcast({ type: "org:changed", data: orgSpec });
    }
    return c.json(result);
  });

  // ── Agent create ──

  api.post("/agents", async (c) => {
    const body = await c.req.json();
    const { roleId, name, department, capabilities, risk, model, phases } = body;
    if (!roleId) return c.json({ error: "roleId is required" }, 400);

    const args = [roleId];
    if (name) args.push("--name", name);
    if (department) args.push("--dept", department);
    if (capabilities) args.push("--capabilities", Array.isArray(capabilities) ? capabilities.join(",") : capabilities);
    if (risk) args.push("--risk", risk);
    if (model) args.push("--model", model);
    if (phases) args.push("--phases", Array.isArray(phases) ? phases.join(",") : phases);

    const result = await runOguSync("agent:create", args);
    if (result.exitCode === 0) {
      broadcast({ type: "agent:updated", roleId, state: { action: "created" } });
    }
    return c.json(result);
  });

  // ── Agent run (start a task on an agent) ──

  api.post("/agents/:roleId/run", async (c) => {
    const roleId = c.req.param("roleId");
    const body = await c.req.json();
    const { taskId, featureSlug } = body;
    if (!taskId || !featureSlug) return c.json({ error: "taskId and featureSlug are required" }, 400);

    const args = [taskId, "--feature", featureSlug, "--role", roleId];
    const result = await runOguSync("agent:run", args);
    if (result.exitCode === 0) {
      broadcast({ type: "agent:started", roleId, taskId, featureSlug });
    }
    return c.json(result);
  });

  // ── Agent stop ──

  api.post("/agents/:roleId/stop", async (c) => {
    const roleId = c.req.param("roleId");
    const body = await c.req.json().catch(() => ({}));
    const args = [roleId];
    if (body.force) args.push("--force");

    const result = await runOguSync("agent:stop", args);
    if (result.exitCode === 0) {
      broadcast({ type: "agent:updated", roleId, state: { action: "stopped" } });
    }
    return c.json(result);
  });

  // ── Agent escalate ──

  api.post("/agents/:roleId/escalate", async (c) => {
    const roleId = c.req.param("roleId");
    const body = await c.req.json().catch(() => ({}));
    const args = [roleId];
    if (body.targetTier) args.push("--tier", body.targetTier);

    const result = await runOguSync("agent:escalate", args);
    if (result.exitCode === 0) {
      broadcast({ type: "agent:escalated", roleId, taskId: body.taskId || "", fromTier: "", toTier: body.targetTier || "" });
    }
    return c.json(result);
  });

  // ── Governance approve / deny ──

  api.post("/governance/approve", async (c) => {
    const body = await c.req.json();
    const { taskId, actor } = body;
    if (!taskId) return c.json({ error: "taskId is required" }, 400);

    const args = [taskId];
    if (actor) args.push("--actor", actor);

    const result = await runOguSync("approve", args);
    if (result.exitCode === 0) {
      broadcast({ type: "governance:approved", taskId, approvedBy: actor || "studio" });
    }
    return c.json(result);
  });

  api.post("/governance/deny", async (c) => {
    const body = await c.req.json();
    const { taskId, reason, actor } = body;
    if (!taskId) return c.json({ error: "taskId is required" }, 400);

    const args = [taskId];
    if (reason) args.push("--reason", reason);
    if (actor) args.push("--actor", actor);

    const result = await runOguSync("deny", args);
    if (result.exitCode === 0) {
      broadcast({ type: "governance:denied", taskId, deniedBy: actor || "studio", reason: reason || "" });
    }
    return c.json(result);
  });

  // ── Kadima allocate ──

  api.post("/kadima/allocate", async (c) => {
    const body = await c.req.json();
    const { slug, enqueue, dryRun } = body;
    if (!slug) return c.json({ error: "slug is required" }, 400);

    const args = [slug];
    if (enqueue) args.push("--enqueue");
    if (dryRun) args.push("--dry-run");

    const result = await runOguSync("kadima:allocate", args);
    return c.json(result);
  });

  // ── Kadima standup ──

  api.post("/kadima/standup", async (c) => {
    const result = await runOguSync("kadima:standup");
    return c.json(result);
  });

  // ── Compile ──

  api.post("/compile", async (c) => {
    const body = await c.req.json();
    const { slug, fix, gate, verbose } = body;
    if (!slug) return c.json({ error: "slug is required" }, 400);

    broadcast({ type: "compile:started", featureSlug: slug });

    const args = [slug];
    if (fix) args.push("--fix");
    if (gate != null) args.push("--gate", String(gate));
    if (verbose) args.push("--verbose");

    const result = await runOguSync("compile", args);
    broadcast({ type: "compile:completed", featureSlug: slug, passed: result.exitCode === 0, errors: result.exitCode === 0 ? 0 : 1 });
    return c.json(result);
  });

  return api;
}
