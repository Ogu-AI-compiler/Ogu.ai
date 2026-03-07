/**
 * BuildReadinessPanel.tsx — Slice 442
 * Readiness gate before starting project build.
 * Shows checklist of prerequisites, missing roles, task count,
 * and start/simulate buttons.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssignedAgent {
  memberId: string;
  roleId: string;
  agentId: string;
  agentName?: string;
}

interface BuildReadiness {
  ready: boolean;
  missingRoles: string[];
  taskCount: number;
  assignedAgents: AssignedAgent[];
  hasEnrichedPlan: boolean;
  hasPRD: boolean;
}

interface BuildReadinessProps {
  readiness: BuildReadiness;
  onStart: (simulate: boolean) => void;
  loading?: boolean;
}

// ── Checklist item ────────────────────────────────────────────────────────────

function CheckItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 0",
      fontSize: 12,
      color: ok ? "var(--color-text)" : "var(--color-text-muted)",
    }}>
      <span style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        background: ok ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
        color: ok ? "#22c55e" : "rgba(255,255,255,0.25)",
        border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
      }}>
        {ok ? "\u2713" : "\u2013"}
      </span>
      <span>{label}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BuildReadinessPanel({
  readiness,
  onStart,
  loading = false,
}: BuildReadinessProps) {
  const { ready, missingRoles, taskCount, assignedAgents, hasEnrichedPlan, hasPRD } = readiness;

  return (
    <div style={{
      marginBottom: 24,
      padding: 16,
      borderRadius: 8,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${ready ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
    }}>
      {/* Header */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--color-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span>Build Readiness</span>
        <span style={{
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 4,
          fontWeight: 700,
          color: ready ? "#22c55e" : "#f59e0b",
          background: ready ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
        }}>
          {ready ? "Ready" : "Not Ready"}
        </span>
      </div>

      {/* Checklist */}
      <div style={{ marginBottom: 16 }}>
        <CheckItem label="PRD generated" ok={hasPRD} />
        <CheckItem label="Enriched plan exists" ok={hasEnrichedPlan} />
        <CheckItem label={`Required roles assigned (${assignedAgents.length} agents)`} ok={missingRoles.length === 0} />
        <CheckItem label={`Tasks ready (${taskCount})`} ok={taskCount > 0} />
      </div>

      {/* Missing roles warning */}
      {missingRoles.length > 0 && (
        <div style={{
          padding: "8px 12px",
          borderRadius: 6,
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          fontSize: 12,
          color: "#ef4444",
          marginBottom: 16,
        }}>
          Missing required roles: {missingRoles.join(", ")}
        </div>
      )}

      {/* Agents summary */}
      {assignedAgents.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 16 }}>
          {assignedAgents.length} assigned agent{assignedAgents.length !== 1 ? "s" : ""} · {taskCount} tasks
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onStart(false)}
          disabled={!ready || loading}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: ready && !loading ? "var(--color-accent, var(--color-primary))" : "rgba(255,255,255,0.05)",
            border: "none",
            color: ready && !loading ? "#fff" : "rgba(255,255,255,0.3)",
            cursor: ready && !loading ? "pointer" : "default",
          }}
        >
          {loading ? "Starting..." : "Start Build"}
        </button>
        <button
          onClick={() => onStart(true)}
          disabled={!ready || loading}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: ready && !loading ? "var(--color-text)" : "rgba(255,255,255,0.3)",
            cursor: ready && !loading ? "pointer" : "default",
          }}
        >
          Simulate
        </button>
      </div>
    </div>
  );
}
