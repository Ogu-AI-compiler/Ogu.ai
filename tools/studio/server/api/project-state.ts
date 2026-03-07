/**
 * Project State API — single state resolver for the ProjectScreen.
 *
 * GET  /project/:slug/state      → returns UIState
 * POST /project/:slug/transition  → calls transitionFeature(), broadcasts via WS
 */

import { Hono } from "hono";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import { getPendingProposal } from "./manifest.js";
import { isPipelineActive, acquirePipelineLock, releasePipelineLock, retryFailedTasks, abortPipeline, pausePipeline, resumePipeline, isPipelinePaused } from "./dispatch.js";
import { readProjectRegistry } from "./router.js";
import { getAgentsDir, getMarketplaceDir, getProjectsDir, getRunnersDir, getStateDir, resolveOguPath, resolveRuntimePath } from "../../../ogu/commands/lib/runtime-paths.mjs";
import { hasTaskGateEvidence } from "../../../ogu/commands/lib/task-gate-evidence.mjs";
import { createTTLStore } from "../../../ogu/commands/lib/ttl-store.mjs";

function getCliPath(): string {
  return resolve(import.meta.dirname || __dirname, "..", "..", "..", "ogu", "cli.mjs");
}

function getRoot(): string {
  return process.env.OGU_ROOT || process.cwd();
}

function readJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

const fileCache = createTTLStore();
const FILE_CACHE_TTL_MS = Math.max(100, parseInt(process.env.OGU_FILE_CACHE_TTL_MS || "500", 10));

function readJsonCached(path: string): any {
  const cached = fileCache.get(path);
  if (cached !== undefined) return cached;
  const value = readJson(path);
  fileCache.set(path, value, { ttlMs: FILE_CACHE_TTL_MS });
  return value;
}

// ── UIState shape ──

export interface UIConfig {
  screens: Array<{ id: string; label: string; reason: string }>;
  dashboard: {
    widgets: Array<{ type: string; label: string; size: "full" | "half" }>;
    primary_cta: { label: string; command: string; type: string };
    quick_actions: Array<{ label: string; command: string; args?: string[] }>;
  };
}

export interface UIState {
  slug: string;
  phase: string;
  viewType: "decisions" | "architecture" | "pipeline" | "summary";
  progress: { currentStep: number; totalSteps: number; percentage: number };
  requiredDecisions: string[];
  primaryAction: { label: string; command: string; type: string };
  uiConfig: UIConfig | null;
  meta: {
    projectName: string;
    mode: string;
    archetype: string;
    confidence: number;
    createdAt: string;
  };
  tasks: Array<{ id: string; title: string; group: string; model: string; done: boolean; dependsOn?: string[]; agent?: { name: string; emoji: string; avatar?: Record<string, string> } }>;
  team: any | null;
  pendingProposal: any | null;
  canContinue: boolean;
  nextPhase: string | null;
  pipelineActive: boolean;
}

// ── Default agent mapping by task group ──

const DEFAULT_AGENTS: Record<string, { name: string; emoji: string }> = {
  setup: { name: "Ops", emoji: "\uD83D\uDD27" },
  core: { name: "Dev", emoji: "\uD83D\uDCBB" },
  ui: { name: "Design", emoji: "\uD83C\uDFA8" },
  integration: { name: "Integration", emoji: "\uD83D\uDD0C" },
  polish: { name: "QA", emoji: "\u2728" },
};

// ── Phase → viewType mapping ──

function resolveViewType(phase: string, requiredDecisions: string[]): UIState["viewType"] {
  if ((phase === "discovery" || phase === "feature") && requiredDecisions.length > 0) {
    return "decisions";
  }
  if (phase === "feature" || phase === "architect" || phase === "design") {
    return "architecture";
  }
  if (["building", "verifying", "enforcing", "preflight", "lock", "previewing"].includes(phase)) {
    return "pipeline";
  }
  if (phase === "done" || phase === "observing") {
    return "summary";
  }
  return "architecture";
}

// ── Primary CTA per phase ──

function resolvePrimaryCTA(phase: string): UIState["primaryAction"] {
  switch (phase) {
    case "discovery":
      return { label: "Define Feature", command: "/feature", type: "navigate" };
    case "feature":
      return { label: "Begin Architecture", command: "/architect", type: "navigate" };
    case "architect":
      return { label: "Review Architecture", command: "/architect", type: "navigate" };
    case "design":
      return { label: "Review Design", command: "/design", type: "navigate" };
    case "preflight":
      return { label: "Run Preflight", command: "/preflight", type: "command" };
    case "lock":
      return { label: "Lock Context", command: "/lock", type: "command" };
    case "building":
      return { label: "Continue Build", command: "/build", type: "command" };
    case "verifying":
      return { label: "Run Verification", command: "/verify-ui", type: "command" };
    case "enforcing":
      return { label: "Enforce Contracts", command: "/enforce", type: "command" };
    case "previewing":
      return { label: "Preview", command: "/preview", type: "command" };
    case "done":
      return { label: "View Summary", command: "/done", type: "navigate" };
    case "observing":
      return { label: "Observe", command: "/observe", type: "navigate" };
    default:
      return { label: "Continue", command: "/chat", type: "navigate" };
  }
}

// ── Core resolver ──

