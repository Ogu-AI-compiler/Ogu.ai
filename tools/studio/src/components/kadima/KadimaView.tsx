import { useEffect, useState, useCallback } from "react";
import { styled, Text, YStack, XStack, Separator, ScrollView } from "tamagui";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { ActionButton } from "@/components/shared/ActionButton";
import { DetailPanel } from "@/components/shared/DetailPanel";

const Page = styled(YStack, { flex: 1, padding: "$7", gap: "$6", overflow: "scroll", position: "relative" as any });
const Card = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  gap: "$3",
});
const StatBox = styled(YStack, {
  backgroundColor: "rgba(255,255,255,0.04)",
  borderRadius: "$2",
  padding: "$3",
  minWidth: 120,
  gap: "$1",
});
const TabBtn = styled(XStack, {
  paddingHorizontal: "$3",
  paddingVertical: "$2",
  borderRadius: "$2",
  cursor: "pointer",
  variants: {
    active: {
      true: { backgroundColor: "rgba(108,92,231,0.2)" },
      false: { backgroundColor: "rgba(255,255,255,0.04)", hoverStyle: { backgroundColor: "rgba(255,255,255,0.08)" } },
    },
  } as const,
});

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
    <YStack
      backgroundColor="rgba(255,255,255,0.04)"
      borderRadius="$2"
      padding="$3"
      gap="$1"
      borderLeftWidth={3}
      borderColor={statusColor}
      cursor="pointer"
      hoverStyle={{ backgroundColor: "rgba(255,255,255,0.06)" }}
      onPress={onSelect}
    >
      <Text fontSize="$2" fontWeight="600" fontFamily="$mono" numberOfLines={1}>{task.taskId}</Text>
      {task.roleId && (
        <Text fontSize={10} color="$colorPress">{task.roleId}</Text>
      )}
      {task.featureSlug && (
        <Text fontSize={10} color="#6c5ce7" fontFamily="$mono">{task.featureSlug}</Text>
      )}
      <XStack gap="$2" justifyContent="space-between">
        {task.model && (
          <Text fontSize={9} color="$colorPress">{task.model}</Text>
        )}
        {task.cost != null && (
          <Text fontSize={9} color="$colorPress">${task.cost?.toFixed(4)}</Text>
        )}
      </XStack>
    </YStack>
  );
}

