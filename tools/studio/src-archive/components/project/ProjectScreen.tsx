import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
import { useSocket } from "@/hooks/useSocket";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { TaskGraph } from "./TaskGraph";
import { TeamReviewPanel } from "./TeamReviewPanel";

// ── Lightweight Markdown renderer for CTO chat ──

function MiniMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={elements.length} className="rounded-md my-1 px-2 py-1.5 overflow-x-auto" style={{ backgroundColor: "rgba(0,0,0,0.3)", fontSize: 11, lineHeight: 1.5, fontFamily: "var(--font-mono)" }}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(<div key={elements.length} className="font-bold mt-2 mb-0.5" style={{ fontSize: 13, color: "var(--color-text)" }}>{inlineFormat(line.slice(4))}</div>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<div key={elements.length} className="font-bold mt-2.5 mb-0.5" style={{ fontSize: 14, color: "var(--color-text)" }}>{inlineFormat(line.slice(3))}</div>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<div key={elements.length} className="font-bold mt-2.5 mb-1" style={{ fontSize: 15, color: "var(--color-text)" }}>{inlineFormat(line.slice(2))}</div>);
      i++; continue;
    }

    // Bullet list
    if (/^[\-\*]\s/.test(line)) {
      elements.push(<div key={elements.length} className="flex gap-1.5 ml-1"><span style={{ color: "var(--color-accent)", opacity: 0.6 }}>•</span><span>{inlineFormat(line.slice(2))}</span></div>);
      i++; continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      const rest = line.replace(/^\d+\.\s*/, "");
      elements.push(<div key={elements.length} className="flex gap-1.5 ml-1"><span style={{ color: "var(--color-accent)", opacity: 0.6, minWidth: 12 }}>{num}.</span><span>{inlineFormat(rest)}</span></div>);
      i++; continue;
    }

    // Empty line = spacing
    if (line.trim() === "") {
      elements.push(<div key={elements.length} className="h-1.5" />);
      i++; continue;
    }

    // Regular paragraph
    elements.push(<div key={elements.length}>{inlineFormat(line)}</div>);
    i++;
  }

  return <>{elements}</>;
}

/** Format inline markdown: **bold**, *italic*, `code`, [links] */
function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Regex: code, bold, italic, links
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    const m = match[0];
    if (m.startsWith("`")) {
      parts.push(<code key={parts.length} className="rounded px-1 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.3)", fontFamily: "var(--font-mono)", fontSize: "0.9em" }}>{m.slice(1, -1)}</code>);
    } else if (m.startsWith("**")) {
      parts.push(<strong key={parts.length} style={{ color: "var(--color-text)", fontWeight: 600 }}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("*") || m.startsWith("_")) {
      parts.push(<em key={parts.length}>{m.slice(1, -1)}</em>);
    } else if (m.startsWith("[")) {
      const linkMatch = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) parts.push(<span key={parts.length} style={{ color: "var(--color-accent)", textDecoration: "underline" }}>{linkMatch[1]}</span>);
    }
    lastIdx = match.index + m.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ── Constants ──

const LAUNCH_IDS = ["brief", "setup", "cto"];

const PHASE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  feature: "Feature",
  architect: "Architect",
  design: "Design",
  preflight: "Preflight",
  lock: "Lock",
  building: "Building",
  verifying: "Verifying",
  enforcing: "Enforcing",
  previewing: "Preview",
  done: "Done",
  observing: "Observing",
};

const DEFAULT_AGENTS: Record<string, { name: string; emoji: string }> = {
  setup: { name: "Ogu-Ops", emoji: "\uD83D\uDD27" },
  core: { name: "Ogu-Dev", emoji: "\uD83D\uDCBB" },
  ui: { name: "Ogu-Design", emoji: "\uD83C\uDFA8" },
  integration: { name: "Ogu-Link", emoji: "\uD83D\uDD0C" },
  polish: { name: "Ogu-QA", emoji: "\u2728" },
};

const GROUP_COLORS: Record<string, string> = {
  setup: "#4ade80",
  core: "#818cf8",
  ui: "#f472b6",
  integration: "#fb923c",
  polish: "#a78bfa",
};

const GROUP_MODELS: Record<string, string> = {
  setup: "haiku",
  core: "sonnet",
  ui: "sonnet",
  integration: "sonnet",
  polish: "haiku",
};

const GROUP_ORDER = ["setup", "core", "ui", "integration", "polish"];

// ── Agent Group Icon (inline SVG per group) ──

