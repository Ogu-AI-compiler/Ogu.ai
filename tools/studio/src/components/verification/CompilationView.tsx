import { useState } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
import { GateRow } from "./GateRow";

const GATE_DESCRIPTIONS: Record<string, string> = {
  doctor: "Project structure health",
  context_lock: "Context & spec locked",
  plan_tasks: "All planned files exist",
  no_todos: "No TODO/FIXME in code",
  ui_functional: "UI buttons & links work",
  design_compliance: "Design tokens applied",
  brand_compliance: "Brand assets present",
  smoke_test: "Smoke tests pass",
  vision: "Visual verification",
  contracts: "Contract files valid",
  preview: "Build succeeds (npm build)",
  memory: "Memory & context valid",
  spec_consistency: "Code matches spec",
  drift_check: "No spec drift",
};

const GATE_ORDER = [
  "doctor", "context_lock", "plan_tasks", "no_todos",
  "ui_functional", "design_compliance", "brand_compliance", "smoke_test",
  "vision", "contracts", "preview", "memory", "spec_consistency", "drift_check",
];

export function CompilationView() {
  const gateResults = useStore((s) => s.gateResults);
  const pipelineRunning = useStore((s) => s.pipelineRunning);
  const pipelineError = useStore((s) => s.pipelineError);
  const activeProjectSlug = useStore((s) => s.activeProjectSlug);
  const setCurrentStage = useStore((s) => s.setCurrentStage);
  const clearGateResults = useStore((s) => s.clearGateResults);
  const executionStatus = useStore((s) => s.executionStatus);
  const dispatchProgress = useStore((s) => s.dispatchProgress);
  const [starting, setStarting] = useState(false);
  const [fixing, setFixing] = useState(false);

  const failedGate = gateResults.find((g) => !g.passed);

  const passed = gateResults.filter((g) => g.passed).length;
  const failed = gateResults.filter((g) => !g.passed).length;
  const total = gateResults.length;
  const allPassed = total === 14 && failed === 0;

  // Dynamic build status based on actual execution outcome
  const wasAborted = executionStatus === "aborted";
  const hadFailures = (dispatchProgress.failedTasks ?? 0) > 0;
  const completedTasks = dispatchProgress.completedTasks ?? 0;
  const totalTasks = dispatchProgress.totalTasks ?? 0;

  const buildStatusTitle = wasAborted
    ? "Execution Aborted"
    : hadFailures
      ? `Build Finished with Issues`
      : completedTasks > 0
        ? "Build Complete"
        : "Ready for Verification";

  const buildStatusSubtitle = wasAborted
    ? `Execution was stopped. ${completedTasks > 0 ? `${completedTasks} task${completedTasks !== 1 ? "s" : ""} completed before abort.` : "No tasks completed."} You can still run the quality gates on completed work.`
    : hadFailures
      ? `${completedTasks} of ${totalTasks} tasks completed — ${dispatchProgress.failedTasks} failed. Run the 14 gates to validate what was built.`
      : completedTasks > 0
        ? `All ${completedTasks} tasks finished successfully. Run the 14 quality gates to validate the project.`
        : "Run the 14 quality gates to validate the project before marking it done.";

  const handleRunVerification = async () => {
    if (!activeProjectSlug || pipelineRunning || starting) return;
    setStarting(true);
    try {
      await api.runVerification(activeProjectSlug);
    } catch { /* WS events drive the UI */ }
    setStarting(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(99,241,157,0.1)", border: "1px solid rgba(99,241,157,0.2)" }}
        >
          <Icon d={icons.shield} size={16} stroke="var(--color-accent)" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-text">Verification</h2>
          <p className="text-xs text-text-muted">
            {pipelineRunning
              ? `Running 14 quality gates...`
              : allPassed
                ? "All 14 gates passed — project verified"
                : failed > 0
                  ? `${failed} gate${failed > 1 ? "s" : ""} failed — fix issues and re-run`
                  : total > 0
                    ? `${passed}/${total} gates passed`
                    : wasAborted
                      ? "Execution aborted — run gates on completed work"
                      : hadFailures
                        ? `${completedTasks}/${totalTasks} tasks completed — ready for verification`
                        : "Build complete — ready to run verification"}
          </p>
        </div>
        {pipelineRunning && (
          <Icon d={icons.loader} size={16} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-auto px-6 py-6 ${total === 0 && !pipelineRunning ? "flex items-center justify-center" : ""}`}>
        <div className="max-w-2xl w-full mx-auto flex flex-col gap-5">

          {/* Ready state — no gates run yet */}
          {!pipelineRunning && total === 0 && (
            <div
              className="flex flex-col items-center gap-5 px-8 py-10 rounded-2xl text-center"
              style={{
                background: wasAborted
                  ? "linear-gradient(0deg, rgba(248,113,113,0) 0%, rgba(248,113,113,0.04) 100%)"
                  : hadFailures
                    ? "linear-gradient(0deg, rgba(251,191,36,0) 0%, rgba(251,191,36,0.04) 100%)"
                    : "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.05) 100%)",
                border: wasAborted
                  ? "1px solid rgba(248,113,113,0.2)"
                  : hadFailures
                    ? "1px solid rgba(251,191,36,0.2)"
                    : "1px solid rgba(99,241,157,0.2)",
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: wasAborted ? "rgba(248,113,113,0.1)" : hadFailures ? "rgba(251,191,36,0.1)" : "rgba(99,241,157,0.1)",
                  border: wasAborted ? "1px solid rgba(248,113,113,0.25)" : hadFailures ? "1px solid rgba(251,191,36,0.25)" : "1px solid rgba(99,241,157,0.25)",
                }}
              >
                <Icon
                  d={icons.shield}
                  size={24}
                  stroke={wasAborted ? "#f87171" : hadFailures ? "#fbbf24" : "var(--color-accent)"}
                />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text mb-1">{buildStatusTitle}</h3>
                <p className="text-sm text-text-muted max-w-xs">
                  {buildStatusSubtitle}
                </p>
              </div>

              {/* Gate list preview */}
              <div className="w-full grid grid-cols-2 gap-1.5 text-left">
                {Object.entries(GATE_DESCRIPTIONS).map(([gate, desc]) => (
                  <div key={gate} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
                    <span className="text-[10px] text-text-muted truncate">{desc}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleRunVerification}
                disabled={pipelineRunning || starting}
                className="px-8 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(99,241,157,0.9), rgba(99,241,157,0.7))",
                  color: "#0a0a0a",
                  boxShadow: "0 0 20px rgba(99,241,157,0.25)",
                  opacity: (pipelineRunning || starting) ? 0.6 : 1,
                }}
              >
                {starting ? "Starting..." : "Run Verification (14 Gates)"}
              </button>
            </div>
          )}

          {/* Running state */}
          {pipelineRunning && total === 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon d={icons.loader} size={14} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
              <span className="text-sm text-text-muted letter-shimmer">Starting gates...</span>
            </div>
          )}

          {/* Progress bar */}
          {total > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{passed} passed{failed > 0 ? `, ${failed} failed` : ""}</span>
                <span>{total}/14</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(passed / 14) * 100}%`,
                    backgroundColor: failed > 0 ? "var(--color-error)" : "var(--color-accent)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Gate results */}
          {total > 0 && (
            <div className="flex flex-col gap-1">
              {gateResults.map((g, i) => (
                <GateRow key={g.gate} gate={g.gate} passed={g.passed} index={i} />
              ))}
              {/* Remaining gates (running) */}
              {pipelineRunning && total < 14 && GATE_ORDER.slice(total).map((gateKey, i) => (
                <div
                  key={`pending-${gateKey}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  {i === 0 ? (
                    <Icon d={icons.loader} size={12} style={{ animation: "spin 1.5s linear infinite", color: "rgba(255,255,255,0.35)" }} />
                  ) : (
                    <div style={{ width: 12, height: 12, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }} />
                  )}
                  <span className="text-xs" style={{ color: i === 0 ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)" }}>
                    {GATE_DESCRIPTIONS[gateKey] ?? gateKey}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {pipelineError && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm" style={{ border: "1px solid var(--color-error)", color: "var(--color-error)", background: "rgba(255,80,80,0.05)" }}>
              <span>{pipelineError}</span>
              {activeProjectSlug && (
                <button
                  onClick={async () => {
                    if (fixing) return;
                    setFixing(true);
                    try {
                      await api.fixGate(activeProjectSlug);
                      // Go back to execution so user can watch the agent fix the issue
                      clearGateResults();
                      setCurrentStage("execution");
                    } catch {}
                    setFixing(false);
                  }}
                  disabled={fixing}
                  style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 12px",
                    borderRadius: 6, border: "1px solid rgba(239,68,68,0.4)",
                    background: fixing ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.12)",
                    color: "var(--color-error)", cursor: fixing ? "default" : "pointer",
                    opacity: fixing ? 0.6 : 1, transition: "background 0.15s",
                  }}
                >
                  {fixing ? "FIXING…" : "FIX"}
                </button>
              )}
            </div>
          )}

          {/* Re-run after failure */}
          {!pipelineRunning && failed > 0 && (
            <button
              onClick={handleRunVerification}
              disabled={starting}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer self-start transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "var(--color-text)",
                opacity: starting ? 0.6 : 1,
              }}
            >
              {starting ? "Starting..." : "Re-run Verification"}
            </button>
          )}

          {/* Success */}
          {allPassed && (
            <div
              className="flex items-center gap-3 px-5 py-4 rounded-2xl"
              style={{
                background: "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.08) 100%)",
                border: "1px solid rgba(99,241,157,0.3)",
              }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(99,241,157,0.15)" }}>
                <Icon d={icons.checkCircle} size={16} stroke="var(--color-accent)" />
              </div>
              <div>
                <span className="text-sm font-semibold text-text block">All 14 gates passed</span>
                <span className="text-xs text-text-muted">Project is verified and complete</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