export function resolveUIState(root: string, slug: string): UIState | null {
  const featureDir = join(root, "docs/vault/04_Features", slug);
  const fsmStatePath = resolveRuntimePath(root, "state", "features", `${slug}.state.json`);
  const runnersDir = getRunnersDir(root);

  // Check existence via: feature vault dir | FSM state file | runner files for this slug
  const hasRunnerForSlug = (() => {
    if (!existsSync(runnersDir)) return false;
    try {
      return readdirSync(runnersDir).some((f) => {
        if (!f.endsWith(".input.json")) return false;
        const d = readJson(join(runnersDir, f));
        return d?.featureSlug === slug;
      });
    } catch { return false; }
  })();

  if (!existsSync(featureDir) && !existsSync(fsmStatePath) && !hasRunnerForSlug) return null;

  // Read FSM state (fall back to file-based detection)
  const fsmState = readJsonCached(fsmStatePath);
  const phase: string = fsmState?.currentPhase || "discovery";

  // Read project metadata
  const meta = readJsonCached(join(featureDir, "project.meta.json"));

  const isTaskDone = (taskId: string) => hasTaskGateEvidence(root, taskId);

  // Read Plan.json for tasks — try feature dir first, then fallback to runner files
  let plan = readJsonCached(join(featureDir, "Plan.json"));
  if (!plan?.tasks || plan.tasks.length === 0) {
    // Fallback: build task list from .ogu/runners/ (wizard-created projects)
    if (existsSync(runnersDir)) {
      try {
        const inputFiles = readdirSync(runnersDir)
          .filter((f) => f.endsWith(".input.json"))
          .sort((a, b) => {
            const na = parseInt(a.replace(/\D/g, ""), 10);
            const nb = parseInt(b.replace(/\D/g, ""), 10);
            return na - nb;
          });
        if (inputFiles.length > 0) {
          // Map agent roleId to UI group
          const ROLE_TO_GROUP: Record<string, string> = {
            devops: "setup", ops: "setup",
            "backend-dev": "core", backend: "core", dev: "core",
            "frontend-dev": "ui", frontend: "ui", design: "ui",
            integration: "integration", link: "integration",
            qa: "polish", test: "polish", quality: "polish",
          };
          const tasks = inputFiles.map((f) => {
            const data = readJsonCached(join(runnersDir, f));
            const outputFile = f.replace(".input.json", ".output.json");
            const hasOutput = existsSync(join(runnersDir, outputFile));
            const roleId = data?.agent?.roleId || "";
            const group = data?.group || ROLE_TO_GROUP[roleId] || "core";
            const modelStr = data?.routingDecision?.model || "";
            const taskId = data?.taskId || f.replace(".input.json", "");
            return {
              id: taskId,
              title: data?.taskName || data?.taskId || "Unknown",
              group,
              model: modelStr.includes("haiku") ? "haiku" : modelStr.includes("opus") ? "opus" : "sonnet",
              depends_on: data?.dependsOn || [],
              done: hasOutput && isTaskDone(taskId),
            };
          });
          plan = { tasks };
        }
      } catch { /* fallback failed, proceed with empty */ }
    }
  }
  // Read team.json for real agent names (from CTO pipeline)
  let teamJson = readJsonCached(resolveRuntimePath(root, "projects", slug, "team.json"));
  if (teamJson && !teamJson.blueprint) {
    // Attach blueprint from CTO plan if not already present
    const ctoPlan = readJsonCached(resolveRuntimePath(root, "projects", slug, "cto-plan.json"));
    if (ctoPlan?.teamBlueprint) {
      teamJson = { ...teamJson, blueprint: ctoPlan.teamBlueprint, complexity: { score: ctoPlan.complexityScore || 0, tier: ctoPlan.complexityTier || teamJson.complexity_tier || "medium" } };
    }
  }
  if (teamJson) {
    const approved = teamJson.approved === true || !!teamJson.approved_at;
    teamJson = { ...teamJson, approved, approved_at: teamJson.approved_at || null };
  }
  const teamMembers: any[] = teamJson?.members || [];

  // Build group→agent lookup from team.json (role_id → group mapping)
  // Uses keyword matching so "integration_engineer" matches "integration"
  const GROUP_KEYWORDS: Array<[string, string[]]> = [
    ["setup", ["devops", "ops", "infrastructure", "deploy"]],
    ["core", ["backend", "engineer", "developer", "architect"]],
    ["ui", ["frontend", "designer", "ui"]],
    ["integration", ["integration", "link", "api"]],
    ["polish", ["qa", "quality", "tester", "test", "security"]],
  ];
  function roleToGroup(roleId: string): string {
    const r = roleId.toLowerCase();
    // Product manager → separate, maps to core
    if (r.includes("product") || r === "pm") return "core";
    // Integration must be checked before "engineer" (integration_engineer)
    if (r.includes("integration")) return "integration";
    for (const [group, keywords] of GROUP_KEYWORDS) {
      if (keywords.some((k) => r.includes(k))) return group;
    }
    return r;
  }
  // Load avatar configs from agent profiles
  const agentsDir = join(getMarketplaceDir(process.env.OGU_ROOT || root), "agents");
  function loadAgentAvatar(agentId: string): Record<string, string> | undefined {
    if (!agentId) return undefined;
    try {
      const p = join(agentsDir, `${agentId}.json`);
      if (!existsSync(p)) return undefined;
      const a = JSON.parse(readFileSync(p, "utf-8"));
      return a.avatar || undefined;
    } catch { return undefined; }
  }

  const teamAgentByRole: Record<string, { name: string; emoji: string; avatar?: Record<string, string> }> = {};
  for (const m of teamMembers) {
    const role = m.role_id || m.roleId || "";
    const group = roleToGroup(role);
    if (group && !teamAgentByRole[group]) {
      teamAgentByRole[group] = {
        name: m.agent_name || m.role_display || role,
        emoji: DEFAULT_AGENTS[group]?.emoji || "\uD83E\uDD16",
        avatar: loadAgentAvatar(m.agent_id || m.agentId),
      };
    }
  }

  const tasks: UIState["tasks"] = (plan?.tasks || []).map((t: any) => {
    const group = t.group || "core";
    // A task is done only if it passed task gates (gate evidence or runner gate results)
    const runnerDone = isTaskDone(t.id);
    return {
      id: t.id || "",
      title: t.title || "",
      group,
      model: t.model || "sonnet",
      done: runnerDone,
      dependsOn: t.depends_on || t.dependsOn || [],
      agent: teamAgentByRole[group] || DEFAULT_AGENTS[group] || DEFAULT_AGENTS.core,
    };
  });

  const totalSteps = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;

  // Pipeline continuation — follows FSM order exactly
  const NEXT_PHASE: Record<string, string> = {
    architect: "design",
    design: "preflight",
    preflight: "lock",
    lock: "building",
    building: "verifying",
    verifying: "enforcing",
    enforcing: "previewing",
    previewing: "done",
  };
  const allTasksDone = totalSteps > 0 && doneCount >= totalSteps;
  const pipelineActive = isPipelineActive(slug, root);
  const canContinue = allTasksDone && phase in NEXT_PHASE && !pipelineActive;
  const nextPhase = NEXT_PHASE[phase] || null;

  // Read UI_Manifest.json for decisions + uiConfig
  const manifest = readJson(join(featureDir, "UI_Manifest.json"));
  const requiredDecisions: string[] = manifest?.required_decisions || [];

  // Extract v2 uiConfig if available
  let uiConfig: UIConfig | null = null;
  if (manifest?.version === 2 && Array.isArray(manifest?.screens)) {
    uiConfig = {
      screens: manifest.screens,
      dashboard: manifest.dashboard || {
        widgets: [{ type: "progress", label: "Progress", size: "full" }, { type: "tasks", label: "Tasks", size: "half" }, { type: "activity", label: "Recent Activity", size: "full" }],
        primary_cta: { label: "Continue", command: "/architect", type: "navigate" },
        quick_actions: [],
      },
    };
  }

  // Resolve primary CTA — prefer v2 dashboard CTA, then v1 manifest string, then phase-based
  let primaryAction: UIState["primaryAction"];
  if (uiConfig?.dashboard?.primary_cta) {
    primaryAction = uiConfig.dashboard.primary_cta;
  } else if (manifest?.primary_cta && typeof manifest.primary_cta === "string") {
    primaryAction = { label: manifest.primary_cta, command: resolvePrimaryCTA(phase).command, type: resolvePrimaryCTA(phase).type };
  } else {
    primaryAction = resolvePrimaryCTA(phase);
  }

  // Check for pending manifest proposals (sync)
  const pendingProposal = getPendingProposal(root, slug);

  return {
    slug,
    phase,
    viewType: resolveViewType(phase, requiredDecisions),
    progress: {
      currentStep: doneCount,
      totalSteps,
      percentage: totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0,
    },
    requiredDecisions,
    primaryAction,
    uiConfig,
    meta: {
      projectName: meta?.slug || slug,
      mode: meta?.mode || "application",
      archetype: meta?.archetype_id || "",
      confidence: meta?.confidence ?? 0,
      createdAt: meta?.created_at || "",
    },
    tasks,
    team: teamJson ? {
      ...teamJson,
      members: (teamJson.members || []).map((m: any) => ({
        ...m,
        avatar: m.avatar || loadAgentAvatar(m.agent_id || m.agentId),
      })),
    } : null,
    pendingProposal,
    canContinue,
    nextPhase,
    pipelineActive,
  };
}

