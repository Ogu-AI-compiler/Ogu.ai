import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useStore } from "@/lib/store";
import { useCommand } from "@/hooks/useCommand";
import { Icon, icons } from "@/lib/icons";
import { DAGView } from "@/components/dag/DAGView";
import { ArtifactsView } from "@/components/artifacts/ArtifactsView";

const stages = [
  { key: "idea", label: "Idea", icon: icons.lightbulb, command: null },
  { key: "feature", label: "Feature", icon: icons.clipboard, command: "feature:validate" },
  { key: "architect", label: "Architect", icon: icons.building, command: "feature:validate" },
  { key: "preflight", label: "Preflight", icon: icons.checkCircle, command: "doctor" },
  { key: "build", label: "Build", icon: icons.hammer, command: null },
  { key: "gates", label: "Gates", icon: icons.shield, command: "gates" },
  { key: "done", label: "Done", icon: icons.rocket, command: null },
];

const phaseOrder = ["idea", "feature", "architect", "ready", "done"];

type Tab = "phases" | "dag" | "artifacts";

function PhaseTimeline() {
  const features = useStore((s) => s.features);
  const activeFeature = useStore((s) => s.activeFeature);
  const cmd = useCommand();

  const active = features.find((f) => f.slug === activeFeature);
  const currentPhase = active?.phase || "idea";
  const currentIdx = phaseOrder.indexOf(currentPhase);

  function getStatus(i: number): "active" | "completed" | "pending" {
    const phaseIdx = Math.min(i, phaseOrder.length - 1);
    if (phaseIdx < currentIdx) return "completed";
    if (phaseIdx === currentIdx) return "active";
    return "pending";
  }

  const nodeStyles: Record<string, React.CSSProperties> = {
    active: {
      backgroundColor: "rgba(139,92,246,0.1)",
      borderColor: "rgba(139,92,246,0.3)",
    },
    completed: {
      backgroundColor: "rgba(34,197,94,0.06)",
      borderColor: "rgba(34,197,94,0.15)",
    },
    pending: {
      backgroundColor: "rgba(22,22,22,0.6)",
      borderColor: "rgba(255,255,255,0.06)",
    },
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap", paddingTop: 24, paddingBottom: 24 }}>
        {stages.map((stage, i) => (
          <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              onClick={
                stage.command
                  ? () => cmd.runSync(stage.command!, activeFeature ? ["--phase-1"] : [])
                  : undefined
              }
              style={{
                width: 100,
                height: 88,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: stage.command ? "pointer" : "default",
                borderWidth: 1,
                borderStyle: "solid",
                ...nodeStyles[getStatus(i)],
              }}
            >
              <Icon d={stage.icon} size={22} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: getStatus(i) === "active" ? "#d4d4d4" : getStatus(i) === "completed" ? "#3fa36b" : "#b3b3b3",
                }}
              >
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  borderRadius: 1,
                  alignSelf: "center",
                  backgroundColor: getStatus(i) === "completed" ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {cmd.output.length > 0 && (
        <div
          style={{
            backgroundColor: "rgba(15,15,23,0.8)",
            borderRadius: 8,
            padding: 16,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: cmd.exitCode === 0 ? "rgba(34,197,94,0.2)" : cmd.exitCode != null ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)",
            maxHeight: 300,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "#b3b3b3" }}>output</span>
            {cmd.exitCode != null && (
              <span style={{ fontSize: 11, color: cmd.exitCode === 0 ? "#3fa36b" : "#d05a5a" }}>
                exit {cmd.exitCode}
              </span>
            )}
          </div>
          {cmd.output.slice(-20).map((line, i) => (
            <span key={i} style={{ fontSize: 13 }}>{line}</span>
          ))}
        </div>
      )}
    </>
  );
}

export function PipelineView() {
  const [tab, setTab] = useState<Tab>("phases");
  const activeFeature = useStore((s) => s.activeFeature);
  const features = useStore((s) => s.features);
  const active = features.find((f) => f.slug === activeFeature);
  const currentPhase = active?.phase || "idea";

  return (
    <div style={{ flex: 1, padding: 28, gap: 24, overflow: "scroll", position: "relative", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Pipeline</span>
        <span style={{ fontSize: 16, color: "#b3b3b3" }}>
          {activeFeature ? `Active: ${activeFeature} (${currentPhase})` : 'No active feature — run "switch <slug>" in chat'}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {(["phases", "dag", "artifacts"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 8,
              cursor: "pointer",
              border: "none",
              backgroundColor: tab === t ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: tab === t ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>
              {t === "phases" ? "Phase Pipeline" : t === "dag" ? "Task DAG" : "Artifacts"}
            </span>
          </button>
        ))}
      </div>

      <Separator style={{ borderColor: "rgba(255,255,255,0.08)" }} />

      {tab === "phases" && <PhaseTimeline />}
      {tab === "dag" && <DAGView />}
      {tab === "artifacts" && <ArtifactsView />}
    </div>
  );
}
