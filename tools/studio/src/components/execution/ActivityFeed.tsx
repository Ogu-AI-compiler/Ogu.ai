import { useRef, useEffect } from "react";
import type { ActivityLine } from "@/store";

const TYPE_COLORS: Record<string, string> = {
  error: "var(--color-error)",
  dispatch: "var(--color-accent)",
  agent: "#a78bfa",
  pipeline: "#60a5fa",
  task: "#34d399",
  think: "var(--color-text-muted)",
};

export function ActivityFeed({ lines }: { lines: ActivityLine[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
        Activity ({lines.length})
      </span>
      <div
        ref={scrollRef}
        className="flex flex-col gap-0.5 max-h-[200px] overflow-auto rounded-lg border border-border bg-bg-card p-2"
      >
        {lines.map((line, i) => (
          <div key={i} className="flex items-start gap-2 py-0.5">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
              style={{ backgroundColor: TYPE_COLORS[line.type] || TYPE_COLORS.think }}
            />
            <span className="text-[11px] text-text-muted leading-relaxed">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
