import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
import { IconBtn } from "@/components/shared/IconBtn";
import { InfiniteCanvas } from "./InfiniteCanvas";
import { TaskGraph } from "./TaskGraph";
import { WaveProgress } from "./WaveProgress";

const GROUP_COLORS: Record<string, string> = {
  setup: "#4ade80",
  core: "#818cf8",
  ui: "#f472b6",
  integration: "#fb923c",
  polish: "#a78bfa",
};

function agentBorderColor(agent: ActiveAgent): string {
  if (agent.status === "done") return "#4ade80";
  if (agent.status === "failed") return "#f87171";
  return GROUP_COLORS[agent.group] || "#a78bfa";
}

// Deterministic hue from name string
function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h) % 360;
}

function InitialsAvatar({ name, size = 36, hovered }: { name: string; size?: number; hovered: boolean }) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const hue = nameHue(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue}, 55%, 28%)`,
      border: `1.5px solid hsl(${hue}, 60%, 42%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, color: `hsl(${hue}, 80%, 88%)`,
      fontFamily: "var(--font-sans)",
      transform: hovered ? "scale(1.1)" : "scale(1)",
      transition: "transform 0.2s ease-out",
      letterSpacing: "0.02em",
      userSelect: "none",
    }}>
      {initials}
    </div>
  );
}

