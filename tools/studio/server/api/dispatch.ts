/**
 * Dispatch Engine — executes Plan.json tasks via the agent pipeline.
 *
 * Called as fire-and-forget from brief.ts after CTO progressive reveal.
 *
 * Flow:
 *   1. Read Plan.json → build DAG waves from depends_on
 *   2. For each wave (sequential):
 *      - Check budget (skip wave if exhausted)
 *      - Spawn `ogu agent:run` per task (parallel within wave)
 *      - On success: mark done in Plan.json
 *      - Broadcast project:state_changed after each wave
 *   3. After all waves: broadcast dispatch:completed
 */

import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { broadcast } from "../ws/server.js";
import { generateProposal, hasRecentProposal } from "./manifest.js";
import { preflightTaskSpec, runTaskGates, buildTaskFixNote, resolveTaskGroup, formatGateErrorsForFix } from "../../../ogu/commands/lib/task-gates.mjs";
import { hasTaskGateEvidence, readRunnerOutput, hasRunnerGatePass, writeTaskGateEvidence } from "../../../ogu/commands/lib/task-gate-evidence.mjs";
import { writeHandoffContext, buildHandoffKey } from "../../../ogu/commands/lib/handoff-context.mjs";
import { getBudgetDir, getProjectsDir, getRunnersDir, getStateDir, resolveRuntimePath } from "../../../ogu/commands/lib/runtime-paths.mjs";

function getCliPath(): string {
  return resolve(import.meta.dirname || __dirname, "..", "..", "..", "ogu", "cli.mjs");
}

// ── Per-slug pipeline mutex ──
// Prevents concurrent pipeline runs (auto-pipeline + client /continue).
const activePipelines = new Map<string, { phase: string; startedAt: number }>();

// ── Abort / Pause state ──
const abortedPipelines = new Set<string>();
const pausedPipelines = new Set<string>();

// ── Durable dispatch state ──
type DispatchState = {
  slug: string;
  dispatchStatus?: "idle" | "running" | "completed" | "failed" | "aborted";
  dispatchStartedAt?: string | null;
  dispatchCompletedAt?: string | null;
  pipelineActive?: boolean;
  pipelinePhase?: string | null;
  pipelineStatus?: "running" | "completed" | "failed" | "aborted";
  pipelineStartedAt?: string | null;
  pipelineCompletedAt?: string | null;
  paused?: boolean;
  aborted?: boolean;
  pauseRequestedAt?: string | null;
  abortRequestedAt?: string | null;
  totalTasks?: number;
  totalWaves?: number;
  waveIndex?: number;
  completedCount?: number;
  failedCount?: number;
  activeChildPids?: number[];
  lastHeartbeat?: string;
  updatedAt?: string;
  lastError?: string | null;
};

const DISPATCH_STALE_MS = 30 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function dispatchDir(root: string): string {
  return join(getStateDir(root), "dispatch");
}

function dispatchStatePath(root: string, slug: string): string {
  return join(dispatchDir(root), `${slug}.json`);
}

function readDispatchState(root: string, slug: string): DispatchState | null {
  const path = dispatchStatePath(root, slug);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function writeDispatchState(root: string, slug: string, state: DispatchState): DispatchState {
  const dir = dispatchDir(root);
  mkdirSync(dir, { recursive: true });
  const next = { ...state, slug, updatedAt: nowIso() };
  writeFileSync(dispatchStatePath(root, slug), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

function updateDispatchState(root: string, slug: string, patch: Partial<DispatchState>, opts: { heartbeat?: boolean } = {}): DispatchState {
  const base: DispatchState = readDispatchState(root, slug) || { slug };
  const next: DispatchState = { ...base, ...patch, slug };
  if (opts.heartbeat) next.lastHeartbeat = nowIso();
  if (next.dispatchStatus === "running" && !next.dispatchStartedAt) next.dispatchStartedAt = nowIso();
  if (next.pipelineActive && !next.pipelineStartedAt) next.pipelineStartedAt = nowIso();
  if (patch.activeChildPids) {
    next.activeChildPids = Array.from(new Set(patch.activeChildPids.filter((n) => Number.isFinite(n))));
  }
  next.updatedAt = nowIso();
  return writeDispatchState(root, slug, next);
}

function touchDispatchState(root: string, slug: string, patch: Partial<DispatchState> = {}): DispatchState {
  return updateDispatchState(root, slug, patch, { heartbeat: true });
}

function addChildPid(root: string, slug: string, pid?: number | null): void {
  if (!pid) return;
  const state = readDispatchState(root, slug);
  const current = new Set(state?.activeChildPids || []);
  current.add(pid);
  updateDispatchState(root, slug, { activeChildPids: [...current] }, { heartbeat: true });
}

function removeChildPid(root: string, slug: string, pid?: number | null): void {
  if (!pid) return;
  const state = readDispatchState(root, slug);
  const current = new Set(state?.activeChildPids || []);
  current.delete(pid);
  updateDispatchState(root, slug, { activeChildPids: [...current] }, { heartbeat: true });
}

function getRootOrDefault(root?: string): string {
  return root || process.env.OGU_ROOT || process.cwd();
}

// ── Active child processes per slug (for kill-on-abort) ──
const activeChildren = new Map<string, Set<ReturnType<typeof spawn>>>();

function registerChild(root: string, slug: string, child: ReturnType<typeof spawn>): void {
  if (!activeChildren.has(slug)) activeChildren.set(slug, new Set());
  activeChildren.get(slug)!.add(child);
  addChildPid(root, slug, child.pid);
}

function unregisterChild(root: string, slug: string, child: ReturnType<typeof spawn>): void {
  activeChildren.get(slug)?.delete(child);
  removeChildPid(root, slug, child.pid);
}

function killAllChildren(slug: string): void {
  const children = activeChildren.get(slug);
  if (!children) return;
  for (const child of children) {
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
  }
  children.clear();
}

export function isPipelineActive(slug: string, root?: string): boolean {
  const entry = activePipelines.get(slug);
  if (entry) {
    // Safety: auto-expire stale locks after 15 minutes (pipeline shouldn't take longer)
    if (Date.now() - entry.startedAt > 15 * 60 * 1000) {
      console.warn(`[pipeline] Lock for ${slug} expired after 15 min — force-releasing`);
      activePipelines.delete(slug);
    } else {
      return true;
    }
  }

  const resolvedRoot = getRootOrDefault(root);
  const state = readDispatchState(resolvedRoot, slug);
  if (!state?.pipelineActive) return false;

  const lastBeat = state.lastHeartbeat ? new Date(state.lastHeartbeat).getTime() : 0;
  if (lastBeat && Date.now() - lastBeat > DISPATCH_STALE_MS) {
    console.warn(`[pipeline] Durable lock for ${slug} stale — clearing`);
    updateDispatchState(resolvedRoot, slug, { pipelineActive: false, pipelineStatus: "failed", lastError: "stale pipeline lock" });
    return false;
  }
  return true;
}

export function acquirePipelineLock(slug: string, phase: string, root?: string): boolean {
  const resolvedRoot = getRootOrDefault(root);
  if (isPipelineActive(slug, resolvedRoot)) return false;
  activePipelines.set(slug, { phase, startedAt: Date.now() });
  updateDispatchState(resolvedRoot, slug, {
    pipelineActive: true,
    pipelinePhase: phase,
    pipelineStatus: "running",
    pipelineStartedAt: nowIso(),
    aborted: false,
    paused: false,
  }, { heartbeat: true });
  return true;
}

export function releasePipelineLock(slug: string, root?: string, patch: Partial<DispatchState> = {}): void {
  const resolvedRoot = getRootOrDefault(root);
  activePipelines.delete(slug);
  // NOTE: do NOT clear abortedPipelines here — let the pipeline loop detect it
  pausedPipelines.delete(slug);
  activeChildren.delete(slug);
  updateDispatchState(resolvedRoot, slug, {
    pipelineActive: false,
    pipelinePhase: patch.pipelinePhase ?? null,
    pipelineStatus: patch.pipelineStatus ?? "completed",
    pipelineCompletedAt: patch.pipelineCompletedAt ?? nowIso(),
    lastError: patch.lastError ?? null,
  }, { heartbeat: true });
}

export function abortPipeline(slug: string, root?: string): void {
  const resolvedRoot = getRootOrDefault(root);
  // Set abort flag FIRST, then kill children — flag must survive until pipeline exits
  abortedPipelines.add(slug);
  killAllChildren(slug);

  // Best-effort kill of persisted child PIDs (in case of restart)
  const state = readDispatchState(resolvedRoot, slug);
  if (state?.activeChildPids?.length) {
    for (const pid of state.activeChildPids) {
      try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ }
    }
  }

  const dispatchPatch: Partial<DispatchState> = {};
  if (state?.dispatchStatus === "running") {
    dispatchPatch.dispatchStatus = "aborted";
    dispatchPatch.dispatchCompletedAt = nowIso();
    dispatchPatch.lastError = "aborted";
  }

  activePipelines.delete(slug); // release lock so future runs can start
  pausedPipelines.delete(slug);
  updateDispatchState(resolvedRoot, slug, {
    ...dispatchPatch,
    aborted: true,
    paused: false,
    abortRequestedAt: nowIso(),
    pipelineActive: false,
    pipelineStatus: "aborted",
  }, { heartbeat: true });

  // Write abort marker so auto-recovery skips this project on next startup
  if (root) {
    try {
      const dir = join(getStateDir(root), "features");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${slug}.aborted`), String(Date.now()));
    } catch {}
  }
}

export function pausePipeline(slug: string, root?: string): void {
  const resolvedRoot = getRootOrDefault(root);
  pausedPipelines.add(slug);
  updateDispatchState(resolvedRoot, slug, {
    paused: true,
    pauseRequestedAt: nowIso(),
    pipelineStatus: "running",
  }, { heartbeat: true });
}

export function resumePipeline(slug: string, root?: string): void {
  const resolvedRoot = getRootOrDefault(root);
  pausedPipelines.delete(slug);
  updateDispatchState(resolvedRoot, slug, {
    paused: false,
    pipelineStatus: "running",
  }, { heartbeat: true });
}

export function isPipelineAborted(slug: string, root?: string): boolean {
  if (abortedPipelines.has(slug)) return true;
  const state = readDispatchState(getRootOrDefault(root), slug);
  return !!state?.aborted || state?.pipelineStatus === "aborted";
}

export function isPipelinePaused(slug: string, root?: string): boolean {
  if (pausedPipelines.has(slug)) return true;
  const state = readDispatchState(getRootOrDefault(root), slug);
  return !!state?.paused;
}

/** Wait while paused. Resolves false if aborted while waiting, true if resumed. */
async function waitIfPaused(slug: string, root?: string): Promise<boolean> {
  const resolvedRoot = getRootOrDefault(root);
  while (isPipelinePaused(slug, resolvedRoot)) {
    touchDispatchState(resolvedRoot, slug, { paused: true });
    if (isPipelineAborted(slug, resolvedRoot)) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
  return !isPipelineAborted(slug, resolvedRoot);
}

// ── Types ──

interface PlanTask {
  id: string;
  title: string;
  group: string;
  model?: string;
  depends_on?: string[];
  touches?: string[];
  done?: boolean;
  done_when?: string;
}

interface Plan {
  feature: string;
  tasks: PlanTask[];
}

const MAX_PARALLEL_TASKS = Math.max(1, parseInt(process.env.OGU_MAX_PARALLEL_TASKS || "4", 10));
const EXEC_MODE = process.env.OGU_EXEC_MODE || "spawn";
const TASK_TIMEOUT_MS = Math.max(30000, parseInt(process.env.OGU_TASK_TIMEOUT_MS || "300000", 10));

// ── Group → OrgSpec role mapping ──

const GROUP_ROLES: Record<string, string> = {
  setup: "devops",
  core: "backend-dev",
  ui: "frontend-dev",
  integration: "backend-dev",
  polish: "qa",
};

const DEFAULT_AGENT_NAMES: Record<string, string> = {
  setup: "Ops",
  core: "Dev",
  ui: "Design",
  integration: "Integration",
  polish: "QA",
};

// Map task group → role_id used in team.json
const GROUP_TO_TEAM_ROLE: Record<string, string> = {
  setup: "devops",
  core: "backend_engineer",
  ui: "frontend_engineer",
  integration: "backend_engineer",
  polish: "qa",
};

// ── Task failure store — enables learning candidate creation on retry ──
// taskId → { errors, group, agentId, failedAt }
const taskFailureStore = new Map<string, { errors: string[]; group: string; agentId: string | null; failedAt: number }>();

// ── Candidate dedup fingerprints (in-process, 24h TTL) ──
// Prevents creating near-identical candidates from repeated retries
const candidateFingerprints = new Map<string, number>(); // fingerprint → createdAt ms
const FINGERPRINT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Strip file paths and specific identifiers from gate errors,
 * keeping only semantic type for cross-project reuse.
 * e.g. "src/Button.tsx: no exported React component" → "ui:no-component-export"
 */
function normalizeGateErrors(errors: string[], group: string): string[] {
  return errors.slice(0, 5).map((err) => {
    const stripped = err
      .replace(/[\w./-]+\.(tsx?|jsx?|json|mjs|md|css|env)\s*[:，]/gi, "") // remove "path/file.ts:"
      .replace(/\b[\w-]+\/[\w/-]+/g, "")                                   // remove remaining paths
      .replace(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g, "Component")           // PascalCase → "Component"
      .replace(/["'`][^"'`]{0,40}["'`]/g, "")                             // remove string literals
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9:-]/g, "")
      .slice(0, 60);
    return `${group}:${stripped || "gate-failure"}`;
  });
}

