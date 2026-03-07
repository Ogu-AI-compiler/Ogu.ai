import { useStore } from "@/lib/store";
import { getNextAction } from "@/lib/next-action";
import { GateProgressBar } from "@/components/dashboard/GateProgressBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  detectedPhase: string;
  pendingApprovals: number;
  budget: any;
  onAction: (action: { type: string; command?: string; route?: string }) => void;
}

export function ActiveFeatureCard({ detectedPhase, pendingApprovals, budget, onAction }: Props) {
  const { features, activeFeature, gateState } = useStore();
  const active = features.find((f) => f.slug === activeFeature);
  const nextAction = getNextAction(activeFeature, detectedPhase, gateState, pendingApprovals);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-text">
            {activeFeature || "No Active Feature"}
          </span>
          {active && (
            <div className="flex gap-2 items-center">
              <Badge variant="secondary">{detectedPhase}</Badge>
              {active.tasks > 0 && (
                <span className="text-xs text-text-muted">{active.tasks} tasks</span>
              )}
            </div>
          )}
        </div>
        <Button
          variant="default"
          onClick={() => onAction(nextAction)}
        >
          {nextAction.label}
        </Button>
      </div>

      {activeFeature && (
        <span className="text-sm text-text-muted">{nextAction.description}</span>
      )}

      {budget && (
        <div className="flex gap-4 text-xs text-text-muted">
          <span>Spent: ${(budget.spent ?? 0).toFixed(2)}</span>
          <span>Limit: ${(budget.limit ?? 0).toFixed(2)}</span>
        </div>
      )}

      {gateState?.gates && Object.keys(gateState.gates).length > 0 && (
        <GateProgressBar gates={gateState.gates} />
      )}
    </Card>
  );
}
