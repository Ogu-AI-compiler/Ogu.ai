/**
 * MorningBrief — boot screen shown on first load.
 * Aggregates system health, active feature, budget, pending approvals.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon, icons } from "@/lib/icons";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface BriefData {
  health: any;
  feature: { slug: string; phase: string } | null;
  budget: any;
  pendingApprovals: number;
  standup: string | null;
}

export function MorningBrief({ onDismiss }: { onDismiss: () => void }) {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const activeFeature = useStore((s) => s.activeFeature);
  const features = useStore((s) => s.features);

  useEffect(() => {
    Promise.all([
      api.getKadimaHealth().catch(() => null),
      api.getBudget().catch(() => null),
      api.getGovernancePending().catch(() => ({ pending: [], count: 0 })),
      api.getKadimaStandup().catch(() => null),
    ]).then(([health, budget, governance, standup]) => {
      if (!health || health.error) {
        setOffline(true);
        setLoading(false);
        return;
      }
      const feat = features.find((f) => f.slug === activeFeature) || null;
      setData({
        health,
        feature: feat ? { slug: feat.slug, phase: feat.phase } : null,
        budget,
        pendingApprovals: governance?.count || 0,
        standup: standup?.stdout || null,
      });
      setLoading(false);
    });
  }, [activeFeature, features]);

  if (loading) {
    return (
      <Card className="flex flex-col gap-3 boot-stagger">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-48" />
      </Card>
    );
  }

  if (offline) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <StatusDot variant="error" size="lg" />
          <span className="text-sm font-semibold text-text">Kadima Offline</span>
        </div>
        <span className="text-sm text-text-muted">
          The daemon is not running. Start with: <code className="text-xs font-mono text-text-secondary">ogu kadima:start</code>
        </span>
        <Button variant="ghost" size="sm" className="self-end" onClick={onDismiss}>
          Dismiss
        </Button>
      </Card>
    );
  }

  if (!data) return null;

  const budgetSpent = data.budget?.todaySpent ?? data.budget?.spent;
  const budgetLimit = data.budget?.dailyLimit ?? data.budget?.limit;
  const budgetPct = budgetSpent != null && budgetLimit
    ? Math.round((budgetSpent / budgetLimit) * 100)
    : null;

  return (
    <Card className="flex flex-col gap-4 boot-stagger">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-text">Morning Brief</span>
        <Button variant="ghost" size="icon" onClick={onDismiss}>
          <Icon d={icons.x} size={14} />
        </Button>
      </div>

      {/* System Health */}
      <div className="flex items-center gap-3">
        <StatusDot variant="success" />
        <span className="text-sm text-text">System Online</span>
        {data.health?.uptimeMs && (
          <span className="text-xs text-text-muted">
            Uptime: {Math.floor(data.health.uptimeMs / 60000)}m
          </span>
        )}
      </div>

      {/* Active Feature */}
      {data.feature && (
        <div className="flex items-center gap-3">
          <Icon d={icons.features} size={14} stroke="var(--color-text-muted)" />
          <span className="text-sm text-text">
            <span className="font-mono text-text-secondary">{data.feature.slug}</span>
            {" "}&middot; {data.feature.phase}
          </span>
        </div>
      )}

      {/* Budget */}
      {data.budget && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Icon d={icons.shield} size={14} stroke="var(--color-text-muted)" />
            <span className="text-sm text-text">
              Budget: ${budgetSpent?.toFixed(2) ?? "0.00"} / ${budgetLimit?.toFixed(2) ?? "0.00"}
            </span>
          </div>
          {budgetPct !== null && (
            <Progress
              className="ml-[26px]"
              value={budgetPct}
              color={budgetPct > 80 ? "var(--color-error)" : budgetPct > 60 ? "var(--color-warning)" : "var(--color-success)"}
            />
          )}
        </div>
      )}

      {/* Pending Approvals */}
      {data.pendingApprovals > 0 && (
        <div className="flex items-center gap-3">
          <Icon d={icons.building} size={14} stroke="var(--color-warning)" />
          <span className="text-sm text-warning">
            {data.pendingApprovals} pending approval{data.pendingApprovals > 1 ? "s" : ""}
          </span>
          <span
            className="text-xs text-accent cursor-pointer hover:underline"
            onClick={() => useStore.getState().setRoute("/governance")}
          >
            Review
          </span>
        </div>
      )}

      {/* Today's Focus */}
      {data.standup && (
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-xs text-text-muted font-medium">Today's Focus</span>
          <span className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-3">
            {data.standup.split("\n").slice(0, 3).join("\n")}
          </span>
        </div>
      )}
    </Card>
  );
}
