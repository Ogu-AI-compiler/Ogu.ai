/**
 * ProjectCompletePanel.tsx — Slice 444
 * Shown when project execution completes successfully.
 * Displays summary stats, artifact list, duration, and next actions.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompletionSummary {
  total: number;
  completed: number;
  failed: number;
  startedAt?: string;
  completedAt?: string;
  agentCount: number;
  outputFiles?: string[];
}

interface ProjectCompleteProps {
  projectName: string;
  summary: CompletionSummary;
  onNewProject?: () => void;
  onObserve?: () => void;
  onDeploy?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt || !completedAt) return "N/A";
  const elapsed = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (elapsed < 60000) return `${Math.round(elapsed / 1000)}s`;
  if (elapsed < 3600000) return `${Math.round(elapsed / 60000)}m`;
  return `${(elapsed / 3600000).toFixed(1)}h`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      flex: 1,
      padding: "12px 16px",
      borderRadius: 6,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "var(--color-text)" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProjectCompletePanel({
  projectName,
  summary,
  onNewProject,
  onObserve,
  onDeploy,
}: ProjectCompleteProps) {
  const { total, completed, failed, startedAt, completedAt, agentCount, outputFiles } = summary;
  const duration = formatDuration(startedAt, completedAt);
  const allSuccess = failed === 0 && completed === total;

  return (
    <div style={{
      marginBottom: 24,
      padding: 24,
      borderRadius: 8,
      background: allSuccess
        ? "rgba(34,197,94,0.05)"
        : "rgba(245,158,11,0.05)",
      border: `1px solid ${allSuccess ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
    }}>
      {/* Success header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>
          {allSuccess ? "\u2713" : "\u26A0"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>
          {allSuccess ? "Project Complete" : "Project Finished with Issues"}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
          {projectName}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <StatCard label="Total Tasks" value={total} />
        <StatCard label="Completed" value={completed} color="#22c55e" />
        {failed > 0 && <StatCard label="Failed" value={failed} color="#ef4444" />}
        <StatCard label="Agents" value={agentCount} />
        <StatCard label="Duration" value={duration} />
      </div>

      {/* Output artifacts */}
      {outputFiles && outputFiles.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}>
            Output Artifacts ({outputFiles.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {outputFiles.map((file, i) => (
              <div key={i} style={{
                padding: "4px 10px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.03)",
                fontSize: 11,
                color: "var(--color-text-muted)",
                fontFamily: "monospace",
              }}>
                {file}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next actions */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--color-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 8,
      }}>
        Next Steps
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {onDeploy && (
          <button
            onClick={onDeploy}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: "var(--color-accent, var(--color-primary))",
              border: "none",
              color: "var(--color-accent-text)",
              cursor: "pointer",
            }}
          >
            Deploy
          </button>
        )}
        {onObserve && (
          <button
            onClick={onObserve}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            Observe
          </button>
        )}
        {onNewProject && (
          <button
            onClick={onNewProject}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            New Project
          </button>
        )}
      </div>
    </div>
  );
}