/** Compute a fingerprint to detect near-duplicate candidates. */
export function computeCandidateFingerprint(agentId: string | null, group: string, normalizedSignals: string[]): string {
  return `${agentId ?? "noagent"}:${group}:${normalizedSignals.slice(0, 3).join("|")}`;
}

/** Returns true if a nearly identical candidate was created recently. */
export function isDuplicateCandidate(fingerprint: string): boolean {
  const now = Date.now();
  // Prune expired entries
  for (const [fp, ts] of candidateFingerprints) {
    if (now - ts > FINGERPRINT_TTL_MS) candidateFingerprints.delete(fp);
  }
  if (candidateFingerprints.has(fingerprint)) return true;
  candidateFingerprints.set(fingerprint, now);
  return false;
}

/** Load team members for a project, returns a group→agentId map */
function loadTeamAgentIds(root: string, slug: string): Record<string, string | null> {
  const ids: Record<string, string | null> = { setup: null, core: null, ui: null, integration: null, polish: null };
  try {
    const teamPath = join(getProjectsDir(root), slug, "team.json");
    if (!existsSync(teamPath)) return ids;
    const team = JSON.parse(readFileSync(teamPath, "utf-8"));
    const members: any[] = team?.members?.filter((m: any) => m.status === "active" && m.agent_id) || [];
    const used = new Set<string>();
    const pick = (keywords: string[]): string | null => {
      let m = members.find((m: any) => !used.has(m.agent_id) && keywords.some((k) => m.role_id === k));
      if (!m) m = members.find((m: any) => !used.has(m.agent_id) && keywords.some((k) => (m.role_id || "").includes(k)));
      if (!m) m = members.find((m: any) => !used.has(m.agent_id));
      if (m) { used.add(m.agent_id); return m.agent_id; }
      return null;
    };
    ids["setup"] = pick(["devops", "ops", "infra", "platform"]);
    ids["core"] = pick(["backend_engineer", "backend", "engineer", "developer"]);
    ids["ui"] = pick(["frontend_engineer", "frontend", "designer", "ui"]);
    ids["integration"] = pick(["backend_engineer", "backend", "integration", "api"]);
    ids["polish"] = pick(["qa", "quality", "test"]);
  } catch { /* fallback to nulls */ }
  return ids;
}

/** Load team members for a project, returns a group→agentName map */
function loadTeamAgentNames(root: string, slug: string): Record<string, string> {
  const names: Record<string, string> = { ...DEFAULT_AGENT_NAMES };
  try {
    let teamPath = join(getProjectsDir(root), slug, "team.json");
    // Fallback: try OGU_ROOT if mainRoot differs
    if (!existsSync(teamPath)) {
      const oguRoot = process.env.OGU_ROOT;
      if (oguRoot && oguRoot !== root) teamPath = join(getProjectsDir(oguRoot), slug, "team.json");
    }
    if (!existsSync(teamPath)) {
      console.warn(`[dispatch] team.json not found for ${slug} at ${teamPath} — using default agent names`);
      return names;
    }
    const team = JSON.parse(readFileSync(teamPath, "utf-8"));
    const members: any[] = team?.members?.filter((m: any) => m.status === "active" && m.agent_name) || [];
    if (members.length === 0) {
      console.warn(`[dispatch] team.json for ${slug} has no active members — using default agent names`);
      return names;
    }
    console.log(`[dispatch] Loaded ${members.length} team members for ${slug}: ${members.map((m: any) => m.agent_name).join(", ")}`);

    // Try exact role match first, then fuzzy, then round-robin from pool
    const used = new Set<string>();
    const pick = (keywords: string[]): string | null => {
      const roleOf = (m: any) => [m.role_id, m.role_display, m.roleId, m.roleDisplay].filter(Boolean).map((s: string) => s.toLowerCase()).join(" ");
      // Case-insensitive exact match
      let m = members.find((m) => !used.has(m.agent_id) && keywords.some((k) => roleOf(m).split(" ").includes(k)));
      // Fuzzy match
      if (!m) m = members.find((m) => !used.has(m.agent_id) && keywords.some((k) => roleOf(m).includes(k)));
      // Any unused
      if (!m) m = members.find((m) => !used.has(m.agent_id));
      // Any at all
      if (!m) m = members[0];
      if (m) { used.add(m.agent_id); return m.agent_name; }
      return null;
    };

    const n = pick(["devops", "ops", "infra", "platform"]); if (n) names["setup"] = n;
    const n2 = pick(["backend_engineer", "backend", "engineer", "developer", "fullstack"]); if (n2) names["core"] = n2;
    const n3 = pick(["frontend_engineer", "frontend", "designer", "ui", "ux"]); if (n3) names["ui"] = n3;
    const n4 = pick(["backend_engineer", "backend", "integration", "api"]); if (n4) names["integration"] = n4;
    const n5 = pick(["qa", "quality", "test"]); if (n5) names["polish"] = n5;
  } catch { /* fallback to defaults */ }
  return names;
}

// ── DAG Wave Builder ──

