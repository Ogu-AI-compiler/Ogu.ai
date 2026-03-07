/**
 * ErrorRecoveryPanel.tsx — Slice 443
 * Displays failed tasks with error details, retry/skip actions,
 * and gate severity indicators.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface FailedTask {
  taskId: string;
  taskName: string;
  error: string;
  gate?: string;
  severity?: "error" | "warning" | "fatal";
  attempts?: number;
}

interface ErrorRecoveryProps {
  failedTasks: FailedTask[];
  onRetry: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  onRetryAll?: () => void;
}

// ── Severity colors ──────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  error:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.2)" },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
  fatal:   { color: "#ef4444", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ErrorRecoveryPanel({
  failedTasks,
  onRetry,
  onSkip,
  onRetryAll,
}: ErrorRecoveryProps) {
  if (failedTasks.length === 0) return null;

  return (
    <div style={{
      marginBottom: 24,
      padding: 16,
      borderRadius: 8,
      background: "rgba(239,68,68,0.05)",
      border: "1px solid rgba(239,68,68,0.15)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#ef4444",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span>\u26A0</span>
          <span>Failed Tasks ({failedTasks.length})</span>
        </div>
        {onRetryAll && failedTasks.length > 1 && (
          <button
            onClick={onRetryAll}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              cursor: "pointer",
            }}
          >
            Retry All
          </button>
        )}
      </div>

      {/* Failed task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {failedTasks.map((task) => {
          const sev = SEVERITY_STYLE[task.severity || "error"];

          return (
            <div key={task.taskId} style={{
              padding: "10px 12px",
              borderRadius: 6,
              background: sev.bg,
              border: `1px solid ${sev.border}`,
            }}>
              {/* Task header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)", flex: 1 }}>
                  {task.taskName || task.taskId}
                </span>
                {task.gate && (
                  <span style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.08)",
                    color: "var(--color-text-muted)",
                  }}>
                    Gate: {task.gate}
                  </span>
                )}
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: sev.color,
                  textTransform: "uppercase",
                }}>
                  {task.severity || "error"}
                </span>
              </div>

              {/* Error message details */}
              <div style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                padding: "6px 8px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: 4,
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                marginBottom: 8,
                maxHeight: 80,
                overflow: "auto",
              }}>
                {task.error || "No error message available"}
              </div>

              {/* Attempt count */}
              {task.attempts != null && task.attempts > 1 && (
                <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 6 }}>
                  {task.attempts} attempts
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => onRetry(task.taskId)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--color-accent, var(--color-primary))",
                    border: "none",
                    color: "var(--color-accent-text)",
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
                {onSkip && (
                  <button
                    onClick={() => onSkip(task.taskId)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "var(--color-text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
