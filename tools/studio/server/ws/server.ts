import { WebSocketServer, WebSocket } from "ws";
import { watch } from "chokidar";
import { readFileSync } from "fs";
import { join, basename } from "path";
import { randomUUID } from "node:crypto";
import type { Server } from "http";
import type { ServerEvent } from "./events.js";
import { getBudgetDir, getOguRoot, getStateDir } from "../../../ogu/commands/lib/runtime-paths.mjs";

// ── Phase 3B: Studio WebSocket infrastructure ──
import {
  createEventEnvelope,
  coalesceEvents,
  EVENT_PRIORITIES,
  createStudioEvent,
  isCriticalEvent,
  createEventStream,
  createEventBatcher,
  createEventReplayBuffer,
  createCursorStore,
  getMissedEvents,
  createStreamCursorManager,
} from "./events.js";

// Global event infrastructure for this WS server instance
// Cast to any because .mjs modules have no TypeScript declarations
const eventStream = (createEventStream as any)() as {
  publish: (e: { type: string; data: any }) => { seq: number; type: string; data: any; timestamp: number };
  subscribe: (cb: (e: any) => void) => () => void;
  getSequence: () => number;
  getHistory: (sinceSeq?: number) => any[];
};
const replayBuffer = (createEventReplayBuffer as any)({ maxSize: 5000 }) as {
  append: (event: any) => void;
  replaySince: (lastSeq: number) => any[];
  size: () => number;
  getLatestSeq: () => number;
};
const cursorManager = (createStreamCursorManager as any)() as {
  setCursor: (clientId: string, streamKey: string, seq: number) => void;
  getCursor: (clientId: string, streamKey: string) => number;
  getAllCursors: (clientId: string) => Record<string, number>;
  removeCursors: (clientId: string) => void;
  listClients: () => string[];
};

function normalizePayload(payload: any): Record<string, any> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) return payload;
  return { payload };
}

function flattenEnvelope(envelope: any): Record<string, any> {
  const payload = normalizePayload(envelope?.payload);
  return {
    ...payload,
    type: envelope?.type || "event",
    id: envelope?.id,
    streamKey: envelope?.streamKey,
    timestamp: envelope?.timestamp,
  };
}

function publishEvent(event: any, streamKeyOverride?: string) {
  const enriched = { ...event };
  if (!enriched.type) enriched.type = "event";
  if (!enriched.id) enriched.id = randomUUID();
  const streamKey = streamKeyOverride || enriched.streamKey || getStreamKey(enriched.type);
  enriched.streamKey = streamKey;
  const published = eventStream.publish({ type: enriched.type, data: enriched });
  enriched.seq = published.seq;
  if (!enriched.timestamp) enriched.timestamp = new Date(published.timestamp).toISOString();
  replayBuffer.append(enriched);
  return enriched;
}

const eventBatcher = (createEventBatcher as any)({
  batchIntervalMs: 80,
  criticalTypes: ["GOV_BLOCKED", "INTENT_STATE", "SNAPSHOT_AVAILABLE"],
  coalesceTypes: ["budget:updated", "kadima:status", "files:changed"],
  onCritical: (event: any) => {
    const enriched = publishEvent(event, event?.streamKey);
    broadcastRaw(enriched);
  },
}) as {
  push: (event: any) => void;
  flush: () => any[];
  getPendingCount: () => number;
  batchIntervalMs: number;
};

// Flush batcher on interval
setInterval(() => {
  const batch = eventBatcher.flush();
  if (batch.length > 0) {
    const coalesced = coalesceEvents(
      batch.map((e: any) => createEventEnvelope({ type: e.type, streamKey: e.streamKey || "default", payload: e, priority: "normal" }))
    );
    for (const envelope of coalesced) {
      broadcastEnvelope(envelope);
    }
  }
}, 80);

/** Broadcast a raw object to all connected clients */
function broadcastRaw(payload: unknown) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

