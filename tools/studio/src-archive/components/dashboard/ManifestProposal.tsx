import { useStore } from "@/lib/store";
import { api } from "@/lib/api";

const TRIGGER_LABELS: Record<string, string> = {
  phase_transition: "Phase Change",
  progress_milestone: "Milestone",
  budget_threshold: "Budget",
  error_spike: "Error Spike",
};

export function ManifestProposal() {
  const proposal = useStore((s) => s.manifestProposal);
  const setManifestProposal = useStore((s) => s.setManifestProposal);

  if (!proposal) return null;

  const handleApprove = async () => {
    try {
      console.log("[manifest] Approving:", proposal.slug, proposal.id);
      await api.applyManifest(proposal.slug, proposal.id);
      setManifestProposal(null);
    } catch (err) {
      console.error("[manifest] Approve failed:", err);
      // Still clear the card on error so user isn't stuck
      setManifestProposal(null);
    }
  };

  const handleDismiss = async () => {
    try {
      console.log("[manifest] Dismissing:", proposal.slug, proposal.id);
      await api.dismissManifest(proposal.slug, proposal.id);
      setManifestProposal(null);
    } catch (err) {
      console.error("[manifest] Dismiss failed:", err);
      setManifestProposal(null);
    }
  };

  const triggerLabel = TRIGGER_LABELS[proposal.trigger] || proposal.trigger;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-[360px]" style={{ pointerEvents: "auto" }}>
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          backgroundColor: "var(--color-bg-card, #1a1a2e)",
          border: "1px solid var(--color-border, #2a2a3e)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>Layout Suggestion</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}
          >
            {triggerLabel}
          </span>
        </div>

        {/* Summary */}
        {proposal.detail && (
          <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{proposal.detail}</p>
        )}

        {/* Operation pills */}
        <div className="flex flex-wrap gap-1.5">
          {proposal.ops?.map((op: any, i: number) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md"
              style={{ backgroundColor: "rgba(74,222,128,0.08)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.15)" }}
            >
              <span style={{ opacity: 0.6 }}>+</span>
              {op.action === "add_screen" ? `${op.label} screen` : op.action === "add_widget" ? `${op.label} widget` : op.label}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleApprove}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            Approve
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
            style={{ backgroundColor: "transparent", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
