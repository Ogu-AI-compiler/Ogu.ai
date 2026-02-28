import { useEffect, useState, useCallback, useRef } from "react";
import { styled, Text, YStack, XStack, Separator, Input } from "tamagui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
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
const StatRow = styled(XStack, { gap: "$4", flexWrap: "wrap" });
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

const TIER_COLORS: Record<string, string> = {
  low: "#4ade80", medium: "#facc15", high: "#f87171", critical: "#ef4444",
};
const STATUS_COLORS: Record<string, string> = {
  idle: "rgba(255,255,255,0.2)", running: "#4ade80", failed: "#ef4444", stopped: "#facc15",
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, backgroundColor: color, transition: "width 0.3s ease" }} />
    </div>
  );
}

type Tab = "departments" | "grid" | "worktrees";

// ── Agent Grid Card ──
function safeState(agent: any) {
  const s = agent?.state || {};
  return {
    currentTask: s.currentTask || null,
    tasksCompleted: s.tasksCompleted || 0,
    tasksFailed: s.tasksFailed || 0,
    tokensUsed: s.tokensUsed || 0,
    costUsed: s.costUsed || 0,
  };
}

function AgentGridCard({ agent, onSelect }: { agent: any; onSelect: () => void }) {
  const st = safeState(agent);
  const isActive = !!st.currentTask;
  const totalTasks = st.tasksCompleted + st.tasksFailed;
  const successRate = totalTasks > 0 ? Math.round((st.tasksCompleted / totalTasks) * 100) : 100;
  const color = isActive ? "#4ade80" : "rgba(255,255,255,0.2)";

  return (
    <YStack
      backgroundColor="rgba(22,22,22,0.6)"
      borderRadius="$3"
      padding="$3"
      gap="$2"
      borderWidth={1}
      borderColor={isActive ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}
      width={180}
      cursor="pointer"
      hoverStyle={{ borderColor: "rgba(255,255,255,0.15)" }}
      onPress={onSelect}
    >
      <XStack gap="$2" alignItems="center">
        <div style={{
          width: 10, height: 10, borderRadius: 5, backgroundColor: color,
          boxShadow: isActive ? "0 0 6px rgba(74,222,128,0.5)" : "none",
        }} />
        <Text fontSize="$2" fontWeight="700" numberOfLines={1} flex={1}>{agent.name}</Text>
      </XStack>
      <Text fontSize={10} color="$colorPress" fontFamily="$mono">{agent.roleId}</Text>
      <XStack justifyContent="space-between">
        <Text fontSize={9} color="$colorPress">{agent.department || "—"}</Text>
        <Text fontSize={9} color={TIER_COLORS[agent.riskTier] || "#888"}>{agent.riskTier}</Text>
      </XStack>
      <ProgressBar value={st.tasksCompleted} max={totalTasks || 1} color={successRate >= 90 ? "#4ade80" : "#facc15"} />
      <XStack justifyContent="space-between">
        <Text fontSize={9} color="$colorPress">{successRate}% success</Text>
        <Text fontSize={9} color="$colorPress">${st.costUsed.toFixed(2)}</Text>
      </XStack>
      {isActive && (
        <XStack backgroundColor="rgba(74,222,128,0.1)" borderRadius="$1" paddingHorizontal="$1" paddingVertical={1}>
          <Text fontSize={8} color="#4ade80" numberOfLines={1}>{st.currentTask}</Text>
        </XStack>
      )}
    </YStack>
  );
}

// ── Live Output Panel ──
function LiveOutput({ lines, roleId }: { lines: string[]; roleId: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <YStack
      backgroundColor="rgba(0,0,0,0.4)"
      borderRadius="$2"
      padding="$3"
      maxHeight={200}
      overflow="scroll"
      borderWidth={1}
      borderColor="rgba(74,222,128,0.15)"
    >
      <Text fontSize={10} color="#4ade80" fontWeight="600" marginBottom="$1">Live Output — {roleId}</Text>
      {lines.slice(-50).map((line, i) => (
        <Text key={i} fontSize={11} fontFamily="$mono" color="$colorPress">{line}</Text>
      ))}
      <div ref={endRef} />
    </YStack>
  );
}

