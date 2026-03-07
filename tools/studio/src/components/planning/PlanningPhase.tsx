import { useRef, useEffect } from "react";
import { useStore } from "@/store";
import { Icon, icons } from "@/lib/icons";

export function PlanningPhase() {
  const activityLines = useStore((s) => s.activityLines);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityLines]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--color-accent-soft)" }}
        >
          <Icon d={icons.clipboard} size={16} stroke="var(--color-accent)" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-text">Planning Phase</h2>
          <p className="text-xs text-text-muted">PM and Architects are preparing the execution plan</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          {/* Active phases */}
          <div className="flex flex-col gap-3">
            {[
              { label: "PM drafting product requirements...", icon: icons.clipboard },
              { label: "Architects creating technical specification...", icon: icons.building },
              { label: "Breaking down into tasks...", icon: icons.nodes },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-card"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <Icon d={icons.loader} size={14} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
                <span className="text-sm text-text-muted">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Activity Feed */}
          {activityLines.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Activity</span>
              <div
                ref={scrollRef}
                className="flex flex-col gap-1 max-h-[300px] overflow-auto rounded-xl border border-border bg-bg-card p-3"
              >
                {activityLines.map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                      style={{
                        backgroundColor:
                          line.type === "error" ? "var(--color-error)" :
                          line.type === "dispatch" ? "var(--color-accent)" :
                          "var(--color-text-muted)",
                      }}
                    />
                    <span className="text-xs text-text-muted leading-relaxed">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
