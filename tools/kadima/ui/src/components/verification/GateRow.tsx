import { Icon, icons } from "@/lib/icons";

interface GateRowProps {
  gate: string;
  passed: boolean;
  index: number;
}

export function GateRow({ gate, passed, index }: GateRowProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors stage-enter"
      style={{
        animationDelay: `${index * 60}ms`,
        backgroundColor: passed ? "rgba(52, 211, 153, 0.06)" : "rgba(239, 68, 68, 0.06)",
      }}
    >
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: passed ? "var(--color-success)" : "var(--color-error)" }}
      >
        {passed ? (
          <Icon d={icons.check} size={10} stroke="var(--color-bg)" />
        ) : (
          <Icon d={icons.x} size={10} stroke="var(--color-bg)" />
        )}
      </div>
      <span className="text-sm text-text flex-1">{gate}</span>
      <span
        className="text-[10px] font-bold uppercase"
        style={{ color: passed ? "var(--color-success)" : "var(--color-error)" }}
      >
        {passed ? "PASS" : "FAIL"}
      </span>
    </div>
  );
}
