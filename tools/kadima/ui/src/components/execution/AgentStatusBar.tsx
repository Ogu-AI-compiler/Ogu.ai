import { useStore } from "@/store";
import { Icon, icons } from "@/lib/icons";

const STATUS_COLORS: Record<string, string> = {
  idle: "var(--color-text-muted)",
  executing: "var(--color-accent)",
  blocked: "var(--color-error)",
};

export function AgentStatusBar() {
  const agentStatuses = useStore((s) => s.agentStatuses);
  const entries = Object.entries(agentStatuses);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Agents</span>
      <div className="flex flex-col gap-1.5">
        {entries.map(([roleId, agent]) => (
          <div
            key={roleId}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-card"
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_COLORS[agent.status] || STATUS_COLORS.idle }}
            />
            <span className="text-xs font-medium text-text truncate flex-1">{roleId}</span>
            {agent.currentTask && (
              <span className="text-[10px] text-text-muted truncate max-w-[120px]">{agent.currentTask}</span>
            )}
            {agent.status === "executing" && (
              <Icon d={icons.loader} size={10} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
