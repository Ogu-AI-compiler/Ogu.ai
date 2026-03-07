import { useEffect, useCallback, useRef } from "react";
import { useStore } from "@/store";

type Handler = (event: any) => void;

let sharedWs: WebSocket | null = null;
let refCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const customHandlers = new Map<string, Set<Handler>>();

// ── Client-side event dedup (prefer server-issued id/seq) ──
const recentEventIds = new Map<string, number>();
const recentEventSeqs = new Map<number, number>();
const RECENT_TTL_MS = 5000;
const RECENT_MAX = 2000;

function pruneRecent(map: Map<any, number>, now: number) {
  if (map.size <= RECENT_MAX) return;
  for (const [k, ts] of map) {
    if (now - ts > RECENT_TTL_MS) map.delete(k);
  }
}

function eventFingerprint(event: any): string {
  const t = event.type || "";
  const id = event.taskId || event.slug || event.gate || (event.waveIndex ?? "");
  const text = event.text || event.title || event.label || "";
  return `${t}:${id}:${text}`;
}

function isDuplicateEvent(event: any): boolean {
  if (event.type === "pong") return false;
  const now = Date.now();

  if (typeof event.id === "string" && event.id.length > 0) {
    if (recentEventIds.has(event.id)) return true;
    recentEventIds.set(event.id, now);
    pruneRecent(recentEventIds, now);
    return false;
  }

  if (typeof event.seq === "number") {
    if (recentEventSeqs.has(event.seq)) return true;
    recentEventSeqs.set(event.seq, now);
    pruneRecent(recentEventSeqs, now);
    return false;
  }

  const fp = eventFingerprint(event);
  if (recentEventIds.has(fp)) return true;
  recentEventIds.set(fp, now);
  pruneRecent(recentEventIds, now);
  return false;
}

function getOrCreateWs(): WebSocket {
  if (sharedWs && sharedWs.readyState !== WebSocket.CLOSED && sharedWs.readyState !== WebSocket.CLOSING) {
    return sharedWs;
  }

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => { console.log("[ws] Connected"); };

  ws.onmessage = (e) => {
    try {
      const raw = JSON.parse(e.data);
      const event = raw?.type === "replay" && raw.event ? raw.event : raw;
      if (isDuplicateEvent(event)) return;
      processEvent(event);
      const handlers = customHandlers.get(event.type);
      if (handlers) handlers.forEach((h) => h(event));
    } catch {}
  };

  ws.onclose = () => {
    console.log("[ws] Disconnected");
    sharedWs = null;
    if (refCount > 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => { if (refCount > 0) getOrCreateWs(); }, 2000);
    }
  };

  sharedWs = ws;
  return ws;
}