function AgentGroupIcon({ group, color }: { group: string; color: string }) {
  const s = { stroke: color, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  switch (group) {
    case "setup":
      return <g {...s}><rect x={2} y={2} width={12} height={12} rx={2} /><path d="M5 7l2 2-2 2" /><line x1={9} y1={11} x2={11} y2={11} /></g>;
    case "core":
      return <g {...s}><path d="M6 3L2 8l4 5" /><path d="M10 3l4 5-4 5" /></g>;
    case "ui":
      return <g {...s}><path d="M12 2L4 10l-1 4 4-1 8-8z" /><path d="M9 5l2 2" /></g>;
    case "integration":
      return <g {...s}><path d="M9 7l-2 2" /><path d="M5 7a3 3 0 0 1 0-4h0a3 3 0 0 1 4 0" /><path d="M11 9a3 3 0 0 1 0 4h0a3 3 0 0 1-4 0" /></g>;
    case "polish":
      return <g {...s}><path d="M8 1.5L2 4.5v3.5c0 3.5 2.5 6 6 7.5 3.5-1.5 6-4 6-7.5V4.5z" /><path d="M5.5 8.5l2 2L11 7" /></g>;
    default:
      return <g {...s}><circle cx={8} cy={8} r={5} /></g>;
  }
}

// CTO thinking messages — all driven by real server events now (no fake timers)

function useCTOThinking(ctoActive: boolean, tasks: any[], wsOn: (type: string, handler: (e: any) => void) => () => void) {
  const [lines, setLines] = useState<Array<{ text: string; type: "think" | "agent" | "dispatch" }>>([]);
  const [phase, setPhase] = useState<"idle" | "thinking" | "assigning" | "done">("idle");
  const [revealedAgents, setRevealedAgents] = useState<Set<string>>(new Set());
  const [revealedTasks, setRevealedTasks] = useState<Set<string>>(new Set());
  // Live tasks built from WS events — used before Plan.json is fetched
  const [liveTasks, setLiveTasks] = useState<Array<{ id: string; title: string; group: string; dependsOn?: string[] }>>([]);

  const prevCtoRef = useRef(false);

  // CTO becomes active → enter thinking phase (messages come from server)
  useEffect(() => {
    if (ctoActive && !prevCtoRef.current) {
      setPhase("thinking");
      setLines([]);
      setRevealedAgents(new Set());
      setRevealedTasks(new Set());
      setLiveTasks([]);
    }
    prevCtoRef.current = ctoActive;
  }, [ctoActive]);

  // Listen for live WebSocket events from the server
  useEffect(() => {
    // Server sends a thinking line (e.g. "Plan generated — dispatching agents...")
    const offThink = wsOn("cto:thinking_line", (e) => {
      setLines((prev) => [...prev, { text: e.text, type: "think" }]);
    });

    // Server reveals an agent
    const offAgent = wsOn("cto:agent_found", (e) => {
      setPhase("assigning");
      const agent = DEFAULT_AGENTS[e.group] || DEFAULT_AGENTS.core;
      setLines((prev) => [
        ...prev,
        { text: `${agent.emoji} ${e.agentName || agent.name} ready`, type: "agent" },
      ]);
      setRevealedAgents((prev) => new Set([...prev, e.agentName || agent.name]));
    });

    // Server dispatches a task — also build a live task entry for the canvas
    const offTask = wsOn("cto:task_dispatched", (e) => {
      const agent = DEFAULT_AGENTS[e.group] || DEFAULT_AGENTS.core;
      setLines((prev) => [
        ...prev,
        { text: `\u279C ${agent.emoji} ${agent.name}: "${e.title}"`, type: "dispatch" },
      ]);
      setRevealedTasks((prev) => new Set([...prev, e.taskId]));
      setLiveTasks((prev) => {
        if (prev.some((t) => t.id === e.taskId)) return prev;
        return [...prev, { id: e.taskId, title: e.title, group: e.group || "core", dependsOn: e.dependsOn }];
      });
    });

    // CTO step completes → show all
    const offComplete = wsOn("project:launch_progress", (e) => {
      if (e.step === "cto" && e.status === "complete") {
        // Small delay to let last animations play
        setTimeout(() => setPhase("done"), 800);
      }
    });

    return () => { offThink(); offAgent(); offTask(); offComplete(); };
  }, [wsOn]);

  // If tasks already exist on mount (page reload), skip animations
  useEffect(() => {
    if (tasks.length > 0 && phase === "idle") {
      setPhase("done");
    }
  }, [tasks, phase]);

  return { lines, phase, revealedAgents, revealedTasks, liveTasks };
}

// ── Phase labels for continuation ──

const NEXT_PHASE_LABEL: Record<string, string> = {
  architect: "Design",
  design: "Preflight",
  preflight: "Lock",
  lock: "Build",
  building: "Verify",
  verifying: "Enforce",
  enforcing: "Preview",
  previewing: "Compile",
};

const TOTAL_GATES = 14;

// ── Pipeline Progress (inline in Activity panel) ──

function PipelineProgress({ slug, phase, canContinue }: { slug: string; phase: string; canContinue: boolean }) {
  const pipelineRunning = useStore((s) => s.pipelineRunning);
  const gateResults = useStore((s) => s.gateResults);
  const pipelineError = useStore((s) => s.pipelineError);
  const clearGateResults = useStore((s) => s.clearGateResults);
  const setPipelineRunning = useStore((s) => s.setPipelineRunning);

  const showContinue = canContinue && !pipelineRunning && !pipelineError;
  if (!pipelineRunning && !pipelineError && gateResults.length === 0 && !showContinue) return null;

  const handleContinue = async () => {
    setPipelineRunning(true);
    clearGateResults();
    try {
      await api.continueProject(slug);
    } catch {
      // Server rejected (409 = already running, or other error) — reset
      setPipelineRunning(false);
    }
  };

  return (
    <div className="py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Phase separator */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent, var(--accent))" }}>
          {pipelineRunning ? `Advancing to ${NEXT_PHASE_LABEL[phase] || "next"}` : pipelineError ? "Pipeline Error" : showContinue ? "Ready to Continue" : `${PHASE_LABELS[phase] || phase} Complete`}
        </span>
        {pipelineRunning && (
          <span className="letter-shimmer text-[8px]">running</span>
        )}
      </div>

      {/* Gate squares */}
      {(pipelineRunning || gateResults.length > 0) && (
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {Array.from({ length: TOTAL_GATES }).map((_, i) => {
            const result = gateResults[i];
            let bg = "rgba(255,255,255,0.08)";
            if (result) bg = result.passed ? "#4ade80" : "#ef4444";
            return (
              <span
                key={i}
                className="inline-block rounded-sm transition-colors"
                style={{ width: 8, height: 8, backgroundColor: bg }}
              />
            );
          })}
          <span className="text-[8px] ml-1" style={{ color: "var(--color-text-muted)" }}>
            {gateResults.length}/{TOTAL_GATES}
          </span>
        </div>
      )}

      {/* Gate results log */}
      <div className="flex flex-col gap-0.5 pl-1">
        {gateResults.map((g, i) => (
          <span key={i} className="text-[9px] font-mono" style={{ color: g.passed ? "#4ade80" : "#ef4444" }}>
            {g.passed ? "\u2713" : "\u2717"} {g.gate}
          </span>
        ))}
      </div>

      {/* Continue button — visible when tasks are done and pipeline not running */}
      {showContinue && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>
            All tasks complete — run quality gates
          </span>
          <button
            onClick={handleContinue}
            className="px-3 py-1 rounded text-[9px] font-semibold cursor-pointer"
            style={{ backgroundColor: "var(--color-accent, #818cf8)", color: "var(--color-accent-text)", border: "none" }}
          >
            Continue
          </button>
        </div>
      )}

      {/* Error + retry */}
      {pipelineError && !pipelineRunning && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px]" style={{ color: "#fca5a5" }}>{pipelineError}</span>
          <button
            onClick={handleContinue}
            className="px-2 py-0.5 rounded text-[9px] font-semibold cursor-pointer"
            style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// ── Persistent Activity Log (shows dispatch/pipeline progress after CTO phase) ──

