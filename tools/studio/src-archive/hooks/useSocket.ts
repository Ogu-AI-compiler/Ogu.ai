import { useEffect, useCallback, useRef } from "react";
import { useStore } from "@/lib/store";

type Handler = (event: any) => void;

// ── Singleton WebSocket connection ──
// One shared connection for the entire app. Built-in event handlers run exactly
// once per event (via the store). Components use `on()` for custom subscriptions.

let sharedWs: WebSocket | null = null;
let refCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const customHandlers = new Map<string, Set<Handler>>();

function getOrCreateWs(): WebSocket {
  if (sharedWs && sharedWs.readyState !== WebSocket.CLOSED && sharedWs.readyState !== WebSocket.CLOSING) {
    return sharedWs;
  }

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => {
    console.log("[ws] Connected");
  };

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      // ── Built-in handlers (run once via Zustand store) ──
      processEvent(event);
      // ── Custom per-component handlers ──
      const handlers = customHandlers.get(event.type);
      if (handlers) handlers.forEach((h) => h(event));
    } catch { /* ignore parse errors */ }
  };

  ws.onclose = () => {
    console.log("[ws] Disconnected");
    sharedWs = null;
    // Auto-reconnect if there are still subscribers
    if (refCount > 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (refCount > 0) getOrCreateWs();
      }, 2000);
    }
  };

  sharedWs = ws;
  return ws;
}

