import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";

interface Props {
  activeAgents: number;
  queuedTasks: number;
  budget: any;
}

export function QuickStats({ activeAgents, queuedTasks, budget }: Props) {
  const setRoute = useStore((s) => s.setRoute);

  const tiles = [
    {
      label: "Active Agents",
      value: String(activeAgents),
      color: activeAgents > 0 ? "var(--color-success)" : undefined,
      route: "/agents",
    },
    {
      label: "Queued Tasks",
      value: String(queuedTasks),
      color: queuedTasks > 0 ? "var(--color-accent)" : undefined,
      route: "/pipeline",
    },
    {
      label: "Budget",
      value: budget ? `$${(budget.spent ?? 0).toFixed(2)}` : "$0.00",
      color: undefined,
      route: "/budget",
    },
  ];

  return (
    <div className="flex gap-3">
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          onClick={() => setRoute(tile.route)}
          className="flex-1 flex flex-col gap-1 cursor-pointer hover:bg-bg-card-hover transition-colors"
        >
          <span className="text-[10px] text-text-muted font-medium">{tile.label}</span>
          <span
            className="text-xl font-bold"
            style={{ color: tile.color || "var(--color-text)" }}
          >
            {tile.value}
          </span>
        </Card>
      ))}
    </div>
  );
}