const ACTIVITY_TYPE_STYLES: Record<string, { color: string; prefix: string }> = {
  think: { color: "var(--color-text-muted, var(--text-muted))", prefix: "\u25B6" },
  agent: { color: "#4ade80", prefix: "\u2713" },
  dispatch: { color: "var(--color-accent, var(--accent))", prefix: "\u25B6" },
  task: { color: "#4ade80", prefix: "\u2713" },
  pipeline: { color: "#818cf8", prefix: "\u25B6" },
  error: { color: "#fca5a5", prefix: "\u2717" },
};

function ActivityLog() {
  const activityLines = useStore((s) => s.activityLines);
  const pipelineRunning = useStore((s) => s.pipelineRunning);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activityLines.length]);

  if (activityLines.length === 0) return null;

  // Only show the most recent lines (last 30) to keep the panel manageable
  const visibleLines = activityLines.slice(-30);

  return (
    <div className="py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          Activity
        </span>
        {pipelineRunning && (
          <span className="letter-shimmer text-[10px]">running</span>
        )}
        <span className="text-[10px] ml-auto" style={{ color: "var(--color-text-muted)" }}>
          {activityLines.length} events
        </span>
      </div>
      <div className="flex flex-col gap-0.5 pl-1 max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {visibleLines.map((line, i) => {
          const style = ACTIVITY_TYPE_STYLES[line.type] || ACTIVITY_TYPE_STYLES.think;
          return (
            <div key={i} style={{ animation: i >= visibleLines.length - 3 ? "nodeAppear 0.25s ease-out both" : undefined }}>
              <span
                className="text-[11px]"
                style={{ color: style.color, fontFamily: "var(--font-mono)" }}
              >
                {style.prefix} {line.text}
              </span>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

// ── Build Canvas View ──

function BuildCanvasView({
  tasks,
  ctoActive,
  isLaunching,
  visibleNodeIds,
  dispatchedIds,
  handleBBox,
  nodeDragRef,
  thinkPhase,
  thinkLines,
  showAll,
  revealedAgents,
  revealedTasks,
  agentGroups,
  phase,
  totalTasks,
  doneTasks,
  cmd,
  setCmd,
  cmdLoading,
  handleCommand,
  inputRef,
  canvasBBox,
  panelTab,
  setPanelTab,
  chatAgent,
  setChatAgent,
  chatMessages,
  setChatMessages,
  chatLoading,
  setChatLoading,
  chatEndRef,
  slug,
  selectedNodeId,
  setSelectedNodeId,
  canContinue,
  agentContextRef,
}: any) {
  // Resolve selected task from nodeId (includes unique agent instance ID)
  const selectedTask = useMemo(() => {
    if (!selectedNodeId) return null;
    const g_tasks = new Map<string, any[]>();
    for (const t of tasks) {
      const g = (t as any).group || "core";
      if (!g_tasks.has(g)) g_tasks.set(g, []);
      g_tasks.get(g)!.push(t);
    }
    for (const [g, gList] of g_tasks) {
      const idx = gList.findIndex((t: any) => t.id === selectedNodeId);
      if (idx !== -1) {
        const t = gList[idx];
        const agent = DEFAULT_AGENTS[g] || DEFAULT_AGENTS.core;
        const BASE_IDS: Record<string, string> = { setup: "OGU-7A2F", core: "OGU-3B8E", ui: "OGU-5C1D", integration: "OGU-9E4A", polish: "OGU-2D6C" };
        const uniqueId = `${BASE_IDS[g] || "OGU-0000"}-${String(idx + 1).padStart(2, "0")}`;
        return { id: t.id, title: t.title, group: g, agentName: agent.name, agentId: uniqueId, color: GROUP_COLORS[g] || "#818cf8" };
      }
    }
    return null;
  }, [selectedNodeId, tasks]);

  // Sync agent context to parent ref so handleCommand can read it
  useEffect(() => {
    if (agentContextRef) {
      if (selectedTask) {
        agentContextRef.current = {
          agentGroup: selectedTask.group,
          agentId: selectedTask.agentId,
          agentName: selectedTask.agentName,
          taskId: selectedTask.id,
          taskTitle: selectedTask.title,
        };
      } else if (chatAgent) {
        const agent = DEFAULT_AGENTS[chatAgent] || DEFAULT_AGENTS.core;
        agentContextRef.current = { agentGroup: chatAgent, agentName: agent.name };
      } else {
        agentContextRef.current = null;
      }
    }
  }, [selectedTask, chatAgent, agentContextRef]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Floating pills (top-left) */}
      <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
        {phase && (
          <span
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold backdrop-blur-sm"
            style={{
              backgroundColor: "rgba(var(--accent-rgb, 212,212,212), 0.15)",
              color: "var(--color-accent, var(--accent))",
              border: "1px solid rgba(var(--accent-rgb, 212,212,212), 0.2)",
            }}
          >
            {PHASE_LABELS[phase] || phase}
          </span>
        )}
        {totalTasks > 0 && (
          <span
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold backdrop-blur-sm"
            style={{
              backgroundColor: "var(--color-bg-card, var(--bg-card))",
              color: "var(--color-text, var(--text))",
              border: "1px solid var(--color-border, var(--border))",
            }}
          >
            {doneTasks}/{totalTasks} tasks
          </span>
        )}
        {isLaunching && (
          <span className="letter-shimmer text-[11px] font-semibold px-3 py-1.5">
            Launching...
          </span>
        )}
      </div>

      {/* Canvas — only when there are tasks to show */}
      {tasks.length > 0 || ctoActive || isLaunching ? (
        <InfiniteCanvas nodesBBox={canvasBBox} onNodeDrag={nodeDragRef} rightInset={356}
          onNodeClick={(nodeId: string, group: string) => { setSelectedNodeId(nodeId); setChatAgent(group); setChatMessages([]); setPanelTab("chat"); }}>
          <TaskGraph
            tasks={tasks}
            ctoActive={!!ctoActive}
            revealedNodeIds={visibleNodeIds}
            dispatchedTaskIds={dispatchedIds}
            onBBox={handleBBox}
            onNodeDrag={nodeDragRef}
            activeNodeId={selectedNodeId}
            onNodeSelect={(nodeId: string, group: string) => { setSelectedNodeId(nodeId); setChatAgent(group); setChatMessages([]); setPanelTab("chat"); }}
          />
        </InfiniteCanvas>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <ProjectPicker currentSlug={slug} />
        </div>
      )}

      {/* Agent Activity Panel */}
      {(thinkPhase === "thinking" || thinkPhase === "assigning" || agentGroups.length > 0) && (
        <div
          className="absolute z-20"
          style={{
            top: 12,
            right: 16,
            bottom: 88,
            width: 420,
          }}
        >
          <div
            className="rounded-xl overflow-hidden h-full flex flex-col"
            style={{
              backgroundColor: "rgba(var(--bg-card-rgb, 22,22,22), 0.85)",
              border: "1px solid var(--color-border, var(--border))",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Panel header with tabs */}
            <div
              className="shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="flex items-center mx-2 my-2 rounded-lg p-0.5"
                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              >
                <button
                  onClick={() => setPanelTab("activity")}
                  className="flex-1 px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-all rounded-md"
                  style={{
                    border: "none",
                    backgroundColor: panelTab === "activity" ? "rgba(255,255,255,0.1)" : "transparent",
                    color: panelTab === "activity" ? "var(--color-text, var(--text))" : "var(--color-text-muted, var(--text-muted))",
                  }}
                >
                  Activity
                </button>
                <button
                  onClick={() => { setPanelTab("chat"); if (!chatAgent) setChatAgent(null); }}
                  className="flex-1 px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-all rounded-md flex items-center justify-center gap-1.5"
                  style={{
                    border: "none",
                    backgroundColor: panelTab === "chat" ? "rgba(255,255,255,0.1)" : "transparent",
                    color: panelTab === "chat" ? "var(--color-text, var(--text))" : "var(--color-text-muted, var(--text-muted))",
                  }}
                >
                  Chat
                  {chatAgent && (
                    <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                      {(DEFAULT_AGENTS[chatAgent] || DEFAULT_AGENTS.core).name}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {panelTab === "chat" && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Agent context strip */}
                {chatAgent && (
                  <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <svg width={12} height={12} viewBox="0 0 16 16" className="shrink-0">
                      <AgentGroupIcon group={chatAgent} color={GROUP_COLORS[chatAgent] || "#818cf8"} />
                    </svg>
                    <span className="text-[12px] font-semibold" style={{ color: GROUP_COLORS[chatAgent] || "#818cf8" }}>
                      {selectedTask ? selectedTask.agentName : (DEFAULT_AGENTS[chatAgent] || DEFAULT_AGENTS.core).name}
                    </span>
                    {selectedTask && (
                      <span className="text-[11px] truncate max-w-[160px]" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
                        {selectedTask.title}
                      </span>
                    )}
                    <button
                      onClick={() => { setChatAgent(null); setSelectedNodeId(null); setChatMessages([]); }}
                      className="ml-auto text-[11px] cursor-pointer hover:text-text transition-colors"
                      style={{ background: "none", border: "none", color: "var(--color-text-muted)" }}
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2" style={{ scrollbarWidth: "thin" }}>
                  {chatMessages.length === 0 && (
                    <span className="text-[12px] text-text-muted py-4 text-center">
                      {selectedTask ? `Ask about "${selectedTask.title}" (${selectedTask.agentId})...` : chatAgent ? `Ask CTO about ${(DEFAULT_AGENTS[chatAgent] || DEFAULT_AGENTS.core).name}...` : "Select an agent or task node, or ask CTO anything."}
                    </span>
                  )}
                  {chatMessages.map((msg: any, i: number) => {
                    const isRtl = /[\u0590-\u05FF\u0600-\u06FF]/.test(msg.text?.slice(0, 80) || "");
                    return (
                      <div key={i} className={`flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        <span className="text-[10px] font-semibold" style={{ color: msg.role === "user" ? "var(--color-text-muted)" : "var(--color-accent, var(--accent))" }}>
                          {msg.role === "user" ? "You" : "CTO"}
                        </span>
                        <div
                          className="text-[12px] leading-relaxed px-2.5 py-1.5 rounded-lg max-w-[90%] cto-md"
                          dir={isRtl ? "rtl" : undefined}
                          style={{
                            backgroundColor: msg.role === "user" ? "rgba(255,255,255,0.06)" : "rgba(var(--accent-rgb, 212,212,212), 0.1)",
                            color: "var(--color-text-secondary, var(--text-secondary))",
                            textAlign: isRtl ? "right" : undefined,
                          }}
                        >
                          <MiniMarkdown text={msg.text} />
                        </div>
                      </div>
                    );
                  })}
                  {chatLoading && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold" style={{ color: "var(--color-accent)" }}>CTO</span>
                      <span className="letter-shimmer text-[12px]">Thinking...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}

            {panelTab === "activity" && teamData && !teamApproved && (
              <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "thin" }}>
                <TeamReviewPanel
                  blueprint={{ roles: (teamData.blueprint?.roles || []) }}
                  team={{ members: teamData.members || [] }}
                  complexity={teamData.complexity}
                  onApprove={async () => {
                    setTeamApproved(true);
                    try {
                      await fetch(`/api/brief/project/${slug}/approve-team`, { method: "POST", headers: { "Content-Type": "application/json" } });
                    } catch (err) {
                      console.error("[ProjectScreen] Team approve failed:", err);
                    }
                  }}
                />
              </div>
            )}

            {panelTab === "activity" && (!teamData || teamApproved) && (
              <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "thin" }}>
                {(thinkPhase === "thinking" || thinkPhase === "assigning") && (
                  <div className="pb-3" style={{ animation: "nodeAppear 0.3s ease-out both", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg width={14} height={14} viewBox="0 0 16 16" className="shrink-0">
                        <g stroke="var(--color-accent, var(--accent))" strokeWidth={1.2} strokeLinecap="round" fill="none">
                          {thinkPhase === "thinking" ? (
                            // CTO icon (brain-like)
                            <>
                              <path d="M8 14V8" />
                              <path d="M5 8c-2 0-3-1.5-3-3s1.5-3 3-3c.5 0 1 .1 1.5.4" />
                              <path d="M11 8c2 0 3-1.5 3-3s-1.5-3-3-3c-.5 0-1 .1-1.5.4" />
                              <path d="M6.5 2.4C7 2.1 7.5 2 8 2s1 .1 1.5.4" />
                              <path d="M4 8.5C3 9.5 3 11 4 12s3 1 4 0" />
                              <path d="M12 8.5c1 1 1 2.5 0 3.5s-3 1-4 0" />
                            </>
                          ) : (
                            // PM icon (person with tasks)
                            <>
                              <circle cx="8" cy="4" r="2" />
                              <path d="M4 14v-2a4 4 0 0 1 8 0v2" />
                              <path d="M11 9l1.5 1.5L15 8" />
                            </>
                          )}
                        </g>
                      </svg>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--color-accent, var(--accent))" }}>
                        {thinkPhase === "thinking" ? "CTO" : "PM"}
                      </span>
                      <span className="text-[11px] ml-auto letter-shimmer">
                        {thinkPhase === "thinking" ? "Analyzing..." : "Distributing tasks..."}
                      </span>
                    </div>
                    <div className="pl-5 flex flex-col gap-0.5">
                      {thinkLines.map((line: any, i: number) => (
                        <div key={i} style={{ animation: "nodeAppear 0.25s ease-out both" }}>
                          {line.type === "think" && (
                            <span className="text-[11px]" style={{ color: "var(--color-text-muted, var(--text-muted))", fontFamily: "var(--font-mono, var(--font-mono))" }}>
                              {"\u25B6"} {line.text}
                            </span>
                          )}
                          {line.type === "agent" && (
                            <span className="text-[11px] font-medium" style={{ color: "#4ade80", fontFamily: "var(--font-mono, var(--font-mono))" }}>
                              {"\u2713"} {line.text}
                            </span>
                          )}
                          {line.type === "dispatch" && (
                            <span className="text-[11px] font-medium" style={{ color: "var(--color-accent, var(--accent))", fontFamily: "var(--font-mono, var(--font-mono))" }}>
                              {line.text}
                            </span>
                          )}
                        </div>
                      ))}
                      <span
                        className="inline-block w-1.5 h-2.5 mt-0.5"
                        style={{
                          backgroundColor: "var(--color-accent, var(--accent))",
                          animation: "blink 1s step-end infinite",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Persistent activity log (shows after CTO phase ends) */}
                <ActivityLog />

                {agentGroups.map((group: any, gi: number) => {
                  const isVisible = showAll || revealedAgents.has(group.name);
                  if (!isVisible) return null;

                  const visibleTasks = showAll
                    ? group.tasks
                    : group.tasks.filter((t: any) => revealedTasks.has(t.id));
                  const doneCount = visibleTasks.filter((t: any) => t.done).length;

                  return (
                    <div
                      key={gi}
                      className="py-3"
                      style={{
                        ...(gi > 0 || thinkPhase === "thinking" || thinkPhase === "assigning"
                          ? { borderTop: "1px solid rgba(255,255,255,0.06)" }
                          : {}),
                        ...(!showAll ? { animation: "nodeAppear 0.3s ease-out both" } : {}),
                      }}
                    >
                      <button
                        className="flex items-center gap-2 mb-1.5 cursor-pointer rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-white/5 w-full text-left"
                        style={{ background: "none", border: "none", padding: "2px 4px" }}
                        onClick={() => { setChatAgent(group.key); setSelectedNodeId(null); setChatMessages([]); setPanelTab("chat"); }}
                        data-agent-key={group.key}
                      >
                        <svg width={14} height={14} viewBox="0 0 16 16" className="shrink-0">
                          <AgentGroupIcon group={group.key} color={group.color} />
                        </svg>
                        <span className="text-[12px] font-semibold" style={{ color: group.color }}>
                          {group.name}
                        </span>
                        <span
                          className="text-[10px] px-1 py-0.5 rounded font-mono"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.06)",
                            color: "var(--color-text-muted, var(--text-muted))",
                          }}
                        >
                          {group.model}
                        </span>
                        {visibleTasks.length > 0 && (
                          <span className="text-[11px] ml-auto" style={{ color: "var(--color-text-muted, var(--text-muted))" }}>
                            {doneCount}/{visibleTasks.length}
                          </span>
                        )}
                      </button>
                      <div className="flex flex-col gap-1 pl-1">
                        {visibleTasks.map((t: any) => (
                          <div
                            key={t.id}
                            className="flex items-start gap-2"
                            style={!showAll ? { animation: "nodeAppear 0.25s ease-out both" } : undefined}
                          >
                            <span className="shrink-0 mt-0.5">
                              {t.done ? (
                                <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
                                  <circle cx={8} cy={8} r={7} stroke="#4ade80" strokeWidth={1.5} />
                                  <path d="M5 8l2 2 4-4" stroke="#4ade80" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : (
                                <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
                                  <circle cx={8} cy={8} r={7} stroke="var(--color-text-muted, var(--text-muted))" strokeWidth={1} opacity={0.4} />
                                </svg>
                              )}
                            </span>
                            <span
                              className="text-[12px] leading-tight"
                              style={{
                                color: t.done ? "var(--color-text-muted, var(--text-muted))" : "var(--color-text-secondary, var(--text-secondary))",
                                textDecoration: t.done ? "line-through" : "none",
                                textDecorationColor: "rgba(255,255,255,0.15)",
                              }}
                            >
                              {t.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Pipeline progress — inline in activity log */}
                <PipelineProgress slug={slug} phase={phase} canContinue={canContinue || false} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Command Bar */}
      <div
        className="absolute z-20"
        style={{ bottom: 16, left: 20, right: 20 }}
      >
        <div
          className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 transition-colors"
          style={{
            backgroundColor: "rgba(var(--bg-card-rgb, 22,22,22), 0.9)",
            border: "1px solid var(--color-border, var(--border))",
            backdropFilter: "blur(12px)",
          }}
        >
          <Icon d={icons.terminal} size={14} stroke="var(--color-text-muted, var(--text-muted))" />
          {chatAgent && (
            <button
              onClick={() => { setChatAgent(null); setSelectedNodeId(null); setChatMessages([]); }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0 cursor-pointer transition-colors hover:opacity-80"
              style={{
                backgroundColor: `${GROUP_COLORS[chatAgent] || "#818cf8"}18`,
                border: `1px solid ${GROUP_COLORS[chatAgent] || "#818cf8"}33`,
              }}
            >
              <svg width={10} height={10} viewBox="0 0 16 16" className="shrink-0">
                <AgentGroupIcon group={chatAgent} color={GROUP_COLORS[chatAgent] || "#818cf8"} />
              </svg>
              <span className="text-[10px] font-semibold" style={{ color: GROUP_COLORS[chatAgent] || "#818cf8" }}>
                {selectedTask ? selectedTask.agentName : (DEFAULT_AGENTS[chatAgent] || DEFAULT_AGENTS.core).name}
              </span>
              {selectedTask && (
                <span className="text-[8px] font-mono opacity-60" style={{ color: GROUP_COLORS[chatAgent] || "#818cf8" }}>
                  {selectedTask.agentId}
                </span>
              )}
              <svg width={8} height={8} viewBox="0 0 16 16" fill="none" stroke={GROUP_COLORS[chatAgent] || "#818cf8"} strokeWidth={2} strokeLinecap="round" opacity={0.6}>
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={cmd}
            onChange={(e: any) => setCmd(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === "Enter") handleCommand();
            }}
            placeholder={selectedTask ? `Ask about ${selectedTask.title}...` : chatAgent ? `Ask CTO about ${(DEFAULT_AGENTS[chatAgent] || DEFAULT_AGENTS.core).name}...` : "Type a command... (/build, /design, /verify)"}
            className="flex-1 bg-transparent border-none outline-none text-sm text-text placeholder:text-text-muted"
            style={{ fontFamily: "var(--font-sans, var(--font))" }}
            disabled={cmdLoading}
          />
          <button
            onClick={handleCommand}
            disabled={!cmd.trim() || cmdLoading}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
            style={{ backgroundColor: "var(--color-accent, var(--accent))" }}
          >
            {cmdLoading ? (
              <Icon
                d={icons.loader}
                size={13}
                stroke="var(--color-bg, var(--bg))"
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Icon d={icons.play} size={13} fill="var(--color-bg, var(--bg))" stroke="none" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Picker ──

function ProjectPicker({ currentSlug }: { currentSlug: string | null }) {
  const setActiveProjectSlug = useStore((s) => s.setActiveProjectSlug);
  const [projects, setProjects] = useState<Array<{ slug: string; phase: string; tasks: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFeatures().then(({ features }) => {
      setProjects(features || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <span className="text-xs" style={{ color: "var(--color-text-muted, var(--text-muted))" }}>Loading projects...</span>;
  }
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm" style={{ color: "var(--color-text-muted, var(--text-muted))" }}>No projects yet.</span>
        <span className="text-xs" style={{ color: "var(--color-text-muted, var(--text-muted))" }}>Use the wizard to create one.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-72">
      <span className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted, var(--text-muted))" }}>
        Select a project
      </span>
      {projects.map((p) => (
        <button
          key={p.slug}
          onClick={() => setActiveProjectSlug(p.slug)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer transition-all"
          style={{
            background: p.slug === currentSlug ? "rgba(99,241,157,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${p.slug === currentSlug ? "rgba(99,241,157,0.3)" : "rgba(255,255,255,0.08)"}`,
            color: "var(--color-text, var(--text))",
          }}
        >
          <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="var(--color-accent, var(--accent))" strokeWidth={1.4} strokeLinecap="round">
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <path d="M5 6h6M5 9h4" />
          </svg>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-xs font-semibold truncate">{p.slug}</span>
            <span className="text-[10px]" style={{ color: "var(--color-text-muted, var(--text-muted))" }}>
              {p.tasks} tasks · {p.phase || "new"}
            </span>
          </div>
          {p.tasks > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }}>
              {p.tasks}t
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ──

export function ProjectScreen() {
  const slug = useStore((s) => s.activeProjectSlug);
  const launchSteps = useStore((s) => s.launchSteps);
  const uiState = useStore((s) => s.projectUIState);
  const setProjectUIState = useStore((s) => s.setProjectUIState);
  const setActiveProjectSlug = useStore((s) => s.setActiveProjectSlug);
  const teamData = useStore((s) => s.teamData);
  const teamApproved = useStore((s) => s.teamApproved);
  const setTeamApproved = useStore((s) => s.setTeamApproved);
  const { on: wsOn } = useSocket();

  const [cmd, setCmd] = useState("");
  const [cmdLoading, setCmdLoading] = useState(false);
  const [panelTab, setPanelTab] = useState<"activity" | "chat">("activity");
  const [chatAgent, setChatAgent] = useState<string | null>(null); // group key
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "cto"; text: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [canvasBBox, setCanvasBBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const nodeDragRef = useRef<((id: string, startX: number, startY: number) => void) | null>(null);
  const agentContextRef = useRef<{ agentGroup?: string; agentId?: string; agentName?: string; taskId?: string; taskTitle?: string } | null>(null);

  const fetchState = useCallback(async () => {
    // If no slug at all, try to recover the most recent project from the registry
    if (!slug) {
      try {
        const { project } = await api.getActiveProject();
        if (project?.slug) setActiveProjectSlug(project.slug);
      } catch { /* no projects registered */ }
      return;
    }
    try {
      const state = await api.getProjectState(slug);
      setProjectUIState(state);
    } catch (err: any) {
      // Stale slug (project deleted or orphaned) — recover from registry
      const is404 = err?.message?.includes("404") || err?.message === "Feature not found";
      if (is404) {
        try {
          const { project } = await api.getActiveProject();
          if (project?.slug && project.slug !== slug) {
            setActiveProjectSlug(project.slug);
            // fetchState will re-run via useEffect when slug changes
          } else {
            setActiveProjectSlug(null);
          }
        } catch {
          setActiveProjectSlug(null);
        }
      }
    }
  }, [slug, setProjectUIState, setActiveProjectSlug]);

  // Fetch on mount
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Re-fetch when CTO step completes (Plan.json now has tasks) and when all steps complete
  useEffect(() => {
    if (launchSteps) {
      const ctoJustDone = launchSteps.cto === "complete";
      const allDone = LAUNCH_IDS.every((id) => launchSteps[id] === "complete");
      if (ctoJustDone || allDone) {
        const timer = setTimeout(fetchState, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [launchSteps, fetchState]);

  // Periodic re-fetch to self-correct stale state (e.g. WS events from previous sessions)
  useEffect(() => {
    const interval = setInterval(fetchState, 10000); // every 10s
    return () => clearInterval(interval);
  }, [fetchState]);

  // Pipeline state — no auto-continue; server handles initial flow via autoContinuePipeline.
  // User clicks "Continue" or "Retry" manually via PipelineProgress component.

  // ── Command bar handler (reads SSE stream) ──
  const handleCommand = useCallback(async () => {
    const text = cmd.trim();
    if (!text || cmdLoading) return;
    setCmd("");
    setCmdLoading(true);

    // Show user message immediately
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);
    setPanelTab("chat");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          feature: slug,
          ...agentContextRef.current,
        }),
      });

      if (!res.ok || !res.body) {
        setChatMessages((prev) => [...prev, { role: "cto", text: `Error: ${res.status}` }]);
        setChatLoading(false);
        setCmdLoading(false);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let ctoText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (line.startsWith("data:") || line.startsWith("data: ")) {
              const jsonStr = line.replace(/^data:\s*/, "");
              try {
                const evt = JSON.parse(jsonStr);
                let newText = "";

                // Handle plain text events (stderr fallback)
                if (evt.type === "text" && evt.text) {
                  newText = evt.text;
                }
                // Handle Claude CLI stream-json assistant messages
                else if (evt.type === "assistant" && evt.message?.content) {
                  for (const block of evt.message.content) {
                    if (block.type === "text" && block.text) {
                      newText += block.text;
                    }
                    // Show tool_use activity as thinking indicator
                    if (block.type === "tool_use") {
                      const toolLabel = block.name === "Read" ? `Reading ${(block.input?.file_path || "").split("/").pop() || "file"}...`
                        : block.name === "Glob" ? "Searching files..."
                        : block.name === "Grep" ? "Searching code..."
                        : block.name === "Write" ? "Writing file..."
                        : block.name === "Edit" ? "Editing file..."
                        : block.name === "Bash" ? "Running command..."
                        : `Using ${block.name}...`;
                      setChatMessages((prev) => {
                        const last = prev[prev.length - 1];
                        if (last?.role === "cto" && !ctoText) {
                          return [...prev.slice(0, -1), { role: "cto", text: `_${toolLabel}_` }];
                        }
                        if (!last || last.role !== "cto") {
                          return [...prev, { role: "cto", text: `_${toolLabel}_` }];
                        }
                        return prev;
                      });
                    }
                  }
                }
                // Handle content_block_delta streaming events
                else if (evt.type === "content_block_delta" && evt.delta?.text) {
                  newText = evt.delta.text;
                }

                if (newText) {
                  ctoText += newText;
                  // Update CTO message in-place (replaces any tool_use indicator)
                  setChatMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.role === "cto") {
                      return [...prev.slice(0, -1), { role: "cto", text: ctoText }];
                    }
                    return [...prev, { role: "cto", text: ctoText }];
                  });
                }
              } catch { /* skip non-JSON data lines */ }
            }
          }
        }
      }

      // Ensure CTO response is added even if empty
      if (!ctoText) {
        setChatMessages((prev) => [...prev, { role: "cto", text: "(No response)" }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "cto", text: "Connection error." }]);
    } finally {
      setChatLoading(false);
      setCmdLoading(false);
    }
  }, [cmd, cmdLoading, slug]);

  // ── Derived state ──
  const isLaunching = launchSteps && LAUNCH_IDS.some((id) => launchSteps[id] === "active");
  const ctoActive = launchSteps?.cto === "active";
  const launchDone = launchSteps ? LAUNCH_IDS.every((id) => launchSteps[id] === "complete") : false;
  const tasks = uiState?.tasks || [];
  const phase = uiState?.phase || null;

  const doneTasks = tasks.filter((t: any) => t.done).length;
  const totalTasks = tasks.length;

  // Group tasks by agent for activity panel
  const agentGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; color: string; model: string; tasks: Array<{ id: string; title: string; done: boolean }> }>();
    for (const t of tasks) {
      const g = (t as any).group || "core";
      if (!groups.has(g)) {
        const agent = DEFAULT_AGENTS[g] || DEFAULT_AGENTS.core;
        groups.set(g, { key: g, name: agent.name, color: GROUP_COLORS[g] || "#818cf8", model: (t as any).model || GROUP_MODELS[g] || "sonnet", tasks: [] });
      }
      groups.get(g)!.tasks.push({ id: (t as any).id, title: (t as any).title, done: !!(t as any).done });
    }
    return [...groups.entries()]
      .sort(([a], [b]) => {
        const ai = GROUP_ORDER.indexOf(a);
        const bi = GROUP_ORDER.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .map(([, v]) => v);
  }, [tasks]);

  // CTO thinking panel + progressive reveal
  const { lines: thinkLines, phase: thinkPhase, revealedAgents, revealedTasks, liveTasks } = useCTOThinking(!!ctoActive, tasks, wsOn);

  // Merge: use API tasks when available, otherwise live tasks from WS events
  const effectiveTasks = tasks.length > 0 ? tasks : liveTasks;

  // Activity panel: show all when not in active launch sequence
  const showAll = thinkPhase === "idle" || thinkPhase === "done";

  // Compute visible node IDs for canvas reveal
  const visibleNodeIds = useMemo(() => {
    if (showAll) return null; // null = show everything
    const ids = new Set<string>();
    for (const t of effectiveTasks) {
      const group = (t as any).group || "core";
      const agent = (t as any).agent || DEFAULT_AGENTS[group] || DEFAULT_AGENTS.core;
      if (revealedAgents.has(agent.name)) ids.add((t as any).id);
    }
    return ids;
  }, [showAll, effectiveTasks, revealedAgents]);

  // Compute dispatched task IDs for beam states
  const dispatchedIds = useMemo(() => {
    if (showAll) return null; // null = all dispatched
    return revealedTasks;
  }, [showAll, revealedTasks]);

  const handleBBox = useCallback((bbox: { x: number; y: number; w: number; h: number }) => {
    setCanvasBBox(bbox);
  }, []);

  if (!slug) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <ProjectPicker currentSlug={null} />
      </div>
    );
  }

  return (
    <BuildCanvasView
      tasks={effectiveTasks}
      ctoActive={ctoActive}
      isLaunching={isLaunching}
      visibleNodeIds={visibleNodeIds}
      dispatchedIds={dispatchedIds}
      handleBBox={handleBBox}
      nodeDragRef={nodeDragRef}
      thinkPhase={thinkPhase}
      thinkLines={thinkLines}
      showAll={showAll}
      revealedAgents={revealedAgents}
      revealedTasks={revealedTasks}
      agentGroups={agentGroups}
      phase={phase}
      totalTasks={totalTasks}
      doneTasks={doneTasks}
      cmd={cmd}
      setCmd={setCmd}
      cmdLoading={cmdLoading}
      handleCommand={handleCommand}
      inputRef={inputRef}
      canvasBBox={canvasBBox}
      panelTab={panelTab}
      setPanelTab={setPanelTab}
      chatAgent={chatAgent}
      setChatAgent={setChatAgent}
      chatMessages={chatMessages}
      setChatMessages={setChatMessages}
      chatLoading={chatLoading}
      setChatLoading={setChatLoading}
      chatEndRef={chatEndRef}
      slug={slug}
      selectedNodeId={selectedNodeId}
      setSelectedNodeId={setSelectedNodeId}
      canContinue={uiState?.canContinue || false}
      agentContextRef={agentContextRef}
    />
  );
}
