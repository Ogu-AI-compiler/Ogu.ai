import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useCommand } from "@/hooks/useCommand";
import { api } from "@/lib/api";
import { Icon, icons } from "@/lib/icons";
import { StatusCard } from "./StatusCard";
import { GateProgressBar } from "./GateProgressBar";
import { RecentActivity } from "./RecentActivity";

/* ── Pipeline stages ── */
const stages = [
  { key: "discovery", label: "Discovery", icon: icons.lightbulb, command: null },
  { key: "feature", label: "Feature", icon: icons.clipboard, command: "feature:validate" },
  { key: "architect", label: "Architect", icon: icons.building, command: "feature:validate" },
  { key: "preflight", label: "Preflight", icon: icons.checkCircle, command: "doctor" },
  { key: "build", label: "Build", icon: icons.hammer, command: null },
  { key: "gates", label: "Gates", icon: icons.shield, command: "gates" },
  { key: "deliver", label: "Done", icon: icons.rocket, command: null },
];

const phaseOrder = ["discovery", "feature", "architect", "preflight", "build", "gates", "deliver"];

const NODE_STYLES: Record<string, React.CSSProperties> = {
  active: { backgroundColor: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.3)" },
  completed: { backgroundColor: "rgba(34,197,94,0.06)", borderColor: "rgba(34,197,94,0.15)" },
  pending: { backgroundColor: "rgba(22,22,22,0.6)", borderColor: "rgba(255,255,255,0.06)" },
};

export function DashboardView() {
  const { features, activeFeature, platform, gateState } = useStore();
  const [themeData, setThemeData] = useState<any>(null);
  const [detectedPhase, setDetectedPhase] = useState<string>("discovery");
  const [involvement, setInvolvement] = useState<string | null>(null);
  const doctor = useCommand();
  const pipelineCmd = useCommand();

  const refresh = () => {
    api.getState().then((d) => setThemeData(d.theme));
    api.getGates().then((g) => useStore.getState().setGateState(g));
    fetch("/api/state/phase").then((r) => r.json()).then((d) => {
      if (d.phase) setDetectedPhase(d.phase);
      if (d.involvement) setInvolvement(d.involvement);
    }).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeCount = features.filter((f) => f.phase !== "done").length;
  const doneCount = features.filter((f) => f.phase === "done").length;
  const mood = themeData?.mood || "dark";

  const currentPhase = detectedPhase;
  const currentIdx = phaseOrder.indexOf(currentPhase);

  function getStatus(i: number): "active" | "completed" | "pending" {
    const phaseIdx = Math.min(i, phaseOrder.length - 1);
    if (phaseIdx < currentIdx) return "completed";
    if (phaseIdx === currentIdx) return "active";
    return "pending";
  }

  return (
    <div style={{ flex: 1, padding: 28, gap: 24, overflow: "scroll", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "var(--text)" }}>Dashboard</span>
        <span style={{ fontSize: 16, color: "var(--text-secondary)" }}>Project overview and health status</span>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatusCard label="Platform" value={platform} />
        <StatusCard label="Active Feature" value={activeFeature || "None"} accent={!!activeFeature} />
        <StatusCard label="Features" value={String(activeCount)} sub={`${doneCount} completed`} />
        <StatusCard label="Theme" value={mood} />
      </div>

      {/* Pipeline */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 12, borderRadius: 12, padding: 20,
        backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-secondary)" }}>
            Pipeline {activeFeature ? `- ${activeFeature}` : ""}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {involvement && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: "var(--accent)",
                backgroundColor: "var(--accent-soft)", padding: "2px 8px", borderRadius: 10,
              }}>{involvement}</span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: currentIdx >= 0 ? "#8b5cf6" : "var(--text-secondary)",
              backgroundColor: currentIdx >= 0 ? "rgba(139,92,246,0.12)" : "transparent",
              padding: "2px 8px", borderRadius: 10,
            }}>{currentPhase.toUpperCase()}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap", paddingTop: 12, paddingBottom: 12 }}>
          {stages.map((stage, i) => (
            <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                onClick={
                  stage.command
                    ? () => pipelineCmd.runSync(stage.command!, activeFeature ? ["--phase-1"] : [])
                    : undefined
                }
                style={{
                  width: 100, height: 88, borderRadius: 12,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 8,
                  cursor: stage.command ? "pointer" : "default",
                  borderWidth: 1, borderStyle: "solid",
                  ...NODE_STYLES[getStatus(i)],
                }}
              >
                <Icon d={stage.icon} size={22} />
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: getStatus(i) === "active" ? "#d4d4d4" : getStatus(i) === "completed" ? "#3fa36b" : "#b3b3b3",
                }}>
                  {stage.label}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div style={{
                  width: 40, height: 2, borderRadius: 1, alignSelf: "center",
                  backgroundColor: getStatus(i) === "completed" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)",
                }} />
              )}
            </div>
          ))}
        </div>
        {pipelineCmd.output.length > 0 && (
          <div style={{
            borderRadius: 8, padding: 12, gap: 4, marginTop: 8,
            display: "flex", flexDirection: "column",
            backgroundColor: "color-mix(in srgb, var(--bg) 80%, transparent)",
            border: `1px solid ${pipelineCmd.exitCode === 0 ? "var(--success)" : "var(--error)"}33`,
          }}>
            {pipelineCmd.output.slice(-10).map((line, i) => (
              <span key={i} style={{ fontSize: 13, color: "var(--text)" }}>{line}</span>
            ))}
          </div>
        )}
      </div>

      {/* Gates */}
      <div style={{ borderRadius: 12, padding: 20, backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <GateProgressBar gates={gateState?.gates || {}} />
        {gateState?.feature && (
          <span style={{ fontSize: 13, marginTop: 12, display: "block", color: "var(--text-secondary)" }}>
            Feature: {gateState.feature}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12 }}>
        <div
          onClick={() => doctor.runSync("doctor")}
          style={{
            borderRadius: 8, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12,
            cursor: "pointer", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            {doctor.loading ? "Running..." : "Run Doctor"}
          </span>
        </div>
        <div
          onClick={() => doctor.runSync("validate")}
          style={{
            borderRadius: 8, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12,
            cursor: "pointer", backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Validate</span>
        </div>
      </div>

      {doctor.output.length > 0 && (
        <div style={{
          borderRadius: 8, padding: 16, gap: 4,
          display: "flex", flexDirection: "column",
          backgroundColor: "color-mix(in srgb, var(--bg) 80%, transparent)",
          border: `1px solid ${doctor.exitCode === 0 ? "var(--success)" : "var(--error)"}33`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>output</span>
            {doctor.exitCode != null && (
              <span style={{ fontSize: 11, color: doctor.exitCode === 0 ? "var(--success)" : "var(--error)" }}>
                exit {doctor.exitCode}
              </span>
            )}
          </div>
          {doctor.output.map((line, i) => (
            <span key={i} style={{ fontSize: 13, color: "var(--text)" }}>{line}</span>
          ))}
        </div>
      )}

      <RecentActivity />
    </div>
  );
}
