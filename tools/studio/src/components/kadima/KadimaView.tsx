import { useEffect, useState, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { ActionButton } from "@/components/shared/ActionButton";
import { DetailPanel } from "@/components/shared/DetailPanel";

const COLUMN_CONFIG = [
  { key: "pending", label: "Pending", color: "#facc15", statuses: ["pending", "queued"] },
  { key: "running", label: "Running", color: "#4ade80", statuses: ["dispatched", "running", "active"] },
  { key: "completed", label: "Completed", color: "#6c5ce7", statuses: ["completed", "done"] },
  { key: "failed", label: "Failed", color: "#ef4444", statuses: ["failed", "error", "cancelled", "halted"] },
];

type Tab = "kanban" | "queue" | "standup";

function TaskCard({ task, onSelect }: { task: any; onSelect: () => void }) {
  const statusColor = COLUMN_CONFIG.find((c) => c.statuses.includes(task.status))?.color || "#888";
  return (
    <div
      onClick={onSelect}
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        borderLeftWidth: 3,
        borderLeftStyle: "solid",
        borderColor: statusColor,
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.taskId}</span>
      {task.roleId && (
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{task.roleId}</span>
      )}
      {task.featureSlug && (
        <span style={{ fontSize: 10, color: "#6c5ce7", fontFamily: "monospace" }}>{task.featureSlug}</span>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        {task.model && (
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{task.model}</span>
        )}
        {task.cost != null && (
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>${task.cost?.toFixed(4)}</span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ label, color, tasks, onSelectTask }: {
  label: string; color: string; tasks: any[]; onSelectTask: (task: any) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 8, borderBottomWidth: 2, borderBottomStyle: "solid", borderColor: color }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
        <div style={{ backgroundColor: `${color}20`, borderRadius: 10, padding: "0 4px", minWidth: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color }}>{tasks.length}</span>
        </div>
      </div>
      <ScrollArea style={{ maxHeight: 500 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tasks.length === 0 ? (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "16px 0" }}>—</span>
          ) : (
            tasks.map((task, i) => (
              <TaskCard key={task.taskId || i} task={task} onSelect={() => onSelectTask(task)} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function WaveProgress({ scheduler }: { scheduler: any }) {
  const waves = scheduler?.waves || [];
  const currentWave = scheduler?.currentWave ?? -1;
  const totalWaves = waves.length || scheduler?.totalWaves || 0;

  if (totalWaves === 0) return null;

  return (
    <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Wave Progress</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          {currentWave >= 0 ? `Wave ${currentWave + 1} of ${totalWaves}` : `${totalWaves} waves`}
        </span>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {Array.from({ length: totalWaves }).map((_, i) => {
          let color: string;
          if (i < currentWave) color = "#4ade80";
          else if (i === currentWave) color = "#6c5ce7";
          else color = "rgba(255,255,255,0.1)";
          return (
            <div key={i} style={{
              flex: 1, height: 8, borderRadius: 4, backgroundColor: color,
              transition: "background-color 0.3s ease",
            }} />
          );
        })}
      </div>
    </div>
  );
}

export function KadimaView() {
  const [health, setHealth] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [scheduler, setScheduler] = useState<any>(null);
  const [runners, setRunners] = useState<any>(null);
  const [standup, setStandup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [daemonRunning, setDaemonRunning] = useState(false);
  const [tab, setTab] = useState<Tab>("kanban");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [standupLoading, setStandupLoading] = useState(false);
  const { on } = useSocket();

  const fetchAll = useCallback(() => {
    Promise.all([
      api.getKadimaHealth().catch(() => null),
      api.getKadimaDashboard().catch(() => null),
      api.getKadimaScheduler().catch(() => null),
      api.getKadimaRunners().catch(() => null),
    ]).then(([h, d, s, r]) => {
      setHealth(h);
      setDashboard(d);
      setScheduler(s);
      setRunners(r);
      setDaemonRunning(!!h && !h.error);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 8000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    const unsub1 = on("task:dispatched", () => fetchAll());
    const unsub2 = on("task:completed", () => fetchAll());
    const unsub3 = on("task:failed", () => fetchAll());
    const unsub4 = on("wave:started", () => fetchAll());
    const unsub5 = on("wave:completed", () => fetchAll());
    const unsub6 = on("kadima:status", () => fetchAll());
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  }, [on, fetchAll]);

  const handleStandup = async () => {
    setStandupLoading(true);
    try {
      const result = await api.getKadimaStandup();
      setStandup(result.stdout || "No standup data available.");
    } catch {
      setStandup("Failed to generate standup.");
    } finally {
      setStandupLoading(false);
    }
  };

  if (loading) return (
    <div style={{ flex: 1, padding: 28 }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading Kadima...</span>
    </div>
  );

  const queue = scheduler?.queue || [];
  const kanbanData: Record<string, any[]> = { pending: [], running: [], completed: [], failed: [] };
  for (const task of queue) {
    const column = COLUMN_CONFIG.find((c) => c.statuses.includes(task.status));
    if (column) {
      kanbanData[column.key].push(task);
    } else {
      kanbanData.pending.push(task);
    }
  }

  return (
    <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 24, overflow: "auto", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "var(--text)" }}>Kadima Control Plane</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: daemonRunning ? "#4ade80" : "#ef4444",
          }} />
          <span style={{ fontSize: 13, color: daemonRunning ? "#4ade80" : "#ef4444" }}>
            {daemonRunning ? "Daemon Running" : "Daemon Offline"}
          </span>
        </div>
      </div>

      {!daemonRunning ? (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Kadima daemon is not running</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
              Manages task scheduling, runner pools, and state machines.
            </span>
          </div>
          <button
            onClick={async () => {
              try { await api.startKadima(); } catch {}
            }}
            style={{
              alignSelf: "flex-start", padding: "8px 20px", borderRadius: 8, cursor: "pointer", border: "1px solid rgba(99,241,157,0.35)",
              background: "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.1) 100%)",
              color: "#63f19d", fontSize: 13, fontWeight: 600,
            }}
          >
            Start Daemon
          </button>
        </div>
      ) : (
        <>
          {/* Health Stats */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Status", value: health?.status || "OK", color: "#4ade80" },
              { label: "Uptime", value: health?.uptimeMs ? `${Math.floor(health.uptimeMs / 60000)}m` : "—", color: undefined },
              { label: "Active Loops", value: String(health?.loops?.active || dashboard?.loops?.active || "—"), color: undefined },
              { label: "Queue", value: String(queue.length), color: undefined },
              { label: "Runners", value: `${runners?.active || 0}/${runners?.maxConcurrent || 4}`, color: undefined },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, minWidth: 120, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>

          <WaveProgress scheduler={scheduler} />

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { key: "kanban", label: "Kanban Board" },
              { key: "queue", label: "Queue Detail" },
              { key: "standup", label: "Standup" },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  if (key === "standup" && !standup) handleStandup();
                }}
                style={{
                  paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  borderRadius: 8, cursor: "pointer", border: "none",
                  backgroundColor: tab === key ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: tab === key ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>{label}</span>
              </button>
            ))}
          </div>

          <Separator style={{ borderColor: "rgba(255,255,255,0.08)" }} />

          {/* Kanban Tab */}
          {tab === "kanban" && (
            <div style={{ display: "flex", gap: 16, flex: 1 }}>
              {COLUMN_CONFIG.map((col) => (
                <KanbanColumn
                  key={col.key}
                  label={col.label}
                  color={col.color}
                  tasks={kanbanData[col.key]}
                  onSelectTask={setSelectedTask}
                />
              ))}
            </div>
          )}

          {/* Queue Detail Tab */}
          {tab === "queue" && (
            <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Scheduler Queue</span>
              {queue.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {queue.slice(0, 30).map((task: any, i: number) => {
                    const statusColor = COLUMN_CONFIG.find((c) => c.statuses.includes(task.status))?.color || "#888";
                    return (
                      <div
                        key={task.taskId || i}
                        onClick={() => setSelectedTask(task)}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.03)",
                          borderRadius: 4,
                          padding: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
                          <span style={{ fontSize: 13, fontFamily: "monospace" }}>{task.taskId}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{task.roleId || "—"}</span>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{task.featureSlug || "—"}</span>
                          <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>{task.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Queue empty</span>
              )}
            </div>
          )}

          {/* Standup Tab */}
          {tab === "standup" && (
            <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Today's Standup</span>
                <ActionButton
                  label="Refresh"
                  variant="ghost"
                  onAction={handleStandup}
                />
              </div>
              {standupLoading ? (
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Generating standup...</span>
              ) : standup ? (
                <div style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 12 }}>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "rgba(255,255,255,0.5)", whiteSpace: "pre-wrap" as any }}>
                    {standup}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Click Refresh to generate standup report</span>
              )}
            </div>
          )}
        </>
      )}

      {selectedTask && (
        <DetailPanel
          title={selectedTask.taskId || "Task Details"}
          data={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
