/**
 * MarketplaceProjectView.tsx — Slice 422
 * Displays a marketplace project created via the CTO pipeline.
 *
 * Shows:
 *   - Phase indicator (planning → team → PRD → enriching → ready → running → complete)
 *   - Team roster from team.json
 *   - PRD features list
 *   - Enriched task grid with owner_role + status badges
 *   - Execution progress bar
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { TeamReviewPanel } from "./TeamReviewPanel";
import { BuildReadinessPanel } from "./BuildReadinessPanel";
import { ErrorRecoveryPanel } from "./ErrorRecoveryPanel";
import { ProjectCompletePanel } from "./ProjectCompletePanel";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CTOPlan {
  projectId: string;
  tier: "low" | "medium" | "high";
  complexity: { score: number; tier: string };
  teamBlueprint: { roles: Array<{ roleId: string; count: number }> };
}

interface TeamMember {
  role_id: string;
  agent_id: string | null;
  status: "active" | "unassigned";
}

interface Team {
  projectId: string;
  members: TeamMember[];
}

interface PRDFeature {
  id: string;
  title: string;
  priority: "must" | "should" | "could";
  acceptance_criteria: string[];
}

interface PRD {
  product: { name: string };
  features: PRDFeature[];
}

interface EnrichedTask {
  id: string;
  name: string;
  owner_role: string;
  owner_agent_id?: string;
  definition_of_done: string;
  gates: string[];
  _enriched: boolean;
}

interface EnrichedPlan {
  tasks: EnrichedTask[];
  _enrichment: {
    total_tasks: number;
    assigned_tasks: number;
    unassigned_tasks: number;
  };
}

interface ExecutionState {
  status: "running" | "completed" | "partial" | "failed" | "not_started";
  startedAt?: string;
  completedAt?: string;
  tasks: Record<string, { status: string; error?: string }>;
  summary?: { total: number; completed: number; failed: number };
}

interface ProjectData {
  projectId: string;
  ctoPlan: CTOPlan | null;
  team: Team | null;
  prd: PRD | null;
  enrichedPlan: EnrichedPlan | null;
  executionState: ExecutionState | null;
}

// ── Phase indicator ───────────────────────────────────────────────────────────

const PHASES = [
  { id: "planning", label: "CTO Plan" },
  { id: "team", label: "Team" },
  { id: "prd", label: "PRD" },
  { id: "enriched", label: "Ready" },
  { id: "running", label: "Running" },
  { id: "complete", label: "Done" },
];

function detectPhase(data: ProjectData): string {
  if (!data.ctoPlan) return "planning";
  if (!data.team) return "team";
  if (!data.prd) return "prd";
  if (!data.enrichedPlan) return "enriched";
  const es = data.executionState;
  if (!es || es.status === "not_started") return "enriched";
  if (es.status === "running") return "running";
  if (es.status === "completed") return "complete";
  return "running";
}

function PhaseBar({ current }: { current: string }) {
  const idx = PHASES.findIndex(p => p.id === current);
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
      {PHASES.map((phase, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={phase.id} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              height: 4,
              background: done ? "var(--color-primary)" : active ? "var(--color-primary)" : "rgba(255,255,255,0.1)",
              opacity: active ? 1 : done ? 0.7 : 0.3,
              borderRadius: 2,
              marginBottom: 6,
            }} />
            <div style={{
              fontSize: 11,
              color: active ? "var(--color-primary)" : done ? "var(--color-text-muted)" : "rgba(255,255,255,0.3)",
              fontWeight: active ? 600 : 400,
            }}>
              {phase.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Team roster ───────────────────────────────────────────────────────────────

const ROLE_EMOJI: Record<string, string> = {
  pm: "📋", architect: "🏗️", backend_engineer: "⚙️", frontend_engineer: "🎨",
  qa: "🔍", devops: "🔧", security: "🔒", designer: "✏️",
};

function TeamRoster({ team }: { team: Team }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Team ({team.members.length})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {team.members.map((m, i) => (
          <div key={i} style={{
            padding: "4px 10px",
            borderRadius: 6,
            background: m.status === "active" ? "rgba(var(--color-primary-rgb),0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${m.status === "active" ? "rgba(var(--color-primary-rgb),0.3)" : "rgba(255,255,255,0.1)"}`,
            fontSize: 12,
          }}>
            <span style={{ marginRight: 4 }}>{ROLE_EMOJI[m.role_id] || "🤖"}</span>
            <span style={{ color: "var(--color-text)" }}>{m.role_id}</span>
            {m.status === "unassigned" && (
              <span style={{ marginLeft: 6, color: "rgba(255,255,255,0.3)", fontSize: 10 }}>unassigned</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PRD features ─────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  must: "#ef4444", should: "#f59e0b", could: "#6b7280",
};

function FeatureList({ prd }: { prd: PRD }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        PRD Features ({prd.features.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {prd.features.map(f => (
          <div key={f.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 10px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 6,
            borderLeft: `3px solid ${PRIORITY_COLOR[f.priority] || "#6b7280"}`,
          }}>
            <span style={{ fontSize: 12, color: "var(--color-text)", flex: 1 }}>{f.title}</span>
            <span style={{ fontSize: 10, color: PRIORITY_COLOR[f.priority], fontWeight: 600, textTransform: "uppercase" }}>
              {f.priority}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Task grid ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending: "#6b7280", running: "#f59e0b", completed: "#22c55e", failed: "#ef4444",
};

function TaskGrid({ plan, executionState }: { plan: EnrichedPlan; executionState: ExecutionState | null }) {
  const taskStatuses = executionState?.tasks || {};
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Tasks ({plan._enrichment?.total_tasks || plan.tasks.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {plan.tasks.map(task => {
          const taskStatus = taskStatuses[task.id]?.status || "pending";
          return (
            <div key={task.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 6,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: STATUS_COLOR[taskStatus] || "#6b7280",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12, color: "var(--color-text)", flex: 1 }}>
                {task.name || task.id}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                {ROLE_EMOJI[task.owner_role] || "🤖"} {task.owner_role}
              </span>
              <span style={{ fontSize: 10, color: STATUS_COLOR[taskStatus], textTransform: "uppercase", fontWeight: 600 }}>
                {taskStatus}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ExecutionProgress({ executionState }: { executionState: ExecutionState }) {
  const summary = executionState.summary;
  if (!summary) return null;
  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Execution Progress</span>
        <span style={{ fontSize: 12, color: "var(--color-text)" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3,
          background: summary.failed > 0 ? "#ef4444" : "var(--color-primary)",
          width: `${pct}%`,
          transition: "width 0.3s ease",
        }} />
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
        {summary.completed}/{summary.total} tasks · {summary.failed} failed
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarketplaceProjectView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api(`/project-lifecycle/${projectId}`);
      if (res.error) throw new Error(res.error);
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
    // Poll when running
    const isRunning = data?.executionState?.status === "running";
    if (isRunning) {
      const id = setInterval(loadData, 2000);
      return () => clearInterval(id);
    }
  }, [loadData, data?.executionState?.status]);

  const handleRun = async (simulate: boolean) => {
    setRunning(true);
    try {
      await api(`/project-lifecycle/${projectId}/run`, { method: "POST", body: { simulate } });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 32, color: "var(--color-text-muted)", fontSize: 13 }}>Loading project...</div>;
  }
  if (error) {
    return <div style={{ padding: 32, color: "#ef4444", fontSize: 13 }}>Error: {error}</div>;
  }
  if (!data) {
    return <div style={{ padding: 32, color: "var(--color-text-muted)", fontSize: 13 }}>Project not found</div>;
  }

  const phase = detectPhase(data);
  const projectName = data.prd?.product?.name || data.ctoPlan?.projectId || projectId;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)" }}>{projectName}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>
            {data.ctoPlan?.tier && (
              <span style={{ marginRight: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {data.ctoPlan.tier} complexity
              </span>
            )}
            {projectId}
          </div>
        </div>
        {/* Run button — only when enriched plan exists and not running */}
        {data.enrichedPlan && phase !== "running" && phase !== "complete" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleRun(true)}
              disabled={running}
              style={{
                padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                color: "var(--color-text)", cursor: "pointer",
              }}
            >
              Simulate
            </button>
            <button
              onClick={() => handleRun(false)}
              disabled={running}
              style={{
                padding: "8px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: "var(--color-primary)", border: "none",
                color: "var(--color-accent-text)", cursor: "pointer",
              }}
            >
              Run
            </button>
          </div>
        )}
      </div>

      {/* Phase bar */}
      <PhaseBar current={phase} />

      {/* Execution progress */}
      {data.executionState?.summary && (
        <ExecutionProgress executionState={data.executionState} />
      )}

      {/* Error recovery — shown when tasks have failed */}
      {data.executionState?.tasks && Object.entries(data.executionState.tasks).some(([, t]) => t.status === "failed") && (
        <ErrorRecoveryPanel
          failedTasks={Object.entries(data.executionState.tasks)
            .filter(([, t]) => t.status === "failed")
            .map(([id, t]) => ({
              taskId: id,
              taskName: data.enrichedPlan?.tasks.find(task => task.id === id)?.name || id,
              error: t.error || "Unknown error",
            }))}
          onRetry={(taskId) => {
            api(`/project-lifecycle/${projectId}/retry`, { method: "POST", body: { taskId } }).then(loadData);
          }}
        />
      )}

      {/* Team review — shown when team exists but enriched plan doesn't */}
      {data.team && data.ctoPlan?.teamBlueprint && !data.enrichedPlan && (
        <TeamReviewPanel
          blueprint={data.ctoPlan.teamBlueprint}
          team={data.team}
          complexity={data.ctoPlan.complexity}
          onApprove={() => loadData()}
        />
      )}

      {/* Team roster (read-only, shown when past review) */}
      {data.team && data.enrichedPlan && <TeamRoster team={data.team} />}

      {/* PRD Features */}
      {data.prd && <FeatureList prd={data.prd} />}

      {/* Build readiness — shown when enriched plan exists but not yet running */}
      {data.enrichedPlan && (!data.executionState || data.executionState.status === "not_started") && (
        <BuildReadinessPanel
          readiness={{
            ready: true,
            missingRoles: [],
            taskCount: data.enrichedPlan.tasks.length,
            assignedAgents: (data.team?.members || [])
              .filter(m => m.status === "active" && m.agent_id)
              .map(m => ({ memberId: m.role_id, roleId: m.role_id, agentId: m.agent_id! })),
            hasEnrichedPlan: true,
            hasPRD: !!data.prd,
          }}
          onStart={(simulate) => handleRun(simulate)}
          loading={running}
        />
      )}

      {/* Tasks */}
      {data.enrichedPlan && (
        <TaskGrid plan={data.enrichedPlan} executionState={data.executionState} />
      )}

      {/* Project complete — shown when execution finished */}
      {data.executionState?.status === "completed" && data.executionState.summary && (
        <ProjectCompletePanel
          projectName={projectName}
          summary={{
            total: data.executionState.summary.total,
            completed: data.executionState.summary.completed,
            failed: data.executionState.summary.failed,
            startedAt: data.executionState.startedAt,
            completedAt: data.executionState.completedAt,
            agentCount: (data.team?.members || []).filter(m => m.status === "active").length,
          }}
          onNewProject={() => window.location.href = "/"}
        />
      )}
    </div>
  );
}