function KanbanColumn({ label, color, tasks, onSelectTask }: {
  label: string; color: string; tasks: any[]; onSelectTask: (task: any) => void;
}) {
  return (
    <YStack flex={1} minWidth={180} gap="$2">
      <XStack gap="$2" alignItems="center" paddingBottom="$2" borderBottomWidth={2} borderColor={color}>
        <Text fontSize="$2" fontWeight="700" color={color}>{label}</Text>
        <XStack backgroundColor={`${color}20`} borderRadius={10} paddingHorizontal="$1" minWidth={20} alignItems="center" justifyContent="center">
          <Text fontSize={10} fontWeight="600" color={color}>{tasks.length}</Text>
        </XStack>
      </XStack>
      <ScrollView maxHeight={500}>
        <YStack gap="$2">
          {tasks.length === 0 ? (
            <Text fontSize="$1" color="rgba(255,255,255,0.2)" textAlign="center" paddingVertical="$4">—</Text>
          ) : (
            tasks.map((task, i) => (
              <TaskCard key={task.taskId || i} task={task} onSelect={() => onSelectTask(task)} />
            ))
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function WaveProgress({ scheduler }: { scheduler: any }) {
  const waves = scheduler?.waves || [];
  const currentWave = scheduler?.currentWave ?? -1;
  const totalWaves = waves.length || scheduler?.totalWaves || 0;

  if (totalWaves === 0) return null;

  return (
    <Card>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$3" fontWeight="600">Wave Progress</Text>
        <Text fontSize="$1" color="$colorPress">
          {currentWave >= 0 ? `Wave ${currentWave + 1} of ${totalWaves}` : `${totalWaves} waves`}
        </Text>
      </XStack>
      <XStack gap="$1" alignItems="center">
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
      </XStack>
    </Card>
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

  // WebSocket live updates
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

  if (loading) return <Page><Text color="$colorPress">Loading Kadima...</Text></Page>;

  // Build Kanban columns from scheduler queue
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
    <Page>
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$7" fontWeight="700" letterSpacing={-0.5}>Kadima Control Plane</Text>
        <XStack gap="$2" alignItems="center">
          <div style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: daemonRunning ? "#4ade80" : "#ef4444",
          }} />
          <Text fontSize="$2" color={daemonRunning ? "#4ade80" : "#ef4444"}>
            {daemonRunning ? "Daemon Running" : "Daemon Offline"}
          </Text>
        </XStack>
      </XStack>

      {!daemonRunning ? (
        <Card>
          <Text fontSize="$3" fontWeight="600">Kadima daemon is not running</Text>
          <Text fontSize="$2" color="$colorPress">Start it with: ogu kadima:start</Text>
          <Text fontSize="$1" color="$colorPress" fontFamily="$mono">
            The daemon manages task scheduling, runner pools, and state machines.
          </Text>
        </Card>
      ) : (
        <>
          {/* Health Stats */}
          <XStack gap="$4" flexWrap="wrap">
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Status</Text>
              <Text fontSize="$4" fontWeight="700" color="#4ade80">{health?.status || "OK"}</Text>
            </StatBox>
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Uptime</Text>
              <Text fontSize="$4" fontWeight="700">
                {health?.uptimeMs ? `${Math.floor(health.uptimeMs / 60000)}m` : "—"}
              </Text>
            </StatBox>
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Active Loops</Text>
              <Text fontSize="$4" fontWeight="700">
                {health?.loops?.active || dashboard?.loops?.active || "—"}
              </Text>
            </StatBox>
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Queue</Text>
              <Text fontSize="$4" fontWeight="700">{queue.length}</Text>
            </StatBox>
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Runners</Text>
              <Text fontSize="$4" fontWeight="700">
                {runners?.active || 0}/{runners?.maxConcurrent || 4}
              </Text>
            </StatBox>
          </XStack>

          {/* Wave Progress */}
          <WaveProgress scheduler={scheduler} />

          {/* Tabs */}
          <XStack gap="$2">
            {([
              { key: "kanban", label: "Kanban Board" },
              { key: "queue", label: "Queue Detail" },
              { key: "standup", label: "Standup" },
            ] as { key: Tab; label: string }[]).map(({ key, label }) => (
              <TabBtn key={key} active={tab === key} onPress={() => {
                setTab(key);
                if (key === "standup" && !standup) handleStandup();
              }}>
                <Text fontSize="$2" fontWeight="600" color={tab === key ? "#a78bfa" : "$colorPress"}>{label}</Text>
              </TabBtn>
            ))}
          </XStack>

          <Separator borderColor="rgba(255,255,255,0.08)" />

          {/* Kanban Tab */}
          {tab === "kanban" && (
            <XStack gap="$4" flex={1}>
              {COLUMN_CONFIG.map((col) => (
                <KanbanColumn
                  key={col.key}
                  label={col.label}
                  color={col.color}
                  tasks={kanbanData[col.key]}
                  onSelectTask={setSelectedTask}
                />
              ))}
            </XStack>
          )}

          {/* Queue Detail Tab */}
          {tab === "queue" && (
            <Card>
              <Text fontSize="$3" fontWeight="600">Scheduler Queue</Text>
              {queue.length > 0 ? (
                <YStack gap="$2">
                  {queue.slice(0, 30).map((task: any, i: number) => {
                    const statusColor = COLUMN_CONFIG.find((c) => c.statuses.includes(task.status))?.color || "#888";
                    return (
                      <XStack
                        key={task.taskId || i}
                        backgroundColor="rgba(255,255,255,0.03)"
                        borderRadius="$1"
                        padding="$2"
                        justifyContent="space-between"
                        alignItems="center"
                        cursor="pointer"
                        hoverStyle={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                        onPress={() => setSelectedTask(task)}
                      >
                        <XStack gap="$2" alignItems="center">
                          <div style={{
                            width: 6, height: 6, borderRadius: 3,
                            backgroundColor: statusColor,
                          }} />
                          <Text fontSize="$2" fontFamily="$mono">{task.taskId}</Text>
                        </XStack>
                        <XStack gap="$3">
                          <Text fontSize="$1" color="$colorPress">{task.roleId || "—"}</Text>
                          <Text fontSize="$1" color="$colorPress">{task.featureSlug || "—"}</Text>
                          <Text fontSize="$1" color={statusColor} fontWeight="600">{task.status}</Text>
                        </XStack>
                      </XStack>
                    );
                  })}
                </YStack>
              ) : (
                <Text fontSize="$2" color="$colorPress">Queue empty</Text>
              )}
            </Card>
          )}

          {/* Standup Tab */}
          {tab === "standup" && (
            <Card>
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$3" fontWeight="600">Today's Standup</Text>
                <ActionButton
                  label="Refresh"
                  variant="ghost"
                  onAction={handleStandup}
                />
              </XStack>
              {standupLoading ? (
                <Text fontSize="$2" color="$colorPress">Generating standup...</Text>
              ) : standup ? (
                <YStack backgroundColor="rgba(255,255,255,0.03)" borderRadius="$2" padding="$3">
                  <Text fontSize="$2" fontFamily="$mono" color="$colorPress" style={{ whiteSpace: "pre-wrap" as any }}>
                    {standup}
                  </Text>
                </YStack>
              ) : (
                <Text fontSize="$2" color="$colorPress">Click Refresh to generate standup report</Text>
              )}
            </Card>
          )}
        </>
      )}

      {/* Detail Panel */}
      {selectedTask && (
        <DetailPanel
          title={selectedTask.taskId || "Task Details"}
          data={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </Page>
  );
}
