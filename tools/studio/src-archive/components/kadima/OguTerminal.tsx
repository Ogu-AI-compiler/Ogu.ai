/**
 * OguTerminal — compact read-only terminal showing agent output.
 * Auto-spawns on task:dispatched, auto-closes 10s after completion.
 */

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useStore, type ActiveTerminal } from "@/lib/store";
import { StatusDot } from "@/components/ui/status-dot";

const STATUS_COLORS: Record<string, string> = {
  running: "var(--color-success)",
  dispatched: "var(--color-warning)",
  completed: "var(--color-info)",
  failed: "var(--color-error)",
};

export function OguTerminal({ terminal }: { terminal: ActiveTerminal }) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState("dispatched");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { on } = useSocket();
  const removeTerminal = useStore((s) => s.removeTerminal);

  useEffect(() => {
    const unsubs = [
      on("agent:progress", (e: any) => {
        if (e.taskId !== terminal.taskId) return;
        setLines((prev) => [...prev, e.output || e.message || ""]);
        setStatus("running");
      }),
      on("agent:completed", (e: any) => {
        if (e.taskId !== terminal.taskId) return;
        setStatus("completed");
        setTimeout(() => removeTerminal(terminal.taskId), 10000);
      }),
      on("agent:failed", (e: any) => {
        if (e.taskId !== terminal.taskId) return;
        setLines((prev) => [...prev, `Error: ${e.reason || "unknown"}`]);
        setStatus("failed");
        setTimeout(() => removeTerminal(terminal.taskId), 10000);
      }),
      on("task:completed", (e: any) => {
        if (e.taskId !== terminal.taskId) return;
        setStatus("completed");
        setTimeout(() => removeTerminal(terminal.taskId), 10000);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, terminal.taskId, removeTerminal]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const dotColor = STATUS_COLORS[status] || "var(--color-text-muted)";

  return (
    <div className="flex flex-col rounded-lg border border-border bg-bg overflow-hidden" style={{ height: 200 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-bg-card">
        <StatusDot color={dotColor} />
        <span className="text-[11px] font-semibold text-text truncate">{terminal.roleId}</span>
        <span className="text-[10px] font-mono text-text-muted truncate">{terminal.taskId}</span>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-2">
        {lines.length === 0 ? (
          <span className="text-xs text-text-muted">Waiting for output...</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="text-[11px] font-mono text-text-secondary leading-relaxed whitespace-pre-wrap">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Grid of active terminals */
export function TerminalGrid() {
  const terminals = useStore((s) => s.activeTerminals);

  if (terminals.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {terminals.map((t) => (
        <OguTerminal key={t.taskId} terminal={t} />
      ))}
    </div>
  );
}
