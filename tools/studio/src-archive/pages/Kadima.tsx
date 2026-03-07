import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { useStore } from "@/lib/store";
import { ScreenLayout } from "@/components/shared/ScreenLayout";
import { ActionButton } from "@/components/shared/ActionButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

type Tab = "status" | "standups" | "allocations" | "logs";

interface KadimaStatus {
  running: boolean;
  pid: number | null;
  uptimeMs: number | null;
  uptimeFormatted: string | null;
  config: { maxConcurrent: number; port: number; host: string };
  tasks: { queued: number; running: number; completed: number; failed: number; total: number };
}

interface Standup {
  date: string;
  content?: string;
  summary?: string;
  source: string;
}

interface Allocation {
  taskId: string;
  taskName: string;
  roleId: string;
  status: string;
  featureSlug?: string;
  startedAt?: string;
  completedAt?: string;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "#94a3b8",
  in_progress: "#38bdf8",
  done: "#4ade80",
  blocked: "#f87171",
};

export function Kadima() {
  const [status, setStatus] = useState<KadimaStatus | null>(null);
  const [standups, setStandups] = useState<Standup[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("status");
  const { on } = useSocket();
  const setRoute = useStore((s) => s.setRoute);

  const fetchData = useCallback(() => {
    Promise.all([
      api.getKadimaStatus().catch(() => null),
      api.getKadimaStandups().catch(() => ({ standups: [] })),
      api.getKadimaAllocations().catch(() => ({ allocations: [] })),
    ]).then(([s, st, al]) => {
      if (s) setStatus(s);
      setStandups(st?.standups || []);
      setAllocations(al?.allocations || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Real-time updates
  useEffect(() => {
    const unsub1 = on("kadima:status", () => fetchData());
    const unsub2 = on("scheduler:tick", () => fetchData());
    return () => { unsub1(); unsub2(); };
  }, [on, fetchData]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.startKadima();
    } catch { /* refresh below */ }
    setTimeout(fetchData, 1500);
    setActionLoading(false);
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await api.stopKadima();
    } catch { /* refresh below */ }
    setTimeout(fetchData, 1500);
    setActionLoading(false);
  };

  const fetchLogs = useCallback(() => {
    fetch("/api/kadima/logs?limit=100")
      .then((r) => r.json())
      .then((d) => setLogs(d?.logs || []))
      .catch(() => setLogs([]));
  }, []);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-10 gap-8 overflow-auto relative">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-24 w-[200px]" />
          <Skeleton className="h-24 w-[200px]" />
          <Skeleton className="h-24 w-[200px]" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const running = status?.running ?? false;
  const tasks = status?.tasks || { queued: 0, running: 0, completed: 0, failed: 0, total: 0 };

  return (
    <ScreenLayout
      title="Kadima"
      subtitle={running ? `PID ${status?.pid} -- ${status?.uptimeFormatted || "running"}` : "Daemon offline"}
      tabs={[
        { key: "status", label: "Status" },
        { key: "standups", label: `Standups (${standups.length})` },
        { key: "allocations", label: `Allocations (${allocations.length})` },
        { key: "logs", label: "Logs" },
      ]}
      activeTab={tab}
      onTabChange={(key) => setTab(key as Tab)}
    >
      <div className="flex flex-col flex-1 p-8 gap-6">

        {/* ── Status Tab ── */}
        {tab === "status" && (
          <>
            {/* Daemon Status */}
            <div className="flex gap-4 flex-wrap">
              <Card className="flex flex-col gap-3 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <StatusDot
                    size="lg"
                    color={running ? "#4ade80" : "#ef4444"}
                    glow={running}
                  />
                  <span className="text-sm font-bold text-text">
                    {running ? "Running" : "Stopped"}
                  </span>
                </div>
                {running && status?.uptimeFormatted && (
                  <span className="text-[11px] text-text-muted">Uptime: {status.uptimeFormatted}</span>
                )}
                {running && status?.pid && (
                  <span className="text-[10px] text-text-muted font-mono">PID: {status.pid}</span>
                )}
              </Card>

              <Card className="flex flex-col gap-3 min-w-[200px]">
                <span className="text-[10px] text-text-muted font-semibold">Configuration</span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-secondary">
                    Max Concurrent: {status?.config?.maxConcurrent || 4}
                  </span>
                  <span className="text-xs text-text-secondary">
                    Port: {status?.config?.port || 4210}
                  </span>
                  <span className="text-xs text-text-secondary font-mono">
                    {status?.config?.host || "127.0.0.1"}:{status?.config?.port || 4210}
                  </span>
                </div>
              </Card>

              <Card className="flex flex-col gap-3 min-w-[200px]">
                <span className="text-[10px] text-text-muted font-semibold">Task Summary</span>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-xs text-text-muted">Queued</span>
                    <span className="text-xs font-semibold" style={{ color: STATUS_COLORS.queued }}>
                      {tasks.queued}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-text-muted">Running</span>
                    <span className="text-xs font-semibold" style={{ color: STATUS_COLORS.in_progress }}>
                      {tasks.running}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-text-muted">Completed</span>
                    <span className="text-xs font-semibold" style={{ color: STATUS_COLORS.done }}>
                      {tasks.completed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-text-muted">Failed</span>
                    <span className="text-xs font-semibold" style={{ color: STATUS_COLORS.blocked }}>
                      {tasks.failed}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!running ? (
                <ActionButton
                  label={actionLoading ? "Starting..." : "Start Daemon"}
                  variant="success"
                  onAction={handleStart}
                  disabled={actionLoading}
                />
              ) : (
                <ActionButton
                  label={actionLoading ? "Stopping..." : "Stop Daemon"}
                  variant="danger"
                  onAction={handleStop}
                  confirm="Stop Kadima daemon?"
                  disabled={actionLoading}
                />
              )}
              <ActionButton
                label="View Pipeline"
                variant="ghost"
                onAction={() => setRoute("/pipeline")}
              />
            </div>

            {/* Quick Stats Bar */}
            {tasks.total > 0 && (
              <>
                <Separator />
                <div className="flex items-end gap-1 h-8">
                  {[
                    { label: "Queued", count: tasks.queued, color: STATUS_COLORS.queued },
                    { label: "Running", count: tasks.running, color: STATUS_COLORS.in_progress },
                    { label: "Done", count: tasks.completed, color: STATUS_COLORS.done },
                    { label: "Failed", count: tasks.failed, color: STATUS_COLORS.blocked },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-[2px] flex-1">
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 60,
                          height: Math.max((s.count / Math.max(tasks.total, 1)) * 28, 3),
                          borderRadius: 2,
                          backgroundColor: s.color,
                        }}
                      />
                      <span className="text-[8px] text-text-muted">{s.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Standups Tab ── */}
        {tab === "standups" && (
          <>
            {standups.length === 0 ? (
              <Card className="flex flex-col gap-3">
                <span className="text-sm text-text-muted">
                  No standups found. Run: ogu kadima:standup
                </span>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {[...standups].reverse().map((standup, i) => (
                  <Card key={standup.date || i} className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-text">{standup.date}</span>
                      <Badge variant="secondary">{standup.source}</Badge>
                    </div>
                    {standup.summary && (
                      <span className="text-xs text-text-secondary">{standup.summary}</span>
                    )}
                    {standup.content && (
                      <pre className="text-[11px] text-text-muted whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-auto">
                        {standup.content.slice(0, 2000)}
                      </pre>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Allocations Tab ── */}
        {tab === "allocations" && (
          <>
            {allocations.length === 0 ? (
              <Card className="flex flex-col gap-3">
                <span className="text-sm text-text-muted">
                  No task allocations. Run: ogu kadima:allocate &lt;slug&gt;
                </span>
              </Card>
            ) : (
              <div className="flex flex-col gap-1">
                {allocations.map((alloc, i) => {
                  const color = STATUS_COLORS[alloc.status] || "#888";
                  return (
                    <div
                      key={alloc.taskId || i}
                      className="flex gap-3 items-center rounded-md p-2.5 bg-bg-card hover:bg-bg-card-hover transition-colors"
                      style={{ border: "1px solid var(--color-border, var(--border))" }}
                    >
                      <StatusDot color={color} />
                      <span className="text-sm font-semibold text-text flex-1 truncate">
                        {alloc.taskName || alloc.taskId}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">{alloc.roleId}</span>
                      {alloc.featureSlug && (
                        <span className="text-[10px] text-text-secondary">{alloc.featureSlug}</span>
                      )}
                      <div
                        className="flex items-center rounded px-2 py-0.5"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <span className="text-[10px] font-semibold" style={{ color }}>
                          {alloc.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Logs Tab ── */}
        {tab === "logs" && (
          <>
            {logs.length === 0 ? (
              <Card className="flex flex-col gap-3">
                <span className="text-sm text-text-muted">No daemon logs available</span>
              </Card>
            ) : (
              <div className="flex flex-col gap-0.5 max-h-[600px] overflow-auto rounded-lg border border-border bg-bg p-4">
                {logs.map((log, i) => {
                  const text = typeof log === "string" ? log : JSON.stringify(log);
                  return (
                    <span key={i} className="font-mono text-[11px] text-text-muted">
                      {text}
                    </span>
                  );
                })}
              </div>
            )}
            <ActionButton
              label="Refresh Logs"
              variant="ghost"
              onAction={fetchLogs}
            />
          </>
        )}

      </div>
    </ScreenLayout>
  );
}
