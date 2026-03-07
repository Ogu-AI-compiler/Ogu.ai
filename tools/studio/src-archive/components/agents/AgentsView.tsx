import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useSocket } from "@/hooks/useSocket";
import { ActionButton } from "@/components/shared/ActionButton";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { Input } from "@/components/ui/input";

const TIER_COLORS: Record<string, string> = {
  low: "#4ade80", medium: "#facc15", high: "#f87171", critical: "#ef4444",
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
    <div
      onClick={onSelect}
      style={{
        backgroundColor: "rgba(22,22,22,0.6)",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: isActive ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)",
        width: 180,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{
          width: 10, height: 10, borderRadius: 5, backgroundColor: color,
          boxShadow: isActive ? "0 0 6px rgba(74,222,128,0.5)" : "none",
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</span>
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{agent.roleId}</span>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{agent.department || "—"}</span>
        <span style={{ fontSize: 9, color: TIER_COLORS[agent.riskTier] || "#888" }}>{agent.riskTier}</span>
      </div>
      <ProgressBar value={st.tasksCompleted} max={totalTasks || 1} color={successRate >= 90 ? "#4ade80" : "#facc15"} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{successRate}% success</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>${st.costUsed.toFixed(2)}</span>
      </div>
      {isActive && (
        <div style={{ backgroundColor: "rgba(74,222,128,0.1)", borderRadius: 4, padding: "1px 4px" }}>
          <span style={{ fontSize: 8, color: "#4ade80", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{st.currentTask}</span>
        </div>
      )}
    </div>
  );
}

function LiveOutput({ lines, roleId }: { lines: string[]; roleId: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <div style={{
      backgroundColor: "rgba(0,0,0,0.4)",
      borderRadius: 8,
      padding: 12,
      maxHeight: 200,
      overflow: "auto",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: "rgba(74,222,128,0.15)",
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}>
      <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 600, marginBottom: 4 }}>Live Output — {roleId}</span>
      {lines.slice(-50).map((line, i) => (
        <span key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>{line}</span>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function RunTaskForm({ agent, onClose, onRun }: { agent: any; onClose: () => void; onRun: (taskId: string, featureSlug: string) => void }) {
  const [taskId, setTaskId] = useState("");
  const [featureSlug, setFeatureSlug] = useState(useStore.getState().activeFeature || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopStyle: "solid", borderColor: "rgba(108,92,231,0.2)" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa" }}>Run Task on {agent.name}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          style={{ flex: 1 }}
          placeholder="Task ID"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
        />
        <Input
          style={{ flex: 1 }}
          placeholder="Feature slug"
          value={featureSlug}
          onChange={(e) => setFeatureSlug(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <ActionButton
          label="Run"
          variant="success"
          onAction={() => { if (taskId && featureSlug) onRun(taskId, featureSlug); }}
          disabled={!taskId || !featureSlug}
        />
        <ActionButton label="Cancel" variant="ghost" onAction={onClose} />
      </div>
    </div>
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

  if (loading) return (
    <div style={{ flex: 1, padding: 28, overflow: "auto" }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading agents...</span>
    </div>
  );

  const active = agents.filter((a) => safeState(a).currentTask);

  const departments: Record<string, any[]> = {};
  for (const agent of agents) {
    const dept = agent.department || "Unassigned";
    if (!departments[dept]) departments[dept] = [];
    departments[dept].push(agent);
  }

  return (
    <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 24, overflow: "auto", position: "relative" }}>
      <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "var(--text)" }}>Agent Runtime</span>

      {/* Summary Stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { label: "Total Agents", value: String(agents.length), color: undefined },
          { label: "Active Now", value: String(active.length), color: "#4ade80" },
          { label: "Success Rate", value: `${stats?.successRate ?? 100}%`, color: (stats?.successRate ?? 100) >= 90 ? "#4ade80" : (stats?.successRate ?? 100) >= 70 ? "#facc15" : "#ef4444" },
          { label: "Total Cost", value: `$${(stats?.totalCost ?? 0).toFixed(2)}`, color: undefined },
          { label: "Avg Cost/Task", value: `$${(stats?.avgCostPerTask ?? 0).toFixed(4)}`, color: undefined },
          { label: "Escalations", value: String(stats?.escalations ?? 0), color: (stats?.escalations ?? 0) > 0 ? "#facc15" : undefined },
          { label: "Worktrees", value: String(worktrees.length), color: undefined },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, minWidth: 120, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{label}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {([
          { key: "departments", label: "Departments" },
          { key: "grid", label: "Grid" },
          { key: "worktrees", label: `Worktrees (${worktrees.length})` },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
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

      <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />

      {/* Live output for active agents */}
      {active.map((agent) => {
        const lines = agentOutput[agent.roleId] || [];
        return lines.length > 0 ? (
          <LiveOutput key={agent.roleId} lines={lines} roleId={agent.roleId} />
        ) : null;
      })}

      {agents.length === 0 ? (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)" }}>
          <span style={{ color: "rgba(255,255,255,0.5)" }}>No agents configured. Run: ogu org:init</span>
        </div>
      ) : (
        <>
          {/* Grid Tab */}
          {tab === "grid" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {agents.map((agent) => (
                <AgentGridCard
                  key={agent.roleId}
                  agent={agent}
                  onSelect={() => setSelectedAgent(agent)}
                />
              ))}
            </div>
          )}

          {/* Department Tab */}
          {tab === "departments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {Object.entries(departments).sort(([a], [b]) => a.localeCompare(b)).map(([dept, deptAgents]) => (
                <div key={dept} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{dept}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>({deptAgents.length})</span>
                  </div>

                  {deptAgents.map((agent) => {
                    const st = safeState(agent);
                    const totalTasks = st.tasksCompleted + st.tasksFailed;
                    const successRate = totalTasks > 0 ? Math.round((st.tasksCompleted / totalTasks) * 100) : 100;
                    const isExpanded = expanded === agent.roleId;

                    return (
                      <div key={agent.roleId} style={{
                        backgroundColor: "rgba(22,22,22,0.6)",
                        borderRadius: 12,
                        padding: 20,
                        borderWidth: 1,
                        borderStyle: "solid",
                        borderColor: "rgba(255,255,255,0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}>
                        <div
                          onClick={() => setExpanded(isExpanded ? null : agent.roleId)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{
                              width: 10, height: 10, borderRadius: 5,
                              backgroundColor: st.currentTask ? "#4ade80" : "rgba(255,255,255,0.2)",
                              boxShadow: st.currentTask ? "0 0 6px rgba(74,222,128,0.5)" : "none",
                            }} />
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{agent.name}</span>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{agent.roleId}</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: TIER_COLORS[agent.riskTier] || "#888", fontWeight: 600 }}>
                              {agent.riskTier}
                            </span>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{isExpanded ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                            {st.tasksCompleted} completed | {st.tasksFailed} failed
                          </span>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                            Tokens: {st.tokensUsed.toLocaleString()}
                          </span>
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                            Cost: ${st.costUsed.toFixed(2)}
                          </span>
                        </div>

                        {st.currentTask && (
                          <div style={{ backgroundColor: "rgba(74,222,128,0.1)", borderRadius: 4, padding: "4px 8px" }}>
                            <span style={{ fontSize: 12, color: "#4ade80" }}>Running: {st.currentTask}</span>
                          </div>
                        )}

                        {isExpanded && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopStyle: "solid", borderColor: "rgba(255,255,255,0.06)" }}>
                            {/* Success rate bar */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Success Rate</span>
                                <span style={{ fontSize: 10, color: successRate >= 90 ? "#4ade80" : successRate >= 70 ? "#facc15" : "#ef4444" }}>
                                  {successRate}%
                                </span>
                              </div>
                              <ProgressBar
                                value={st.tasksCompleted}
                                max={totalTasks || 1}
                                color={successRate >= 90 ? "#4ade80" : successRate >= 70 ? "#facc15" : "#ef4444"}
                              />
                            </div>

                            {totalTasks > 0 && (
                              <div style={{ display: "flex", gap: 16 }}>
                                <div style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, minWidth: 120, display: "flex", flexDirection: "column", gap: 4 }}>
                                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Tokens/Task</span>
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                                    {Math.round(st.tokensUsed / totalTasks).toLocaleString()}
                                  </span>
                                </div>
                                <div style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, minWidth: 120, display: "flex", flexDirection: "column", gap: 4 }}>
                                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Cost/Task</span>
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                                    ${(st.costUsed / totalTasks).toFixed(4)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {agent.capabilities && agent.capabilities.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Capabilities</span>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {agent.capabilities.map((cap: string) => (
                                    <div key={cap} style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 4, padding: "2px 8px" }}>
                                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{cap}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {agentOutput[agent.roleId]?.length > 0 && (
                              <LiveOutput lines={agentOutput[agent.roleId]} roleId={agent.roleId} />
                            )}

                            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
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
                            </div>

                            {runTarget === agent.roleId && (
                              <RunTaskForm
                                agent={agent}
                                onClose={() => setRunTarget(null)}
                                onRun={(taskId, featureSlug) => handleRun(agent.roleId, taskId, featureSlug)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Worktrees Tab */}
          {tab === "worktrees" && (
            <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Active Worktrees</span>
              {worktrees.length === 0 ? (
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No active worktrees</span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {worktrees.map((wt) => {
                    const matchedAgent = agents.find((a) => wt.includes(a.roleId));
                    return (
                      <div
                        key={wt}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.03)",
                          borderRadius: 8,
                          padding: 12,
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          borderLeftWidth: 3,
                          borderLeftStyle: "solid",
                          borderColor: matchedAgent?.state?.currentTask ? "#4ade80" : "rgba(255,255,255,0.1)",
                        }}
                      >
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{wt}</span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                            Branch: agent/{wt.replace(/-/g, "/")}
                          </span>
                        </div>
                        {matchedAgent && (
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: 3,
                              backgroundColor: matchedAgent?.state?.currentTask ? "#4ade80" : "rgba(255,255,255,0.2)",
                            }} />
                            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{matchedAgent.name}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

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
    </div>
  );
}
