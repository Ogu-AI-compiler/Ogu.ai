import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { ActionButton } from "@/components/shared/ActionButton";

const RISK_COLORS: Record<string, string> = {
  low: "#4ade80",
  medium: "#facc15",
  high: "#f87171",
  critical: "#ef4444",
};

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 0) return "just now";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ApprovalPanel() {
  const pendingApprovals = useStore((s) => s.pendingApprovals);
  const setPendingApprovals = useStore((s) => s.setPendingApprovals);
  const resolveApprovalStore = useStore((s) => s.resolveApproval);
  const activeFeature = useStore((s) => s.activeFeature);
  const activeProject = useStore((s) => s.activeProjectSlug);
  const slug = activeFeature || activeProject || "";
  const { on } = useSocket();

  const [loading, setLoading] = useState(true);
  const [denyTarget, setDenyTarget] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchApprovals = useCallback(() => {
    if (!slug) { setLoading(false); return; }
    api.getApprovals(slug)
      .then((d) => setPendingApprovals(d.approvals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, setPendingApprovals]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // WebSocket updates
  useEffect(() => {
    const unsub1 = on("governance:pending", () => fetchApprovals());
    const unsub2 = on("governance:resolved", () => fetchApprovals());
    const unsub3 = on("governance:approved", () => fetchApprovals());
    const unsub4 = on("governance:denied", () => fetchApprovals());
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [on, fetchApprovals]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.resolveApproval(slug, id, "approve");
      resolveApprovalStore(id);
    } catch { /* refreshes below */ }
    setActionLoading(null);
    fetchApprovals();
  };

  const handleDeny = async (id: string) => {
    if (!denyReason.trim()) return;
    setActionLoading(id);
    try {
      await api.resolveApproval(slug, id, "deny", denyReason);
      resolveApprovalStore(id);
    } catch { /* refreshes below */ }
    setDenyTarget(null);
    setDenyReason("");
    setActionLoading(null);
    fetchApprovals();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="animate-pulse h-8 w-48 rounded-lg"
          style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
        />
        <div
          className="animate-pulse h-24 w-full rounded-lg"
          style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
        />
      </div>
    );
  }

  if (pendingApprovals.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl"
        style={{
          backgroundColor: "var(--color-bg-card, #1a1a2e)",
          border: "1px solid var(--color-border, #2a2a3e)",
        }}
      >
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted, #7a7a7a)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4" />
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        </svg>
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          No pending approvals -- all clear
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Pending Approvals
          </span>
          <Badge variant="warning">{pendingApprovals.length}</Badge>
        </div>
      </div>

      {/* Approval Cards */}
      {pendingApprovals.map((approval) => {
        const riskColor = RISK_COLORS[approval.riskTier || "medium"] || "#888";
        const isProcessing = actionLoading === approval.id;

        return (
          <div
            key={approval.id}
            className="flex flex-col gap-3 rounded-xl p-4"
            style={{
              backgroundColor: "var(--color-bg-card, #1a1a2e)",
              border: "1px solid var(--color-border, #2a2a3e)",
            }}
          >
            {/* Top row: task name + risk tier */}
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2">
                  <StatusDot color={riskColor} size="md" />
                  <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    {approval.taskName}
                  </span>
                  {approval.riskTier && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${riskColor}20`,
                        color: riskColor,
                      }}
                    >
                      {approval.riskTier}
                    </span>
                  )}
                </div>
                <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  Policy: {approval.policyViolated}
                </span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                {timeAgo(approval.timestamp)}
              </span>
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-4">
              <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                Requested by: <span className="font-mono font-semibold">{approval.requestedBy}</span>
              </span>
              {approval.featureSlug && (
                <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                  {approval.featureSlug}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <ActionButton
                label={isProcessing ? "..." : "Approve"}
                variant="success"
                size="sm"
                onAction={() => handleApprove(approval.id)}
                disabled={isProcessing}
              />
              <ActionButton
                label="Deny"
                variant="danger"
                size="sm"
                onAction={() => setDenyTarget(denyTarget === approval.id ? null : approval.id)}
                disabled={isProcessing}
              />
            </div>

            {/* Deny reason input */}
            {denyTarget === approval.id && (
              <div className="flex flex-col gap-2 pt-1" style={{ borderTop: "1px solid var(--color-border, #2a2a3e)" }}>
                <textarea
                  placeholder="Reason for denial..."
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  rows={2}
                  className="rounded-lg px-3 py-2 text-xs font-mono resize-none"
                  style={{
                    backgroundColor: "var(--color-bg, #0a0a0a)",
                    border: "1px solid var(--color-border, #2a2a3e)",
                    color: "var(--color-text, #e0e0e0)",
                    outline: "none",
                  }}
                />
                <div className="flex gap-2">
                  <ActionButton
                    label="Confirm Deny"
                    variant="danger"
                    size="sm"
                    onAction={() => handleDeny(approval.id)}
                    disabled={!denyReason.trim()}
                  />
                  <ActionButton
                    label="Cancel"
                    variant="ghost"
                    size="sm"
                    onAction={() => { setDenyTarget(null); setDenyReason(""); }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
