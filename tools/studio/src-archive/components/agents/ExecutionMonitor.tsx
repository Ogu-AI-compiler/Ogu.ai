import { useEffect, useState, useCallback, useRef } from "react";
import { useStore, type AgentStatus } from "@/lib/store";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  idle: "#555",
  executing: "#4ade80",
  blocked: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  executing: "Executing",
  blocked: "Blocked",
};

function formatElapsed(startedAt?: string | null): string {
  if (!startedAt) return "";
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return "";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// Mini task graph node
function TaskNode({ status, label }: { status: "completed" | "current" | "pending"; label: string }) {
  const colors = {
    completed: "#4ade80",
    current: "#facc15",
    pending: "#555",
  };
  const color = colors[status];
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          backgroundColor: color,
          boxShadow: status === "current" ? `0 0 6px ${color}80` : "none",
        }}
      />
      <span
        className="text-[9px] font-mono truncate max-w-[80px]"
        style={{
          color: status === "pending" ? "var(--color-text-muted)" : "var(--color-text-secondary)",
          fontWeight: status === "current" ? 600 : 400,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// Live log viewer per agent
function AgentLogViewer({ roleId }: { roleId: string }) {
  const logs = useStore((s) => s.agentLogs[roleId] || []);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-4 rounded-lg"
        style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
      >
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          No log output yet
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col max-h-[160px] overflow-auto rounded-lg px-3 py-2"
      style={{
        backgroundColor: "var(--color-bg, #0a0a0a)",
        border: "1px solid var(--color-border, #2a2a3e)",
      }}
    >
      {logs.slice(-50).map((line, i) => {
        const isError = line.startsWith("[ERROR]") || line.toLowerCase().includes("error");
        return (
          <span
            key={i}
            className="text-[10px] font-mono leading-relaxed"
            style={{ color: isError ? "#ef4444" : "var(--color-text-muted)" }}
          >
            {line}
          </span>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

// Single agent card in the monitor
function AgentMonitorCard({ agent }: { agent: AgentStatus }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLORS[agent.status] || "#555";
  const isActive = agent.status === "executing";

  // Build mini task graph
  const allTasks = [
    ...agent.tasksCompleted.map((t) => ({ id: t, status: "completed" as const })),
    ...(agent.currentTask ? [{ id: agent.currentTask, status: "current" as const }] : []),
    ...agent.tasksPending.filter((t) => t !== agent.currentTask).map((t) => ({ id: t, status: "pending" as const })),
  ];
  const maxVisible = 6;
  const visibleTasks = allTasks.slice(0, maxVisible);
  const overflow = allTasks.length - maxVisible;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4 transition-all"
      style={{
        backgroundColor: "var(--color-bg-card, #1a1a2e)",
        border: `1px solid ${isActive ? `${statusColor}44` : "var(--color-border, #2a2a3e)"}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <StatusDot
            color={statusColor}
            size="lg"
            glow={isActive}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {agent.roleName}
            </span>
            <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
              {agent.roleId}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={agent.status === "executing" ? "success" : agent.status === "blocked" ? "error" : "secondary"}
          >
            {STATUS_LABELS[agent.status]}
          </Badge>
          {isActive && agent.startedAt && (
            <span className="text-[10px] font-mono" style={{ color: "var(--color-text-secondary)" }}>
              {formatElapsed(agent.startedAt)}
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {expanded ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      </div>

      {/* Current task */}
      {agent.currentTask && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5"
          style={{ backgroundColor: `${statusColor}12` }}
        >
          <span className="text-[10px] font-semibold" style={{ color: statusColor }}>
            Current:
          </span>
          <span className="text-[11px] font-mono" style={{ color: "var(--color-text)" }}>
            {agent.currentTask}
          </span>
        </div>
      )}

      {/* Mini task graph */}
      {allTasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
            Task Graph
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            {visibleTasks.map((task, i) => (
              <div key={task.id} className="flex items-center gap-1">
                <TaskNode status={task.status} label={task.id} />
                {i < visibleTasks.length - 1 && (
                  <svg width={12} height={8} viewBox="0 0 12 8">
                    <path d="M0 4 L8 4 M6 1 L9 4 L6 7" fill="none" stroke="var(--color-border, #2a2a3e)" strokeWidth={1} />
                  </svg>
                )}
              </div>
            ))}
            {overflow > 0 && (
              <span className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>
                +{overflow} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          Completed: <span className="font-semibold" style={{ color: "#4ade80" }}>{agent.tasksCompleted.length}</span>
        </span>
        <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          Pending: <span className="font-semibold" style={{ color: "#facc15" }}>{agent.tasksPending.length}</span>
        </span>
      </div>

      {/* Expanded: log stream */}
      {expanded && (
        <div className="flex flex-col gap-2 pt-2" style={{ borderTop: "1px solid var(--color-border, #2a2a3e)" }}>
          <span className="text-[10px] font-semibold" style={{ color: "var(--color-text-muted)" }}>
            Log Stream
          </span>
          <AgentLogViewer roleId={agent.roleId} />
        </div>
      )}
    </div>
  );
}

export function ExecutionMonitor() {
  const agentStatuses = useStore((s) => s.agentStatuses);
  const setAgentStatuses = useStore((s) => s.setAgentStatuses);
  const activeFeature = useStore((s) => s.activeFeature);
  const activeProject = useStore((s) => s.activeProjectSlug);
  const slug = activeFeature || activeProject || "";
  const { on } = useSocket();

  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatuses = useCallback(() => {
    if (!slug) { setLoading(false); return; }
    api.getAgentStatuses(slug)
      .then((d) => setAgentStatuses(d.statuses || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, setAgentStatuses]);

  useEffect(() => {
    fetchStatuses();
    timerRef.current = setInterval(fetchStatuses, 8000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchStatuses]);

  // WebSocket live updates
  useEffect(() => {
    const unsub1 = on("agent:started", () => fetchStatuses());
    const unsub2 = on("agent:completed", () => fetchStatuses());
    const unsub3 = on("agent:failed", () => fetchStatuses());
    const unsub4 = on("agent:task_complete", () => fetchStatuses());
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [on, fetchStatuses]);

  const agents = Object.values(agentStatuses);

  // Sort: executing first, then blocked, then idle
  const sortOrder: Record<string, number> = { executing: 0, blocked: 1, idle: 2 };
  const sorted = [...agents].sort((a, b) => (sortOrder[a.status] ?? 3) - (sortOrder[b.status] ?? 3));

  const activeCount = agents.filter((a) => a.status === "executing").length;
  const blockedCount = agents.filter((a) => a.status === "blocked").length;

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse h-24 rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl"
        style={{
          backgroundColor: "var(--color-bg-card, #1a1a2e)",
          border: "1px solid var(--color-border, #2a2a3e)",
        }}
      >
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted, #7a7a7a)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No agent statuses available
        </span>
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Agents will appear here once org:init is run and tasks are dispatched
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Execution Monitor
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <StatusDot color="#4ade80" size="sm" />
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              {activeCount} active
            </span>
          </div>
          {blockedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <StatusDot color="#ef4444" size="sm" />
              <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                {blockedCount} blocked
              </span>
            </div>
          )}
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            {agents.length} total
          </span>
        </div>
      </div>

      {/* Agent cards */}
      {sorted.map((agent) => (
        <AgentMonitorCard key={agent.roleId} agent={agent} />
      ))}
    </div>
  );
}
