import { Hono } from "hono";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { spawnSync } from "child_process";

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
  if (hasFilled("IDEA.md")) return "feature";
  return "idea";
}

function scanFeatures() {
  const featuresDir = join(getRoot(), "docs/vault/04_Features");
  if (!existsSync(featuresDir)) return [];
  return readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "Index.md")
    .map((d) => {
      const dir = join(featuresDir, d.name);
      const phase = detectPhase(dir);
      const plan = readJson(join(dir, "Plan.json"));
      const tasks = plan?.tasks?.length || 0;
      return { slug: d.name, phase, tasks };
    })
    .sort((a, b) => {
      const order: Record<string, number> = { done: 0, ready: 1, architect: 2, feature: 3, idea: 4 };
      return (order[a.phase] ?? 5) - (order[b.phase] ?? 5);
    });
}

export function createApiRouter() {
  const api = new Hono();

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
    const statePath = join(root, ".ogu/STATE.json");
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

  return api;
}
