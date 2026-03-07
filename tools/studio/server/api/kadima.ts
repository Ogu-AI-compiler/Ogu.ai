/**
 * Kadima Server API — file-based daemon status, standups, allocations, logs.
 *
 * Reads directly from .ogu/ files. Start/stop delegates to CLI.
 *
 * Endpoints:
 *   GET  /kadima/status       — daemon status (PID, uptime, config)
 *   POST /kadima/start        — start kadima daemon via CLI
 *   POST /kadima/stop         — stop kadima daemon via CLI
 *   GET  /kadima/standups     — recent standups
 *   GET  /kadima/allocations  — current allocations
 *   GET  /kadima/logs         — daemon logs
 *   GET  /audit/events        — audit events with filters
 */

import { Hono } from "hono";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { getAuditDir, getMemoryDir, getStateDir, resolveOguPath, resolveRuntimePath } from "../../../ogu/commands/lib/runtime-paths.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getCliPath(): string {
  return join(__dirname, "..", "..", "..", "ogu", "cli.mjs");
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

function readText(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

/** Check if a process with given PID is running */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Run an ogu CLI command asynchronously, return { exitCode, stdout } */
function runOguAsync(command: string, args: string[] = []): Promise<{ exitCode: number; stdout: string }> {
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

    setTimeout(() => {
      child.kill();
      resolve({ exitCode: 1, stdout: "Timeout after 30s" });
    }, 30000);
  });
}

