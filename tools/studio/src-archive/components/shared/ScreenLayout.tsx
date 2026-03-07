import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

// ── Types ──

interface FooterAction {
  label: string;
  command: string;
  args?: string[];
}

interface Tab {
  key: string;
  label: string;
}

interface Props {
  title: string;
  subtitle?: string;
  back?: string | false;      // route to go back to (default: /dashboard), false = no back button
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  actions?: FooterAction[];   // footer action buttons
  children: ReactNode;
}

// ── Component ──

export function ScreenLayout({ title, subtitle, back, tabs, activeTab, onTabChange, actions, children }: Props) {
  const setRoute = useStore((s) => s.setRoute);

  const runAction = async (action: FooterAction) => {
    const toastId = toast.loading(`Running ${action.label}...`);
    try {
      const res = await fetch("/api/command/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: action.command, args: action.args || [] }),
      });
      const data = await res.json();
      if (data.exitCode === 0) {
        const lines = data.stdout ? data.stdout.split("\n").filter(Boolean) : [];
        toast.success(`${action.label} passed`, {
          id: toastId,
          description: lines.slice(-3).join("\n") || undefined,
        });
      } else {
        const lines = data.stdout ? data.stdout.split("\n").filter(Boolean) : [];
        toast.error(`${action.label} failed`, {
          id: toastId,
          description: lines.slice(-5).join("\n") || undefined,
        });
      }
    } catch {
      toast.error(`${action.label} — connection error`, { id: toastId });
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid var(--color-border, var(--border))" }}
      >
        {/* Left: back + title */}
        <div className="flex items-center gap-3">
          {back !== false && (
            <button
              onClick={() => setRoute(back || "/dashboard")}
              className="flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
              style={{ background: "none", border: "none" }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted, var(--text-muted))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: "var(--color-text, var(--text))" }}>
              {title}
            </h1>
            {subtitle && (
              <span className="text-[11px]" style={{ color: "var(--color-text-muted, var(--text-muted))" }}>
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Right: tabs (if any) */}
        {tabs && tabs.length > 0 && (
          <div
            className="flex items-center rounded-lg p-0.5"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange?.(tab.key)}
                className="px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-all rounded-md"
                style={{
                  border: "none",
                  backgroundColor: activeTab === tab.key ? "rgba(255,255,255,0.1)" : "transparent",
                  color: activeTab === tab.key
                    ? "var(--color-text, var(--text))"
                    : "var(--color-text-muted, var(--text-muted))",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-auto">
        {children}
      </div>

      {/* Footer */}
      {actions && actions.length > 0 && (
        <div
          className="shrink-0 flex items-center gap-2 px-8 py-3"
          style={{ borderTop: "1px solid var(--color-border, var(--border))" }}
        >
          {actions.map((action) => (
            <button
              key={action.command}
              onClick={() => runAction(action)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors hover:bg-white/5"
              style={{
                backgroundColor: "transparent",
                border: "1px solid var(--color-border, var(--border))",
                color: "var(--color-text-secondary, var(--text-secondary))",
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