function AgentCard({ agent }: { agent: ActiveAgent }) {
  const [hovered, setHovered] = useState(false);
  const color = agentBorderColor(agent);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 16,
        border: `1px solid ${hovered ? color + "55" : color + "30"}`,
        background: `linear-gradient(0deg, rgba(255,255,255,0) 0%, ${color}0d 2.45%, rgba(255,255,255,0) 126.14%)`,
        boxShadow: hovered
          ? `1.1px 2.2px 0.5px -1.8px ${color}99 inset, -1px -2.2px 0.5px -1.8px ${color}99 inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 20px ${color}22 inset`
          : `1.1px 2.2px 0.5px -1.8px ${color}99 inset, -1px -2.2px 0.5px -1.8px ${color}99 inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        cursor: "default",
      }}
    >
      <InitialsAvatar name={agent.name} hovered={hovered} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {agent.name}
          </span>
          <div style={{
            width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
            backgroundColor: color,
            boxShadow: agent.status === "working" ? `0 0 6px ${color}` : "none",
            animation: agent.status === "working" ? "pulse 1.5s ease-in-out infinite" : "none",
          }} />
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {agent.taskTitle}
        </span>
      </div>
    </div>
  );
}

const PANEL_W = 400;

// Return ALL team members as agent records — one entry per agent
function buildTeamAgents(teamData: any): Record<string, { id: string; name: string; role?: string; specialty?: string; tier?: number; avatar?: Record<string, string> }> | null {
  if (!teamData) return null;
  const members = teamData.members || teamData.roles || [];
  if (members.length === 0) return null;
  const result: Record<string, { id: string; name: string; role?: string; specialty?: string; tier?: number; avatar?: Record<string, string> }> = {};
  for (const m of members) {
    const name = m.agent_name || m.agentName;
    if (!name) continue;
    const key = m.agent_id || m.agentId || name;
    result[key] = {
      id: m.agent_id || m.agentId || `AGT-${name.slice(0, 4).toUpperCase()}`,
      name,
      role: m.role_display || m.roleDisplay || m.role_id || m.roleId || undefined,
      specialty: m.agent_specialty || m.agentSpecialty || undefined,
      tier: m.agent_tier || m.agentTier || undefined,
      avatar: m.avatar || undefined,
    };
  }
  return Object.keys(result).length > 0 ? result : null;
}

interface ActiveAgent {
  name: string;
  group: string;
  taskTitle: string;
  status: "working" | "done" | "failed";
  ts: number;
}

export function ExecutionWorkspace() {
  const activityLines = useStore((s) => s.activityLines);
  const projectUIState = useStore((s) => s.projectUIState);
  const setProjectUIState = useStore((s) => s.setProjectUIState);
  const activeProjectSlug = useStore((s) => s.activeProjectSlug);
  const teamData = useStore((s) => s.teamData);
  const dp = useStore((s) => s.dispatchProgress);
  const executionStatus = useStore((s) => s.executionStatus);
  const fixingAgentNames = useStore((s) => s.fixingAgentNames);
  const fixingTaskTitles = useStore((s) => s.fixingTaskTitles);

  const [canvasBBox, setCanvasBBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"agents" | "activity">("agents");
  const [hoveredBtn, setHoveredBtn] = useState<"resume" | "pause" | "abort" | null>(null);
  const nodeDragRef = useRef<((id: string, startX: number, startY: number) => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleAbort = useCallback(async () => {
    if (!activeProjectSlug) return;
    await api.abortProject(activeProjectSlug).catch(() => {});
  }, [activeProjectSlug]);

  const handlePause = useCallback(async () => {
    if (!activeProjectSlug) return;
    await api.pauseProject(activeProjectSlug).catch(() => {});
  }, [activeProjectSlug]);

  const handleResume = useCallback(async () => {
    if (!activeProjectSlug) return;
    await api.resumeProject(activeProjectSlug).catch(() => {});
  }, [activeProjectSlug]);

  // Fetch project state on mount so canvas is never blank
  useEffect(() => {
    if (!activeProjectSlug) return;
    api.getProjectState(activeProjectSlug).then((state) => {
      if (state) setProjectUIState(state);
    }).catch(() => {});
  }, [activeProjectSlug, setProjectUIState]);

  // Auto-scroll activity
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activityLines]);

  const tasks = useMemo(() => projectUIState?.tasks || [], [projectUIState?.tasks]);
  const teamAgents = useMemo(() => buildTeamAgents(teamData), [teamData]);

  const handleBBox = useCallback((bbox: { x: number; y: number; w: number; h: number }) => {
    setCanvasBBox(bbox);
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedTask((prev) => prev === nodeId ? null : nodeId);
  }, []);

  // Derive active agents — single source of truth: teamAgents (same record passed to TaskGraph)
  const activeAgents = useMemo<ActiveAgent[]>(() => {
    if (!teamAgents) return [];
    const agents = new Map<string, ActiveAgent>();

    // Seed from teamAgents — the canonical processed list
    for (const agent of Object.values(teamAgents)) {
      const label = agent.role || agent.name;
      agents.set(agent.name, { name: agent.name, group: label, taskTitle: label, status: "working", ts: Date.now() - 1000 });
    }

    // Enrich with task data — only update existing agents, never add new ones
    for (const t of tasks) {
      const agentName = t.agent?.name || t.ownerAgent || null;
      if (!agentName || !agents.has(agentName)) continue;
      const existing = agents.get(agentName)!;
      const taskStatus: "done" | "failed" | "working" = t.done ? "done" : t.failed ? "failed" : "working";
      if (taskStatus === "working" || existing.taskTitle === existing.group) {
        agents.set(agentName, { ...existing, taskTitle: t.title || t.id, status: taskStatus, ts: Date.now() });
      }
    }

    // Overlay with activity lines — only for known agents
    for (const line of activityLines.slice(-30)) {
      const completedMatch = line.text.match(/^(.+?) completed: "(.+)"$/);
      if (completedMatch && agents.has(completedMatch[1])) {
        agents.set(completedMatch[1], { ...agents.get(completedMatch[1])!, taskTitle: completedMatch[2], status: "done", ts: line.ts });
      }
      const issueMatch = line.text.match(/^(.+?) encountered an issue on "(.+)"$/);
      if (issueMatch && agents.has(issueMatch[1])) {
        agents.set(issueMatch[1], { ...agents.get(issueMatch[1])!, taskTitle: issueMatch[2], status: "failed", ts: line.ts });
      }
    }

    return [...agents.values()].sort((a, b) => b.ts - a.ts);
  }, [teamAgents, tasks, activityLines]);

  // Selected task detail
  const selectedTaskData = useMemo(() => {
    if (!selectedTask) return null;
    return tasks.find((t: any) => t.id === selectedTask) || null;
  }, [selectedTask, tasks]);

  const done = dp.completedTasks + dp.failedTasks;
  const pct = dp.totalTasks > 0 ? Math.min(100, Math.round((done / dp.totalTasks) * 100)) : 0;

  return (
    <div className="flex flex-col h-full relative">
      {/* Full-screen canvas — extends under the panel so nodes are visible through glass */}
      <div className="absolute inset-0">
        <InfiniteCanvas
          nodesBBox={canvasBBox}
          onNodeDrag={nodeDragRef}
          onNodeClick={handleNodeClick}
          rightInset={PANEL_W}
        >
          <TaskGraph
            tasks={tasks}
            ctoActive={false}
            onBBox={handleBBox}
            onNodeDrag={nodeDragRef}
            activeNodeId={selectedTask}
            onNodeSelect={handleNodeClick}
            teamAgents={teamAgents}
            isPaused={executionStatus === "paused"}
          />
        </InfiniteCanvas>

        {/* Top bar — wave progress + execution controls */}
        {dp.totalTasks > 0 && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2" style={{ right: PANEL_W + 12 }}>
            {/* Wave progress pill */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0" style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "rgba(255,255,255,0.07) -8px -6px 4px -8px inset, rgba(255,255,255,0.1) 6px 6px 4px -5px inset", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
              <span className="text-xs text-text-muted">Wave {dp.currentWave}/{dp.totalWaves}</span>
              <div className="w-24 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: "var(--color-accent)" }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>{pct}%</span>
            </div>

            {/* Execution controls — inline with progress */}
            {(executionStatus === "running" || executionStatus === "paused") && (
              <>
                {executionStatus === "paused" ? (
                  <button
                    onClick={handleResume}
                    onMouseEnter={() => setHoveredBtn("resume")}
                    onMouseLeave={() => setHoveredBtn(null)}
                    className="home-chip flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      border: "1px solid rgba(99,241,157,0.35)",
                      background: "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)",
                      boxShadow: hoveredBtn === "resume"
                        ? "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.7) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.7) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 18px rgba(99,241,157,0.18) inset"
                        : "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.7) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.7) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                      color: "var(--color-accent)", fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <Icon d={icons.play} size={11} stroke="var(--color-accent)" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    onMouseEnter={() => setHoveredBtn("pause")}
                    onMouseLeave={() => setHoveredBtn(null)}
                    className="home-chip flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 2.45%, rgba(255,255,255,0) 126.14%)",
                      boxShadow: hoveredBtn === "pause"
                        ? "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.3) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.3) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 18px rgba(255,255,255,0.1) inset"
                        : "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.3) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.3) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                      color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600,
                    }}
                  >
                    <Icon d={icons.pause} size={11} stroke="rgba(255,255,255,0.7)" />
                    Pause
                  </button>
                )}
                <button
                  onClick={handleAbort}
                  onMouseEnter={() => setHoveredBtn("abort")}
                  onMouseLeave={() => setHoveredBtn(null)}
                  className="home-chip flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: "1px solid rgba(248,113,113,0.30)",
                    background: "linear-gradient(0deg, rgba(248,113,113,0) 0%, rgba(248,113,113,0.07) 2.45%, rgba(248,113,113,0) 126.14%)",
                    boxShadow: hoveredBtn === "abort"
                      ? "1.1px 2.2px 0.5px -1.8px rgba(248,113,113,0.6) inset, -1px -2.2px 0.5px -1.8px rgba(248,113,113,0.6) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 18px rgba(248,113,113,0.18) inset"
                      : "1.1px 2.2px 0.5px -1.8px rgba(248,113,113,0.6) inset, -1px -2.2px 0.5px -1.8px rgba(248,113,113,0.6) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                    color: "#f87171", fontSize: 12, fontWeight: 600,
                  }}
                >
                  <Icon d={icons.x} size={11} stroke="#f87171" />
                  Abort
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div
        className="absolute top-0 right-0 bottom-0 flex flex-col z-10"
        style={{
          width: PANEL_W,
          background: "transparent",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.12) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.12) inset",
          borderLeft: "1px solid transparent",
          borderImage: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.14) 100%) 1",
        }}
      >
        {/* Tab bar */}
        <div className="px-5 pb-4 pt-5 shrink-0">
          <div
            className="chip-wrapper"
            style={{
              position: "relative",
              display: "flex",
              gap: 6,
              padding: "8px 8px",
              background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 2.45%, rgba(255,255,255,0) 126.14%)",
              borderRadius: 9999,
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)", pointerEvents: "none" }} />
            {([["agents", "Agents"], ["activity", `Activity ${activityLines.length > 0 ? `(${activityLines.length})` : ""}`]] as const).map(([key, label]) => {
              const active = panelTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setPanelTab(key)}
                  className="home-chip flex-1 flex items-center justify-center px-4 py-2 rounded-full cursor-pointer transition-all"
                  style={{
                    border: active ? "1px solid rgba(99,241,157,0.40)" : "1px solid rgba(255,255,255,0.12)",
                    background: active
                      ? "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 2.45%, rgba(99,241,157,0) 126.14%)"
                      : "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.07) 2.45%, rgba(255,255,255,0) 126.14%)",
                    color: active ? "var(--color-text)" : "rgba(255,255,255,0.5)",
                    boxShadow: active
                      ? "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset, 0 0 12px rgba(99,241,157,0.12)"
                      : "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.45) inset, 2px 3px 2px 0px rgba(0,0,0,0.1) inset",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Agents tab */}
        {panelTab === "agents" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {fixingAgentNames.length > 0 && (
              <div className="px-5 pt-3 pb-1 shrink-0">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                  <Icon d={icons.loader} size={11} style={{ animation: "spin 1s linear infinite", color: "#f87171", flexShrink: 0 }} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.06em" }}>Fixing gate failure</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fixingTaskTitles.slice(0, 2).join(", ")}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto px-5 pb-5">
              <div className="flex flex-col gap-2">
                {(() => {
                  const displayedAgents = fixingAgentNames.length > 0
                    ? activeAgents.filter((a) => fixingAgentNames.includes(a.name))
                    : activeAgents;
                  return displayedAgents.length > 0 ? displayedAgents.map((agent) => (
                    <div key={agent.name} style={{ outline: fixingAgentNames.length > 0 ? "1px solid rgba(248,113,113,0.4)" : "none", borderRadius: 16 }}>
                      <AgentCard agent={{ ...agent, status: fixingAgentNames.length > 0 ? "working" : agent.status }} />
                    </div>
                  )) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <Icon d={icons.loader} size={12} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Waiting for agents...</span>
                    </div>
                  );
                })()}
                {selectedTaskData && (
                  <div className="mt-2 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Selected Task</span>
                      <IconBtn onClick={() => setSelectedTask(null)} size={20} style={{ color: "rgba(255,255,255,0.45)", borderRadius: 7 }}>
                        <Icon d={icons.x} size={9} />
                      </IconBtn>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", display: "block", marginBottom: 4 }}>{selectedTaskData.title}</span>
                    <div style={{ display: "flex", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                      <span className="capitalize">{selectedTaskData.group}</span>
                      <span>·</span>
                      <span>{selectedTaskData.done ? "Done" : "Pending"}</span>
                      {selectedTaskData.agent && <><span>·</span><span>{selectedTaskData.agent.name}</span></>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Activity tab */}
        {panelTab === "activity" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-auto px-5 pb-5">
              <div className="flex flex-col gap-0.5">
                {activityLines.map((line, i) => {
                  const isMilestone = line.type === "dispatch" || line.type === "pipeline";
                  const milestoneColor = line.type === "dispatch" ? "var(--color-accent)" : "#60a5fa";
                  const iconColor =
                    line.type === "error" ? "#f87171" :
                    line.type === "dispatch" ? "var(--color-accent)" :
                    line.type === "agent" ? "#a78bfa" :
                    line.type === "pipeline" ? "#60a5fa" :
                    line.type === "task" ? "#4ade80" :
                    "rgba(255,255,255,0.2)";
                  const icon = line.type === "error" ? "\u2715" : line.type === "dispatch" ? "\u25B8" : line.type === "agent" ? "\u25C6" : line.type === "pipeline" ? "\u2192" : line.type === "task" ? "\u2713" : line.type === "think" ? "\u22EF" : "\u00B7";

                  // Parse agent attribution patterns
                  const issueMatch = !isMilestone && line.text.match(/^(.+?) encountered an issue on "(.+)"$/);
                  const completedMatch = !isMilestone && line.text.match(/^(.+?) completed: "(.+)"$/);
                  const attrMatch = issueMatch || completedMatch;

                  if (isMilestone) {
                    return (
                      <div
                        key={`${line.ts}-${i}`}
                        className="activity-line-reveal flex items-center gap-2 my-1.5 px-3 rounded-xl"
                        style={{
                          fontSize: 11,
                          background: `linear-gradient(90deg, ${milestoneColor}0f 0%, ${milestoneColor}06 60%, transparent 100%)`,
                          border: `1px solid ${milestoneColor}28`,
                          boxShadow: `1.1px 2.2px 0.5px -1.8px ${milestoneColor}55 inset, -1px -2.2px 0.5px -1.8px ${milestoneColor}55 inset`,
                        }}
                      >
                        <span style={{ color: milestoneColor, flexShrink: 0 }}>{icon}</span>
                        <span style={{ color: milestoneColor, fontWeight: 600, padding: "8px 0" }}>{line.text}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${line.ts}-${i}`}
                      className="activity-line-reveal flex items-start gap-2 leading-relaxed py-0.5"
                      style={{ fontSize: 11 }}
                    >
                      <span className="shrink-0 mt-0.5" style={{ color: iconColor }}>{icon}</span>
                      {attrMatch ? (
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>
                          <span style={{ color: "#a78bfa", fontWeight: 600 }}>{attrMatch[1]}</span>
                          {issueMatch ? (
                            <> encountered an issue on <span style={{ color: "#f87171" }}>"{attrMatch[2]}"</span></>
                          ) : (
                            <> completed <span style={{ color: "var(--color-accent)" }}>"{attrMatch[2]}"</span></>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>{line.text}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom wave bar */}
      <div className="absolute bottom-0 left-0 z-10" style={{ right: PANEL_W, pointerEvents: "none" }}>
        <WaveProgress />
      </div>
    </div>
  );
}
