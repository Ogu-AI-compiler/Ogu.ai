import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";

interface Props {
  agents: any[];
}

export function LiveAgentsMini({ agents }: Props) {
  const setRoute = useStore((s) => s.setRoute);

  const activeAgents = agents
    .filter((a) => a.state?.currentTask)
    .slice(0, 3);

  if (activeAgents.length === 0 && agents.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-muted font-medium">Agents</span>
        <span
          className="text-[10px] text-text-muted cursor-pointer hover:text-text transition-colors"
          onClick={() => setRoute("/agents")}
        >
          View all &rarr;
        </span>
      </div>
      {activeAgents.length === 0 ? (
        <span className="text-sm text-text-muted">No agents running</span>
      ) : (
        <div className="flex flex-col gap-2">
          {activeAgents.map((agent) => (
            <div
              key={agent.roleId}
              className="flex items-center gap-2 cursor-pointer hover:bg-accent-soft rounded-md px-2 py-1.5 transition-colors"
              onClick={() => setRoute("/agents")}
            >
              <StatusDot size="sm" color="#4ade80" glow />
              <span className="text-sm font-semibold text-text flex-1 truncate">{agent.name}</span>
              <span className="text-[10px] text-text-muted truncate max-w-[200px]">
                {agent.state?.currentTask}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
