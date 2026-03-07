import { cn } from "@/lib/cn";

const phases = [
  { key: "idea", label: "Idea" },
  { key: "feature", label: "Feature" },
  { key: "architect", label: "Architect" },
  { key: "preflight", label: "Preflight" },
  { key: "build", label: "Build" },
  { key: "gates", label: "Gates" },
  { key: "done", label: "Done" },
];

const phaseOrder = ["idea", "feature", "architect", "preflight", "build", "gates", "done"];

export function PhaseBanner({ currentPhase }: { currentPhase: string }) {
  const currentIdx = phaseOrder.indexOf(currentPhase);

  return (
    <div className="flex gap-1.5 items-center">
      {phases.map((p, i) => {
        const isActive = i === currentIdx;
        const isCompleted = i < currentIdx;
        return (
          <div
            key={p.key}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors",
              isActive && "bg-accent-soft text-text",
              isCompleted && "bg-success-soft text-success",
              !isActive && !isCompleted && "bg-bg text-text-muted border border-border",
            )}
          >
            {p.label}
          </div>
        );
      })}
    </div>
  );
}