// ── Run Task Form ──
function RunTaskForm({ agent, onClose, onRun }: { agent: any; onClose: () => void; onRun: (taskId: string, featureSlug: string) => void }) {
  const [taskId, setTaskId] = useState("");
  const [featureSlug, setFeatureSlug] = useState(useStore.getState().activeFeature || "");

  return (
    <YStack gap="$2" marginTop="$2" paddingTop="$2" borderTopWidth={1} borderColor="rgba(108,92,231,0.2)">
      <Text fontSize="$1" fontWeight="600" color="#a78bfa">Run Task on {agent.name}</Text>
      <XStack gap="$2">
        <Input
          flex={1}
          placeholder="Task ID"
          value={taskId}
          onChangeText={setTaskId}
          backgroundColor="rgba(255,255,255,0.04)"
          borderColor="rgba(255,255,255,0.1)"
          color="white"
          fontSize={12}
          fontFamily="$mono"
        />
        <Input
          flex={1}
          placeholder="Feature slug"
          value={featureSlug}
          onChangeText={setFeatureSlug}
          backgroundColor="rgba(255,255,255,0.04)"
          borderColor="rgba(255,255,255,0.1)"
          color="white"
          fontSize={12}
          fontFamily="$mono"
        />
      </XStack>
      <XStack gap="$2">
        <ActionButton
          label="Run"
          variant="success"
          onAction={() => { if (taskId && featureSlug) onRun(taskId, featureSlug); }}
          disabled={!taskId || !featureSlug}
        />
        <ActionButton label="Cancel" variant="ghost" onAction={onClose} />
      </XStack>
    </YStack>
  );
}

