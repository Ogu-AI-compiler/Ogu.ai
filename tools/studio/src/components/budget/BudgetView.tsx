import { useEffect, useState, useCallback } from "react";
import { styled, Text, YStack, XStack, Separator } from "tamagui";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

const Page = styled(YStack, { flex: 1, padding: "$7", gap: "$6", overflow: "scroll" });
const Card = styled(YStack, {
  backgroundColor: "rgba(22,22,22,0.6)",
  borderRadius: "$4",
  padding: "$5",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  gap: "$3",
});
const StatBox = styled(YStack, {
  backgroundColor: "rgba(255,255,255,0.04)",
  borderRadius: "$2",
  padding: "$3",
  minWidth: 140,
  gap: "$1",
});
const TabBtn = styled(XStack, {
  paddingHorizontal: "$3",
  paddingVertical: "$2",
  borderRadius: "$2",
  cursor: "pointer",
  variants: {
    active: {
      true: { backgroundColor: "rgba(108,92,231,0.2)" },
      false: { backgroundColor: "rgba(255,255,255,0.04)", hoverStyle: { backgroundColor: "rgba(255,255,255,0.08)" } },
    },
  } as const,
});

const STATUS_COLORS = { ok: "#4ade80", warning: "#facc15", exhausted: "#ef4444" };
const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6": "#a78bfa",
  "claude-sonnet-4-6": "#6c5ce7",
  "claude-haiku-4-5-20251001": "#00d4ff",
  opus: "#a78bfa",
  sonnet: "#6c5ce7",
  haiku: "#00d4ff",
};

type Tab = "overview" | "by-model" | "by-role" | "by-feature";

function ProgressBarWithMarkers({ pct, color }: { pct: number; color: string }) {
  const barWidth = Math.min(pct, 100);
  return (
    <div style={{ width: "100%", position: "relative" }}>
      <div style={{
        width: "100%", height: 16, borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden",
      }}>
        <div style={{
          width: `${barWidth}%`, height: "100%", borderRadius: 8,
          backgroundColor: color, transition: "width 0.3s ease",
        }} />
      </div>
      {/* Threshold markers */}
      {[50, 75, 90].map((threshold) => (
        <div key={threshold} style={{
          position: "absolute", top: -4, left: `${threshold}%`,
          width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.2)",
        }}>
          <span style={{
            position: "absolute", top: -16, left: -8,
            fontSize: 9, color: "rgba(255,255,255,0.3)",
          }}>{threshold}%</span>
        </div>
      ))}
    </div>
  );
}

function BreakdownBar({ entries, colorMap }: { entries: { label: string; value: number }[]; colorMap: Record<string, string> }) {
  const total = entries.reduce((s, e) => s + e.value, 0);
  if (total === 0) return <Text fontSize="$1" color="$colorPress">No data</Text>;

  return (
    <YStack gap="$2">
      <div style={{
        width: "100%", height: 10, borderRadius: 5, overflow: "hidden",
        display: "flex", backgroundColor: "rgba(255,255,255,0.06)",
      }}>
        {entries.filter((e) => e.value > 0).map((entry) => (
          <div key={entry.label} style={{
            width: `${(entry.value / total) * 100}%`, height: "100%",
            backgroundColor: colorMap[entry.label] || "#6c5ce7",
          }} />
        ))}
      </div>
      <XStack gap="$3" flexWrap="wrap">
        {entries.filter((e) => e.value > 0).map((entry) => (
          <XStack key={entry.label} gap="$1" alignItems="center">
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: colorMap[entry.label] || "#6c5ce7",
            }} />
            <Text fontSize={10} color="$colorPress">{entry.label}</Text>
            <Text fontSize={10} color="$colorPress" fontWeight="600">${entry.value.toFixed(4)}</Text>
          </XStack>
        ))}
      </XStack>
    </YStack>
  );
}

