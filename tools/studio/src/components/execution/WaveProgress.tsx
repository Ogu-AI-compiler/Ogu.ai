import { useStore } from "@/store";

export function WaveProgress() {
  const dp = useStore((s) => s.dispatchProgress);

  if (dp.totalTasks === 0 && dp.totalWaves === 0) return null;

  const done = dp.completedTasks + dp.failedTasks;
  const pct = dp.totalTasks > 0 ? Math.min(100, Math.round((done / dp.totalTasks) * 100)) : 0;

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-bg shrink-0">
      {dp.totalWaves > 0 && (
        <span className="text-[11px] text-text-muted">
          Wave {dp.currentWave}/{dp.totalWaves}
        </span>
      )}
      <div className="flex-1 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: "var(--color-accent)" }}
        />
      </div>
      <span className="text-[11px] text-text-muted">
        {done}/{dp.totalTasks} tasks
      </span>
      <span className="text-[11px] font-semibold" style={{ color: "var(--color-accent)" }}>{pct}%</span>
    </div>
  );
}
