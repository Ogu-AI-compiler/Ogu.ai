import { Hono } from "hono";
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { spawnSync } from "child_process";
import { abortPipeline, pausePipeline, resumePipeline } from "./dispatch.js";

// ── Phase 3A: Studio Data Layer ──
import {
  getOrgData,
  getBudgetData,
  getAuditData,
  getGovernanceData,
  getAgentData,
  getDashboardSnapshot,
} from "../../../ogu/commands/lib/studio-data-provider.mjs";
import {
  searchAudit as searchAuditLayer,
  getBudgetSummary,
} from "../../../ogu/commands/lib/studio-data-layer.mjs";
import { search as globalSearch } from "../../../ogu/commands/lib/global-search.mjs";
import { createWidget, createDashboardLayout, WIDGET_TYPES, serializeWidgets } from "../../../ogu/commands/lib/genui-widgets.mjs";
import { createSSEEmitter } from "../../../ogu/commands/lib/sse-emitter.mjs";
import { createExecutionStream, EXECUTION_EVENTS, formatEventForLog } from "../../../ogu/commands/lib/execution-event-stream.mjs";
import { getRunnersDir, resolveRuntimePath } from "../../../ogu/commands/lib/runtime-paths.mjs";

// ── Phase 4F: Cache Manager + TTL Store ──
import { createLRUCache } from "../../../ogu/commands/lib/cache-manager.mjs";
import { createTTLStore } from "../../../ogu/commands/lib/ttl-store.mjs";

// Progress Tracker + ETA Calculator (Phase 4F)
import { createProgressTracker } from "../../../ogu/commands/lib/progress-tracker.mjs";
import { createETACalculator } from "../../../ogu/commands/lib/eta-calculator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getCliPath() {
  return join(__dirname, "..", "..", "..", "ogu", "cli.mjs");
}

/** Run ogu CLI init to create full vault structure */
function runOguInit(projectRoot: string) {
  const cli = getCliPath();
  spawnSync("node", [cli, "init"], {
    cwd: projectRoot,
    env: { ...process.env, OGU_ROOT: projectRoot },
    stdio: "ignore",
    timeout: 15000,
  });
}

function getRoot() { return process.env.OGU_ROOT || process.cwd(); }

/** Resolve project root from registry or current root */
function resolveProjectRoot(slug: string): string {
  const defaultRoot = getRoot();
  if (existsSync(join(defaultRoot, "docs/vault/04_Features", slug))) return defaultRoot;
  const entry = readProjectRegistry().find((p) => p.slug === slug);
  if (entry && existsSync(entry.root)) return entry.root;
  return defaultRoot;
}