export function createKadimaRouter() {
  const router = new Hono();

  // ── GET /kadima/status — daemon status ──

  router.get("/kadima/status", (c) => {
    const root = getRoot();
    const pidPath = resolveRuntimePath(root, "kadima.pid");
    const configPath = resolveOguPath(root, "kadima.config.json");
    const schedulerPath = join(getStateDir(root), "scheduler-state.json");

    let running = false;
    let pid: number | null = null;
    let uptime: number | null = null;

    // Check PID file
    if (existsSync(pidPath)) {
      const pidContent = readText(pidPath).trim();
      pid = parseInt(pidContent, 10);
      if (!isNaN(pid) && pid > 0) {
        running = isProcessRunning(pid);
        if (running) {
          // Estimate uptime from PID file mtime
          try {
            const stat = statSync(pidPath);
            uptime = Date.now() - stat.mtimeMs;
          } catch { /* ignore */ }
        }
      }
    }

    // Read config
    const config = readJson(configPath) || {};

    // Read scheduler state for task summary
    const schedulerState = readJson(schedulerPath) || {};
    const queue = schedulerState.queue || [];
    const taskSummary = {
      queued: queue.filter((t: any) => t.status === "queued" || t.status === "pending").length,
      running: queue.filter((t: any) => t.status === "running" || t.status === "dispatched" || t.status === "active").length,
      completed: queue.filter((t: any) => t.status === "completed" || t.status === "done").length,
      failed: queue.filter((t: any) => t.status === "failed" || t.status === "error" || t.status === "blocked").length,
      total: queue.length,
    };

    return c.json({
      running,
      pid: running ? pid : null,
      uptimeMs: uptime,
      uptimeFormatted: uptime ? `${Math.floor(uptime / 60000)}m ${Math.floor((uptime % 60000) / 1000)}s` : null,
      config: {
        maxConcurrent: config.scheduler?.maxConcurrent || config.maxConcurrent || 4,
        port: config.api?.port || 4210,
        host: config.api?.host || "127.0.0.1",
      },
      tasks: taskSummary,
    });
  });

  // ── POST /kadima/start — start daemon ──

  router.post("/kadima/start", async (c) => {
    const result = await runOguAsync("kadima:start");
    return c.json({
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      output: result.stdout,
    });
  });

  // ── POST /kadima/stop — stop daemon ──

  router.post("/kadima/stop", async (c) => {
    const result = await runOguAsync("kadima:stop");
    return c.json({
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      output: result.stdout,
    });
  });

  // ── GET /kadima/standups — recent standups ──

  router.get("/kadima/standups", (c) => {
    const root = getRoot();
    const standupsDir = resolveRuntimePath(root, "kadima/standups");

    if (!existsSync(standupsDir)) {
      // Fallback: look in memory files for standup-like content
      const memoryDir = getMemoryDir(root);
      if (!existsSync(memoryDir)) return c.json({ standups: [] });

      const files = readdirSync(memoryDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .slice(-3);

      const standups = files.map((f) => ({
        date: f.replace(".md", ""),
        content: readText(join(memoryDir, f)),
        source: "memory",
      }));

      return c.json({ standups });
    }

    try {
      const files = readdirSync(standupsDir)
        .filter((f) => f.endsWith(".json") || f.endsWith(".md"))
        .sort()
        .slice(-7);

      const standups = files.map((f) => {
        const fullPath = join(standupsDir, f);
        if (f.endsWith(".json")) {
          return { date: f.replace(".json", ""), ...readJson(fullPath), source: "standup" };
        }
        return { date: f.replace(".md", ""), content: readText(fullPath), source: "standup" };
      });

      return c.json({ standups });
    } catch {
      return c.json({ standups: [] });
    }
  });

  // ── GET /kadima/allocations — current allocations ──

  router.get("/kadima/allocations", (c) => {
    const root = getRoot();
    const allocationsDir = resolveRuntimePath(root, "kadima/allocations");
    const allocationsPath = join(allocationsDir, "allocations.json");

    if (existsSync(allocationsPath)) {
      const data = readJson(allocationsPath);
      return c.json({ allocations: data?.allocations || data || [] });
    }

    // Fallback: build from scheduler state
    const schedulerState = readJson(join(getStateDir(root), "scheduler-state.json")) || {};
    const queue = schedulerState.queue || [];

    const statusMap: Record<string, string> = {
      pending: "queued", queued: "queued",
      dispatched: "in_progress", running: "in_progress", active: "in_progress",
      completed: "done", done: "done",
      failed: "blocked", error: "blocked", blocked: "blocked", halted: "blocked",
    };

    const allocations = queue.map((entry: any) => ({
      taskId: entry.taskId || "",
      taskName: entry.taskName || entry.taskId || "",
      roleId: entry.roleId || entry.agent || "unassigned",
      status: statusMap[entry.status] || "queued",
      featureSlug: entry.featureSlug || null,
      startedAt: entry.startedAt || null,
      completedAt: entry.completedAt || null,
    }));

    return c.json({ allocations });
  });

  // ── GET /kadima/logs — daemon logs ──

  router.get("/kadima/logs", (c) => {
    const root = getRoot();
    const limit = parseInt(c.req.query("limit") || "100", 10);

    // Try kadima-specific logs first
    const kadimaLogsDir = resolveRuntimePath(root, "kadima/logs");
    if (existsSync(kadimaLogsDir)) {
      try {
        const files = readdirSync(kadimaLogsDir)
          .filter((f) => f.endsWith(".log") || f.endsWith(".jsonl"))
          .sort()
          .slice(-3);

        const allLines: string[] = [];
        for (const f of files) {
          const content = readText(join(kadimaLogsDir, f));
          allLines.push(...content.split("\n").filter(Boolean));
        }

        return c.json({ logs: allLines.slice(-limit), count: allLines.length });
      } catch {
        return c.json({ logs: [], count: 0 });
      }
    }

    // Fallback: read from scheduler archive
    const archivePath = join(getStateDir(root), "scheduler-archive.jsonl");
    if (existsSync(archivePath)) {
      const lines = readText(archivePath).split("\n").filter(Boolean);
      const entries = lines
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter((e): e is any => e !== null)
        .slice(-limit);

      return c.json({ logs: entries, count: lines.length });
    }

    return c.json({ logs: [], count: 0 });
  });

  // ── GET /audit/events — audit events with filters ──

  router.get("/audit/events", (c) => {
    const root = getRoot();
    const limit = parseInt(c.req.query("limit") || "100", 10);
    const type = c.req.query("type") || "";
    const dateFrom = c.req.query("from") || "";
    const dateTo = c.req.query("to") || "";

    const auditDir = getAuditDir(root);
    if (!existsSync(auditDir)) return c.json({ events: [], count: 0 });

    // Collect events from all audit files (current.jsonl + date-based files)
    const allEvents: any[] = [];

    const files = readdirSync(auditDir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort();

    for (const f of files) {
      const lines = readText(join(auditDir, f)).split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          allEvents.push(event);
        } catch { /* skip malformed */ }
      }
    }

    // Apply filters
    let filtered = allEvents;

    if (type) {
      filtered = filtered.filter((e) =>
        e.type === type || (e.type || "").startsWith(type + ".")
      );
    }

    if (dateFrom) {
      filtered = filtered.filter((e) =>
        (e.timestamp || "") >= dateFrom
      );
    }

    if (dateTo) {
      filtered = filtered.filter((e) =>
        (e.timestamp || "") <= dateTo + "T23:59:59"
      );
    }

    const total = filtered.length;
    const events = filtered.slice(-limit);

    return c.json({ events, count: total, showing: events.length });
  });

  return router;
}
