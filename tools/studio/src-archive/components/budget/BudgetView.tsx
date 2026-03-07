import { useEffect, useState, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

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
  if (total === 0) return <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>No data</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {entries.filter((e) => e.value > 0).map((entry) => (
          <div key={entry.label} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: colorMap[entry.label] || "#6c5ce7",
            }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{entry.label}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>${entry.value.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
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

  useEffect(() => {
    const unsub1 = on("budget:updated", () => fetchData());
    const unsub2 = on("budget:alert", (_event: any) => {
      fetchData();
    });
    return () => { unsub1(); unsub2(); };
  }, [on, fetchData]);

  if (loading) return (
    <div style={{ flex: 1, padding: 28 }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading budget...</span>
    </div>
  );

  const statusColor = budget ? STATUS_COLORS[budget.status as keyof typeof STATUS_COLORS] || "#888" : "#888";
  const pct = budget?.percentage || 0;

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
    <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 24, overflow: "auto" }}>
      <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "var(--text)" }}>Budget</span>

      {budget ? (
        <>
          {/* Summary Stats */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Daily Limit", value: `$${budget.dailyLimit}`, color: undefined },
              { label: "Spent Today", value: `$${todaySpent.toFixed(4)}`, color: statusColor },
              { label: "Remaining", value: `$${remaining.toFixed(4)}`, color: undefined },
              { label: "Burn Rate", value: `$${burnRate.toFixed(4)}/hr`, color: undefined },
              {
                label: "Projected Runway",
                value: hoursRemaining === Infinity ? "∞" : `${hoursRemaining.toFixed(1)}h`,
                color: hoursRemaining < 2 ? "#ef4444" : hoursRemaining < 6 ? "#facc15" : "#4ade80",
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 12, minWidth: 140, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{label}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Daily Usage — {pct}%</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: statusColor, textTransform: "uppercase" as any }}>{budget.status}</span>
            </div>
            <ProgressBarWithMarkers pct={pct} color={statusColor} />
          </div>
        </>
      ) : (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)" }}>
          <span style={{ color: "rgba(255,255,255,0.5)" }}>No budget data yet. Budget tracking starts when Studio chat is used.</span>
        </div>
      )}

      <Separator style={{ borderColor: "rgba(255,255,255,0.08)" }} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {([
          { key: "overview", label: "7-Day History" },
          { key: "by-model", label: "By Model" },
          { key: "by-role", label: "By Role" },
          { key: "by-feature", label: "By Feature" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
              borderRadius: 8, cursor: "pointer", border: "none",
              backgroundColor: tab === key ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: tab === key ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>{label}</span>
          </button>
        ))}
      </div>

      {/* 7-Day History */}
      {tab === "overview" && (
        <>
          {Object.keys(byDay).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(byDay)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([day, data]: [string, any]) => (
                  <div
                    key={day}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{day}</span>
                    <div style={{ display: "flex", gap: 16 }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{data.calls} calls</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{data.tokens?.toLocaleString()} tokens</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>${data.spent?.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No transaction history</span>
          )}
        </>
      )}

      {/* By Model */}
      {tab === "by-model" && (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Cost by Model</span>
          {Object.keys(byModel).length > 0 ? (
            <>
              <BreakdownBar
                entries={Object.entries(byModel).map(([model, data]: [string, any]) => ({
                  label: model, value: data.spent || 0,
                }))}
                colorMap={MODEL_COLORS}
              />
              <Separator style={{ borderColor: "rgba(255,255,255,0.06)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(byModel)
                  .sort(([, a]: any, [, b]: any) => (b.spent || 0) - (a.spent || 0))
                  .map(([model, data]: [string, any]) => (
                    <div key={model} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 4, padding: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MODEL_COLORS[model] || "#6c5ce7" }} />
                        <span style={{ fontSize: 13, fontFamily: "monospace" }}>{model}</span>
                      </div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{data.calls} calls</span>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{data.tokens?.toLocaleString()} tokens</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>${data.spent?.toFixed(4)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No model usage data yet</span>
          )}
        </div>
      )}

      {/* By Role */}
      {tab === "by-role" && (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Cost by Agent Role</span>
          {Object.keys(byRole).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(byRole)
                .sort(([, a]: any, [, b]: any) => (b.spent || 0) - (a.spent || 0))
                .map(([role, data]: [string, any]) => (
                  <div key={role} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 4, padding: 8 }}>
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{role}</span>
                    <div style={{ display: "flex", gap: 16 }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{data.calls} calls</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{data.tokens?.toLocaleString()} tokens</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>${data.spent?.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No role-based spending data yet</span>
          )}
        </div>
      )}

      {/* By Feature */}
      {tab === "by-feature" && (
        <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Cost by Feature</span>
          {Object.keys(byFeature).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(byFeature)
                .sort(([, a]: any, [, b]: any) => (b.spent || 0) - (a.spent || 0))
                .map(([feature, data]: [string, any]) => (
                  <div key={feature} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 4, padding: 8 }}>
                    <span style={{ fontSize: 13, fontFamily: "monospace" }}>{feature}</span>
                    <div style={{ display: "flex", gap: 16 }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{data.calls} calls</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>${data.spent?.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No feature-based spending data yet</span>
          )}
        </div>
      )}
    </div>
  );
}