function readJson(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function readText(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

/** Check if a file has real content beyond just template headers */
function hasRealContent(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    const stripped = content
      .replace(/^#+ .+$/gm, "")
      .replace(/<!--.*?-->/gs, "")
      .replace(/^-\s*\[\s*\]\s*$/gm, "")
      .replace(/^\|.*\|$/gm, "")
      .replace(/^\s*$/gm, "")
      .trim();
    return stripped.length > 20;
  } catch {
    return false;
  }
}

function detectPhase(featureDir: string): string {
  const has = (f: string) => existsSync(join(featureDir, f));
  const hasFilled = (f: string) => has(f) && hasRealContent(join(featureDir, f));
  const hasMetrics = has("METRICS.json");

  if (hasMetrics) {
    const m = readJson(join(featureDir, "METRICS.json"));
    if (m?.completed) return "done";
  }
  if (has("Plan.json") && has("Spec.md")) {
    const spec = readText(join(featureDir, "Spec.md"));
    const plan = readJson(join(featureDir, "Plan.json"));
    const specFilled = !spec.includes("<!-- TO BE FILLED BY /architect -->") && hasRealContent(join(featureDir, "Spec.md"));
    const planHasTasks = plan?.tasks?.length > 0;
    if (specFilled && planHasTasks) return "ready";
  }
  if (hasFilled("PRD.md")) return "architect";
  if (hasFilled("ProjectBrief.md") || hasFilled("IDEA.md")) return "feature";
  return "idea";
}

// ── Persistent project registry ──
// Projects created by the wizard live in ~/Projects/{slug}, not in the Studio root.
// This registry tracks all known project roots so they survive server restarts.

const REGISTRY_PATH = join(homedir(), ".ogu", "studio-projects.json");

export interface ProjectEntry {
  slug: string;
  root: string;
  createdAt: string;
}

export function readProjectRegistry(): ProjectEntry[] {
  try {
    const data = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

export function registerProject(slug: string, root: string): void {
  const dir = join(homedir(), ".ogu");
  mkdirSync(dir, { recursive: true });

  const projects = readProjectRegistry().filter((p) => p.slug !== slug);
  projects.push({ slug, root, createdAt: new Date().toISOString() });
  writeFileSync(REGISTRY_PATH, JSON.stringify({ projects }, null, 2) + "\n", "utf-8");
}

function scanFeatures() {
  const results: Array<{ slug: string; phase: string; tasks: number; root?: string }> = [];
  const seen = new Set<string>();

  // 1. Scan current OGU_ROOT features (if any)
  const currentRoot = getRoot();
  const featuresDir = join(currentRoot, "docs/vault/04_Features");
  if (existsSync(featuresDir)) {
    for (const d of readdirSync(featuresDir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name === "Index.md") continue;
      const dir = join(featuresDir, d.name);
      const phase = detectPhase(dir);
      const plan = readJson(join(dir, "Plan.json"));
      const tasks = plan?.tasks?.length || 0;
      results.push({ slug: d.name, phase, tasks, root: currentRoot });
      seen.add(d.name);
    }
  }

  // 2. Scan registered projects (from wizard-created projects)
  for (const entry of readProjectRegistry()) {
    if (seen.has(entry.slug)) continue;
    if (!existsSync(entry.root)) continue;

    const projFeaturesDir = join(entry.root, "docs/vault/04_Features");
    if (!existsSync(projFeaturesDir)) continue;

    for (const d of readdirSync(projFeaturesDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      if (seen.has(d.name)) continue;
      const dir = join(projFeaturesDir, d.name);
      const phase = detectPhase(dir);
      const plan = readJson(join(dir, "Plan.json"));
      const tasks = plan?.tasks?.length || 0;
      results.push({ slug: d.name, phase, tasks, root: entry.root });
      seen.add(d.name);
    }
  }

  return results.sort((a, b) => {
    const order: Record<string, number> = { done: 0, ready: 1, architect: 2, feature: 3, idea: 4 };
    return (order[a.phase] ?? 5) - (order[b.phase] ?? 5);
  });
}

export function createApiRouter() {
  const api = new Hono();

  // ── Phase 4F: LRU cache for expensive API responses (max 50 entries) ──
  const apiCache = createLRUCache({ maxSize: 50 });
  // TTL store for time-bounded cache entries (30s TTL for org/budget data)
  const ttlStore = createTTLStore();

  // ── Phase 4F: Progress tracker for pipeline task tracking ──
  const pipelineProgressTracker = createProgressTracker({ total: 100 });
  const pipelineEtaCalculator = createETACalculator({ total: 100 });

  api.get("/state", (c) => {
    const root = getRoot();
    const oguDir = join(root, ".ogu");
    const state = readJson(join(oguDir, "STATE.json")) || {};
    const theme = readJson(join(oguDir, "THEME.json")) || {};
    const profile = readJson(join(oguDir, "PROFILE.json")) || {};
    const valid = existsSync(join(oguDir, "STATE.json")) || existsSync(join(oguDir, "PROFILE.json"));
    return c.json({ state, theme, profile, root, valid });
  });

  api.get("/state/gates", (c) => {
    const oguDir = join(getRoot(), ".ogu");
    const gates = readJson(join(oguDir, "GATE_STATE.json")) || {};
    return c.json(gates);
  });

  /* ── Involvement level persistence ── */
  api.post("/state/involvement", async (c) => {
    const { writeFileSync } = await import("fs");
    const { level } = await c.req.json() as { level?: string };
    const validLevels = ["autopilot", "guided", "product-focused", "hands-on"];
    if (!level || !validLevels.includes(level)) {
      return c.json({ error: `Invalid level. Must be one of: ${validLevels.join(", ")}` }, 400);
    }

    const root = getRoot();
    const statePath = resolveRuntimePath(root, "STATE.json");
    const state = readJson(statePath) || {};
    state.involvement_level = level;
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
    return c.json({ ok: true, level });
  });

  /* ── Phase detection endpoint ── */
  api.get("/state/phase", async (c) => {
    const { detectCurrentPhase, getActiveSlug, getInvolvementLevel } = await import("./phase-guard.js");
    const root = getRoot();
    const slug = getActiveSlug(root);
    const phase = detectCurrentPhase(root, slug);
    const involvement = getInvolvementLevel(root);
    return c.json({ phase, slug, involvement });
  });

  api.get("/features", (c) => {
    const features = scanFeatures();
    const oguDir = join(getRoot(), ".ogu");
    const state = readJson(join(oguDir, "STATE.json"));
    return c.json({ features, active: state?.current_task || null });
  });

  // Switch OGU_ROOT to a project (needed for projects created by wizard in ~/Projects/)
  api.post("/features/:slug/activate", (c) => {
    const slug = c.req.param("slug");
    const features = scanFeatures();
    const match = features.find((f) => f.slug === slug);
    if (!match || !match.root) return c.json({ error: "Project not found" }, 404);
    process.env.OGU_ROOT = match.root;
    return c.json({ ok: true, root: match.root });
  });

  api.delete("/features/:slug", async (c) => {
    const slug = c.req.param("slug");
    if (!slug || slug.includes("..") || slug.includes("/")) return c.json({ error: "Invalid slug" }, 400);

    // Find the feature across all registered projects
    const features = scanFeatures();
    const match = features.find((f) => f.slug === slug);
    if (!match || !match.root) return c.json({ error: "Feature not found" }, 404);

    // Abort any running pipeline for this project (best-effort kill before deletion)
    abortPipeline(slug, match.root);
    // Clear active pointer if this was the current task
    try {
      const statePath = resolveRuntimePath(match.root, "STATE.json");
      const state = readJson(statePath) || {};
      if (state.current_task === slug) {
        delete state.current_task;
        writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
      }
    } catch { /* best-effort */ }

    // 1. Feature vault directory
    const dir = join(match.root, "docs/vault/04_Features", slug);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });

    // 2. Project data (.ogu/projects/{slug}/)
    const projectDir = resolveRuntimePath(match.root, "projects", slug);
    if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });

    // 3. FSM state file
    const fsmState = resolveRuntimePath(match.root, "state", "features", `${slug}.state.json`);
    if (existsSync(fsmState)) rmSync(fsmState, { force: true });
    const abortedMarker = resolveRuntimePath(match.root, "state", "features", `${slug}.aborted`);
    if (existsSync(abortedMarker)) rmSync(abortedMarker, { force: true });
    const dispatchState = resolveRuntimePath(match.root, "state", "dispatch", `${slug}.json`);
    if (existsSync(dispatchState)) rmSync(dispatchState, { force: true });

    // 4. Runner files (task-*.input.json / task-*.output.json for this slug)
    const runnersDir = getRunnersDir(match.root);
    if (existsSync(runnersDir)) {
      try {
        for (const f of readdirSync(runnersDir)) {
          if (!f.endsWith(".json")) continue;
          try {
            const data = JSON.parse(readFileSync(join(runnersDir, f), "utf-8"));
            if (data?.featureSlug === slug || data?.slug === slug) {
              rmSync(join(runnersDir, f), { force: true });
            }
          } catch { /* skip unparseable files */ }
        }
      } catch { /* ignore */ }
    }

    // 5. Remove from GLOBAL project registry AND delete standalone project directory
    try {
      const allEntries = readProjectRegistry();
      const entry = allEntries.find((p) => p.slug === slug);
      const globalRegistry = allEntries.filter((p) => p.slug !== slug);
      mkdirSync(join(homedir(), ".ogu"), { recursive: true });
      writeFileSync(REGISTRY_PATH, JSON.stringify({ projects: globalRegistry }, null, 2) + "\n", "utf-8");

      // Delete the actual project directory if it was a wizard-created standalone project
      // Safety: only delete if the entry root ends with the slug (standalone project)
      if (entry?.root && existsSync(entry.root)) {
        const entryRootBase = entry.root.replace(/\/$/, "").split("/").pop() || "";
        // It's a standalone project if the folder name starts with the slug (may have timestamp suffix)
        if (entryRootBase === slug || entryRootBase.startsWith(slug + "-")) {
          rmSync(entry.root, { recursive: true, force: true });
          if (process.env.OGU_ROOT === entry.root) delete process.env.OGU_ROOT;
        }
      }
    } catch { /* ignore */ }

    // 6. Release marketplace allocations for this project
    try {
      const { listProjectAllocations, releaseAgent } = await import("../../../ogu/commands/lib/marketplace-allocator.mjs") as any;
      const allocs = listProjectAllocations(match.root, slug);
      for (const alloc of allocs) {
        try { releaseAgent(match.root, alloc.allocation_id); } catch { /* best-effort */ }
      }
    } catch { /* lib not available */ }

    return c.json({ ok: true, deleted: slug });
  });

  api.get("/features/:slug", (c) => {
    const slug = c.req.param("slug");
    const featuresDir = join(getRoot(), "docs/vault/04_Features");
    const dir = join(featuresDir, slug);
    if (!existsSync(dir)) return c.json({ error: "Feature not found" }, 404);
    return c.json({
      slug,
      phase: detectPhase(dir),
      prd: readText(join(dir, "PRD.md")),
      spec: readText(join(dir, "Spec.md")),
      plan: readJson(join(dir, "Plan.json")),
      metrics: readJson(join(dir, "METRICS.json")),
      qa: readText(join(dir, "QA.md")),
    });
  });

  api.get("/logs/recent", (c) => {
    const logsDir = join(getRoot(), "docs/vault/01_Daily");
    if (!existsSync(logsDir)) return c.json([]);
    const files = readdirSync(logsDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .slice(-3);
    return c.json(
      files.map((f) => ({
        name: f.replace(".md", ""),
        content: readText(join(logsDir, f)),
      }))
    );
  });

  api.get("/theme/presets", async (c) => {
    const { presets } = await import("../../src/theme/presets.js");
    return c.json(presets);
  });

  /* ── Project file tree ── */

  // Hidden from users: Ogu engine internals + standard noise
  const IGNORE = new Set([
    // Ogu core — never expose engine files
    "tools",         // CLI, studio, skills, gates — the entire engine
    "CLAUDE.md",     // AI system prompt
    "docs",          // internal vault (ADRs, contracts, runbooks)
    // Standard ignores
    "node_modules", ".git", "dist", ".DS_Store", ".ogu", ".claude",
  ]);

  interface TreeNode {
    name: string;
    type: "file" | "dir";
    size?: number;
    children?: TreeNode[];
  }

  function scanDir(dir: string, depth: number, maxDepth: number): TreeNode[] {
    if (depth > maxDepth) return [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const nodes: TreeNode[] = [];

      for (const entry of entries) {
        if (IGNORE.has(entry.name) || entry.name.startsWith(".")) continue;
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            type: "dir",
            children: scanDir(fullPath, depth + 1, maxDepth),
          });
        } else {
          try {
            const stat = statSync(fullPath);
            nodes.push({ name: entry.name, type: "file", size: stat.size });
          } catch {
            nodes.push({ name: entry.name, type: "file" });
          }
        }
      }

      // Sort: directories first, then alphabetical
      return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch {
      return [];
    }
  }

  api.get("/files", (c) => {
    const root = getRoot();
    const depth = parseInt(c.req.query("depth") || "4", 10);
    const children = scanDir(root, 0, Math.min(depth, 6));
    return c.json({ name: ".", type: "dir", children });
  });

  /* ── Directory browser (for folder picker) ── */
  api.get("/dirs", (c) => {
    const dir = c.req.query("path") || homedir();
    const resolved = resolve(dir);
    if (!existsSync(resolved)) return c.json({ error: "Not found" }, 404);
    try {
      const entries = readdirSync(resolved, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort();
      const hasOgu = existsSync(join(resolved, ".ogu", "STATE.json"));
      return c.json({ path: resolved, dirs: entries, hasOgu });
    } catch {
      return c.json({ error: "Cannot read directory" }, 400);
    }
  });

  /* ── Project management ── */

  api.post("/project/open", async (c) => {
    const { mkdirSync } = await import("fs");
    const { path: projectPath } = await c.req.json();
    if (!projectPath) return c.json({ error: "path is required" }, 400);

    const resolved = resolve(projectPath);
    if (!existsSync(resolved)) return c.json({ error: "Directory does not exist" }, 400);

    // Auto-init full Ogu structure if directory has no .ogu
    const oguDir = join(resolved, ".ogu");
    if (!existsSync(join(oguDir, "STATE.json"))) {
      mkdirSync(resolved, { recursive: true });
      runOguInit(resolved);
    }

    process.env.OGU_ROOT = resolved;
    return c.json({ ok: true, root: resolved });
  });

  api.post("/project/init", async (c) => {
    const { mkdirSync } = await import("fs");
    const { path: projectPath } = await c.req.json();
    if (!projectPath) return c.json({ error: "path is required" }, 400);

    const resolved = projectPath.startsWith("/")
      ? resolve(projectPath)
      : resolve(homedir(), projectPath);

    mkdirSync(resolved, { recursive: true });
    runOguInit(resolved);

    process.env.OGU_ROOT = resolved;
    return c.json({ ok: true, valid: true, root: resolved });
  });

  api.post("/project/delete", async (c) => {
    const { rmSync } = await import("fs");
    const { path: projectPath } = await c.req.json();
    if (!projectPath) return c.json({ error: "path is required" }, 400);

    const resolved = resolve(projectPath);

    // If directory doesn't exist, still return success (already gone)
    if (!existsSync(resolved)) {
      // Clean up OGU_ROOT if it was this project
      if (process.env.OGU_ROOT === resolved) delete process.env.OGU_ROOT;
      return c.json({ ok: true, deleted: resolved });
    }

    // Safety: only delete files if it has .ogu or docs/vault (it's an Ogu project)
    if (existsSync(join(resolved, ".ogu")) || existsSync(join(resolved, "docs", "vault"))) {
      rmSync(resolved, { recursive: true, force: true });
    }

    // Clear OGU_ROOT if it was this project
    if (process.env.OGU_ROOT === resolved) {
      delete process.env.OGU_ROOT;
    }

    // Clean up port registry entry for this project
    try {
      const { writeFileSync: wfs } = await import("fs");
      const registryPath = join(homedir(), ".ogu", "port-registry.json");
      if (existsSync(registryPath)) {
        const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
        if (registry.projects?.[resolved]) {
          delete registry.projects[resolved];
          wfs(registryPath, JSON.stringify(registry, null, 2) + "\n");
        }
      }
    } catch { /* best-effort */ }

    return c.json({ ok: true, deleted: resolved });
  });

  // ── Project lifecycle controls ──

  /** Release all active marketplace allocations for a project */
  async function releaseProjectAllocations(root: string, slug: string) {
    try {
      const { listProjectAllocations, releaseAgent } = await import("../../../ogu/commands/lib/marketplace-allocator.mjs") as any;
      const allocs = listProjectAllocations(root, slug);
      for (const alloc of allocs) {
        try { releaseAgent(root, alloc.allocation_id); } catch { /* best-effort */ }
      }
    } catch { /* lib not available */ }
  }

  api.post("/project/:slug/abort", async (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    abortPipeline(slug, root);
    await releaseProjectAllocations(root, slug);
    try {
      const { broadcast } = await import("../ws/server.js");
      broadcast({ type: "dispatch:aborted", slug } as any);
    } catch { /* best-effort */ }
    return c.json({ ok: true, aborted: slug });
  });

  api.post("/project/:slug/pause", (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    pausePipeline(slug, root);
    import("../ws/server.js").then(({ broadcast }) => {
      broadcast({ type: "dispatch:paused", slug } as any);
    }).catch(() => {});
    return c.json({ ok: true, paused: slug });
  });

  api.post("/project/:slug/resume", (c) => {
    const slug = c.req.param("slug");
    const root = resolveProjectRoot(slug);
    resumePipeline(slug, root);
    import("../ws/server.js").then(({ broadcast }) => {
      broadcast({ type: "dispatch:resumed", slug } as any);
    }).catch(() => {});
    return c.json({ ok: true, resumed: slug });
  });

  // ── Active project (most recent valid from registry) ──
  api.get("/project/active", (c) => {
    // Sort registry by createdAt descending, return first whose root exists on disk
    const registry = readProjectRegistry()
      .filter((p) => existsSync(p.root))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (registry.length === 0) return c.json({ project: null });

    const latest = registry[0];
    return c.json({ project: { slug: latest.slug, root: latest.root } });
  });

  // ── Session persistence (server-side backup) ──

  api.get("/sessions", (c) => {
    const root = getRoot();
    const sessionsFile = join(root, ".ogu", "studio-sessions.json");
    if (!existsSync(sessionsFile)) return c.json({ sessions: null });
    try {
      const data = JSON.parse(readFileSync(sessionsFile, "utf-8"));
      return c.json({ sessions: data });
    } catch {
      return c.json({ sessions: null });
    }
  });

  api.post("/sessions", async (c) => {
    const { writeFileSync: wfs, mkdirSync } = await import("fs");
    const root = getRoot();
    const oguDir = join(root, ".ogu");
    if (!existsSync(oguDir)) mkdirSync(oguDir, { recursive: true });
    const body = await c.req.json();
    const sessionsFile = join(oguDir, "studio-sessions.json");
    try {
      wfs(sessionsFile, JSON.stringify(body, null, 2) + "\n");
      return c.json({ ok: true });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // ── Phase 3A: Studio Data Provider endpoints ──

  // Global Cmd-K search
  api.get("/search", (c) => {
    const root = getRoot();
    const query = c.req.query("q") || "";
    const types = c.req.query("types")?.split(",").filter(Boolean);
    const limit = parseInt(c.req.query("limit") || "20", 10);
    if (!query) return c.json({ results: [] });
    const results = globalSearch({ root, query, types, limit });
    return c.json({ results });
  });

  // Dashboard snapshot — all data in one call
  api.get("/dashboard/snapshot", (c) => {
    const root = getRoot();
    const snapshot = getDashboardSnapshot({ root });
    return c.json(snapshot);
  });

  // Org data (cached with 30s TTL)
  api.get("/org/data", (c) => {
    const root = getRoot();
    const cacheKey = `org:${root}`;
    const cached = ttlStore.get(cacheKey);
    if (cached !== undefined) return c.json(cached);
    const data = getOrgData({ root });
    ttlStore.set(cacheKey, data, { ttlMs: 30000 });
    apiCache.set(cacheKey, data);
    return c.json(data);
  });

  // Budget summary (augmented with alert level)
  api.get("/budget/summary", (c) => {
    const root = getRoot();
    return c.json(getBudgetSummary({ root }));
  });

  // Budget raw data (cached with 30s TTL)
  api.get("/budget/data", (c) => {
    const root = getRoot();
    const cacheKey = `budget:${root}`;
    const cached = ttlStore.get(cacheKey);
    if (cached !== undefined) return c.json(cached);
    const data = getBudgetData({ root });
    ttlStore.set(cacheKey, data, { ttlMs: 30000 });
    apiCache.set(cacheKey, data);
    return c.json(data);
  });

  // Audit search with filters
  api.get("/audit/search", (c) => {
    const root = getRoot();
    const feature = c.req.query("feature");
    const type = c.req.query("type");
    const severity = c.req.query("severity");
    const since = c.req.query("since");
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const results = searchAuditLayer({ root, feature, type, severity, since, limit });
    return c.json({ results });
  });

  // Audit data (raw recent events)
  api.get("/audit/data", (c) => {
    const root = getRoot();
    const limit = parseInt(c.req.query("limit") || "50", 10);
    return c.json(getAuditData({ root, limit }));
  });

  // Governance data
  api.get("/governance/data", (c) => {
    const root = getRoot();
    return c.json(getGovernanceData({ root }));
  });

  // Agent data
  api.get("/agents/data", (c) => {
    const root = getRoot();
    return c.json(getAgentData({ root }));
  });

  // GenUI widgets — create a widget descriptor
  api.post("/widgets/create", async (c) => {
    const body = await c.req.json() as { type?: string; title?: string; data?: any; style?: any };
    const { type, title, data, style } = body;
    if (!type) return c.json({ error: "type is required" }, 400);
    if (!WIDGET_TYPES[type as keyof typeof WIDGET_TYPES]) {
      return c.json({ error: `Invalid widget type: ${type}. Valid: ${Object.keys(WIDGET_TYPES).join(", ")}` }, 400);
    }
    const widget = (createWidget as any)({ type: type as string, title: title || "", data: data || {}, style: style || {} });
    return c.json({ widget });
  });

  // GenUI widgets — list available widget types
  api.get("/widgets/types", (c) => {
    return c.json({ types: WIDGET_TYPES });
  });

  // GenUI dashboard layout — build a grid layout from widgets
  api.post("/widgets/layout", async (c) => {
    const body = await c.req.json() as { widgets?: any[]; columns?: number };
    const { widgets = [], columns } = body;
    const layout = createDashboardLayout({ widgets, columns });
    return c.json({ layout, serialized: serializeWidgets(widgets) });
  });

  // ── Phase 4F: Pipeline progress tracking endpoint ──
  api.get("/pipeline/progress", (c) => {
    const progress = pipelineProgressTracker.getProgress();
    const eta = pipelineEtaCalculator.getETA();
    return c.json({ progress, eta });
  });

  api.post("/pipeline/progress", async (c) => {
    const body = await c.req.json() as { completed?: number; total?: number };
    const completed = body.completed ?? 0;
    pipelineProgressTracker.increment(completed);
    pipelineEtaCalculator.recordProgress(completed, Date.now());
    return c.json({ ok: true, progress: pipelineProgressTracker.getProgress() });
  });

  // SSE endpoint for real-time events (Cmd-K and live dashboard updates)
  const sseEmitter = createSSEEmitter();

  api.get("/events/stream", (c) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const clientId = sseEmitter.addClient((msg: { id: number; event: string; data: any }) => {
          const formatted = sseEmitter.format(msg);
          controller.enqueue(encoder.encode(formatted));
        });
        // Send initial connection event
        const initMsg = sseEmitter.format({ id: 0, event: "connected", data: { clientCount: sseEmitter.clientCount() } });
        controller.enqueue(encoder.encode(initMsg));
        // Cleanup on close
        const cleanup = () => sseEmitter.removeClient(clientId);
        c.req.raw.signal?.addEventListener("abort", cleanup);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  });

  // ── Execution Feed (Slice 435) ────────────────────────────────────────────

  const executionStream = createExecutionStream({ persistToAudit: true });

  // Forward execution events to SSE clients
  executionStream.on("*", (event: any) => {
    sseEmitter.broadcast({ event: event.type, data: event });
  });

  // GET /api/execution/feed — recent execution events (with optional filters)
  api.get("/execution/feed", (c) => {
    const type = c.req.query("type") || undefined;
    const taskId = c.req.query("taskId") || undefined;
    const featureSlug = c.req.query("feature") || undefined;
    const since = c.req.query("since") || undefined;
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const events = executionStream.getHistory({ type, taskId, featureSlug, since, limit });
    return c.json({ events, total: events.length });
  });

  // GET /api/execution/stats — execution stream statistics
  api.get("/execution/stats", (c) => {
    return c.json(executionStream.getStats());
  });

  // GET /api/execution/events — list all event type constants
  api.get("/execution/events", (c) => {
    return c.json({ events: EXECUTION_EVENTS });
  });

  // POST /api/execution/emit — manually emit an execution event (for testing/integration)
  api.post("/execution/emit", async (c) => {
    const body = await c.req.json() as { type?: string; payload?: any };
    if (!body.type) return c.json({ error: "type is required" }, 400);
    const event = executionStream.emit(body.type, body.payload || {});
    return c.json({ event });
  });

  // Marketplace API routes are handled by dedicated createMarketplaceApi() router in index.ts.

  // ── Billing (stub — returns free-plan defaults when no auth) ──────────────
  if (!process.env.AOAS_MODE || process.env.AOAS_MODE === "false") {
    api.get("/billing/subscription", (c) => {
      return c.json({
        plan: { id: "free", name: "Free", compilationsPerMonth: 3, storageGb: 1, agentsMax: 5 },
        balance: 0,
        usage: { compilations: 0, agentHires: 0 },
      });
    });

    api.post("/billing/checkout", async (c) => {
      return c.json({ error: "Billing not configured — enable AOAS mode for payments" }, 400 as any);
    });

    api.post("/billing/portal", async (c) => {
      return c.json({ error: "Billing not configured — enable AOAS mode for payments" }, 400 as any);
    });

    api.get("/billing/credits", (c) => {
      return c.json({ balance: 0, transactions: [] });
    });
  }

  return api;
}
