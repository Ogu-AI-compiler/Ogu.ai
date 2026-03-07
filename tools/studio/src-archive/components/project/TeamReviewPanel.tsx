/**
 * TeamReviewPanel.tsx — Slice 440
 * Interactive team review screen shown after CTO planning, before build.
 * Displays blueprint roles with counts, assigned/unassigned status,
 * complexity tier, and approve/modify actions.
 */

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlueprintRole {
  roleId: string;
  count: number;
}

interface Blueprint {
  roles: BlueprintRole[];
}

interface TeamMember {
  member_id: string;
  role_id: string;
  role_display?: string;
  agent_id: string | null;
  agent_name?: string | null;
  status: "active" | "unassigned";
  optional?: boolean;
}

interface TeamReviewProps {
  blueprint: Blueprint;
  team: { members: TeamMember[] };
  complexity?: { score: number; tier: string };
  onApprove: () => void;
  onModify?: (action: { type: "addRole" | "removeRole"; roleId: string }) => void;
}

// ── Role emoji mapping ────────────────────────────────────────────────────────

const ROLE_EMOJI: Record<string, string> = {
  pm: "\u{1F4CB}",
  architect: "\u{1F3D7}\uFE0F",
  backend_engineer: "\u2699\uFE0F",
  frontend_engineer: "\u{1F3A8}",
  qa: "\u{1F50D}",
  devops: "\u{1F527}",
  security: "\u{1F512}",
  designer: "\u270F\uFE0F",
  data_engineer: "\u{1F4CA}",
  ml_engineer: "\u{1F9E0}",
};

// ── Tier colors ───────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

// ── Section header style ──────────────────────────────────────────────────────

const sectionHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TeamReviewPanel({
  blueprint,
  team,
  complexity,
  onApprove,
  onModify,
}: TeamReviewProps) {
  const [approved, setApproved] = useState(false);

  const unassignedCount = team.members.filter(m => m.status === "unassigned").length;
  const activeCount = team.members.filter(m => m.status === "active").length;

  const handleApprove = () => {
    setApproved(true);
    onApprove();
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section header */}
      <div style={{ ...sectionHeader, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span>Team Review</span>
        {complexity && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            color: "var(--color-accent-text)",
            background: TIER_COLOR[complexity.tier] || "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            {complexity.tier}
          </span>
        )}
      </div>

      {/* Blueprint role cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {blueprint.roles.map((role) => {
          const members = team.members.filter(m => m.role_id === role.roleId);
          const assigned = members.filter(m => m.status === "active").length;

          return (
            <div key={role.roleId} style={{
              padding: "10px 14px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              minWidth: 140,
              position: "relative",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{ROLE_EMOJI[role.roleId] || "\u{1F916}"}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                  {role.roleId.replace(/_/g, " ")}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {assigned}/{role.count} assigned
              </div>
              {assigned < role.count && (
                <div style={{
                  fontSize: 10,
                  color: "var(--color-warning, #f59e0b)",
                  marginTop: 4,
                }}>
                  {role.count - assigned} Unassigned
                </div>
              )}
              {/* Remove role option */}
              {onModify && (
                <button
                  onClick={() => onModify({ type: "removeRole", roleId: role.roleId })}
                  style={{
                    position: "absolute", top: 6, right: 6,
                    background: "none", border: "none",
                    color: "rgba(255,255,255,0.25)", cursor: "pointer",
                    fontSize: 12, padding: 2,
                  }}
                  title={`Remove ${role.roleId}`}
                >
                  \u00D7
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned warning */}
      {unassignedCount > 0 && (
        <div style={{
          padding: "8px 12px",
          borderRadius: 6,
          background: "rgba(245,158,11,0.1)",
          border: "1px solid rgba(245,158,11,0.2)",
          fontSize: 12,
          color: "var(--color-warning, #f59e0b)",
          marginBottom: 16,
        }}>
          {unassignedCount} unassigned slot{unassignedCount !== 1 ? "s" : ""} remaining
        </div>
      )}

      {/* Summary line */}
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
        {activeCount} active · {unassignedCount} unassigned · {blueprint.roles.length} roles
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleApprove}
          disabled={approved}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: approved ? "rgba(34,197,94,0.2)" : "var(--color-accent, var(--color-primary))",
            border: "none",
            color: "var(--color-accent-text)",
            cursor: approved ? "default" : "pointer",
            opacity: approved ? 0.7 : 1,
          }}
        >
          {approved ? "Approved" : "Approve Team"}
        </button>
        {onModify && (
          <button
            onClick={() => onModify({ type: "addRole", roleId: "" })}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            Modify Team
          </button>
        )}
      </div>
    </div>
  );
}