function buildWaves(tasks: PlanTask[], isDone: (task: PlanTask) => boolean): PlanTask[][] {
  const pending = tasks.filter((t) => !isDone(t));
  const resolved = new Set(tasks.filter((t) => isDone(t)).map((t) => t.id));
  const waves: PlanTask[][] = [];
  const remaining = new Set(pending.map((t) => t.id));

  while (remaining.size > 0) {
    const wave: PlanTask[] = [];
    for (const t of pending) {
      if (!remaining.has(t.id)) continue;
      const deps = t.depends_on || [];
      if (deps.every((d) => resolved.has(d))) {
        wave.push(t);
      }
    }

    if (wave.length === 0) {
      // Circular deps or orphans — force remaining into final wave
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

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let index = 0;
  const safeLimit = Math.max(1, limit);
  const runners = Array.from({ length: Math.min(items.length, safeLimit) }, async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) break;
      try {
        const value = await worker(items[current]);
        results[current] = { status: "fulfilled", value };
      } catch (err: any) {
        results[current] = { status: "rejected", reason: err };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

// ── Mark task done in Plan.json ──

function markTaskDone(root: string, slug: string, taskId: string): void {
  const planPath = join(root, "docs/vault/04_Features", slug, "Plan.json");
  try {
    const plan: Plan = JSON.parse(readFileSync(planPath, "utf-8"));
    const task = plan.tasks.find((t) => t.id === taskId);
    if (task) {
      task.done = true;
      writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n", "utf-8");
    }
  } catch { /* best effort */ }
}

// ── Budget pre-check ──

function checkBudget(root: string): { ok: boolean; reason?: string } {
  try {
    const budgetPath = join(getBudgetDir(root), "budget-state.json");
    if (!existsSync(budgetPath)) return { ok: true }; // no budget config = unlimited
    const state = JSON.parse(readFileSync(budgetPath, "utf-8"));
    const limit = state.dailyLimit || 10;
    const spent = state.todaySpent || 0;
    if (spent >= limit) {
      return { ok: false, reason: `Daily budget exhausted ($${spent.toFixed(2)}/$${limit.toFixed(2)})` };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // can't read budget = allow
  }
}

// ── Local Task Gates (fast, per-task validation) ──
// Run after agent:run succeeds. Uses shared task-gates for consistency.

interface LocalGateResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/** Resolve task.group to one of the 5 canonical groups — deterministic, no guessing */
function resolveGroup(task: PlanTask): string {
  return resolveTaskGroup({
    group: task.group,
    title: task.title,
    name: task.id,
    touches: task.touches || [],
  });
}

function getContextKeys(task: PlanTask): string[] {
  const deps = [
    ...(Array.isArray(task.depends_on) ? task.depends_on : []),
    ...(Array.isArray((task as any).dependsOn) ? (task as any).dependsOn : []),
  ].filter(Boolean);
  return [...new Set(deps.map((id) => buildHandoffKey(id)))];
}

function buildHandoffSummary(task: PlanTask, output: any | null, localGates?: LocalGateResult) {
  const files = Array.isArray(output?.files) ? output.files.map((f: any) => f.path).filter(Boolean) : [];
  const gateResults = Array.isArray(output?.gateResults)
    ? output.gateResults
    : localGates
      ? [{ gate: `task-${resolveGroup(task)}`, passed: localGates.passed === true, message: (localGates.errors || []).join("; ").slice(0, 2000) }]
      : [];
  return {
    taskId: task.id,
    title: task.title || task.id,
    group: resolveGroup(task),
    status: output?.status || (localGates?.passed ? "success" : "unknown"),
    files,
    gateResults,
    warnings: localGates?.warnings || [],
    completedAt: new Date().toISOString(),
  };
}

async function runLocalGates(root: string, task: PlanTask): Promise<LocalGateResult> {
  const warnings: string[] = [];
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

// ── Actionable fix note builder ──

/**
 * Builds a structured, actionable fix note for a failed task.
 * When gates fail due to missing files, scans the directory to show what WAS created,
 * so the agent knows exactly what to rename/move/create.
 */
function buildActionableFixNote(task: PlanTask, rawErr: string, root: string): string {
  const preflight = preflightTaskSpec(root, task);
  const taskForFix = {
    ...task,
    title: task.title || task.id,
    touches: preflight.touches || task.touches || [],
    group: preflight.group || task.group,
  };

  return buildTaskFixNote(taskForFix as any, { rawError: rawErr, errors: [] }, root);
}

// ── Execute single task via CLI ──

function executeTask(
  root: string,
  slug: string,
  task: PlanTask,
  fixNote?: string,
  tierOverride?: string,
  extraTouches?: string[],
  agentId?: string | null,
  contextKeys?: string[],
): Promise<{ taskId: string; success: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Already aborted before we even start
    if (isPipelineAborted(slug, root)) {
      return resolve({ taskId: task.id, success: false, error: "Aborted" });
    }
    const cli = getCliPath();
    const role = GROUP_ROLES[resolveGroup(task)] || "backend-dev";

    // Map CTO model choice → OrgSpec tier
    const MODEL_TO_TIER: Record<string, string> = {
      haiku: "fast",
      sonnet: "standard",
      opus: "premium",
    };
    // tierOverride takes precedence (used during auto-fix escalation)
    const tier = tierOverride || MODEL_TO_TIER[task.model || ""] || null;

    const args = [
      cli, "agent:run",
      "--feature", slug,
      "--task", task.id,
      "--role", role,
    ];

    if (tier) {
      args.push("--tier", tier);
    }

    // Merge original touches with extra error-file touches for fix mode
    const allTouches = [...new Set([...(task.touches || []), ...(extraTouches || [])])];
    if (allTouches.length > 0) {
      args.push("--touches", allTouches.join(","));
    }

    if (fixNote) {
      args.push("--fix-note", fixNote);
    }


    const contextList = (contextKeys && contextKeys.length > 0) ? contextKeys : getContextKeys(task);
    for (const key of contextList) {
      args.push("--context", key);
    }

    // Broadcast dispatch event
    broadcast({
      type: "task:dispatched",
      taskId: task.id,
      title: task.title,
      roleId: role,
      model: task.model || "sonnet",
    } as any);

    const heartbeat = setInterval(() => {
      touchDispatchState(root, slug, { dispatchStatus: "running" });
    }, 15000);

    const handleSuccess = async () => {
      // Agent succeeded - if runner already validated task gates, skip local gates
      let runnerGatesPassed = false;
      let output: any | null = null;
      try {
        output = readRunnerOutput(root, task.id);
        if (hasRunnerGatePass(output)) {
          runnerGatesPassed = true;
          writeTaskGateEvidence(root, task.id, {
            passed: true,
            source: "runner",
            gateResults: output?.gateResults || [],
          });
        }
      } catch { /* fall back to local gates */ }

      if (runnerGatesPassed) {
        console.log(`[dispatch] Task ${task.id} completed + runner gates passed`);
        try { writeHandoffContext(root, slug, task.id, buildHandoffSummary(task, output)); } catch { /* best effort */ }
        resolve({ taskId: task.id, success: true });
        return;
      }

      // Fallback: run local gates before marking done
      const localGates = await runLocalGates(root, task);
      if (localGates.warnings.length > 0) {
        console.warn(`[local-gates] ${task.id} warnings: ${localGates.warnings.join(", ")}`);
      }
      if (!localGates.passed) {
        console.error(`[local-gates] ${task.id} FAILED: ${localGates.errors.join(", ")}`);
        taskFailureStore.set(task.id, {
          errors: localGates.errors,
          group: resolveGroup(task),
          agentId: agentId || null,
          failedAt: Date.now(),
        });
        writeTaskGateEvidence(root, task.id, {
          passed: false,
          source: "local",
          errors: localGates.errors,
          warnings: localGates.warnings,
        });
        resolve({ taskId: task.id, success: false, error: formatGateErrorsForFix(localGates.errors) });
      } else {
        console.log(`[dispatch] Task ${task.id} completed + local gates passed`);
        writeTaskGateEvidence(root, task.id, {
          passed: true,
          source: "local",
          warnings: localGates.warnings,
        });
        try {
          const output2 = output || readRunnerOutput(root, task.id);
          writeHandoffContext(root, slug, task.id, buildHandoffSummary(task, output2, localGates));
        } catch { /* best effort */ }
        resolve({ taskId: task.id, success: true });
      }
    };

    if (EXEC_MODE === "inproc") {
      (async () => {
        try {
          const { runAgentTask } = await import("../../../ogu/commands/agent-run.mjs");
          const runPromise = runAgentTask({
            root,
            feature: slug,
            task: task.id,
            role,
            tier,
            dryRun: false,
            simulate: false,
            simulateFailure: 0,
            risk: undefined,
            touches: allTouches,
            contextKeys: contextList,
            fixNote,
          });

          const result = await Promise.race([
            runPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Task timeout")), TASK_TIMEOUT_MS)),
          ]) as any;

          clearInterval(heartbeat);

          if (result?.exitCode === 0) {
            await handleSuccess();
          } else {
            const err = result?.error || result?.result?.error || "Task failed";
            resolve({ taskId: task.id, success: false, error: String(err) });
          }
        } catch (err: any) {
          clearInterval(heartbeat);
          resolve({ taskId: task.id, success: false, error: err.message || "Task failed" });
        }
      })();
      return;
    }

    const child = spawn("node", args, {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    });

    registerChild(root, slug, child);

    let stdout = "";
    let stderr = "";

    // Capture both stdout and stderr — errors can appear in either
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    // 5 minute timeout per task
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, TASK_TIMEOUT_MS);

    child.on("close", async (code) => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      unregisterChild(root, slug, child);
      if (code === 0) {
        await handleSuccess();
      } else {
        // Build a useful error report: prefer stdout (where most CLI errors land), fall back to stderr
        const outTail = stdout.slice(-800).trim();
        const errTail = stderr.slice(-400).trim();
        const errorReport = [
          outTail ? `STDOUT:\n${outTail}` : "",
          errTail ? `STDERR:\n${errTail}` : "",
        ].filter(Boolean).join("\n\n") || `Exit code ${code}`;
        console.error(`[dispatch] Task ${task.id} failed (exit ${code}): ${errTail || outTail.slice(-200)}`);
        resolve({ taskId: task.id, success: false, error: errorReport });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      clearInterval(heartbeat);
      unregisterChild(root, slug, child);
      resolve({ taskId: task.id, success: false, error: err.message });
    });
  });
}

// ── Broadcast updated UIState ──

async function broadcastState(root: string, slug: string): Promise<void> {
  try {
    const { resolveUIState } = await import("./project-state.js");
    const uiState = resolveUIState(root, slug);
    if (uiState) {
      broadcast({ type: "project:state_changed", slug, state: uiState } as any);
    }
  } catch { /* best effort */ }
}

// ── Retry failed tasks ──

export async function retryFailedTasks(root: string, slug: string): Promise<{ retried: string[]; errors: string[] }> {
  const planPath = join(root, "docs/vault/04_Features", slug, "Plan.json");
  if (!existsSync(planPath)) return { retried: [], errors: ["Plan.json not found"] };

  let plan: Plan;
  try {
    plan = JSON.parse(readFileSync(planPath, "utf-8"));
  } catch {
    return { retried: [], errors: ["Failed to parse Plan.json"] };
  }

  const failed = plan.tasks.filter((t) => !hasTaskGateEvidence(root, t.id));
  // Only retry tasks that had a previous input (were dispatched before)
  const runnersDir = getRunnersDir(root);
  const toRetry = failed.filter((t) => {
    const inputExists = existsSync(join(runnersDir, `${t.id}.input.json`));
    if (!inputExists) return false;
    const output = readRunnerOutput(root, t.id);
    const gatePassed = hasTaskGateEvidence(root, t.id);
    if (!output) return true;
    if (gatePassed) return false;
    return output.status !== "success";
  });

  if (toRetry.length === 0) return { retried: [], errors: ["No failed tasks to retry"] };

  const think = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);
  think(`Retrying ${toRetry.length} failed task(s): ${toRetry.map((t) => t.title).join(", ")}`);

  // Load agentIds for learning candidate creation on success
  const mainRoot = process.env.OGU_MAIN_ROOT || root;
  const agentIds = loadTeamAgentIds(mainRoot, slug);

  const results = await runWithConcurrency(
    toRetry,
    MAX_PARALLEL_TASKS,
    (task) => {
      const group = resolveGroup(task);
      broadcast({ type: "task:dispatched", taskId: task.id, title: task.title, roleId: GROUP_ROLES[group] || "backend-dev", model: task.model || "sonnet" } as any);
      return executeTask(root, slug, task, undefined, undefined, undefined, agentIds[group] || null);
    },
  );

  const retried: string[] = [];
  const errors: string[] = [];
  let candidatesCreated = 0;

  for (const result of results) {
    const res = result.status === "fulfilled" ? result.value : { taskId: "?", success: false, error: "Promise rejected" };
    const taskObj = toRetry.find((t) => t.id === res.taskId);
    const group = taskObj ? resolveGroup(taskObj) : "core";
    if (res.success) {
      retried.push(res.taskId);
      markTaskDone(root, slug, res.taskId);
      think(`Retry succeeded: "${taskObj?.title || res.taskId}"`);
      broadcast({ type: "task:completed", taskId: res.taskId, title: taskObj?.title || "", roleId: GROUP_ROLES[group] || "", result: "done" } as any);

      // ── Learning candidate: FAIL → retry success ──
      const storedFailure = taskFailureStore.get(res.taskId);
      if (storedFailure?.agentId) {
        try {
          const normalizedSignals = normalizeGateErrors(storedFailure.errors, storedFailure.group);
          const fingerprint = computeCandidateFingerprint(storedFailure.agentId, storedFailure.group, normalizedSignals);
          if (!isDuplicateCandidate(fingerprint)) {
            const { createLearningCandidate } = await import(
              /* @vite-ignore */ "../../../../tools/ogu/commands/lib/learning-event.mjs"
            );
            createLearningCandidate(root, {
              agentId: storedFailure.agentId,
              taskType: GROUP_ROLES[storedFailure.group] || "backend-dev",
              contextSignature: [`gate:local-${storedFailure.group}`, `group:${storedFailure.group}`],
              failureSignals: normalizedSignals,
              resolutionSummary: `Resolved local ${storedFailure.group} gate on retry. Signals: ${normalizedSignals.slice(0, 2).join("; ")}`,
              iterationCount: 2,
              trigger: "local_gate_failure",
            });
            candidatesCreated++;
          }
        } catch { /* best-effort */ }
        taskFailureStore.delete(res.taskId);
      }
    } else {
      errors.push(`${res.taskId}: ${res.error}`);
      think(`Retry failed: "${taskObj?.title || res.taskId}"`);
      broadcast({ type: "task:failed", taskId: res.taskId, title: taskObj?.title || "", roleId: GROUP_ROLES[group] || "", error: res.error || "Unknown" } as any);
    }
  }

  // Candidates written — trainAll runs in batch at end of dispatchProject or verify, not per-retry.
  if (candidatesCreated > 0) {
    console.log(`[learning] ${candidatesCreated} candidate(s) written — training will run in batch`);
  }

  await broadcastState(root, slug);
  return { retried, errors };
}

// ── Main dispatcher (fire-and-forget) ──

export async function dispatchProject(root: string, slug: string): Promise<void> {
  const planPath = join(root, "docs/vault/04_Features", slug, "Plan.json");
  if (!existsSync(planPath)) {
    console.error(`[dispatch] Plan.json not found: ${planPath}`);
    return;
  }

  let plan: Plan;
  try {
    plan = JSON.parse(readFileSync(planPath, "utf-8"));
  } catch (err) {
    console.error(`[dispatch] Failed to parse Plan.json:`, err);
    return;
  }

  if (!plan.tasks?.length) {
    console.log(`[dispatch] No tasks in Plan.json for ${slug}`);
    return;
  }

  // Enforce lifecycle: team must be approved before dispatch runs
  try {
    const teamPath = join(getProjectsDir(root), slug, "team.json");
    if (!existsSync(teamPath)) {
      const msg = `[dispatch] Team not found for ${slug} — approval required before dispatch`;
      console.warn(msg);
      broadcast({ type: "dispatch:error", slug, error: "Team not approved" } as any);
      return;
    }
    const team = JSON.parse(readFileSync(teamPath, "utf-8"));
    const approved = team?.approved === true || !!team?.approved_at;
    if (!approved) {
      const msg = `[dispatch] Team not approved for ${slug} — approval required before dispatch`;
      console.warn(msg);
      broadcast({ type: "dispatch:error", slug, error: "Team not approved" } as any);
      return;
    }
  } catch { /* best effort — allow dispatch if team check fails */ }

  // Clear any stale abort flag from a previous run for this slug
  abortedPipelines.delete(slug);

  const isTaskDone = (task: PlanTask) => hasTaskGateEvidence(root, task.id);
  const waves = buildWaves(plan.tasks, isTaskDone);
  console.log(`[dispatch] ${slug}: ${plan.tasks.length} tasks in ${waves.length} waves`);

  updateDispatchState(root, slug, {
    dispatchStatus: "running",
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

  // Load real team member names and IDs for this project
  const mainRoot = process.env.OGU_MAIN_ROOT || root;
  const agentNames = loadTeamAgentNames(mainRoot, slug);
  const agentIds = loadTeamAgentIds(mainRoot, slug);

  const think = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);

  think(`Building project in ${waves.length} wave${waves.length > 1 ? "s" : ""} (${plan.tasks.length} tasks total)`);

  broadcast({
    type: "dispatch:started",
    slug,
    totalTasks: plan.tasks.length,
    totalWaves: waves.length,
  } as any);

  let completedCount = 0;
  let failedCount = 0;

  const WAVE_DESCRIPTIONS = [
    "Setting up project foundation",
    "Building core features",
    "Adding UI and interactions",
    "Wiring up integrations",
    "Final polish and quality checks",
  ];

  for (let wi = 0; wi < waves.length; wi++) {
    // ── Abort check ──
    if (abortedPipelines.has(slug)) {
      think("Execution aborted by user");
      broadcast({ type: "dispatch:aborted", slug } as any);
      updateDispatchState(root, slug, {
        dispatchStatus: "aborted",
        dispatchCompletedAt: nowIso(),
        lastError: "aborted",
      }, { heartbeat: true });
      await broadcastState(root, slug);
      return;
    }

    // ── Pause check ──
    if (isPipelinePaused(slug, root)) {
      think("Execution paused — waiting for resume...");
      broadcast({ type: "dispatch:paused", slug } as any);
      await broadcastState(root, slug);
      const resumed = await waitIfPaused(slug, root);
      if (!resumed) {
        think("Execution aborted while paused");
        broadcast({ type: "dispatch:aborted", slug } as any);
        updateDispatchState(root, slug, {
          dispatchStatus: "aborted",
          dispatchCompletedAt: nowIso(),
          lastError: "aborted",
        }, { heartbeat: true });
        await broadcastState(root, slug);
        return;
      }
      think("Execution resumed");
      broadcast({ type: "dispatch:resumed", slug } as any);
    }

    const wave = waves[wi];
    console.log(`[dispatch] Wave ${wi + 1}/${waves.length}: ${wave.map((t) => t.id).join(", ")}`);

    const waveDesc = WAVE_DESCRIPTIONS[wi] || `Processing wave ${wi + 1}`;
    think(`Wave ${wi + 1}/${waves.length}: ${waveDesc} (${wave.length} task${wave.length > 1 ? "s" : ""})`);

    touchDispatchState(root, slug, {
      dispatchStatus: "running",
      waveIndex: wi,
      completedCount,
      failedCount,
    });

    // Budget check before each wave
    const budget = checkBudget(root);
    if (!budget.ok) {
      think("Budget limit reached — pausing execution");
      console.log(`[dispatch] Budget exhausted, stopping: ${budget.reason}`);
      broadcast({
        type: "budget:exhausted",
        dailyLimit: 0,
        spent: 0,
      } as any);
      updateDispatchState(root, slug, {
        dispatchStatus: "failed",
        dispatchCompletedAt: nowIso(),
        lastError: budget.reason || "budget exhausted",
      }, { heartbeat: true });
      break;
    }

    // ── Manifest proposal: budget threshold >50% ──
    try {
      if (!hasRecentProposal(root, slug)) {
        const budgetPath = join(getBudgetDir(root), "budget-state.json");
        if (existsSync(budgetPath)) {
          const bs = JSON.parse(readFileSync(budgetPath, "utf-8"));
          const limit = bs.dailyLimit || 10;
          const spent = bs.todaySpent || 0;
          if (limit > 0 && spent / limit > 0.5) {
            const p = generateProposal(root, slug, "budget_threshold", "50");
            if (p) broadcast({ type: "manifest:proposal", slug, proposal: p } as any);
          }
        }
      }
    } catch { /* best-effort */ }

    broadcast({
      type: "wave:started",
      waveIndex: wi,
      taskCount: wave.length,
    } as any);

    // Execute all tasks in this wave in parallel
    const results = await runWithConcurrency(
      wave,
      MAX_PARALLEL_TASKS,
      (task) => executeTask(root, slug, task, undefined, undefined, undefined, agentIds[resolveGroup(task)] || null),
    );

    // Process results
    let waveSuccess = 0;
    let waveFail = 0;
    const toRetryItems: Array<{ task: PlanTask; fixNote: string; agentName: string; taskRole: string }> = [];

    for (const result of results) {
      const res = result.status === "fulfilled"
        ? result.value
        : { taskId: "?", success: false, error: "Promise rejected" };

      const taskObj = wave.find((t) => t.id === res.taskId);
      const taskGroup = taskObj?.group || "core";
      const taskRole = GROUP_ROLES[taskGroup] || "";
      const agentName = agentNames[taskGroup] || DEFAULT_AGENT_NAMES[taskGroup] || "Agent";

      if (res.success) {
        completedCount++;
        waveSuccess++;
        markTaskDone(root, slug, res.taskId);
        think(`${agentName} completed: "${taskObj?.title || res.taskId}"`);
        broadcast({
          type: "task:completed",
          taskId: res.taskId,
          title: taskObj?.title || "",
          roleId: taskRole,
          result: "done",
        } as any);
      } else {
        failedCount++;
        waveFail++;
        console.error(`[dispatch] Task ${res.taskId} failed: ${res.error}`);
        think(`${agentName} encountered an issue on "${taskObj?.title || res.taskId}"`);
        broadcast({
          type: "task:failed",
          taskId: res.taskId,
          title: taskObj?.title || "",
          roleId: taskRole,
          error: res.error || "Unknown error",
        } as any);

        // Queue for auto-retry with actionable fix note
        if (taskObj) {
          const rawErr = res.error || "Unknown error";
          const fixNote = buildActionableFixNote(taskObj, rawErr, root);
          toRetryItems.push({ task: taskObj, fixNote, agentName, taskRole });
        }
      }
    }

    // ── Auto-retry: re-run failed tasks with the error as fix note ──
    if (toRetryItems.length > 0 && !isPipelineAborted(slug, root) && !isPipelinePaused(slug, root)) {
      think(`Reviewing ${toRetryItems.length} failed task(s) — sending fix notes and retrying...`);
      broadcast({ type: "wave:retry_started", waveIndex: wi, count: toRetryItems.length } as any);

      const retryResults = await runWithConcurrency(
        toRetryItems,
        MAX_PARALLEL_TASKS,
        ({ task, fixNote }) =>
          executeTask(root, slug, task, fixNote, undefined, undefined, agentIds[resolveGroup(task)] || null),
      );

      const toRetry2: typeof toRetryItems = [];

      for (let ri = 0; ri < retryResults.length; ri++) {
        const rr = retryResults[ri];
        const item = toRetryItems[ri];
        const res = rr.status === "fulfilled"
          ? rr.value
          : { taskId: item.task.id, success: false, error: "Promise rejected on retry" };

        if (res.success) {
          completedCount++;
          failedCount--;
          waveFail--;
          waveSuccess++;
          markTaskDone(root, slug, res.taskId);
          think(`${item.agentName} fixed "${item.task.title}" on retry`);
          broadcast({
            type: "task:completed",
            taskId: res.taskId,
            title: item.task.title || "",
            roleId: item.taskRole,
            result: "retry-success",
          } as any);
        } else {
          console.error(`[dispatch] Retry 1 failed for ${item.task.id}: ${res.error}`);
          // Queue for second retry with updated fix note
          const fixNote2 = buildActionableFixNote(item.task, res.error || item.fixNote, root);
          toRetry2.push({ ...item, fixNote: fixNote2 });
        }
      }

      // ── Second retry pass ──
      if (toRetry2.length > 0 && !isPipelineAborted(slug, root) && !isPipelinePaused(slug, root)) {
        think(`${toRetry2.length} task(s) still failing — final retry attempt...`);
        const retry2Results = await runWithConcurrency(
          toRetry2,
          MAX_PARALLEL_TASKS,
          ({ task, fixNote }) =>
            executeTask(root, slug, task, fixNote, "premium", undefined, agentIds[resolveGroup(task)] || null),
        );
        for (let ri = 0; ri < retry2Results.length; ri++) {
          const rr = retry2Results[ri];
          const item = toRetry2[ri];
          const res = rr.status === "fulfilled"
            ? rr.value
            : { taskId: item.task.id, success: false, error: "Promise rejected on retry 2" };
          if (res.success) {
            completedCount++;
            failedCount--;
            waveFail--;
            waveSuccess++;
            markTaskDone(root, slug, res.taskId);
            think(`${item.agentName} fixed "${item.task.title}" on second retry`);
            broadcast({ type: "task:completed", taskId: res.taskId, title: item.task.title || "", roleId: item.taskRole, result: "retry2-success" } as any);
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

    updateDispatchState(root, slug, {
      dispatchStatus: "running",
      waveIndex: wi,
      completedCount,
      failedCount,
    }, { heartbeat: true });

    // Broadcast updated UIState after each wave
    await broadcastState(root, slug);

    // ── Manifest proposals: progress milestones + error spikes ──
    try {
      if (!hasRecentProposal(root, slug)) {
        // Re-read plan to compute progress
        const freshPlan: Plan = JSON.parse(readFileSync(planPath, "utf-8"));
        const total = freshPlan.tasks.length;
        const done = freshPlan.tasks.filter((t) => t.done).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        // Progress milestones
        if (pct >= 50 && pct < 100) {
          const p = generateProposal(root, slug, "progress_milestone", "50");
          if (p) broadcast({ type: "manifest:proposal", slug, proposal: p } as any);
        } else if (pct >= 100) {
          const p = generateProposal(root, slug, "progress_milestone", "100");
          if (p) broadcast({ type: "manifest:proposal", slug, proposal: p } as any);
        }

        // Error spike: >=2 failures in this wave
        if (failedCount >= 2 && !hasRecentProposal(root, slug)) {
          const p = generateProposal(root, slug, "error_spike", `${failedCount} failures`);
          if (p) broadcast({ type: "manifest:proposal", slug, proposal: p } as any);
        }
      }
    } catch { /* manifest proposals are best-effort */ }

    broadcast({
      type: "wave:completed",
      waveIndex: wi,
      results: results.map((r) =>
        r.status === "fulfilled" ? r.value : { success: false },
      ),
    } as any);
  }

  console.log(`[dispatch] ${slug}: Complete. ${completedCount} done, ${failedCount} failed.`);

  const currentDispatch = readDispatchState(root, slug);
  const finalizedStatus: DispatchState["dispatchStatus"] =
    currentDispatch?.dispatchStatus && currentDispatch.dispatchStatus !== "running"
      ? currentDispatch.dispatchStatus
      : (failedCount === 0 ? "completed" : "failed");
  const finalizedError =
    currentDispatch?.dispatchStatus && currentDispatch.dispatchStatus !== "running"
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

  // ── Batch training: run trainAll once at end of all waves ──
  // Processes all learning candidates accumulated during this dispatch run.
  try {
    const { trainAll } = await import(
      /* @vite-ignore */ "../../../../tools/ogu/commands/lib/agent-trainer.mjs"
    );
    const trainResult = await trainAll(root, { playbooksDir: join(mainRoot, "tools/ogu/playbooks") });
    if (trainResult.trained > 0) {
      console.log(`[learning] Batch training: ${trainResult.trained} agent(s) updated`);
    }
  } catch { /* best-effort — training never blocks dispatch */ }

  if (failedCount === 0) {
    think(`All ${completedCount} tasks completed successfully`);
    think("Preparing for verification and quality gates...");
  } else {
    think(`Execution complete: ${completedCount} passed, ${failedCount} failed`);
  }

  broadcast({
    type: "dispatch:completed",
    slug,
    completedCount,
    failedCount,
  } as any);

  // Transition FSM to 'building' if any tasks completed
  if (completedCount > 0) {
    try {
      const { transitionFeature } = await import(
        /* @vite-ignore */ "../../../../tools/ogu/commands/lib/state-machine.mjs"
      );
      think("Transitioning to build phase...");
      transitionFeature(root, slug, "building", {
        reason: `Dispatch complete: ${completedCount} tasks done`,
        actor: "dispatch",
      });

      // ── Manifest proposal: phase transition ──
      if (!hasRecentProposal(root, slug)) {
        const p = generateProposal(root, slug, "phase_transition", "building");
        if (p) broadcast({ type: "manifest:proposal", slug, proposal: p } as any);
      }
    } catch { /* FSM is best-effort */ }

    // ── Auto-pipeline: always continue to Verification regardless of partial failures ──
    // Failed tasks are surfaced in the Verification screen — the pipeline never blocks here.
    if (failedCount > 0) {
      think(`${failedCount} task(s) could not be completed — proceeding to verification to assess overall quality`);
    } else {
      think("All tasks done — starting automated pipeline...");
    }
    // Acquire lock BEFORE broadcasting state so clients see pipelineActive=true immediately
    acquirePipelineLock(slug, "auto-pipeline", root);
    await broadcastState(root, slug);
    // autoContinuePipeline broadcasts its own compile:started per phase — no duplicate here
    autoContinuePipeline(root, slug).catch((err) => {
      console.error("[dispatch] Auto-pipeline failed:", err);
      broadcast({ type: "pipeline:error", slug, error: String(err?.message || err) } as any);
    });
  } else {
    await broadcastState(root, slug);
  }
}

// ── Auto-Pipeline: chain phases until done or failure ──

const PIPELINE_PHASES: Array<{
  phase: string;
  next: string;
  args?: (slug: string) => string[];
  label: string;
  successMsg: string;
  failMsg: string;
}> = [
  {
    phase: "building",
    next: "verifying",
    // Pass-through — transitions FSM to "verifying" (= Ready for Verification).
    // The 14 global gates run on-demand from the Verification screen, not automatically.
    label: "Build complete — ready for verification",
    successMsg: "Build complete — run verification to validate quality",
    failMsg: "Build phase failed",
  },
  // "verifying → done" is NOT automatic. The user triggers it from the Verification screen.
];

async function autoContinuePipeline(root: string, slug: string): Promise<void> {
  // Lock is already held by dispatchProject() caller.
  // If somehow called without lock, acquire it.
  if (!isPipelineActive(slug, root)) {
    if (!acquirePipelineLock(slug, "auto-pipeline", root)) {
      console.log(`[pipeline] Already running for ${slug}, skipping auto-pipeline`);
      return;
    }
  }

  const think = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);
  let finalStatus: DispatchState["pipelineStatus"] = "completed";
  let finalError: string | null = null;

  try {
  for (const step of PIPELINE_PHASES) {
    updateDispatchState(root, slug, {
      pipelinePhase: step.phase,
      pipelineStatus: "running",
    }, { heartbeat: true });
    think(step.label);

    if (!step.args) {
      // Pass-through phase
      try {
        const { transitionFeature } = await import(
          /* @vite-ignore */ "../../../../tools/ogu/commands/lib/state-machine.mjs"
        );
        transitionFeature(root, slug, step.next, {
          reason: `Auto-pipeline: ${step.phase} → ${step.next}`,
          actor: "pipeline",
        });
      } catch { /* best effort */ }

      think(step.successMsg);
      await broadcastState(root, slug);
      if (step.next === "verifying") {
        // Auto-install dependencies before verification if node_modules is missing
        const { existsSync: _ex } = await import("node:fs");
        if (!_ex(join(root, "node_modules")) && _ex(join(root, "package.json"))) {
          think("Installing dependencies (npm install)...");
          try {
            const pkgMgr = _ex(join(root, "pnpm-lock.yaml")) ? "pnpm install"
                         : _ex(join(root, "yarn.lock"))      ? "yarn install"
                         : "npm install";
            await new Promise<void>((res) => {
              const proc = spawn(pkgMgr.split(" ")[0], pkgMgr.split(" ").slice(1), {
                cwd: root, stdio: "ignore",
                env: { ...process.env, CI: "true" },
              });
              proc.on("close", () => res());
              proc.on("error", () => res());
            });
            think("Dependencies installed");
          } catch { think("npm install failed — continuing anyway"); }
        }
        // Build complete — project is now in "Ready for Verification" state.
        broadcast({ type: "build:complete", slug } as any);
      }
      continue;
    }

    // Run CLI command — with iterative auto-fix loop.
    // Each gate run may fail on a DIFFERENT gate, so we loop: run → fix → run → fix...
    // Max total fix cycles per pipeline step prevents infinite loops.
    const MAX_FIX_CYCLES = 2;
    let stepPassed = false;

    for (let cycle = 0; cycle <= MAX_FIX_CYCLES; cycle++) {
      const isRetry = cycle > 0;
      if (isRetry) {
        think(`Gate fix applied — retrying ${step.label}`);
      }

      touchDispatchState(root, slug, { pipelinePhase: step.phase, pipelineStatus: "running" });
      const success = await runPipelineStep(root, slug, step, think);

      if (success) {
        stepPassed = true;
        break;
      }

      // Gate failed — attempt auto-fix for whichever gate failed THIS time
      think(`Gates failed (cycle ${cycle + 1}/${MAX_FIX_CYCLES + 1}) — attempting auto-fix...`);
      const fixed = await autoFixGateFailure(root, slug, step.phase, think, cycle);
      if (!fixed) {
        // Can't fix this gate — stop
        break;
      }
      // Loop continues → re-run gates after fix
    }

    if (stepPassed) {
      // Transition FSM to next phase
      try {
        const { transitionFeature } = await import(
          /* @vite-ignore */ "../../../../tools/ogu/commands/lib/state-machine.mjs"
        );
        transitionFeature(root, slug, step.next, {
          reason: `Auto-pipeline: ${step.phase} → ${step.next}`,
          actor: "pipeline",
        });
      } catch { /* best effort */ }

      think(step.successMsg);
      broadcast({ type: "compile:completed", featureSlug: slug, passed: true, errors: 0 } as any);
      await broadcastState(root, slug);

      if (step.next === "done") {
        think("Your project is complete and ready to use!");
        broadcast({ type: "pipeline:completed", slug, success: true } as any);
      }
    } else {
      // All fix cycles exhausted or gate not fixable — stop
      think(`${step.failMsg} — manual review required`);
      finalStatus = "failed";
      // Read actual error from GATE_STATE.json for display
      let gateErrorMsg: string | undefined;
      try {
        const gs = JSON.parse(readFileSync(resolveRuntimePath(root, "GATE_STATE.json"), "utf-8"));
        const fe = Object.values(gs.gates || {}).find((v: any) => v.status === "failed") as any;
        if (fe?.error) gateErrorMsg = fe.error;
      } catch { /* best effort */ }
      finalError = gateErrorMsg ? `${step.failMsg}: ${gateErrorMsg}` : step.failMsg;
      broadcast({ type: "compile:completed", featureSlug: slug, passed: false, errors: 1, errorMessage: gateErrorMsg } as any);
      broadcast({ type: "pipeline:stopped", slug, phase: step.phase, reason: step.failMsg } as any);
      await broadcastState(root, slug);
      return;
    }
  }
  } catch (err: any) {
    finalStatus = "failed";
    finalError = err?.message || String(err);
    throw err;
  } finally {
    releasePipelineLock(slug, root, {
      pipelineStatus: finalStatus || "completed",
      lastError: finalError,
    });
  }
}

// ── Auto-fix: parse gate failure, identify responsible tasks, re-dispatch with context ──

// Gates that are infrastructure-level and not fixable by re-running agent tasks
const INFRA_GATES = new Set(["1", "2", "12"]); // doctor, context_lock, memory

// Gate-type → fallback task group when no specific task can be identified
const GATE_FALLBACK_GROUP: Record<string, string[]> = {
  "3":  ["core", "ui", "setup"],       // plan_tasks — could be any group
  "4":  ["core", "ui"],                 // no_todos — code quality
  "5":  ["ui"],                         // ui_functional — dead handlers
  "6":  ["ui", "polish"],               // design_compliance — visual issues
  "7":  ["ui"],                         // brand_compliance — brand assets
  "8":  ["polish", "core"],             // smoke_test — test failures
  "9":  ["ui"],                         // vision — visual verification
  "10": ["core", "docs"],               // contracts — contract validation
  "11": ["setup", "core", "ui", "integration", "polish"],  // preview — build errors affect all groups
  "13": ["core"],                       // spec_consistency — spec drift
  "14": ["core", "ui"],                 // drift_check — code drift
};

/**
 * Extract file paths mentioned in gate error text.
 * Handles formats: "src/Foo.tsx:42: message", "missing: src/Foo.tsx", bare paths.
 */
function extractFilePaths(errorText: string): string[] {
  const paths = new Set<string>();

  // Pattern 1a: path:line (e.g. "src/components/Foo.tsx:42: message")
  for (const m of errorText.matchAll(/(\S+\.(?:tsx?|jsx?|mjs|cjs|css|json|md)):(\d+)/g)) {
    paths.add(m[1]);
  }

  // Pattern 1b: TypeScript errors — path(line,col): (e.g. "src/Foo.tsx(219,15): error")
  for (const m of errorText.matchAll(/(\S+\.(?:tsx?|jsx?|mjs|cjs|css|json))\(\d+,\d+\):/g)) {
    paths.add(m[1]);
  }

  // Pattern 2: "missing: path" from Gate 3 (includes .md for contract files)
  for (const m of errorText.matchAll(/missing:\s+(\S+\.(?:tsx?|jsx?|mjs|cjs|css|json|md))/gi)) {
    paths.add(m[1]);
  }

  // Pattern 2b: "ERROR path.md contains TODO markers" (contracts gate)
  for (const m of errorText.matchAll(/ERROR\s+(\S+\.md)\s+contains/g)) {
    paths.add(m[1]);
  }

  // Pattern 2c: bare "path.md contains" without ERROR prefix
  for (const m of errorText.matchAll(/(\S+\.md)\s+contains\s+TODO/g)) {
    paths.add(m[1]);
  }

  // Pattern 3: test file paths (e.g. "tests/smoke/slug.test.ts: error")
  for (const m of errorText.matchAll(/(tests\/\S+\.(?:test|spec)\.(?:ts|tsx|js|mjs)):/g)) {
    paths.add(m[1]);
  }

  // Pattern 4: single-quoted file paths (e.g. "'next.config.ts'", "'src/Foo.tsx'")
  for (const m of errorText.matchAll(/'([\w./\-]+\.(?:tsx?|jsx?|mjs|cjs|css|json|md))'/g)) {
    paths.add(m[1]);
  }

  // Pattern 5: double-quoted file paths (e.g. "\"next.config.ts\"")
  for (const m of errorText.matchAll(/"([\w./\-]+\.(?:tsx?|jsx?|mjs|cjs|css|json|md))"/g)) {
    paths.add(m[1]);
  }

  // Pattern 6: Next.js "Import trace" — relative paths like "./auth.ts" or "./app/api/route.ts"
  // Works even when the error text has no line breaks (single-line JSON storage)
  for (const m of errorText.matchAll(/\.\/([\w./\[\]\-]+\.(?:tsx?|jsx?|mjs|cjs))/g)) {
    paths.add(m[1]);
  }

  return [...paths];
}

/**
 * Map file paths to the Plan.json tasks responsible for them via `touches`.
 * A task matches if any of its `touches` entries is a substring of (or matches) the file path.
 */
function mapPathsToTasks(filePaths: string[], tasks: PlanTask[]): PlanTask[] {
  const matched = new Set<string>();

  for (const fp of filePaths) {
    for (const task of tasks) {
      if (!task.touches?.length) continue;
      for (const touch of task.touches) {
        // Match if the touch path is contained in the error path or vice versa
        if (fp.includes(touch) || touch.includes(fp) || fp.endsWith(touch)) {
          matched.add(task.id);
        }
      }
    }
  }

  return tasks.filter((t) => matched.has(t.id));
}

/**
 * Build a fix note for a specific task — includes only the error lines relevant
 * to that task's files, plus the gate name for context.
 */
// Gates where the FULL error must be included (build errors are cross-file; contracts need full file list)
const FULL_ERROR_GATES = new Set(["8", "10", "11"]);

/**
 * Detect common error patterns and generate specific fix instructions.
 * This gives agents concrete guidance instead of just raw error text.
 */
function detectFixInstructions(errorText: string, task: PlanTask): string[] {
  const instructions: string[] = [];

  // Contract/docs TODO markers — gate 10 (contracts_validation)
  if (/contains TODO markers|Missing:.*\.md/i.test(errorText)) {
    instructions.push(
      'CRITICAL: Contract and architecture markdown files contain TODO placeholders. You must replace every <!-- TODO: ... --> comment with real, specific content based on the actual project code.',
      'For API_Contracts.md: document each API endpoint (method, path, request body, response shape, error codes) based on the actual route handlers in the codebase.',
      'For Navigation_Contract.md: document all routes, their purpose, access rules (public/protected), and breadcrumb structure based on the actual app/ directory.',
      'For Design_System_Contract.md (create if missing): document the design tokens (colors, typography, spacing), core UI components, and usage patterns.',
      'For Patterns.md: document naming conventions, file organization, error handling patterns, and testing patterns actually used in the codebase.',
      'DO NOT leave any <!-- TODO --> comments. Replace every one with concrete, accurate content.',
    );
  }

  // Missing npm packages (e.g. "@auth/prisma-adapter", "nodemailer", "zod")
  // Distinguished from path alias errors (@/) by checking module name format
  const missingPackages = [
    ...[...errorText.matchAll(/Can't resolve ['"]([^'"./][^'"]*)['"]/g)].map((m) => m[1]),
    ...[...errorText.matchAll(/Cannot find module ['"]([^'"./][^'"]*)['"]/g)].map((m) => m[1]),
    ...[...errorText.matchAll(/Module not found:.*['"]([^'"./][^'"]*)['"]/g)].map((m) => m[1]),
  ].filter((p) => p && !p.startsWith("@/") && p !== "node:fs" && p !== "node:path" && p !== "node:crypto");
  const uniquePackages = [...new Set(missingPackages)];
  if (uniquePackages.length > 0) {
    instructions.push(
      `CRITICAL: Missing npm packages causing build failure: ${uniquePackages.join(", ")}`,
      `Fix strategy — choose ONE of:`,
      `  OPTION A (preferred if the feature is needed): Add the missing package(s) to package.json "dependencies" with an appropriate version, e.g. "${uniquePackages[0]}": "latest". Do NOT change existing dependency versions.`,
      `  OPTION B (if the feature is not needed or blocks build): Remove the import from the source file that requires it and replace the usage with a simpler alternative (e.g. use JWT/database sessions instead of prisma adapter, use fetch instead of nodemailer, etc.).`,
      `Look at the Import trace in the error — those are the source files importing the missing package. Fix the FIRST file in the trace (closest to the root of the import chain).`,
    );
  }

  // Path alias errors: "@/..." → tsconfig/vite alias misconfiguration (only when NOT a missing package)
  if (uniquePackages.length === 0 && (/Cannot find module ['"]@\//.test(errorText) || /Cannot find module ['"]@[a-z]/.test(errorText))) {
    if (task.group === "setup") {
      instructions.push(
        'CRITICAL: Add path aliases to tsconfig.json compilerOptions: "baseUrl": ".", "paths": { "@/*": ["src/*"] }',
        'Also add resolve.alias to vite.config.ts: resolve: { alias: { "@": path.resolve(__dirname, "src") } }',
      );
    } else {
      instructions.push(
        'Path aliases like @/ are not configured. Use relative imports (e.g., "../stores/todoStore") instead of "@/stores/todoStore".',
      );
    }
  }

  // Implicit any types
  if (/implicitly has an 'any' type/.test(errorText)) {
    instructions.push(
      'TypeScript strict mode is ON. Add explicit type annotations to ALL function parameters and variables. Never use implicit any.',
    );
  }

  // Unused variables/imports
  if (/is declared but its value is never read/.test(errorText)) {
    instructions.push(
      'Remove unused imports and variables. Do not import React if using react-jsx transform. Remove unused function parameters or prefix with underscore (_).',
    );
  }

  // Missing exports
  if (/has no exported member/.test(errorText)) {
    instructions.push(
      'Exported types are missing. Check that all types referenced by imports are actually exported from the source module.',
    );
  }

  // Missing packages
  if (/Cannot find module ['"][a-z]/.test(errorText) && !/Cannot find module ['"]@\//.test(errorText)) {
    if (task.group === "setup") {
      instructions.push('Install missing npm packages: check error messages for package names and run pnpm add <package>.');
    }
  }

  // TS7015: Element implicitly has 'any' type because index expression is not of type 'number'
  // This happens when using a string to index an object that's typed as Record<EnumType, ...>
  if (/Element implicitly has an 'any' type because index expression/.test(errorText)) {
    instructions.push(
      'TS7015 errors: When indexing a Record<Category, T> with a string variable, cast the key: `record[key as Category]`. ' +
      'Or use type-safe iteration: `(Object.keys(obj) as Category[]).map(...)`. ' +
      'Never index a typed record with an untyped string variable.',
    );
  }

  // Next.js config file format error
  if (/next\.config\.ts.*not supported|Configuring Next\.js via.*next\.config\.ts/i.test(errorText)) {
    instructions.push(
      'CRITICAL: Next.js 14 does not support next.config.ts. You must rename it to next.config.mjs (or next.config.js).',
      'Steps: (1) Read next.config.ts. (2) Create next.config.mjs with equivalent content using ESM syntax (export default instead of module.exports). (3) Delete next.config.ts.',
      'In next.config.mjs use: /** @type {import("next").NextConfig} */ const nextConfig = { ... }; export default nextConfig;',
    );
  }

  // Missing exports from a module (TS2305)
  if (/has no exported member/.test(errorText)) {
    // Extract the specific missing members
    const missing = [...new Set(
      [...errorText.matchAll(/has no exported member ['"](\w+)['"]/g)].map(m => m[1])
    )];
    if (missing.length > 0) {
      instructions.push(
        `Missing exports: ${missing.join(', ')}. Either: (1) export these from the source module, ` +
        `or (2) if they don't exist, create them, or (3) if the import is wrong, fix the import to use the correct name.`,
      );
    }
  }

  return instructions;
}

function buildTaskFixNote(
  task: PlanTask,
  gateName: string,
  gateNum: string,
  errorText: string,
): string {
  // For build/preview and smoke gates, always include the full error.
  // Build errors are often cross-file — agents need full context to fix type mismatches.
  if (FULL_ERROR_GATES.has(gateNum)) {
    const fixInstructions = detectFixInstructions(errorText, task);
    const instructionBlock = fixInstructions.length > 0
      ? `\n\nSPECIFIC FIX INSTRUCTIONS:\n${fixInstructions.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}\n\n`
      : "\n";
    const header = `Gate ${gateNum} (${gateName}) FAILED. Your task touches: ${(task.touches || []).join(", ")}.\nFix ALL errors in your files.${instructionBlock}FULL build output:\n`;
    return header + errorText.slice(0, 2500);
  }

  const lines = errorText.split("\n");

  // Lines that mention the task ID or title
  const taskLines = lines.filter((l) =>
    l.includes(task.id) || (task.title && l.includes(task.title))
  );

  // Lines that mention any of the task's touched files
  const touchLines: string[] = [];
  if (task.touches?.length) {
    for (const line of lines) {
      for (const touch of task.touches) {
        if (line.includes(touch)) {
          touchLines.push(line);
          break;
        }
      }
    }
  }

  const relevantLines = [...new Set([...taskLines, ...touchLines])];
  const note = relevantLines.length > 0 ? relevantLines.join("\n") : errorText;

  return `Gate ${gateNum} (${gateName}) FAILED.\n${note}`;
}

export async function autoFixGateFailure(
  root: string,
  slug: string,
  phase: string,
  think: (text: string) => void,
  escalationCycle: number = 0,
): Promise<boolean> {
  const MAX_FIX_ATTEMPTS = 3;
  const planPath = join(root, "docs/vault/04_Features", slug, "Plan.json");
  const gateStatePath = resolveRuntimePath(root, "GATE_STATE.json");

  // Read the initial gate failure ONCE — before any attempts delete the checkpoint
  let initialGateState: any = {};
  try { initialGateState = JSON.parse(readFileSync(gateStatePath, "utf-8")); } catch { return false; }

  let failedGateEntry = Object.entries(initialGateState.gates || {})
    .find(([, v]: [string, any]) => v.status === "failed") as [string, any] | undefined;

  // If no explicitly failed gate but process exited non-zero, find the first missing gate
  // (e.g. gate 11 crashed/hung before writing its result → gates 1-10 exist, 11+ missing)
  if (!failedGateEntry) {
    const TOTAL_GATES = 14;
    const existingGates = Object.keys(initialGateState.gates || {}).map(Number);
    if (existingGates.length > 0 && existingGates.length < TOTAL_GATES) {
      const maxGate = Math.max(...existingGates);
      const missingGateNum = String(maxGate + 1);
      // Treat the missing gate as failed with a generic error
      failedGateEntry = [missingGateNum, {
        status: "failed",
        error: `Gate ${missingGateNum} did not complete (process may have crashed or timed out)`,
      }];
    }
  }

  if (!failedGateEntry) return false;
  const [failedGateNum, gateData] = failedGateEntry;
  const gateName: string = gateData.name || `gate_${failedGateNum}`;
  const errorText: string = gateData.error || "";

  if (!errorText) return false;

  // Infrastructure gates can't be fixed by re-running tasks
  if (INFRA_GATES.has(failedGateNum)) {
    think(`Gate ${failedGateNum} (${gateName}) is infrastructure-level — cannot auto-fix`);
    return false;
  }

  // ── Gate 10 special case: contracts gate — TODO markers or missing files in vault docs ──
  // Re-running code tasks doesn't help here. Instead dispatch a synthetic "docs" task that
  // ONLY writes the failing markdown contract files with real content from the codebase.
  if (failedGateNum === "10" && /TODO markers|Missing:.*\.md/i.test(errorText)) {
    const contractFilePaths = extractFilePaths(errorText);
    if (contractFilePaths.length > 0) {
      think(`Gate 10 (contracts) — ${contractFilePaths.length} contract/architecture file(s) need real content`);
      think(`Gate error: ${errorText.replace(/\x1b\[[0-9;]*m/g, "").trim().slice(0, 400)}`);

      // Broadcast which agent is fixing
      broadcast({ type: "agent:fixing", slug, agentNames: ["developer"], taskTitles: ["Write contract documentation"] } as any);

      const syntheticTask: PlanTask = {
        id: "T_contracts",
        title: "Write contract and architecture documentation",
        group: "core",
        touches: contractFilePaths,
        description: "Fill in contract and architecture markdown files with real content from the codebase.",
      } as any;

      const contractFixNote = [
        `Gate 10 (contracts_validation) FAILED. These documentation files have TODO placeholders that must be replaced with real content:`,
        contractFilePaths.map((p) => `  - ${p}`).join("\n"),
        ``,
        `INSTRUCTIONS:`,
        `1. Read the actual codebase (app/, components/, lib/, middleware.ts, auth.ts) to understand the project.`,
        `2. For each file listed above, write complete, accurate documentation based on what actually exists.`,
        `3. API_Contracts.md → document every API route (method, path, request body schema, response shape, error codes).`,
        `4. Navigation_Contract.md → document all pages/routes (path, purpose, public/protected, breadcrumb).`,
        `5. Design_System_Contract.md → document design tokens, color system, core UI components and their props.`,
        `6. Patterns.md → document naming conventions, file organization, error handling, testing patterns actually used.`,
        `7. DO NOT leave any <!-- TODO --> comments. Every section must have real content.`,
        `8. Create missing files (e.g. Design_System_Contract.md) if listed.`,
        ``,
        `Full error output:`,
        errorText.slice(0, 1500),
      ].join("\n");

      for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
        const tierOverride = attempt >= 2 ? "standard" : undefined;
        if (attempt === 2) think(`Escalating developer to sonnet model for attempt ${attempt}`);
        think(`Fix attempt ${attempt}/${MAX_FIX_ATTEMPTS}${tierOverride ? " (sonnet)" : ""} — writing contract docs`);

        // Reset gate checkpoint
        try {
          const gs = JSON.parse(readFileSync(gateStatePath, "utf-8"));
          delete gs.gates[failedGateNum];
          for (const k of Object.keys(gs.gates)) {
            if (parseInt(k) > parseInt(failedGateNum)) delete gs.gates[k];
          }
          writeFileSync(gateStatePath, JSON.stringify(gs, null, 2) + "\n", "utf-8");
        } catch { /* best effort */ }

        const result = await executeTask(root, slug, syntheticTask, contractFixNote, tierOverride, contractFilePaths);
        if (result.success) {
          think(`Contract files written successfully — re-running gates`);
          return true;
        }
        if (result.error) {
          think(`Contract fix attempt ${attempt} failed: ${result.error.replace(/\x1b\[[0-9;]*m/g, "").trim().slice(0, 200)}`);
        }
      }

      think(`Could not auto-write contract files after ${MAX_FIX_ATTEMPTS} attempts — manual update required`);
      return false;
    }
  }

  // Load plan
  let plan: Plan;
  try { plan = JSON.parse(readFileSync(planPath, "utf-8")); } catch { return false; }

  // ── Strategy 1: Direct task IDs in error text (e.g. "Task T4: ...")
  const directTaskIds = [...new Set(
    [...errorText.matchAll(/Task\s+(T\d+)/g)].map((m) => m[1])
  )];

  // ── Strategy 2: File paths in error → map to tasks via touches
  const errorFilePaths = extractFilePaths(errorText);
  const pathMappedTasks = mapPathsToTasks(errorFilePaths, plan.tasks);

  // ── Strategy 2b: Dependency errors → also include setup task
  // Patterns: "Cannot find package/module", "ERR_MODULE_NOT_FOUND", "Failed to resolve import"
  const isDependencyError = /Cannot find (?:package|module)|ERR_MODULE_NOT_FOUND|Module not found|Failed to resolve import|Cannot resolve module/i.test(errorText);
  const setupTask = isDependencyError
    ? plan.tasks.find((t) => t.group === "setup")
    : null;

  // ── Strategy 3: Gate-type fallback → pick tasks from the relevant group
  const fallbackGroups = GATE_FALLBACK_GROUP[failedGateNum] || [];
  const fallbackTasks = plan.tasks.filter((t) => fallbackGroups.includes(t.group));

  // Merge all strategies (deduplicate by task ID)
  const taskIdSet = new Set<string>();
  const tasksToFix: PlanTask[] = [];

  // Priority 0: setup task for dependency errors (runs first so deps are installed before other tasks)
  if (setupTask && !taskIdSet.has(setupTask.id)) {
    taskIdSet.add(setupTask.id);
    tasksToFix.push(setupTask);
  }

  // Priority 1: directly mentioned tasks
  for (const id of directTaskIds) {
    const task = plan.tasks.find((t) => t.id === id);
    if (task && !taskIdSet.has(task.id)) {
      taskIdSet.add(task.id);
      tasksToFix.push(task);
    }
  }

  // Priority 2: tasks mapped via file paths
  for (const task of pathMappedTasks) {
    if (!taskIdSet.has(task.id)) {
      taskIdSet.add(task.id);
      tasksToFix.push(task);
    }
  }

  // Priority 3: fallback — only if strategies 1 and 2 found nothing
  if (tasksToFix.length === 0) {
    for (const task of fallbackTasks) {
      if (!taskIdSet.has(task.id)) {
        taskIdSet.add(task.id);
        tasksToFix.push(task);
      }
    }
  }

  if (tasksToFix.length === 0) {
    think(`Gate ${failedGateNum} (${gateName}) failed but no responsible tasks found`);
    return false;
  }

  think(`Gate ${failedGateNum} (${gateName}) failed — identified ${tasksToFix.length} task(s) to fix: ${tasksToFix.map((t) => `${t.id} (${t.group})`).join(", ")}`);

  // Surface the actual gate error so it's visible in activity
  if (errorText) {
    const shortErr = errorText.replace(/\x1b\[[0-9;]*m/g, "").trim().slice(0, 400);
    think(`Gate error: ${shortErr}`);
  }

  // Broadcast which agents are fixing so the canvas can highlight them
  const fixingAgentNames = [...new Set(tasksToFix.map((t: any) => t.owner_agent_name).filter(Boolean))] as string[];
  if (fixingAgentNames.length > 0) {
    broadcast({ type: "agent:fixing", slug, agentNames: fixingAgentNames, taskTitles: tasksToFix.map((t) => t.title || t.id) } as any);
  }

  for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
    // Model escalation per attempt:
    //   Attempt 1: use task's default model (usually haiku/fast)
    //   Attempt 2+: force sonnet/standard — haiku can't handle complex TS fixes or hits token limits
    const tierOverride = attempt >= 2 ? "standard" : undefined;
    if (tierOverride && attempt === 2) {
      const agentNames = [...new Set(tasksToFix.map((t: any) => t.owner_agent_name).filter(Boolean))].join(", ");
      think(`Escalating ${agentNames || "agent"} to sonnet model for attempt ${attempt}`);
    }

    think(`Fix attempt ${attempt}/${MAX_FIX_ATTEMPTS}${tierOverride ? " (sonnet)" : ""} — re-running ${tasksToFix.length} task(s)`);

    // Delete output files for failing tasks so agent-executor re-runs them
    const runnersDir = getRunnersDir(root);
    for (const task of tasksToFix) {
      const outPath = join(runnersDir, `${task.id}.output.json`);
      try {
        if (existsSync(outPath)) {
          const { unlinkSync } = await import("fs");
          unlinkSync(outPath);
        }
      } catch { /* best effort */ }
    }

    // Reset the failed gate checkpoint so it re-runs
    try {
      const gs = JSON.parse(readFileSync(gateStatePath, "utf-8"));
      delete gs.gates[failedGateNum];
      for (const k of Object.keys(gs.gates)) {
        if (parseInt(k) > parseInt(failedGateNum)) delete gs.gates[k];
      }
      writeFileSync(gateStatePath, JSON.stringify(gs, null, 2) + "\n", "utf-8");
    } catch { /* best effort */ }

    // Re-run failing tasks with gate-specific fix notes (with model escalation)
    // Pass ALL error file paths as extra touches so agents can fix files beyond their original scope
    const fixResults = await Promise.all(
      tasksToFix.map((task) =>
        executeTask(root, slug, task, buildTaskFixNote(task, gateName, failedGateNum, errorText), tierOverride, errorFilePaths)
      )
    );

    const allFixed = fixResults.every((r) => r.success);
    if (allFixed) {
      think(`All ${tasksToFix.length} task(s) re-run successfully — re-running gates`);
      return true;
    }

    const failedResults = fixResults.filter((r) => !r.success);
    think(`Fix attempt ${attempt} — ${failedResults.length} task(s) still failing`);
    for (const fr of failedResults) {
      if (fr.error) {
        const shortErr = fr.error.replace(/\x1b\[[0-9;]*m/g, "").trim().slice(0, 400);
        think(`Task ${fr.taskId} error: ${shortErr}`);
      }
    }
  }

  think(`Auto-fix exhausted after ${MAX_FIX_ATTEMPTS} attempts`);
  return false;
}

// ── Run a single pipeline step, returns success bool ──

async function runPipelineStep(
  root: string,
  slug: string,
  step: typeof PIPELINE_PHASES[number],
  think: (text: string) => void,
): Promise<boolean> {
  const cli = getCliPath();
  // Signal client to clear previous gate results before new run
  broadcast({ type: "compile:started", featureSlug: slug, phase: step.phase, next: step.next } as any);
  return new Promise<boolean>((resolve) => {
    const args = step.args!(slug);
    const child = spawn("node", [cli, ...args], {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const text of lines) {
        const gateMatch = text.match(/\[\s*(\d+)\]\s+([\w_]+)\s+(PASS|FAIL|SKIP)/i);
        if (gateMatch) {
          const gateName = gateMatch[2].trim();
          const passed = gateMatch[3].toUpperCase() !== "FAIL";
          think(`Gate: ${gateName} — ${passed ? "passed" : "FAILED"}`);
          broadcast({ type: "compile:gate", gate: gateName, featureSlug: slug, passed } as any);
        }
      }
    });
    child.stderr.on("data", () => {});

    const timer = setTimeout(() => { child.kill("SIGTERM"); }, 10 * 60 * 1000);
    child.on("close", (code) => { clearTimeout(timer); resolve(code === 0); });
    child.on("error", () => { clearTimeout(timer); resolve(false); });
  });
}