export function AgentsView() {
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [worktrees, setWorktrees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("departments");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [runTarget, setRunTarget] = useState<string | null>(null);
  const [agentOutput, setAgentOutput] = useState<Record<string, string[]>>({});
  const { on } = useSocket();

  const fetchData = useCallback(() => {
    Promise.all([
      api.getAgents().catch(() => ({ agents: [] })),
      api.getAgentStats().catch(() => null),
      api.getWorktrees().catch(() => ({ worktrees: [] })),
    ]).then(([a, s, w]) => {
      setAgents(a.agents || []);
      setStats(s);
      setWorktrees(w.worktrees || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // WebSocket live updates
  useEffect(() => {
    const unsub1 = on("agent:started", () => fetchData());
    const unsub2 = on("agent:completed", () => fetchData());
    const unsub3 = on("agent:failed", () => fetchData());
    const unsub4 = on("agent:escalated", () => fetchData());
    const unsub5 = on("agent:progress", (data: any) => {
      if (data.roleId && data.progress?.output) {
        setAgentOutput((prev) => ({
          ...prev,
          [data.roleId]: [...(prev[data.roleId] || []), data.progress.output],
        }));
      }
    });
    const unsub6 = on("command:output", (data: any) => {
      if (data.jobId && data.data) {
        setAgentOutput((prev) => ({
          ...prev,
          [data.jobId]: [...(prev[data.jobId] || []), data.data],
        }));
      }
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  }, [on, fetchData]);

  const handleRun = async (roleId: string, taskId: string, featureSlug: string) => {
    setRunTarget(null);
    setAgentOutput((prev) => ({ ...prev, [roleId]: [] }));
    try {
      await api.runAgent(roleId, taskId, featureSlug);
    } catch {
      // Error handled by fetchData refresh
    }
    fetchData();
  };

  if (loading) return <Page><Text color="$colorPress">Loading agents...</Text></Page>;

  const active = agents.filter((a) => safeState(a).currentTask);

  // Group by department
  const departments: Record<string, any[]> = {};
  for (const agent of agents) {
    const dept = agent.department || "Unassigned";
    if (!departments[dept]) departments[dept] = [];
    departments[dept].push(agent);
  }

  return (
    <Page>
      <Text fontSize="$7" fontWeight="700" letterSpacing={-0.5}>Agent Runtime</Text>

      {/* Summary Stats */}
      <StatRow>
        <StatBox>
          <Text fontSize="$1" color="$colorPress">Total Agents</Text>
          <Text fontSize="$6" fontWeight="700">{agents.length}</Text>
        </StatBox>
        <StatBox>
          <Text fontSize="$1" color="$colorPress">Active Now</Text>
          <Text fontSize="$6" fontWeight="700" color="#4ade80">{active.length}</Text>
        </StatBox>
        <StatBox>
          <Text fontSize="$1" color="$colorPress">Success Rate</Text>
          <Text fontSize="$6" fontWeight="700" color={stats?.successRate >= 90 ? "#4ade80" : stats?.successRate >= 70 ? "#facc15" : "#ef4444"}>
            {stats?.successRate ?? 100}%
          </Text>
        </StatBox>
        <StatBox>
          <Text fontSize="$1" color="$colorPress">Total Cost</Text>
          <Text fontSize="$6" fontWeight="700">${(stats?.totalCost ?? 0).toFixed(2)}</Text>
        </StatBox>
        <StatBox>
          <Text fontSize="$1" color="$colorPress">Avg Cost/Task</Text>
          <Text fontSize="$6" fontWeight="700">${(stats?.avgCostPerTask ?? 0).toFixed(4)}</Text>
        </StatBox>
        <StatBox>
          <Text fontSize="$1" color="$colorPress">Escalations</Text>
          <Text fontSize="$6" fontWeight="700" color={stats?.escalations > 0 ? "#facc15" : "$colorPress"}>
            {stats?.escalations ?? 0}
          </Text>
        </StatBox>
        <StatBox>
          <Text fontSize="$1" color="$colorPress">Worktrees</Text>
          <Text fontSize="$6" fontWeight="700">{worktrees.length}</Text>
        </StatBox>
      </StatRow>

      {/* Tabs */}
      <XStack gap="$2">
        <TabBtn active={tab === "departments"} onPress={() => setTab("departments")}>
          <Text fontSize="$2" fontWeight="600" color={tab === "departments" ? "#a78bfa" : "$colorPress"}>Departments</Text>
        </TabBtn>
        <TabBtn active={tab === "grid"} onPress={() => setTab("grid")}>
          <Text fontSize="$2" fontWeight="600" color={tab === "grid" ? "#a78bfa" : "$colorPress"}>Grid</Text>
        </TabBtn>
        <TabBtn active={tab === "worktrees"} onPress={() => setTab("worktrees")}>
          <Text fontSize="$2" fontWeight="600" color={tab === "worktrees" ? "#a78bfa" : "$colorPress"}>
            Worktrees ({worktrees.length})
          </Text>
        </TabBtn>
      </XStack>

      <Separator borderColor="rgba(255,255,255,0.08)" />

      {/* Live output for active agents */}
      {active.map((agent) => {
        const lines = agentOutput[agent.roleId] || [];
        return lines.length > 0 ? (
          <LiveOutput key={agent.roleId} lines={lines} roleId={agent.roleId} />
        ) : null;
      })}

      {agents.length === 0 ? (
        <Card>
          <Text color="$colorPress">No agents configured. Run: ogu org:init</Text>
        </Card>
      ) : (
        <>
          {/* Grid Tab */}
          {tab === "grid" && (
            <XStack gap="$3" flexWrap="wrap">
              {agents.map((agent) => (
                <AgentGridCard
                  key={agent.roleId}
                  agent={agent}
                  onSelect={() => setSelectedAgent(agent)}
                />
              ))}
            </XStack>
          )}

          {/* Department Tab */}
          {tab === "departments" && (
            <YStack gap="$5">
              {Object.entries(departments).sort(([a], [b]) => a.localeCompare(b)).map(([dept, deptAgents]) => (
                <YStack key={dept} gap="$3">
                  <XStack gap="$2" alignItems="center">
                    <Text fontSize="$3" fontWeight="600" color="$colorPress">{dept}</Text>
                    <Text fontSize="$1" color="$colorPress">({deptAgents.length})</Text>
                  </XStack>

                  {deptAgents.map((agent) => {
                    const st = safeState(agent);
                    const totalTasks = st.tasksCompleted + st.tasksFailed;
                    const successRate = totalTasks > 0 ? Math.round((st.tasksCompleted / totalTasks) * 100) : 100;
                    const isExpanded = expanded === agent.roleId;

                    return (
                      <Card key={agent.roleId}>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                          cursor="pointer"
                          onPress={() => setExpanded(isExpanded ? null : agent.roleId)}
                        >
                          <XStack gap="$2" alignItems="center">
                            <div style={{
                              width: 10, height: 10, borderRadius: 5,
                              backgroundColor: st.currentTask ? "#4ade80" : "rgba(255,255,255,0.2)",
                              boxShadow: st.currentTask ? "0 0 6px rgba(74,222,128,0.5)" : "none",
                            }} />
                            <Text fontWeight="700" fontSize="$3">{agent.name}</Text>
                            <Text fontSize="$1" color="$colorPress" fontFamily="$mono">{agent.roleId}</Text>
                          </XStack>
                          <XStack gap="$3" alignItems="center">
                            <Text fontSize="$1" color={TIER_COLORS[agent.riskTier] || "#888"} fontWeight="600">
                              {agent.riskTier}
                            </Text>
                            <Text fontSize="$1" color="$colorPress">{isExpanded ? "▲" : "▼"}</Text>
                          </XStack>
                        </XStack>

                        {/* Summary line */}
                        <XStack gap="$4" flexWrap="wrap">
                          <Text fontSize="$1" color="$colorPress">
                            {st.tasksCompleted} completed | {st.tasksFailed} failed
                          </Text>
                          <Text fontSize="$1" color="$colorPress">
                            Tokens: {st.tokensUsed.toLocaleString()}
                          </Text>
                          <Text fontSize="$1" color="$colorPress">
                            Cost: ${st.costUsed.toFixed(2)}
                          </Text>
                        </XStack>

                        {/* Active task indicator */}
                        {st.currentTask && (
                          <XStack backgroundColor="rgba(74,222,128,0.1)" borderRadius="$1" paddingHorizontal="$2" paddingVertical="$1">
                            <Text fontSize="$1" color="#4ade80">Running: {st.currentTask}</Text>
                          </XStack>
                        )}

                        {/* Expanded details */}
                        {isExpanded && (
                          <YStack gap="$3" marginTop="$2" paddingTop="$3" borderTopWidth={1} borderColor="rgba(255,255,255,0.06)">
                            {/* Success rate bar */}
                            <YStack gap="$1">
                              <XStack justifyContent="space-between">
                                <Text fontSize={10} color="$colorPress">Success Rate</Text>
                                <Text fontSize={10} color={successRate >= 90 ? "#4ade80" : successRate >= 70 ? "#facc15" : "#ef4444"}>
                                  {successRate}%
                                </Text>
                              </XStack>
                              <ProgressBar
                                value={st.tasksCompleted}
                                max={totalTasks || 1}
                                color={successRate >= 90 ? "#4ade80" : successRate >= 70 ? "#facc15" : "#ef4444"}
                              />
                            </YStack>

                            {/* Token efficiency */}
                            {totalTasks > 0 && (
                              <XStack gap="$4">
                                <StatBox>
                                  <Text fontSize={10} color="$colorPress">Tokens/Task</Text>
                                  <Text fontSize="$2" fontWeight="600">
                                    {Math.round(st.tokensUsed / totalTasks).toLocaleString()}
                                  </Text>
                                </StatBox>
                                <StatBox>
                                  <Text fontSize={10} color="$colorPress">Cost/Task</Text>
                                  <Text fontSize="$2" fontWeight="600">
                                    ${(st.costUsed / totalTasks).toFixed(4)}
                                  </Text>
                                </StatBox>
                              </XStack>
                            )}

                            {/* Capabilities */}
                            {agent.capabilities && agent.capabilities.length > 0 && (
                              <YStack gap="$1">
                                <Text fontSize={10} color="$colorPress">Capabilities</Text>
                                <XStack gap="$1" flexWrap="wrap">
                                  {agent.capabilities.map((cap: string) => (
                                    <XStack key={cap} backgroundColor="rgba(255,255,255,0.06)" borderRadius="$1" paddingHorizontal="$2" paddingVertical={2}>
                                      <Text fontSize={10} color="$colorPress" fontFamily="$mono">{cap}</Text>
                                    </XStack>
                                  ))}
                                </XStack>
                              </YStack>
                            )}

                            {/* Live output */}
                            {agentOutput[agent.roleId]?.length > 0 && (
                              <LiveOutput lines={agentOutput[agent.roleId]} roleId={agent.roleId} />
                            )}

                            {/* Actions */}
                            <XStack gap="$2" marginTop="$1">
                              <ActionButton
                                label="Run Task"
                                variant="success"
                                onAction={() => setRunTarget(runTarget === agent.roleId ? null : agent.roleId)}
                              />
                              <ActionButton
                                label="Stop"
                                variant="danger"
                                onAction={() => api.stopAgent(agent.roleId)}
                                confirm={`Stop agent ${agent.name}?`}
                                disabled={!st.currentTask}
                              />
                              <ActionButton
                                label="Escalate"
                                variant="primary"
                                onAction={() => api.escalateAgent(agent.roleId)}
                                disabled={!st.currentTask}
                              />
                              <ActionButton
                                label="Full Details"
                                variant="ghost"
                                onAction={() => setSelectedAgent(agent)}
                              />
                            </XStack>

                            {/* Run task form */}
                            {runTarget === agent.roleId && (
                              <RunTaskForm
                                agent={agent}
                                onClose={() => setRunTarget(null)}
                                onRun={(taskId, featureSlug) => handleRun(agent.roleId, taskId, featureSlug)}
                              />
                            )}
                          </YStack>
                        )}
                      </Card>
                    );
                  })}
                </YStack>
              ))}
            </YStack>
          )}

          {/* Worktrees Tab */}
          {tab === "worktrees" && (
            <Card>
              <Text fontSize="$3" fontWeight="600">Active Worktrees</Text>
              {worktrees.length === 0 ? (
                <Text fontSize="$2" color="$colorPress">No active worktrees</Text>
              ) : (
                <YStack gap="$2">
                  {worktrees.map((wt) => {
                    // Parse worktree name: {featureSlug}-{taskId}[-{roleId}]
                    const parts = wt.split("-");
                    const matchedAgent = agents.find((a) => wt.includes(a.roleId));

                    return (
                      <XStack
                        key={wt}
                        backgroundColor="rgba(255,255,255,0.03)"
                        borderRadius="$2"
                        padding="$3"
                        gap="$3"
                        alignItems="center"
                        borderLeftWidth={3}
                        borderColor={matchedAgent?.state?.currentTask ? "#4ade80" : "rgba(255,255,255,0.1)"}
                      >
                        <YStack flex={1} gap="$1">
                          <Text fontSize="$2" fontWeight="600" fontFamily="$mono">{wt}</Text>
                          <Text fontSize={10} color="$colorPress">
                            Branch: agent/{wt.replace(/-/g, "/")}
                          </Text>
                        </YStack>
                        {matchedAgent && (
                          <XStack gap="$1" alignItems="center">
                            <div style={{
                              width: 6, height: 6, borderRadius: 3,
                              backgroundColor: matchedAgent?.state?.currentTask ? "#4ade80" : "rgba(255,255,255,0.2)",
                            }} />
                            <Text fontSize={10} color="$colorPress">{matchedAgent.name}</Text>
                          </XStack>
                        )}
                      </XStack>
                    );
                  })}
                </YStack>
              )}
            </Card>
          )}
        </>
      )}

      {/* Detail Panel */}
      {selectedAgent && (
        <DetailPanel
          title={selectedAgent.name}
          data={{
            roleId: selectedAgent.roleId,
            department: selectedAgent.department,
            riskTier: selectedAgent.riskTier,
            enabled: selectedAgent.enabled,
            capabilities: selectedAgent.capabilities,
            ...selectedAgent.state,
          }}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </Page>
  );
}
