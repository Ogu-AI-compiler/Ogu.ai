import { useEffect, useState, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { ActionButton } from "@/components/shared/ActionButton";
import { DetailPanel } from "@/components/shared/DetailPanel";

const RISK_COLORS: Record<string, string> = {
  low: "#4ade80", medium: "#facc15", high: "#f87171", critical: "#ef4444",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#facc15", approved: "#4ade80", denied: "#ef4444",
};

type Tab = "pending" | "history" | "policies";

export function GovernanceView() {
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [denyReason, setDenyReason] = useState("");
  const [denyTarget, setDenyTarget] = useState<string | null>(null);
  const { on } = useSocket();

  const fetchData = useCallback(() => {
    Promise.all([
      api.getGovernancePending().catch(() => ({ pending: [] })),
      api.getGovernanceHistory().catch(() => ({ history: [] })),
      api.getGovernancePolicies().catch(() => null),
    ]).then(([p, h, pol]) => {
      setPending(p.pending || []);
      setHistory(h.history || []);
      setPolicies(pol);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const unsub1 = on("governance:approved", () => fetchData());
    const unsub2 = on("governance:denied", () => fetchData());
    const unsub3 = on("governance:escalated", () => fetchData());
    const unsub4 = on("governance:approval_required", () => fetchData());
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [on, fetchData]);

  const handleApprove = async (taskId: string) => {
    try {
      await api.approveGovernance(taskId, "studio-user");
    } catch { /* refreshes below */ }
    fetchData();
  };

  const handleDeny = async (taskId: string) => {
    if (!denyReason.trim()) return;
    try {
      await api.denyGovernance(taskId, denyReason, "studio-user");
    } catch { /* refreshes below */ }
    setDenyTarget(null);
    setDenyReason("");
    fetchData();
  };

  if (loading) return (
    <div style={{ flex: 1, padding: 28 }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>Loading governance...</span>
    </div>
  );

  const rules = policies?.rules || [];

  return (
    <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 24, overflow: "auto", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "var(--text)" }}>Governance</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pending.length > 0 && (
            <div style={{ backgroundColor: "rgba(250,204,21,0.15)", borderRadius: 4, padding: "2px 8px" }}>
              <span style={{ fontSize: 11, color: "#facc15", fontWeight: 600 }}>{pending.length} pending</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {(["pending", "history", "policies"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
              borderRadius: 8, cursor: "pointer", border: "none",
              backgroundColor: tab === t ? "rgba(108,92,231,0.2)" : "rgba(255,255,255,0.04)",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: tab === t ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>
              {t === "pending" ? `Pending (${pending.length})` : t === "history" ? `History (${history.length})` : `Rules (${rules.length})`}
            </span>
          </button>
        ))}
      </div>

      <Separator style={{ borderColor: "rgba(255,255,255,0.08)" }} />

      {/* Pending Tab */}
      {tab === "pending" && (
        <>
          {pending.length === 0 ? (
            <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No pending approvals — all clear</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pending.map((item, i) => (
                <div key={item.taskId || i} style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{item.taskId || item.file}</span>
                        {item.riskTier && (
                          <div style={{ backgroundColor: `${RISK_COLORS[item.riskTier] || "#888"}20`, borderRadius: 4, padding: "2px 6px" }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: RISK_COLORS[item.riskTier] || "#888" }}>
                              {item.riskTier.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        {item.reason || item.type || "Pending review"}
                      </span>
                      {item.featureSlug && (
                        <span style={{ fontSize: 10, color: "#6c5ce7", fontFamily: "monospace" }}>Feature: {item.featureSlug}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <ActionButton
                        label="Approve"
                        variant="success"
                        onAction={() => handleApprove(item.taskId || item.file)}
                      />
                      <ActionButton
                        label="Deny"
                        variant="danger"
                        onAction={() => setDenyTarget(item.taskId || item.file)}
                      />
                      <ActionButton
                        label="Detail"
                        variant="ghost"
                        onAction={() => setSelectedItem(item)}
                      />
                    </div>
                  </div>

                  {denyTarget === (item.taskId || item.file) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      <Textarea
                        placeholder="Reason for denial..."
                        value={denyReason}
                        onChange={(e) => setDenyReason(e.target.value)}
                        rows={2}
                        style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(239,68,68,0.3)", color: "white", fontSize: 12 }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <ActionButton
                          label="Confirm Deny"
                          variant="danger"
                          onAction={() => handleDeny(denyTarget!)}
                          disabled={!denyReason.trim()}
                        />
                        <ActionButton
                          label="Cancel"
                          variant="ghost"
                          onAction={() => { setDenyTarget(null); setDenyReason(""); }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <>
          {history.length === 0 ? (
            <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No approval history yet</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {history.map((item, i) => {
                const status = item.status || "unknown";
                const color = STATUS_COLORS[status] || "#888";
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.02)",
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{item.taskId || item.file}</span>
                      {item.riskTier && (
                        <span style={{ fontSize: 10, color: RISK_COLORS[item.riskTier] || "#888", fontFamily: "monospace" }}>
                          {item.riskTier}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        {item.approvedAt?.slice(0, 10) || item.deniedAt?.slice(0, 10) || ""}
                      </span>
                      <div style={{ backgroundColor: `${color}20`, borderRadius: 4, padding: "2px 6px" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color, textTransform: "uppercase" as any }}>
                          {status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Policies Tab */}
      {tab === "policies" && (
        <>
          {rules.length === 0 ? (
            <div style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>No governance policies configured</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rules.map((rule: any, i: number) => (
                <div key={i} style={{ backgroundColor: "rgba(22,22,22,0.6)", borderRadius: 12, padding: 20, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>#{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{rule.name || rule.trigger || `Rule ${i + 1}`}</span>
                        {rule.enabled === false && (
                          <div style={{ backgroundColor: "rgba(148,163,184,0.15)", borderRadius: 4, padding: "2px 6px" }}>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>DISABLED</span>
                          </div>
                        )}
                      </div>
                      {rule.condition && (
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                          {typeof rule.condition === "string" ? rule.condition : JSON.stringify(rule.condition)}
                        </span>
                      )}
                      {rule.when && (
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                          When: {JSON.stringify(rule.when)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {rule.action && (
                        <span style={{ fontSize: 12, color: "#6c5ce7" }}>Action: {rule.action}</span>
                      )}
                      {Array.isArray(rule.then) && (
                        <span style={{ fontSize: 12, color: "#6c5ce7" }}>
                          Effect: {rule.then.map((t: any) => t?.effect || "—").join(", ")}
                        </span>
                      )}
                      {rule.priority != null && (
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Priority: {rule.priority}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectedItem && (
        <DetailPanel
          title={selectedItem.taskId || selectedItem.file || "Details"}
          data={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
