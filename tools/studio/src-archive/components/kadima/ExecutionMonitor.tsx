import { useEffect, useState, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

// ── Event type colors ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  "task.started":         "#4ade80",
  "task.completed":       "#6c5ce7",
  "task.failed":          "#ef4444",
  "gate.checking":        "#facc15",
  "gate.passed":          "#4ade80",
  "gate.failed":          "#ef4444",
  "retry.started":        "#f97316",
  "retry.exhausted":      "#ef4444",
  "compile.started":      "#3b82f6",
  "compile.gate":         "#6c5ce7",
  "compile.finished":     "#4ade80",
  "escalation.triggered": "#f97316",
  "feedback.created":     "#a78bfa",
  "learning.candidate":   "#ec4899",
};

function getColor(type: string): string {
  return TYPE_COLORS[type] || "#888";
}

function formatTime(ts: string): string {
  if (!ts) return "--:--:--";
  return ts.slice(11, 19);
}

// ── Timeline row ─────────────────────────────────────────────────────────────

function TimelineRow({ event }: { event: any }) {
  const color = getColor(event.type);
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start", padding: "6px 0",
      borderBottomWidth: 1, borderBottomStyle: "solid", borderColor: "rgba(255,255,255,0.04)",
    }}>
      <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.4)", minWidth: 60 }}>
        {formatTime(event.timestamp)}
      </span>
      <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginTop: 3, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "monospace" }}>{event.type}</span>
          {event.taskId && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{event.taskId}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {event.gate && <Tag label={`gate:${event.gate}`} color="#facc15" />}
          {event.attempt && <Tag label={`attempt:${event.attempt}`} color="#f97316" />}
          {event.durationMs && <Tag label={`${event.durationMs}ms`} color="#3b82f6" />}
          {event.fromTier && <Tag label={`${event.fromTier}→${event.toTier}`} color="#f97316" />}
          {event.error && <span style={{ fontSize: 10, color: "#ef4444" }}>{String(event.error).slice(0, 80)}</span>}
        </div>
      </div>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, padding: "1px 6px", borderRadius: 4,
      backgroundColor: `${color}15`, color, fontFamily: "monospace",
    }}>
      {label}
    </span>
  );
}

// ── Agent status card ────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: any }) {
  const statusColor = agent.status === "executing" ? "#4ade80" : agent.status === "blocked" ? "#ef4444" : "#555";
  return (
    <div style={{
      backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12,
      borderLeftWidth: 3, borderLeftStyle: "solid", borderColor: statusColor,
      display: "flex", flexDirection: "column", gap: 4, minWidth: 180,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{agent.roleId}</span>
      <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>{agent.status}</span>
      {agent.currentTask && (
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{agent.currentTask}</span>
      )}
    </div>
  );
}

// ── Task status grid ─────────────────────────────────────────────────────────

const TASK_STATUSES = [
  { key: "running", label: "Running", color: "#4ade80" },
  { key: "passed", label: "Passed", color: "#6c5ce7" },
  { key: "failed", label: "Failed", color: "#ef4444" },
  { key: "retrying", label: "Retrying", color: "#f97316" },
];

function TaskStatusGrid({ events }: { events: any[] }) {
  const taskMap = new Map<string, string>();
  for (const e of events) {
    if (!e.taskId) continue;
    if (e.type === "task.started") taskMap.set(e.taskId, "running");
    if (e.type === "task.completed") taskMap.set(e.taskId, "passed");
    if (e.type === "task.failed") taskMap.set(e.taskId, "failed");
    if (e.type === "retry.started") taskMap.set(e.taskId, "retrying");
  }

  const counts: Record<string, number> = { running: 0, passed: 0, failed: 0, retrying: 0 };
  for (const status of taskMap.values()) {
    if (counts[status] !== undefined) counts[status]++;
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {TASK_STATUSES.map(({ key, label, color }) => (
        <div key={key} style={{
          backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12,
          minWidth: 100, display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
        }}>
          <span style={{ fontSize: 24, fontWeight: 700, color }}>{counts[key]}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────

const EVENT_CATEGORIES = [
  { label: "All", value: "" },
  { label: "Tasks", value: "task" },
  { label: "Gates", value: "gate" },
  { label: "Retries", value: "retry" },
  { label: "Compile", value: "compile" },
  { label: "Learning", value: "learning" },
];

// ── Main component ───────────────────────────────────────────────────────────

export function ExecutionMonitor() {
  const [events, setEvents] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { on } = useSocket();

  const fetchEvents = useCallback(() => {
    const filters: any = { limit: 100 };
    if (taskFilter) filters.taskId = taskFilter;
    Promise.all([
      api.getExecutionFeed(filters).catch(() => ({ events: [], total: 0 })),
      api.getExecutionStats().catch(() => ({ total: 0, byType: {} })),
    ]).then(([feed, st]) => {
      setEvents(feed.events || []);
      setStats(st);
    }).finally(() => setLoading(false));
  }, [taskFilter]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Live updates via SSE/WS
  useEffect(() => {
    const types = [
      "execution:task.started", "execution:task.completed", "execution:task.failed",
      "execution:gate.passed", "execution:gate.failed",
      "execution:retry.started", "execution:compile.finished",
    ];
    const unsubs = types.map(t => on(t, () => fetchEvents()));
    return () => unsubs.forEach(u => u());
  }, [on, fetchEvents]);

  const filteredEvents = filter
    ? events.filter(e => e.type?.startsWith(filter))
    : events;

  if (loading) {
    return (
      <div style={{ flex: 1, padding: 28 }}>
        <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading execution feed...</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 20, overflow: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: "var(--text)" }}>Execution Monitor</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: events.length > 0 ? "#4ade80" : "#555" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{stats?.total || 0} events</span>
        </div>
      </div>

      {/* Task status summary */}
      <TaskStatusGrid events={events} />

      <Separator style={{ borderColor: "rgba(255,255,255,0.08)" }} />

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {EVENT_CATEGORIES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            style={{
              padding: "4px 10px", borderRadius: 6, cursor: "pointer", border: "none",
              backgroundColor: filter === value ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: filter === value ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>
              {label}
            </span>
          </button>
        ))}
        <input
          type="text"
          placeholder="Filter by taskId..."
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value)}
          style={{
            marginLeft: "auto", padding: "4px 10px", borderRadius: 6,
            backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text)", fontSize: 11, fontFamily: "monospace", width: 180,
          }}
        />
      </div>

      {/* Timeline */}
      <div style={{
        backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 16,
        borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)",
        flex: 1, minHeight: 300,
      }}>
        <ScrollArea style={{ maxHeight: 500 }} ref={scrollRef}>
          {filteredEvents.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                No execution events yet. Events will appear when tasks run.
              </span>
            </div>
          ) : (
            filteredEvents.map((event, i) => (
              <TimelineRow key={event.timestamp + i} event={event} />
            ))
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
