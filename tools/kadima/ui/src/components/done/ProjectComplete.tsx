import { useStore } from "@/store";
import { Icon, icons } from "@/lib/icons";

export function ProjectComplete() {
  const setRoute = useStore((s) => s.setRoute);
  const setCurrentStage = useStore((s) => s.setCurrentStage);
  const gateResults = useStore((s) => s.gateResults);
  const clearActivityLines = useStore((s) => s.clearActivityLines);

  const passed = gateResults.filter((g) => g.passed).length;
  const total = gateResults.length;

  const handleStartNext = () => {
    setCurrentStage("brief");
    clearActivityLines();
    setRoute("/");
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md stage-enter">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl"
          style={{ backgroundColor: "var(--color-success)", color: "var(--color-bg)" }}
        >
          {"\u2713"}
        </div>
        <h2 className="text-2xl font-semibold text-text mb-2">Project Complete</h2>
        <p className="text-sm text-text-muted mb-6">
          All compilation gates passed. Your project is ready.
        </p>

        {/* Gate summary */}
        {total > 0 && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-1.5">
              <Icon d={icons.checkCircle} size={14} stroke="var(--color-success)" />
              <span className="text-sm text-text">{passed}/{total} gates</span>
            </div>
          </div>
        )}

        <button
          onClick={handleStartNext}
          className="btn-shimmer px-8 py-3 rounded-xl text-sm font-semibold cursor-pointer"
          style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-text)" }}
        >
          Start Next Feature
        </button>
      </div>
    </div>
  );
}
