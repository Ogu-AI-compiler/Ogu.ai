import { WebSocketServer, WebSocket } from "ws";
import { watch } from "chokidar";
import { readFileSync } from "fs";
import { join, basename } from "path";
import type { Server } from "http";
import type { ServerEvent } from "./events.js";

const clients = new Set<WebSocket>();

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch { /* ignore malformed */ }
    });
  });

  // Watch .ogu/ directory for changes
  const root = process.env.OGU_ROOT || process.cwd();
  const oguDir = join(root, ".ogu");

  const watcher = watch(oguDir, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  watcher.on("change", (filePath) => {
    const file = basename(filePath);
    try {
      const raw = readFileSync(filePath, "utf-8");
      const data = file.endsWith(".json") ? JSON.parse(raw) : raw;

      const event: ServerEvent = file === "THEME.json"
        ? { type: "theme:changed", themeData: data.generated_tokens || data }
        : { type: "state:changed", file, data };

      broadcast(event);
    } catch { /* ignore parse errors on partial writes */ }
  });

  // Watch .ogu/audit/ for real-time audit events → WS broadcast
  const auditDir = join(oguDir, "audit");
  const auditFileSizes = new Map<string, number>();

  const auditWatcher = watch(join(auditDir, "*.jsonl"), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100 },
  });

  auditWatcher.on("change", (filePath) => {
    try {
      const content = readFileSync(filePath, "utf-8");
      const prevSize = auditFileSizes.get(filePath) || 0;
      auditFileSizes.set(filePath, content.length);

      // Only process new content (appended lines)
      const newContent = content.slice(prevSize);
      const newLines = newContent.split("\n").filter(Boolean);

      for (const line of newLines) {
        try {
          const entry = JSON.parse(line);
          const wsEvent = mapAuditToWsEvent(entry);
          if (wsEvent) broadcast(wsEvent);
        } catch { /* skip malformed lines */ }
      }
    } catch { /* ignore read errors */ }
  });

  auditWatcher.on("add", (filePath) => {
    try {
      const content = readFileSync(filePath, "utf-8");
      auditFileSizes.set(filePath, content.length);
    } catch { /* ignore */ }
  });

  // Watch scheduler + budget state for status updates
  const stateWatcher = watch([
    join(oguDir, "state", "scheduler-state.json"),
    join(oguDir, "budget", "budget-state.json"),
  ], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  stateWatcher.on("change", (filePath) => {
    try {
      const file = basename(filePath);
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      if (file === "scheduler-state.json") {
        broadcast({ type: "kadima:status", data });
      } else if (file === "budget-state.json") {
        broadcast({ type: "budget:updated", data });
      }
    } catch { /* ignore */ }
  });

  // Watch project root for file changes (for live file tree)
  let filesDebounce: ReturnType<typeof setTimeout> | null = null;
  const IGNORE_DIRS = /node_modules|\.git|dist|\.ogu|\.claude/;

  const projectWatcher = watch(root, {
    ignoreInitial: true,
    depth: 3,
    ignored: (path) => IGNORE_DIRS.test(path),
    awaitWriteFinish: { stabilityThreshold: 300 },
  });

  const emitFilesChanged = () => {
    if (filesDebounce) clearTimeout(filesDebounce);
    filesDebounce = setTimeout(() => {
      broadcast({ type: "files:changed" });
    }, 500);
  };

  projectWatcher
    .on("add", emitFilesChanged)
    .on("unlink", emitFilesChanged)
    .on("addDir", emitFilesChanged)
    .on("unlinkDir", emitFilesChanged);

  return wss;
}

export function broadcast(event: ServerEvent) {
  const msg = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

/**
 * Map an audit-trail entry to a typed WebSocket ServerEvent.
 * Returns null for audit events that don't have a WS counterpart.
 */
function mapAuditToWsEvent(entry: { event: string; data?: any }): ServerEvent | null {
  const { event, data } = entry;
  const d = data || {};

  switch (event) {
    // ── Agent lifecycle ──
    case "agent.task.started":
    case "runner.started":
      return { type: "agent:started", roleId: d.roleId || "", taskId: d.taskId || "", featureSlug: d.featureSlug || "" };

    case "runner.completed":
      if (d.taskId && d.roleId) {
        return { type: "agent:completed", roleId: d.roleId, taskId: d.taskId, result: d.result || d };
      }
      return null;

    case "agent.exhausted":
    case "runner.timeout":
      return { type: "agent:failed", roleId: d.roleId || "", taskId: d.taskId || "", error: d.error || event };

    case "agent.escalation":
      return { type: "agent:escalated", roleId: d.roleId || "", taskId: d.taskId || "", fromTier: d.fromTier || "", toTier: d.toTier || d.targetTier || "" };

    case "agent.created":
    case "agent.stopped":
    case "agent.revoked":
      return { type: "agent:updated", roleId: d.roleId || "", state: d };

    // ── Governance ──
    case "governance.blocked":
      return { type: "governance:approval_required", taskId: d.task || d.taskId || "", reason: d.reason || "", riskTier: d.riskTier || "" };

    case "approval.granted":
    case "governance.approved":
      return { type: "governance:approved", taskId: d.taskId || "", approvedBy: d.approvedBy || d.actor || "" };

    case "approval.denied":
    case "governance.denied":
      return { type: "governance:denied", taskId: d.taskId || "", deniedBy: d.deniedBy || d.actor || "", reason: d.reason || "" };

    case "approval.escalated":
    case "governance.escalated":
      return { type: "governance:escalated", taskId: d.taskId || "", escalatedTo: d.escalatedTo || d.targetRole || "" };

    // ── Task / Scheduler ──
    case "scheduler.dispatch":
    case "kadima.dispatch":
    case "task.allocated":
      return { type: "task:dispatched", taskId: d.taskId || "", roleId: d.roleId || "", model: d.model || "" };

    case "scheduler.dispatch_failed":
      return { type: "task:failed", taskId: d.taskId || "", roleId: d.roleId || "", error: d.error || "dispatch_failed" };

    // ── Waves ──
    case "wave.started":
    case "dag.execution.started":
      return { type: "wave:started", waveIndex: d.waveIndex ?? 0, taskCount: d.taskCount ?? d.totalTasks ?? 0 };

    case "wave.completed":
    case "dag.execution.completed":
      return { type: "wave:completed", waveIndex: d.waveIndex ?? 0, results: d.results || d };

    // ── Compile ──
    case "compile.started":
    case "compile.start":
      return { type: "compile:started", featureSlug: d.featureSlug || "" };

    case "gate.failed":
    case "compile.gates":
      return { type: "compile:gate", gate: d.gate || d.gateName || "", featureSlug: d.featureSlug || "", passed: event !== "gate.failed" };

    case "compile.complete":
    case "compile.completed":
      return { type: "compile:completed", featureSlug: d.featureSlug || "", passed: d.passed ?? d.success ?? true, errors: d.errors ?? d.failedGates ?? 0 };

    // ── Budget ──
    case "budget.recorded":
    case "tx.committed":
      return { type: "budget:updated", data: d };

    case "budget.exhausted":
      return { type: "budget:exhausted", dailyLimit: d.dailyLimit ?? 0, spent: d.spent ?? 0 };

    // ── Model routing ──
    case "model.routed":
      return { type: "model:routed", model: d.model || "", reason: d.reason || "", phase: d.phase || "" };

    // ── Org changes ──
    case "org.initialized":
      return { type: "org:changed", data: d };

    // ── Everything else → generic audit:event ──
    default:
      return { type: "audit:event", event: entry };
  }
}
