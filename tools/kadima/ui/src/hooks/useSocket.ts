import { useEffect, useCallback, useRef } from "react";
import { useStore } from "@/store";

type Handler = (event: any) => void;

let sharedEs: EventSource | null = null;
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

function handleRawMessage(data: string) {
  try {
    const raw = JSON.parse(data);
    // Kadima SSE wraps events as { type, payload, feature }
    // Merge: type from the wrapper, fields from payload (payload may not have type)
    const event = raw?.payload
      ? { type: raw.type, ...raw.payload }
      : raw;
    if (!event || !event.type) return;
    if (isDuplicateEvent(event)) return;
    processEvent(event);
    const handlers = customHandlers.get(event.type);
    if (handlers) handlers.forEach((h) => h(event));
  } catch {}
}

function getOrCreateEs(): EventSource {
  if (sharedEs && sharedEs.readyState !== EventSource.CLOSED) {
    return sharedEs;
  }

  const es = new EventSource("/api/events");

  es.onopen = () => { console.log("[sse] Connected to Kadima"); };

  // Kadima broadcasts typed events — listen for the generic "message" event
  // (Kadima broadcaster sends `data: {...}` without an event: line, so type=message)
  es.onmessage = (e) => { handleRawMessage(e.data); };

  // Also listen for named events Kadima may send
  const KADIMA_EVENT_TYPES = [
    "cto:thinking_line", "cto:agent_found", "cto:task_dispatched",
    "project:launch_progress", "project:team_ready", "project:state_changed",
    "compiler:started", "compiler:stage_start", "compiler:artifact", "compiler:completed",
    "dispatch:started", "dispatch:completed", "dispatch:aborted", "dispatch:paused",
    "dispatch:resumed", "dispatch:retrying", "dispatch:retry_done", "dispatch:error",
    "task:completed", "task:failed", "task:enqueued", "task:cancelled",
    "wave:started", "wave:completed",
    "agent:started", "agent:completed", "agent:failed", "agent:fixing",
    "agent:status", "agent:log", "agent:task_complete",
    "compile:started", "compile:gate", "compile:completed",
    "pipeline:stopped", "pipeline:completed",
    "build:complete",
    "state:changed", "theme:changed",
    "manifest:proposal", "manifest:applied", "manifest:dismissed",
    "budget:updated", "budget:alert",
    "governance:pending", "governance:resolved", "governance:approved", "governance:denied",
    "allocation:updated", "allocation:completed",
    "files:changed",
    "execution:task.started", "execution:task.completed", "execution:task.failed",
    "execution:retry.started", "execution:gate.checking", "execution:gate.passed", "execution:gate.failed",
    "command:output", "command:complete", "command:completed",
  ];

  for (const eventType of KADIMA_EVENT_TYPES) {
    es.addEventListener(eventType, (e: MessageEvent) => { handleRawMessage(e.data); });
  }

  es.onerror = () => {
    console.log("[sse] Disconnected — reconnecting...");
    es.close();
    sharedEs = null;
    if (refCount > 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => { if (refCount > 0) getOrCreateEs(); }, 2000);
    }
  };

  sharedEs = es;
  return es;
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
      const pct = event.state?.progress?.percentage ?? 0;
      const allDone = pct === 100;
      const currentStage = store.currentStage;
      if (allDone && (currentStage === "brief" || currentStage === "cto" || currentStage === "team" || currentStage === "planning")) {
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
    const passed = typeof event.passed === "number"
      ? event.passed
      : (event.results?.filter((r: any) => r.success).length || 0);
    const total = typeof event.total === "number"
      ? event.total
      : (event.results?.length || 0);
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
  if (event.type === "dispatch:retrying") {
    store.addActivityLine("Retrying failed tasks...", "pipeline");
  }
  if (event.type === "dispatch:retry_done") {
    if ((event.retried || 0) > 0) {
      store.addActivityLine(`Retry complete: ${event.retried} task(s) retried`, "pipeline");
    } else if (Array.isArray(event.errors) && event.errors.length > 0) {
      store.addActivityLine(`Retry skipped: ${event.errors.join("; ")}`, "pipeline");
    }
  }
  if (event.type === "build:complete") {
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
    getOrCreateEs();

    return () => {
      mountedRef.current = false;
      refCount--;
      if (refCount <= 0) {
        refCount = 0;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        if (sharedEs) {
          sharedEs.onerror = null;
          sharedEs.close();
          sharedEs = null;
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
