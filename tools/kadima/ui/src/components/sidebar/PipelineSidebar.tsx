import { useStore } from "@/store";
import { Icon, icons } from "@/lib/icons";
import type { PipelineStage } from "@/store/pipeline";

const STAGES: { key: PipelineStage; label: string; icon: string }[] = [
  { key: "brief", label: "Brief", icon: icons.lightbulb },
  { key: "cto", label: "CTO Analysis", icon: icons.building },
  { key: "team", label: "Team Assembly", icon: icons.nodes },
  { key: "planning", label: "Planning", icon: icons.clipboard },
  { key: "execution", label: "Execution", icon: icons.hammer },
  { key: "verification", label: "Verification", icon: icons.shield },
  { key: "done", label: "Done", icon: icons.checkCircle },
];

function getStageStatus(stageKey: PipelineStage, current: PipelineStage): "done" | "current" | "pending" {
  const idx = STAGES.findIndex((s) => s.key === stageKey);
  const currentIdx = STAGES.findIndex((s) => s.key === current);
  if (idx < currentIdx) return "done";
  if (idx === currentIdx) return "current";
  return "pending";
}

export function PipelineSidebar() {
  const currentStage = useStore((s) => s.currentStage);
  const currentRoute = useStore((s) => s.currentRoute);
  const setRoute = useStore((s) => s.setRoute);
  const projectName = useStore((s) => s.projectName);

  const isSecondaryScreen = currentRoute !== "/project";

  const handleStageClick = () => {
    // Navigate back to pipeline view (clears any secondary screen)
    if (isSecondaryScreen) setRoute("/project");
  };

  return (
    <div className="flex-1 flex flex-col px-3 py-5">
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 mb-8 cursor-pointer px-1"
        onClick={() => setRoute("/")}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "var(--color-accent)",
            boxShadow: "0 0 16px rgba(99, 241, 157, 0.35)",
          }}
        >
          <Icon d={icons.logo} size={16} stroke="var(--color-bg)" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>Kadima OS</span>
          <span className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>{projectName}</span>
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="flex flex-col">
        <span className="text-[10px] font-medium tracking-wider mb-2 px-2" style={{ color: "var(--color-text-muted)", letterSpacing: "0.08em" }}>PIPELINE</span>
        {STAGES.map((stage, i) => {
          const status = getStageStatus(stage.key, currentStage);
          const isActive = !isSecondaryScreen && status === "current";
          const isDone = status === "done";
          const isLast = i === STAGES.length - 1;
          return (
            <div key={stage.key}>
            <div
              onClick={handleStageClick}
              className="flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer"
              style={{ transition: "background 0.15s ease" }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Status indicator */}
              <div className="w-4 flex justify-center shrink-0">
                {isDone && (
                  <div className="w-[14px] h-[14px] rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--color-success)" }}>
                    <Icon d={icons.check} size={8} stroke="var(--color-bg)" />
                  </div>
                )}
                {isActive && (
                  <div className="w-[14px] h-[14px] rounded-full flex items-center justify-center" style={{ border: "2px solid var(--color-accent)" }}>
                    <div className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: "var(--color-accent)" }} />
                  </div>
                )}
                {!isActive && !isDone && (
                  <div className="w-[14px] h-[14px] rounded-full" style={{ border: "1px solid rgba(255,255,255,0.10)" }} />
                )}
              </div>

              {/* Label */}
              <span
                className="text-[12px] font-medium"
                style={{
                  color: isActive
                    ? "var(--color-text)"
                    : isDone
                    ? "var(--color-text-secondary)"
                    : "rgba(255,255,255,0.25)",
                }}
              >
                {stage.label}
              </span>
            </div>
            {!isLast && (
              <div style={{ display: "flex", paddingLeft: 19, height: 14 }}>
                <div style={{ width: 1, height: "100%", background: isDone ? "rgba(99,241,157,0.25)" : "rgba(255,255,255,0.08)" }} />
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