function processEvent(event: any) {
  const store = useStore.getState();

  if (event.type === "state:changed" && event.file === "GATE_STATE.json") {
    store.setGateState(event.data);
  }
  if (event.type === "theme:changed") {
    store.setThemeData(event.themeData);
  }
  if (event.type === "project:state_changed") {
    const activeSlug = store.activeProjectSlug;
    if (!event.slug || !activeSlug || event.slug === activeSlug) {
      store.setProjectUIState(event.state);
      if (event.state?.team) {
        const approved = event.state.team.approved || event.state.team.approved_at;
        store.setTeamApproved(!!approved);
      }
      if (event.state?.pendingProposal !== undefined) {
        store.setManifestProposal(event.state.pendingProposal);
      }
      // Restore correct stage based on actual project state (survives server restarts)
      const pct = event.state?.progress?.percentage ?? 0;
      const allDone = pct === 100;
      const currentStage = store.currentStage;
      if (allDone && (currentStage === "brief" || currentStage === "cto" || currentStage === "team" || currentStage === "planning")) {
        // Tasks all done — user should be at verification or execution
        store.setCurrentStage(store.pipelineRunning ? "verification" : "execution");
      }
    }
  }
  if (event.type === "manifest:proposal") store.setManifestProposal(event.proposal);
  if (event.type === "manifest:applied" || event.type === "manifest:dismissed") store.setManifestProposal(null);
  if (event.type === "project:launch_progress") store.updateLaunchStep(event.step, event.status);

  // Task events
  if (event.type === "task:completed") {
    store.addActivityLine(`${event.title || event.taskId} completed`, "task");
    store.setDispatchProgress({ completedTasks: (store.dispatchProgress.completedTasks || 0) + 1 });
  }
  if (event.type === "task:failed") {
    store.addActivityLine(`${event.title || event.taskId} failed`, "error");
    store.setDispatchProgress({ failedTasks: (store.dispatchProgress.failedTasks || 0) + 1 });
  }

  // Wave events
  if (event.type === "wave:started") {
    const waveNum = typeof event.waveIndex === "number" ? event.waveIndex + 1 : "?";
    store.setDispatchProgress({ currentWave: typeof event.waveIndex === "number" ? event.waveIndex + 1 : store.dispatchProgress.currentWave });
    store.addActivityLine(`Wave ${waveNum} started (${event.taskCount || 0} tasks)`, "dispatch");
  }
  if (event.type === "wave:completed") {
    const passed = event.results?.filter((r: any) => r.success).length || 0;
    const total = event.results?.length || 0;
    const waveNum = typeof event.waveIndex === "number" ? event.waveIndex + 1 : "?";
    store.addActivityLine(`Wave ${waveNum} done — ${passed}/${total} passed`, "dispatch");
  }

  // Team ready
  if (event.type === "project:team_ready") {
    store.setTeamData(event.team);
    store.setLifecycleProjectId(event.lifecycleProjectId || event.slug);
    store.addActivityLine("Team assembled — review and approve to start build", "agent");
    store.setCurrentStage("team");
  }

  // Pipeline events
  if (event.type === "agent:fixing") {
    store.setFixingAgents(event.agentNames, event.taskTitles);
  }
  if (event.type === "compile:started") {
    store.clearGateResults();
    store.clearFixingAgents();
    store.setPipelineRunning(true);
    // Stay on verification screen while gates run
    if (store.currentStage !== "verification") store.setCurrentStage("verification");
    store.addActivityLine("Running 14 quality gates...", "pipeline");
  }
  if (event.type === "compile:gate") store.addGateResult(event.gate, event.passed);
  if (event.type === "compile:completed") {
    store.setPipelineRunning(false);
    if (event.passed) {
      store.setPipelineError(null);
      store.setCurrentStage("done");
      store.addActivityLine("Pipeline completed successfully", "pipeline");
    } else {
      store.setPipelineError(event.errorMessage || `Compilation failed with ${event.errors} error(s)`);
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
    store.setCurrentStage("done");
    store.addActivityLine("Pipeline completed successfully", "pipeline");
  }

  // CTO thinking
  if (event.type === "cto:thinking_line") store.addActivityLine(event.text, "think");

  // Compiler progressive events
  if (event.type === "compiler:started") store.addActivityLine("Compiler pipeline started", "pipeline");
  if (event.type === "compiler:stage_start") store.addActivityLine(`Pass ${event.stage}/${event.total}: ${event.label}`, "pipeline");
  if (event.type === "compiler:artifact") store.addActivityLine(`Artifact written: ${event.artifact}`, "pipeline");
  if (event.type === "compiler:completed") store.addActivityLine(`Compilation done — ${event.artifacts?.length || 0} artifacts`, "pipeline");

  // CTO progressive reveal
  if (event.type === "cto:agent_found") store.addActivityLine(`Agent joined: ${event.agentName} (${event.group})`, "agent");
  if (event.type === "cto:task_dispatched") store.addActivityLine(`Task queued: ${event.title}`, "task");

  // Launch progress
  if (event.type === "project:launch_progress" && event.status === "complete") {
    store.addActivityLine(`${event.step} phase complete`, "dispatch");
  }

  // Agent execution details
  if (event.type === "agent:started") {
    store.addActivityLine(`${event.roleId || "Agent"} started: ${event.taskId || "task"}`, "agent");
  }
  if (event.type === "agent:completed" || event.type === "agent:task_complete") {
    store.addActivityLine(`${event.roleId || "Agent"} finished task`, "agent");
  }
  if (event.type === "agent:failed") {
    store.addActivityLine(`${event.roleId || "Agent"} failed: ${event.error || "unknown"}`, "error");
  }

  // File system changes
  if (event.type === "files:changed") {
    const files = event.files || event.paths || [];
    if (files.length > 0) {
      const short = files.slice(0, 2).map((f: string) => f.split("/").pop()).join(", ");
      const extra = files.length > 2 ? ` +${files.length - 2} more` : "";
      store.addActivityLine(`Files written: ${short}${extra}`, "task");
    }
  }

  // Budget updates
  if (event.type === "budget:updated") {
    const spent = event.data?.spent ?? event.spent;
    if (typeof spent === "number") store.addActivityLine(`Budget: $${spent.toFixed(2)} spent`, "think");
  }
  if (event.type === "budget:alert") store.addActivityLine(`Budget warning: ${event.message || "threshold reached"}`, "error");

  // Execution events (granular)
  if (event.type === "execution:task.started") store.addActivityLine(`Executing: ${event.title || event.taskId}`, "agent");
  if (event.type === "execution:task.completed") store.addActivityLine(`Done: ${event.title || event.taskId}`, "task");
  if (event.type === "execution:task.failed") store.addActivityLine(`Failed: ${event.title || event.taskId}`, "error");
  if (event.type === "execution:retry.started") store.addActivityLine(`Retrying: ${event.title || event.taskId} (attempt ${event.attempt || "?"})`, "agent");
  if (event.type === "execution:gate.checking") store.addActivityLine(`Checking gate: ${event.gate}`, "pipeline");
  if (event.type === "execution:gate.passed") store.addActivityLine(`Gate passed: ${event.gate}`, "pipeline");
  if (event.type === "execution:gate.failed") store.addActivityLine(`Gate failed: ${event.gate}`, "error");

  // Dispatch events → auto-advance stage + track progress
  if (event.type === "dispatch:started") {
    store.setCurrentStage("execution");
    store.setExecutionStatus("running");
    store.setDispatchProgress({
      totalWaves: event.totalWaves || 0,
      totalTasks: event.totalTasks || 0,
      currentWave: 0,
      completedTasks: 0,
      failedTasks: 0,
    });
    store.addActivityLine(`Build started: ${event.totalTasks} tasks in ${event.totalWaves} waves`, "dispatch");
  }
  if (event.type === "dispatch:completed") {
    store.setDispatchProgress({
      completedTasks: event.completedCount || 0,
      failedTasks: event.failedCount || 0,
    });
    store.addActivityLine(`Build done: ${event.completedCount} completed, ${event.failedCount} failed`, "dispatch");
    store.setExecutionStatus("idle");
  }
  if (event.type === "dispatch:aborted") {
    store.setExecutionStatus("aborted");
    store.addActivityLine("Execution aborted", "error");
  }
  if (event.type === "dispatch:paused") {
    store.setExecutionStatus("paused");
    store.addActivityLine("Execution paused", "pipeline");
  }
  if (event.type === "dispatch:resumed") {
    store.setExecutionStatus("running");
    store.addActivityLine("Execution resumed", "pipeline");
  }
  if (event.type === "build:complete") {
    // All tasks done — FSM is now at "verifying" (Ready for Verification).
    // Do NOT set stage to "done". User must trigger the 14 gates from Verification screen.
    store.setCurrentStage("verification");
    store.addActivityLine("Build complete — ready for verification", "pipeline");
  }
  if (event.type === "dispatch:error") store.addActivityLine(`Dispatch error: ${event.error}`, "error");

  // Allocation events
  if (event.type === "allocation:updated") store.updateAllocation(event.taskId, { status: event.status as any, roleId: event.roleId });
  if (event.type === "allocation:completed") store.updateAllocation(event.taskId, { status: "done", completedAt: new Date().toISOString() });

  // Governance events
  if (event.type === "governance:pending") store.addApproval(event.approval);
  if (event.type === "governance:resolved" || event.type === "governance:approved") store.resolveApproval(event.taskId || event.id);
  if (event.type === "governance:denied") store.resolveApproval(event.taskId);

  // Agent events
  if (event.type === "agent:status") store.updateAgentStatus(event.roleId, { status: event.status as any, currentTask: event.currentTask });
  if (event.type === "agent:log") store.appendAgentLog(event.roleId, event.line);
  if (event.type === "agent:started") store.updateAgentStatus(event.roleId, { currentTask: event.taskId, status: "executing" });
  if (event.type === "agent:completed" || event.type === "agent:task_complete") store.updateAgentStatus(event.roleId, { currentTask: null, status: "idle" });
  if (event.type === "agent:failed") {
    store.updateAgentStatus(event.roleId, { status: "blocked" });
    store.appendAgentLog(event.roleId, `[ERROR] ${event.error || "Task failed"}`);
  }
}

export function useSocket() {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    refCount++;
    getOrCreateWs();

    return () => {
      mountedRef.current = false;
      refCount--;
      if (refCount <= 0) {
        refCount = 0;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        if (sharedWs) {
          sharedWs.onmessage = null; // prevent stale messages during close
          sharedWs.close();
          sharedWs = null;
        }
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