/** Broadcast a structured event envelope to all clients */
function broadcastEnvelope(envelope: any) {
  const flattened = flattenEnvelope(envelope);
  const enriched = publishEvent(flattened, envelope?.streamKey);
  broadcastRaw(enriched);
}

/** Send missed events since lastSeq to a specific WebSocket client */
function replayMissedEvents(ws: WebSocket, clientId: string, lastSeq: number) {
  const missed = replayBuffer.replaySince(lastSeq);
  for (const event of missed) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "replay", event }));
    }
  }
}

const clients = new Set<WebSocket>();
const WS_DEBUG = process.env.OGU_WS_DEBUG === "1";
const WATCH_ROOT = process.env.OGU_WS_WATCH_ROOT !== "0";
const WATCH_DEPTH = Math.max(1, parseInt(process.env.OGU_WS_WATCH_DEPTH || "2", 10));

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);

    // Assign a cursor-tracking client ID
    const clientId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    ws.on("close", () => {
      clients.delete(ws);
      cursorManager.removeCursors(clientId);
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        } else if (msg.type === "subscribe") {
          // Client subscribing to specific channels — record cursor per stream
          const channels: string[] = Array.isArray(msg.channels) ? msg.channels : [];
          const lastSeq: number = typeof msg.lastSeq === "number" ? msg.lastSeq : 0;
          for (const ch of channels) {
            cursorManager.setCursor(clientId, ch, lastSeq);
          }
          // Replay any missed events since lastSeq
          if (lastSeq > 0) {
            replayMissedEvents(ws, clientId, lastSeq);
          }
        } else if (msg.type === "cursor:update") {
          // Client acknowledges receipt of events up to seq
          const { streamKey, seq } = msg;
          if (streamKey && typeof seq === "number") {
            cursorManager.setCursor(clientId, streamKey, seq);
          }
        }
      } catch { /* ignore malformed */ }
    });
  });

  // Watch .ogu/ directory for changes
  const root = process.env.OGU_ROOT || process.cwd();
  const oguDir = getOguRoot(root);

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

  // NOTE: Audit file watcher DISABLED — events are already broadcast directly
  // by brief.ts, dispatch.ts, etc. The audit watcher was causing every event
  // to appear twice (once direct, once via audit file → mapAuditToWsEvent).
  // If we need audit-only events in the future, add a dedup layer first.

  // Watch scheduler + budget state for status updates
  const stateWatcher = watch([
    join(getStateDir(root), "scheduler-state.json"),
    join(getBudgetDir(root), "budget-state.json"),
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
  if (WATCH_ROOT) {
    let filesDebounce: ReturnType<typeof setTimeout> | null = null;
    const IGNORE_DIRS = /node_modules|\.git|dist|\.ogu|\.claude/;

    const projectWatcher = watch(root, {
      ignoreInitial: true,
      depth: WATCH_DEPTH,
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
  }

  return wss;
}

export function broadcast(event: ServerEvent) {
  const enriched = publishEvent(event, (event as any)?.streamKey);
  if (WS_DEBUG) {
    console.log(`[ws:broadcast] type=${enriched.type} seq=${enriched.seq} clients=${clients.size} text=${(enriched as any).text?.slice(0, 40) || (enriched as any).label || ""}`);
  }

  // Send raw event immediately to all clients (no envelope wrapping)
  broadcastRaw(enriched);
}

/** Map event type to stream key for cursor tracking */
function getStreamKey(type: string): string {
  if (type.startsWith("budget")) return "budget";
  if (type.startsWith("agent")) return "agents";
  if (type.startsWith("task")) return "tasks";
  if (type.startsWith("audit")) return "audit";
  if (type.startsWith("governance")) return "governance";
  if (type.startsWith("compile")) return "compile";
  if (type.startsWith("wave")) return "waves";
  if (type.startsWith("kadima")) return "kadima";
  if (type.startsWith("project")) return "project";
  if (type.startsWith("manifest")) return "manifest";
  if (type.startsWith("allocation")) return "allocation";
  if (type.startsWith("dispatch")) return "dispatch";
  return "default";
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