export function BudgetView() {
  const [budget, setBudget] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const { on } = useSocket();

  const fetchData = useCallback(() => {
    Promise.all([
      api.getBudget().catch(() => null),
      api.getBudgetHistory(7).catch(() => null),
    ]).then(([b, h]) => {
      setBudget(b);
      setHistory(h);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // WebSocket live updates
  useEffect(() => {
    const unsub1 = on("budget:updated", () => fetchData());
    const unsub2 = on("budget:alert", (event: any) => {
      // Could show a toast here in the future
      fetchData();
    });
    return () => { unsub1(); unsub2(); };
  }, [on, fetchData]);

  if (loading) return <Page><Text color="$colorPress">Loading budget...</Text></Page>;

  const statusColor = budget ? STATUS_COLORS[budget.status as keyof typeof STATUS_COLORS] || "#888" : "#888";
  const pct = budget?.percentage || 0;

  // Calculate burn rate (tokens/hour estimate from today's data)
  const todaySpent = budget?.todaySpent || 0;
  const remaining = budget?.remaining || 0;
  const hoursElapsed = new Date().getHours() + new Date().getMinutes() / 60 || 1;
  const burnRate = todaySpent / hoursElapsed;
  const hoursRemaining = burnRate > 0 ? remaining / burnRate : Infinity;

  const byModel = history?.byModel || {};
  const byRole = history?.byRole || {};
  const byFeature = history?.byFeature || {};
  const byDay = history?.byDay || {};

  return (
    <Page>
      <Text fontSize="$7" fontWeight="700" letterSpacing={-0.5}>Budget</Text>

      {budget ? (
        <>
          {/* Summary Stats */}
          <XStack gap="$4" flexWrap="wrap">
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Daily Limit</Text>
              <Text fontSize="$6" fontWeight="700">${budget.dailyLimit}</Text>
            </StatBox>
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Spent Today</Text>
              <Text fontSize="$6" fontWeight="700" color={statusColor}>
                ${todaySpent.toFixed(4)}
              </Text>
            </StatBox>
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Remaining</Text>
              <Text fontSize="$6" fontWeight="700">${remaining.toFixed(4)}</Text>
            </StatBox>
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Burn Rate</Text>
              <Text fontSize="$6" fontWeight="700">${burnRate.toFixed(4)}/hr</Text>
            </StatBox>
            <StatBox>
              <Text fontSize="$1" color="$colorPress">Projected Runway</Text>
              <Text fontSize="$6" fontWeight="700" color={hoursRemaining < 2 ? "#ef4444" : hoursRemaining < 6 ? "#facc15" : "#4ade80"}>
                {hoursRemaining === Infinity ? "∞" : `${hoursRemaining.toFixed(1)}h`}
              </Text>
            </StatBox>
          </XStack>

          {/* Progress Bar with Thresholds */}
          <Card>
            <XStack justifyContent="space-between">
              <Text fontSize="$2" fontWeight="600">Daily Usage — {pct}%</Text>
              <Text fontSize="$2" fontWeight="600" color={statusColor} textTransform="uppercase">{budget.status}</Text>
            </XStack>
            <ProgressBarWithMarkers pct={pct} color={statusColor} />
          </Card>
        </>
      ) : (
        <Card>
          <Text color="$colorPress">No budget data yet. Budget tracking starts when Studio chat is used.</Text>
        </Card>
      )}

      <Separator borderColor="rgba(255,255,255,0.08)" />

      {/* Tabs for breakdowns */}
      <XStack gap="$2">
        {([
          { key: "overview", label: "7-Day History" },
          { key: "by-model", label: "By Model" },
          { key: "by-role", label: "By Role" },
          { key: "by-feature", label: "By Feature" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <TabBtn key={key} active={tab === key} onPress={() => setTab(key)}>
            <Text fontSize="$2" fontWeight="600" color={tab === key ? "#a78bfa" : "$colorPress"}>{label}</Text>
          </TabBtn>
        ))}
      </XStack>

      {/* 7-Day History */}
      {tab === "overview" && (
        <>
          {Object.keys(byDay).length > 0 ? (
            <YStack gap="$2">
              {Object.entries(byDay)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([day, data]: [string, any]) => (
                  <XStack
                    key={day}
                    backgroundColor="rgba(255,255,255,0.04)"
                    borderRadius="$2"
                    padding="$3"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Text fontSize="$2" fontFamily="$mono">{day}</Text>
                    <XStack gap="$4">
                      <Text fontSize="$1" color="$colorPress">{data.calls} calls</Text>
                      <Text fontSize="$1" color="$colorPress">{data.tokens?.toLocaleString()} tokens</Text>
                      <Text fontSize="$2" fontWeight="600">${data.spent?.toFixed(4)}</Text>
                    </XStack>
                  </XStack>
                ))}
            </YStack>
          ) : (
            <Text fontSize="$2" color="$colorPress">No transaction history</Text>
          )}
        </>
      )}

      {/* By Model */}
      {tab === "by-model" && (
        <Card>
          <Text fontSize="$3" fontWeight="600">Cost by Model</Text>
          {Object.keys(byModel).length > 0 ? (
            <>
              <BreakdownBar
                entries={Object.entries(byModel).map(([model, data]: [string, any]) => ({
                  label: model, value: data.spent || 0,
                }))}
                colorMap={MODEL_COLORS}
              />
              <Separator borderColor="rgba(255,255,255,0.06)" />
              <YStack gap="$2">
                {Object.entries(byModel)
                  .sort(([, a]: any, [, b]: any) => (b.spent || 0) - (a.spent || 0))
                  .map(([model, data]: [string, any]) => (
                    <XStack key={model} justifyContent="space-between" alignItems="center"
                      backgroundColor="rgba(255,255,255,0.02)" borderRadius="$1" padding="$2">
                      <XStack gap="$2" alignItems="center">
                        <div style={{
                          width: 8, height: 8, borderRadius: 4,
                          backgroundColor: MODEL_COLORS[model] || "#6c5ce7",
                        }} />
                        <Text fontSize="$2" fontFamily="$mono">{model}</Text>
                      </XStack>
                      <XStack gap="$4">
                        <Text fontSize="$1" color="$colorPress">{data.calls} calls</Text>
                        <Text fontSize="$1" color="$colorPress">{data.tokens?.toLocaleString()} tokens</Text>
                        <Text fontSize="$2" fontWeight="600">${data.spent?.toFixed(4)}</Text>
                      </XStack>
                    </XStack>
                  ))}
              </YStack>
            </>
          ) : (
            <Text fontSize="$2" color="$colorPress">No model usage data yet</Text>
          )}
        </Card>
      )}

      {/* By Role */}
      {tab === "by-role" && (
        <Card>
          <Text fontSize="$3" fontWeight="600">Cost by Agent Role</Text>
          {Object.keys(byRole).length > 0 ? (
            <YStack gap="$2">
              {Object.entries(byRole)
                .sort(([, a]: any, [, b]: any) => (b.spent || 0) - (a.spent || 0))
                .map(([role, data]: [string, any]) => (
                  <XStack key={role} justifyContent="space-between" alignItems="center"
                    backgroundColor="rgba(255,255,255,0.02)" borderRadius="$1" padding="$2">
                    <Text fontSize="$2" fontFamily="$mono">{role}</Text>
                    <XStack gap="$4">
                      <Text fontSize="$1" color="$colorPress">{data.calls} calls</Text>
                      <Text fontSize="$1" color="$colorPress">{data.tokens?.toLocaleString()} tokens</Text>
                      <Text fontSize="$2" fontWeight="600">${data.spent?.toFixed(4)}</Text>
                    </XStack>
                  </XStack>
                ))}
            </YStack>
          ) : (
            <Text fontSize="$2" color="$colorPress">No role-based spending data yet</Text>
          )}
        </Card>
      )}

      {/* By Feature */}
      {tab === "by-feature" && (
        <Card>
          <Text fontSize="$3" fontWeight="600">Cost by Feature</Text>
          {Object.keys(byFeature).length > 0 ? (
            <YStack gap="$2">
              {Object.entries(byFeature)
                .sort(([, a]: any, [, b]: any) => (b.spent || 0) - (a.spent || 0))
                .map(([feature, data]: [string, any]) => (
                  <XStack key={feature} justifyContent="space-between" alignItems="center"
                    backgroundColor="rgba(255,255,255,0.02)" borderRadius="$1" padding="$2">
                    <Text fontSize="$2" fontFamily="$mono">{feature}</Text>
                    <XStack gap="$4">
                      <Text fontSize="$1" color="$colorPress">{data.calls} calls</Text>
                      <Text fontSize="$2" fontWeight="600">${data.spent?.toFixed(4)}</Text>
                    </XStack>
                  </XStack>
                ))}
            </YStack>
          ) : (
            <Text fontSize="$2" color="$colorPress">No feature-based spending data yet</Text>
          )}
        </Card>
      )}
    </Page>
  );
}