// ── Router ──

export function createProjectStateRouter() {
  const router = new Hono();

  router.get("/project/:slug/state", (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    const state = resolveUIState(root, slug);
    if (!state) return c.json({ error: "Feature not found" }, 404);
    return c.json(state);
  });

  router.post("/project/:slug/transition", async (c) => {
    const slug = c.req.param("slug");
    const { targetPhase, reason } = await c.req.json();
    const root = resolveProjectRoot(slug);

    if (!targetPhase) {
      return c.json({ error: "targetPhase is required" }, 400);
    }

    // Dynamic import of state-machine (same pattern as router.ts line 138)
    const { transitionFeature } = await import(
      /* @vite-ignore */ "../../../../tools/ogu/commands/lib/state-machine.mjs"
    );

    const result = transitionFeature(root, slug, targetPhase, {
      reason: reason || `Studio transition to ${targetPhase}`,
      actor: "studio",
    });

    if (!result.success) {
      return c.json({ error: result.reason }, 400);
    }

    // Broadcast state change via WebSocket
    const { broadcast } = await import("../ws/server.js");
    const uiState = resolveUIState(root, slug);
    broadcast({ type: "project:state_changed", slug, state: uiState } as any);

    return c.json({ ok: true, ...result, state: uiState });
  });

  // ── Continue pipeline (gates / compile) ──

  // Pre-build phases (architect→lock) are pass-through: transition immediately.
  // Build+ phases run actual CLI commands.
  const PHASE_COMMAND: Record<string, { args?: (slug: string) => string[]; next: string }> = {
    architect: { next: "design" },
    design: { next: "preflight" },
    preflight: { next: "lock" },
    lock: { next: "building" },
    building: { args: (s) => ["gates", "run", s], next: "verifying" },
    verifying: { args: (s) => ["gates", "run", s], next: "enforcing" },
    enforcing: { args: () => ["preview"], next: "previewing" },
    previewing: { args: (s) => ["compile", s], next: "done" },
  };

  // Descriptive messages for each pipeline phase
  const PHASE_MESSAGES: Record<string, { start: string; success: string; fail: string }> = {
    architect: {
      start: "Advancing to design phase...",
      success: "Architecture review complete",
      fail: "Architecture review encountered issues",
    },
    design: {
      start: "Running preflight checks...",
      success: "Design phase complete",
      fail: "Design phase encountered issues",
    },
    preflight: {
      start: "Locking project context...",
      success: "Preflight checks passed",
      fail: "Preflight checks failed",
    },
    lock: {
      start: "Context locked — preparing for build...",
      success: "Project context locked successfully",
      fail: "Context lock failed",
    },
    building: {
      start: "Running quality gates (14 checks)...",
      success: "All quality gates passed — advancing to verification",
      fail: "Some quality gates failed — review required",
    },
    verifying: {
      start: "Verifying UI components and interactions...",
      success: "Verification complete — all checks passed",
      fail: "Verification found issues that need attention",
    },
    enforcing: {
      start: "Enforcing contracts and starting preview...",
      success: "Contract enforcement passed — preview ready",
      fail: "Contract enforcement found violations",
    },
    previewing: {
      start: "Final compilation — running all 14 gates...",
      success: "Compilation successful — project is complete!",
      fail: "Compilation failed — check gate results",
    },
  };

  router.post("/project/:slug/continue", async (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    const state = resolveUIState(root, slug);
    if (!state) return c.json({ error: "Feature not found" }, 404);
    if (isPipelineActive(slug, root)) return c.json({ error: "Pipeline already running" }, 409);
    if (!state.canContinue) return c.json({ error: "Not ready to continue" }, 400);

    const entry = PHASE_COMMAND[state.phase];
    if (!entry) return c.json({ error: `No continuation for phase "${state.phase}"` }, 400);

    // Acquire pipeline lock BEFORE spawning anything
    if (!acquirePipelineLock(slug, `continue:${state.phase}`, root)) {
      return c.json({ error: "Pipeline already running" }, 409);
    }

    const { broadcast } = await import("../ws/server.js");
    const { transitionFeature } = await import(
      /* @vite-ignore */ "../../../../tools/ogu/commands/lib/state-machine.mjs"
    );

    const think = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);
    const msgs = PHASE_MESSAGES[state.phase];

    // Pass-through phases: transition immediately, no CLI
    if (!entry.args) {
      think(msgs?.start || `Advancing to ${entry.next}...`);
      transitionFeature(root, slug, entry.next, {
        reason: `Pipeline pass-through: ${state.phase} → ${entry.next}`,
        actor: "studio",
      });
      think(msgs?.success || `Phase ${entry.next} ready`);
      releasePipelineLock(slug, root, { pipelineStatus: "completed", pipelinePhase: entry.next });
      const updated = resolveUIState(root, slug);
      broadcast({ type: "project:state_changed", slug, state: updated } as any);
      return c.json({ ok: true, phase: entry.next });
    }

    // Broadcast compile:started (FSM stays at current phase until CLI succeeds)
    think(msgs?.start || `Running ${state.phase} phase...`);
    broadcast({ type: "compile:started", featureSlug: slug, phase: state.phase, next: entry.next } as any);

    // Spawn CLI
    const cliPath = getCliPath();
    const child = spawn("node", [cliPath, ...entry.args(slug)], {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let gateCount = 0;
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const text of lines) {
        // Format: "  [1] doctor           PASS" or "  [1] doctor           FAIL"
        const gateMatch = text.match(/\[\s*(\d+)\]\s+([\w_]+)\s+(PASS|FAIL|SKIP)/i);
        if (gateMatch) {
          gateCount++;
          const gateName = gateMatch[2].trim();
          const passed = gateMatch[3].toUpperCase() !== "FAIL";
          think(`Gate ${gateCount}/14: ${gateName} — ${passed ? "passed" : "FAILED"}`);
          broadcast({ type: "compile:gate", gate: gateName, featureSlug: slug, passed } as any);
        }
      }
    });

    child.on("close", async (code) => {
      let passed = code === 0;

      // Iterative auto-fix loop: fix gate → retry → if new gate fails → fix that → retry...
      // Each cycle may fix a DIFFERENT gate. Max cycles prevents infinite loops.
      const MAX_FIX_CYCLES = 8;
      if (!passed) {
        const { autoFixGateFailure } = await import("./dispatch.js");
        for (let cycle = 0; cycle < MAX_FIX_CYCLES; cycle++) {
          const fixed = await autoFixGateFailure(root, slug, state.phase, think, cycle);
          if (!fixed) break; // Can't fix this gate — stop

          think(`Gate fix applied — retrying ${msgs?.start || "quality gates"}...`);
          broadcast({ type: "compile:started", featureSlug: slug, phase: state.phase, next: entry.next } as any);

          passed = await new Promise<boolean>((res) => {
            const retry = spawn("node", [cliPath, ...entry.args!(slug)], {
              cwd: root,
              env: { ...process.env, OGU_ROOT: root },
              stdio: ["ignore", "pipe", "pipe"],
            });
            let retryBuf = "";
            retry.stdout.on("data", (chunk: Buffer) => {
              retryBuf += chunk.toString();
              const rlines = retryBuf.split("\n");
              retryBuf = rlines.pop() ?? "";
              for (const rtext of rlines) {
                const m = rtext.match(/\[\s*(\d+)\]\s+([\w_]+)\s+(PASS|FAIL|SKIP)/i);
                if (m) {
                  const gn = m[2].trim();
                  const gp = m[3].toUpperCase() !== "FAIL";
                  broadcast({ type: "compile:gate", gate: gn, featureSlug: slug, passed: gp } as any);
                }
              }
            });
            retry.stderr.on("data", () => {});
            const t = setTimeout(() => { retry.kill("SIGTERM"); }, 10 * 60 * 1000);
            retry.on("close", (rc) => { clearTimeout(t); res(rc === 0); });
            retry.on("error", () => { res(false); });
          });

          if (passed) break; // All gates passed — done
          // Loop continues → autoFixGateFailure will read the NEW failed gate
        }
      }

      // Only transition FSM if CLI succeeded
      if (passed) {
        transitionFeature(root, slug, entry.next, {
          reason: `Pipeline continue: ${state.phase} → ${entry.next}`,
          actor: "studio",
        });
        think(msgs?.success || `Phase ${entry.next} ready`);
      } else {
        think(msgs?.fail || `Phase ${state.phase} failed`);
      }

      // Release lock FIRST, then broadcast so client sees consistent pipelineActive=false
      releasePipelineLock(slug, root, {
        pipelineStatus: passed ? "completed" : "failed",
        pipelinePhase: state.phase,
        lastError: passed ? null : (msgs?.fail || "Phase failed"),
      });

      broadcast({
        type: "compile:completed",
        featureSlug: slug,
        passed,
        errors: passed ? 0 : 1,
      } as any);

      if (!passed) {
        broadcast({ type: "pipeline:stopped", slug, phase: state.phase, reason: msgs?.fail || "Phase failed" } as any);
      }

      // Broadcast updated UI state (pipelineActive is now false)
      const updated = resolveUIState(root, slug);
      broadcast({ type: "project:state_changed", slug, state: updated } as any);
    });

    return c.json({ ok: true, running: true, phase: state.phase, next: entry.next });
  });

  // ── Allocation Kanban ──

  router.get("/project/:slug/allocations", (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    const allocationsPath = resolveRuntimePath(root, "kadima/allocations/allocations.json");
    if (!existsSync(allocationsPath)) {
      // Fall back: build allocations from DAG + scheduler state
      const featureDir = join(root, "docs/vault/04_Features", slug);
      const plan = readJson(join(featureDir, "Plan.json"));
      const schedulerState = readJson(join(getStateDir(root), "scheduler-state.json"));
      const tasks = plan?.tasks || [];
      const taskStatuses = schedulerState?.taskStatuses || {};

      const allocations = tasks.map((t: any) => {
        const status = taskStatuses[t.id] || "queued";
        const statusMap: Record<string, string> = {
          pending: "queued", queued: "queued",
          dispatched: "in_progress", running: "in_progress", active: "in_progress",
          completed: "done", done: "done",
          failed: "blocked", error: "blocked", blocked: "blocked", halted: "blocked",
        };
        return {
          taskId: t.id || "",
          taskName: t.title || t.id || "",
          roleId: t.agent || t.group || "unassigned",
          status: statusMap[status] || "queued",
          startedAt: t.startedAt || null,
          completedAt: t.completedAt || null,
          blockedReason: status === "failed" || status === "blocked" ? (t.error || "Blocked") : null,
        };
      });
      return c.json({ allocations });
    }
    const data = readJson(allocationsPath);
    return c.json({ allocations: data?.allocations || data || [] });
  });

  // ── Governance Approval Panel ──

  router.get("/project/:slug/approvals", (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    const approvalsPath = join(getStateDir(root), "pending-approvals.json");
    if (!existsSync(approvalsPath)) {
      return c.json({ approvals: [] });
    }
    const data = readJson(approvalsPath);
    const approvals = (data?.approvals || data || []).map((item: any) => ({
      id: item.id || item.taskId || "",
      taskName: item.taskName || item.task || item.taskId || "",
      policyViolated: item.policyViolated || item.reason || item.type || "Unknown policy",
      requestedBy: item.requestedBy || item.agent || item.roleId || "system",
      timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
      featureSlug: item.featureSlug || c.req.param("slug"),
      riskTier: item.riskTier || "medium",
    }));
    return c.json({ approvals });
  });

  router.post("/project/:slug/approvals/:id/resolve", async (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    const id = c.req.param("id");
    const { decision, reason } = await c.req.json();
    const approvalsPath = join(getStateDir(root), "pending-approvals.json");

    const data = readJson(approvalsPath) || { approvals: [] };
    const approvals: any[] = data.approvals || data || [];
    const idx = approvals.findIndex((a: any) => (a.id || a.taskId) === id);

    if (idx === -1) {
      return c.json({ error: "Approval not found" }, 404);
    }

    const resolved = approvals[idx];
    resolved.status = decision === "approve" ? "approved" : "denied";
    resolved.resolvedAt = new Date().toISOString();
    resolved.resolvedBy = "studio-user";
    if (reason) resolved.denyReason = reason;

    // Remove from pending
    approvals.splice(idx, 1);

    // Write back
    const dir = getStateDir(root);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(approvalsPath, JSON.stringify({ approvals }, null, 2) + "\n");

    // Broadcast via WebSocket
    const { broadcast } = await import("../ws/server.js");
    if (decision === "approve") {
      broadcast({ type: "governance:approved", taskId: id, approvedBy: "studio-user" } as any);
    } else {
      broadcast({ type: "governance:denied", taskId: id, deniedBy: "studio-user", reason: reason || "" } as any);
    }

    return c.json({ ok: true, decision, id });
  });

  // ── Agent Execution Monitor ──

  router.get("/project/:slug/agents/status", (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    const agentsDir = getAgentsDir(root);
    const statuses: Record<string, any> = {};

    // Read org-spec for agent definitions
    const orgSpec = readJson(resolveOguPath(root, "org-spec.json"));
    const roles = orgSpec?.roles || [];

    // Read agent session files
    const sessionsDir = join(agentsDir, "sessions");
    const sessionFiles: string[] = [];
    if (existsSync(sessionsDir)) {
      try {
        sessionFiles.push(...readdirSync(sessionsDir).filter((f) => f.endsWith(".json")));
      } catch { /* ignore */ }
    }

    // Read scheduler state for task assignments
    const schedulerState = readJson(join(getStateDir(root), "scheduler-state.json"));
    const taskStatuses = schedulerState?.taskStatuses || {};
    const taskAssignments = schedulerState?.taskAssignments || {};

    // Build status from roles
    for (const role of roles) {
      const roleId = role.roleId || role.id || "";
      if (!roleId) continue;

      // Check if agent has active session
      const sessionFile = sessionFiles.find((f) => {
        const data = readJson(join(sessionsDir, f));
        return data?.roleId === roleId;
      });
      const session = sessionFile ? readJson(join(sessionsDir, sessionFile)) : null;

      // Find tasks assigned to this role
      const assignedTasks = Object.entries(taskAssignments)
        .filter(([, assignee]) => assignee === roleId)
        .map(([taskId]) => taskId);

      const completedTasks = assignedTasks.filter((t) => taskStatuses[t] === "completed" || taskStatuses[t] === "done");
      const pendingTasks = assignedTasks.filter((t) => !["completed", "done"].includes(taskStatuses[t] || ""));
      const currentTask = session?.currentTask || pendingTasks.find((t) => taskStatuses[t] === "running" || taskStatuses[t] === "dispatched") || null;

      let status: "idle" | "executing" | "blocked" = "idle";
      if (currentTask) status = "executing";
      if (assignedTasks.some((t) => taskStatuses[t] === "blocked" || taskStatuses[t] === "failed")) {
        status = "blocked";
      }

      statuses[roleId] = {
        roleId,
        roleName: role.name || roleId,
        currentTask,
        status,
        startedAt: session?.startedAt || null,
        tasksCompleted: completedTasks,
        tasksPending: pendingTasks,
      };
    }

    // Also add statuses from agent state files
    const stateFile = readJson(join(agentsDir, "agent-states.json"));
    if (stateFile) {
      for (const [roleId, state] of Object.entries(stateFile as Record<string, any>)) {
        if (!statuses[roleId]) {
          statuses[roleId] = {
            roleId,
            roleName: state.name || roleId,
            currentTask: state.currentTask || null,
            status: state.currentTask ? "executing" : "idle",
            startedAt: state.startedAt || null,
            tasksCompleted: state.tasksCompleted || [],
            tasksPending: state.tasksPending || [],
          };
        }
      }
    }

    return c.json({ statuses });
  });

  // ── Run Verification (14 global gates) ──
  // Triggered manually from the Verification screen after build completes.
  // Runs ogu gates run, then transitions FSM to "done" if all gates pass.
  router.post("/project/:slug/verify", async (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);

    const { broadcast } = await import("../ws/server.js");
    const think = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);

    think("Starting verification — running 14 quality gates...");
    broadcast({ type: "compile:started", featureSlug: slug, phase: "verifying", next: "done" } as any);

    const cli = getCliPath();
    const child = spawn("node", [cli, "gates", "run", slug], {
      cwd: root,
      env: { ...process.env, OGU_ROOT: root },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let gateCount = 0;
    const gatesPassed: string[] = [];
    const gatesFailed: string[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";
      for (const text of lines) {
        const m = text.match(/\[\s*(\d+)\]\s+([\w_]+)\s+(PASS|FAIL|SKIP)/i);
        if (m) {
          gateCount++;
          const gateName = m[2].trim();
          const passed = m[3].toUpperCase() !== "FAIL";
          think(`Gate ${gateCount}/14: ${gateName} — ${passed ? "passed" : "FAILED"}`);
          broadcast({ type: "compile:gate", gate: gateName, featureSlug: slug, passed } as any);
          if (passed) gatesPassed.push(gateName);
          else gatesFailed.push(gateName);
        }
      }
    });
    child.stderr.on("data", () => {});

    // 15-minute timeout for gates
    const timer = setTimeout(() => { child.kill("SIGTERM"); }, 15 * 60 * 1000);

    // Path to persist gate run history for learning candidates
    const verifyHistoryPath = join(getProjectsDir(root), slug, "verify-history.json");

    child.on("close", async (code) => {
      clearTimeout(timer);
      const passed = code === 0;

      if (passed) {
        think("All 14 gates passed — project verified!");
        try {
          const { transitionFeature } = await import(
            /* @vite-ignore */ "../../../../tools/ogu/commands/lib/state-machine.mjs"
          );
          transitionFeature(root, slug, "done", {
            reason: "Verification complete: all 14 gates passed",
            actor: "studio",
          });
        } catch { /* best effort */ }

        // ── Learning candidates: FAIL → PASS gate transitions ──
        try {
          const prevHistory = existsSync(verifyHistoryPath)
            ? JSON.parse(readFileSync(verifyHistoryPath, "utf-8"))
            : null;
          const prevFailed: string[] = prevHistory?.lastFailed || [];
          const improved = prevFailed.filter((g) => gatesPassed.includes(g));

          if (improved.length > 0) {
            const failCount = prevHistory?.failCount || 1;
            // Find a team agent to attribute the learning to (prefer qa, fallback to first member)
            let agentId: string | null = null;
            try {
              const teamPath = join(getProjectsDir(root), slug, "team.json");
              if (existsSync(teamPath)) {
                const team = JSON.parse(readFileSync(teamPath, "utf-8"));
                const members: any[] = team?.members?.filter((m: any) => m.status === "active" && m.agent_id) || [];
                const qa = members.find((m) => (m.role_id || "").includes("qa"));
                agentId = qa?.agent_id || members[0]?.agent_id || null;
              }
            } catch { /* best effort */ }

            if (agentId) {
              const { createLearningCandidate } = await import(
                /* @vite-ignore */ "../../../../tools/ogu/commands/lib/learning-event.mjs"
              );
              const { isDuplicateCandidate, computeCandidateFingerprint } = await import("./dispatch.js");
              for (const gate of improved) {
                // Generic signals only — no file paths or project-specific data
                const signals = [`gate:${gate}`, `verify-failed-${failCount}x`];
                const fp = computeCandidateFingerprint(agentId, "verify", signals);
                if (!isDuplicateCandidate(fp)) {
                  createLearningCandidate(root, {
                    agentId,
                    taskType: "verification",
                    contextSignature: [`gate:${gate}`, `run:verify`, `iterations:${failCount + 1}`],
                    failureSignals: signals,
                    resolutionSummary: `Gate ${gate} resolved after ${failCount} failed run(s)`,
                    iterationCount: failCount + 1,
                    trigger: "gate_failure",
                  });
                }
              }

              // Run trainAll to process the new candidates
              const { trainAll } = await import(
                /* @vite-ignore */ "../../../../tools/ogu/commands/lib/agent-trainer.mjs"
              );
              await trainAll(root, { playbooksDir: join(root, "tools/ogu/playbooks") });
            }
          }

          // Clear history on success
          mkdirSync(join(getProjectsDir(root), slug), { recursive: true });
          writeFileSync(verifyHistoryPath, JSON.stringify({ lastFailed: [], lastRun: new Date().toISOString(), failCount: 0 }, null, 2));
        } catch { /* learning is best-effort */ }
      } else {
        think("Verification failed — review gate results and fix issues");

        // Persist failures for next run's learning candidate creation
        try {
          let failCount = 1;
          try { failCount = (JSON.parse(readFileSync(verifyHistoryPath, "utf-8")).failCount || 0) + 1; } catch {}
          mkdirSync(join(getProjectsDir(root), slug), { recursive: true });
          writeFileSync(verifyHistoryPath, JSON.stringify({ lastFailed: gatesFailed, lastRun: new Date().toISOString(), failCount }, null, 2));
        } catch { /* best effort */ }
      }

      // Read the first failed gate's error message from GATE_STATE.json
      let errorMessage: string | undefined;
      if (!passed) {
        try {
          const gs = JSON.parse(readFileSync(resolveRuntimePath(root, "GATE_STATE.json"), "utf-8"));
          const failedEntry = Object.values(gs.gates || {}).find((v: any) => v.status === "failed") as any;
          if (failedEntry?.error) errorMessage = failedEntry.error;
          else if (gatesFailed.length > 0) errorMessage = `Gate(s) failed: ${gatesFailed.join(", ")}`;
        } catch { /* best effort */ }
      }

      broadcast({ type: "compile:completed", featureSlug: slug, passed, errors: passed ? 0 : 1, errorMessage } as any);
      if (passed) {
        broadcast({ type: "pipeline:completed", slug, success: true } as any);
      }
      const updated = resolveUIState(root, slug);
      broadcast({ type: "project:state_changed", slug, state: updated } as any);
    });

    child.on("error", () => {
      clearTimeout(timer);
      broadcast({ type: "compile:completed", featureSlug: slug, passed: false, errors: 1 } as any);
    });

    return c.json({ ok: true, running: true });
  });

  // ── Fix failed gate — dispatch back to agent, then re-run verification ──
  router.post("/project/:slug/fix-gate", async (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    const { broadcast } = await import("../ws/server.js");
    const think = (text: string) => broadcast({ type: "cto:thinking_line", slug, text } as any);

    // Run async so client gets 200 immediately
    (async () => {
      try {
        const { autoFixGateFailure } = await import("./dispatch.js");
        const state = readJson(resolveRuntimePath(root, "STATE.json"));
        const phase = state?.phase || "verifying";

        think("Analysing gate failure — identifying responsible tasks...");
        const fixed = await autoFixGateFailure(root, slug, phase, think, 0);
        if (!fixed) {
          think("No auto-fixable gate found — manual review required");
          broadcast({ type: "compile:completed", featureSlug: slug, passed: false, errors: 1, errorMessage: "Gate is not auto-fixable — manual review required" } as any);
          return;
        }

        // Agent has fixed the code — re-run verification gates
        think("Fix applied — re-running 14 verification gates...");
        broadcast({ type: "compile:started", featureSlug: slug, phase: "verifying", next: "done" } as any);

        const cli = getCliPath();
        const child = spawn("node", [cli, "gates", "run", slug], {
          cwd: root,
          env: { ...process.env, OGU_ROOT: root },
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdoutBuf = "";
        let gateCount = 0;
        const gatesPassed: string[] = [];
        const gatesFailed: string[] = [];

        child.stdout.on("data", (chunk: Buffer) => {
          stdoutBuf += chunk.toString();
          const lines = stdoutBuf.split("\n");
          stdoutBuf = lines.pop() ?? "";
          for (const text of lines) {
            const m = text.match(/\[\s*(\d+)\]\s+([\w_]+)\s+(PASS|FAIL|SKIP)/i);
            if (m) {
              gateCount++;
              const gateName = m[2].trim();
              const passed = m[3].toUpperCase() !== "FAIL";
              think(`Gate ${gateCount}/14: ${gateName} — ${passed ? "passed" : "FAILED"}`);
              broadcast({ type: "compile:gate", gate: gateName, featureSlug: slug, passed } as any);
              if (passed) gatesPassed.push(gateName);
              else gatesFailed.push(gateName);
            }
          }
        });

        const timer = setTimeout(() => { child.kill("SIGTERM"); }, 15 * 60 * 1000);
        child.on("close", async (code) => {
          clearTimeout(timer);
          const passed = code === 0;
          let errorMessage: string | undefined;
          if (!passed) {
            try {
              const gs = JSON.parse(readFileSync(resolveRuntimePath(root, "GATE_STATE.json"), "utf-8"));
              const fe = Object.values(gs.gates || {}).find((v: any) => v.status === "failed") as any;
              if (fe?.error) errorMessage = fe.error;
              else if (gatesFailed.length > 0) errorMessage = `Gate(s) failed: ${gatesFailed.join(", ")}`;
            } catch { /* best effort */ }
          }
          broadcast({ type: "compile:completed", featureSlug: slug, passed, errors: passed ? 0 : 1, errorMessage } as any);
          if (passed) {
            think("All gates passed — project verified!");
            broadcast({ type: "pipeline:completed", slug, success: true } as any);
          } else {
            think("Gates still failing after fix — review error details");
          }
          const { resolveUIState } = await import("./project-state.js");
          broadcast({ type: "project:state_changed", slug, state: resolveUIState(root, slug) } as any);
        });
      } catch (err: any) {
        broadcast({ type: "compile:completed", featureSlug: slug, passed: false, errors: 1, errorMessage: err?.message } as any);
      }
    })();

    return c.json({ ok: true, running: true });
  });

  // ── Retry failed tasks ──
  router.post("/project/:slug/retry-failed", async (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    const result = await retryFailedTasks(root, slug);
    return c.json(result);
  });

  // ── Abort pipeline ──
  router.post("/project/:slug/abort", async (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    abortPipeline(slug, root);
    const { broadcast } = await import("../ws/server.js");
    broadcast({ type: "dispatch:aborted", slug } as any);
    return c.json({ ok: true, aborted: true });
  });

  // ── Pause pipeline ──
  router.post("/project/:slug/pause", async (c) => {
    const slug = c.req.param("slug");
    pausePipeline(slug, root);
    const { broadcast } = await import("../ws/server.js");
    broadcast({ type: "dispatch:paused", slug } as any);
    return c.json({ ok: true, paused: true });
  });

  // ── Resume pipeline ──
  router.post("/project/:slug/resume", async (c) => {
    const slug = c.req.param("slug");
    resumePipeline(slug, root);
    const { broadcast } = await import("../ws/server.js");
    broadcast({ type: "dispatch:resumed", slug } as any);
    return c.json({ ok: true, resumed: true });
  });

  return router;
}

/** Resolve project root from registry or default */
function resolveProjectRoot(slug: string): string {
  const defaultRoot = getRoot();
  if (existsSync(join(defaultRoot, "docs/vault/04_Features", slug))) return defaultRoot;
  const entry = readProjectRegistry().find((p) => p.slug === slug);
  if (entry && existsSync(entry.root)) return entry.root;
  return defaultRoot;
}