/** Process a single WS event — calls Zustand store actions exactly once. */
function processEvent(event: any) {
  const store = useStore.getState();

  if (event.type === "state:changed" && event.file === "GATE_STATE.json") {
    store.setGateState(event.data);
  }
  if (event.type === "theme:changed") {
    store.setThemeData(event.themeData);
  }
  if (event.type === "project:state_changed") {
    // Only apply if the event slug matches the active project (prevents cross-project overwrites)
    const activeSlug = store.activeProjectSlug;
    if (!event.slug || !activeSlug || event.slug === activeSlug) {
      store.setProjectUIState(event.state);
      if (event.state?.pendingProposal !== undefined) {
        store.setManifestProposal(event.state.pendingProposal);
      }
    }
  }
  if (event.type === "manifest:proposal") {
    store.setManifestProposal(event.proposal);
  }
  if (event.type === "manifest:applied" || event.type === "manifest:dismissed") {
    store.setManifestProposal(null);
  }
  if (event.type === "project:launch_progress") {
    store.updateLaunchStep(event.step, event.status);
  }
  if (event.type === "dispatch:started") {
    console.log(`[dispatch] Started: ${event.totalTasks} tasks in ${event.totalWaves} waves`);
  }
  if (event.type === "dispatch:completed") {
    console.log(`[dispatch] Done: ${event.completedCount} completed, ${event.failedCount} failed`);
  }
  if (event.type === "dispatch:error") {
    console.error(`[dispatch] Error: ${event.error}`);
    store.addActivityLine(`Dispatch error: ${event.error}`, "error");
  }
  // Task-level events → activity log
  if (event.type === "task:completed") {
    store.addActivityLine(`${event.title || event.taskId} completed`, "task");
  }
  if (event.type === "task:failed") {
    store.addActivityLine(`${event.title || event.taskId} failed`, "error");
  }
  if (event.type === "wave:started") {
    const waveNum = typeof event.waveIndex === "number" ? event.waveIndex + 1 : "?";
    store.addActivityLine(`Wave ${waveNum} started (${event.taskCount || 0} tasks)`, "dispatch");
  }
  if (event.type === "wave:completed") {
    const passed = event.results?.filter((r: any) => r.success).length || 0;
    const total = event.results?.length || 0;
    const waveNum = typeof event.waveIndex === "number" ? event.waveIndex + 1 : "?";
    store.addActivityLine(`Wave ${waveNum} done — ${passed}/${total} passed`, "dispatch");
  }
  if (event.type === "project:team_ready") {
    store.setTeamData(event.team);
    store.setLifecycleProjectId(event.lifecycleProjectId || event.slug);
    store.addActivityLine("Team assembled — review and approve to start build", "agent");
  }
  // Pipeline continuation events
  if (event.type === "compile:started") {
    if (!store.pipelineRunning) {
      store.addActivityLine("Pipeline gate execution started", "pipeline");
    }
    store.clearGateResults();
    store.setPipelineRunning(true);
  }
  if (event.type === "compile:gate") {
    store.addGateResult(event.gate, event.passed);
  }
  if (event.type === "compile:completed") {
    store.setPipelineRunning(false);
    if (event.passed) {
      store.setPipelineError(null);
      store.addActivityLine("Pipeline phase completed successfully", "pipeline");
    } else {
      store.setPipelineError(`Compilation failed with ${event.errors} error(s)`);
      store.addActivityLine("Pipeline phase failed — check gate results", "error");
    }
  }
  if (event.type === "pipeline:stopped") {
    store.setPipelineRunning(false);
    store.addActivityLine(`Pipeline stopped: ${event.reason || "review required"}`, "error");
  }
  if (event.type === "pipeline:completed") {
    store.setPipelineRunning(false);
    store.setPipelineError(null);
    store.addActivityLine("Pipeline completed successfully", "pipeline");
  }
  // CTO thinking lines → activity log
  if (event.type === "cto:thinking_line") {
    store.addActivityLine(event.text, "think");
  }
  // ── Allocation Kanban events ──
  if (event.type === "allocation:updated") {
    store.updateAllocation(event.taskId, { status: event.status as any, roleId: event.roleId });
  }
  if (event.type === "allocation:completed") {
    store.updateAllocation(event.taskId, { status: "done", completedAt: new Date().toISOString() });
  }
  // ── Governance Approval events ──
  if (event.type === "governance:pending") {
    store.addApproval(event.approval);
  }
  if (event.type === "governance:resolved") {
    store.resolveApproval(event.id);
  }
  if (event.type === "governance:approved") {
    store.resolveApproval(event.taskId);
  }
  if (event.type === "governance:denied") {
    store.resolveApproval(event.taskId);
  }
  // ── Agent Execution Monitor events ──
  if (event.type === "agent:status") {
    store.updateAgentStatus(event.roleId, { status: event.status as any, currentTask: event.currentTask });
  }
  if (event.type === "agent:log") {
    store.appendAgentLog(event.roleId, event.line);
  }
  if (event.type === "agent:task_complete") {
    store.updateAgentStatus(event.roleId, { currentTask: null, status: "idle" });
  }
  if (event.type === "agent:started") {
    store.updateAgentStatus(event.roleId, { currentTask: event.taskId, status: "executing" });
  }
  if (event.type === "agent:completed") {
    store.updateAgentStatus(event.roleId, { currentTask: null, status: "idle" });
  }
  if (event.type === "agent:failed") {
    store.updateAgentStatus(event.roleId, { status: "blocked" });
    store.appendAgentLog(event.roleId, `[ERROR] ${event.error || "Task failed"}`);
  }
}

/**
 * useSocket — hook that manages the shared singleton WebSocket connection.
 *
 * Built-in handlers (store updates, activity log) run exactly once per event
 * regardless of how many components call useSocket().
 *
 * Returns `on(type, handler)` for per-component custom event subscriptions.
 */
export function useSocket() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return; // strict-mode double-mount guard
    mountedRef.current = true;
    refCount++;
    getOrCreateWs();

    return () => {
      mountedRef.current = false;
      refCount--;
      if (refCount <= 0) {
        refCount = 0;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        if (sharedWs) { sharedWs.close(); sharedWs = null; }
      }
    };
  }, []);

  const on = useCallback((type: string, handler: Handler) => {
    if (!customHandlers.has(type)) customHandlers.set(type, new Set());
    customHandlers.get(type)!.add(handler);
    return () => { customHandlers.get(type)?.delete(handler); };
  }, []);

  return { on };
}
