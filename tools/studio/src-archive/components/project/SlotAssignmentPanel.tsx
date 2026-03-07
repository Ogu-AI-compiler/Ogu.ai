/**
 * SlotAssignmentPanel.tsx — Slice 441
 * Interactive agent assignment UI for team slots.
 * Shows each team member slot with agent selection dropdown,
 * capacity info, and auto-assign action.
 */

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  member_id: string;
  role_id: string;
  role_display?: string;
  agent_id: string | null;
  agent_name?: string | null;
  status: "active" | "unassigned";
  capacity_units?: number;
  allocated_units?: number;
  optional?: boolean;
}

interface AgentOption {
  agent_id: string;
  name: string;
  role: string;
  tier: number;
  capacity_units: number;
  available_capacity?: number;
}

interface SlotAssignmentProps {
  members: TeamMember[];
  availableAgents: AgentOption[];
  onAssign: (memberId: string, agentId: string) => void;
  onAutoAssign?: () => void;
}

// ── Role emoji ────────────────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SlotAssignmentPanel({
  members,
  availableAgents,
  onAssign,
  onAutoAssign,
}: SlotAssignmentProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});

  const unassignedMembers = members.filter(m => m.status === "unassigned");
  const assignedMembers = members.filter(m => m.status === "active");

  const handleSelect = (memberId: string, agentId: string) => {
    setSelections(prev => ({ ...prev, [memberId]: agentId }));
  };

  const handleAssign = (memberId: string) => {
    const agentId = selections[memberId];
    if (agentId) {
      onAssign(memberId, agentId);
      setSelections(prev => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
    }
  };

  const agentsForRole = (roleId: string) =>
    availableAgents.filter(a => a.role === roleId || a.role === "generalist");

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Header with auto-assign */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={sectionHeader}>
          Slot Assignment ({assignedMembers.length}/{members.length})
        </div>
        {onAutoAssign && unassignedMembers.length > 0 && (
          <button
            onClick={onAutoAssign}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            Auto-Fill All
          </button>
        )}
      </div>

      {/* Slot list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {members.map((member) => {
          const isAssigned = member.status === "active" && member.agent_id;
          const roleAgents = agentsForRole(member.role_id);
          const selectedAgent = selections[member.member_id];

          return (
            <div key={member.member_id} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 6,
              background: isAssigned
                ? "rgba(var(--color-primary-rgb, 99,241,157),0.08)"
                : "rgba(255,255,255,0.03)",
              border: `1px solid ${isAssigned ? "rgba(var(--color-primary-rgb, 99,241,157),0.2)" : "rgba(255,255,255,0.08)"}`,
            }}>
              {/* Role info */}
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {ROLE_EMOJI[member.role_id] || "\u{1F916}"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>
                  {member.role_display || member.role_id.replace(/_/g, " ")}
                </div>
                {isAssigned ? (
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    {member.agent_name || member.agent_id}
                    {member.capacity_units != null && (
                      <span style={{ marginLeft: 6, color: "rgba(255,255,255,0.3)" }}>
                        Capacity: {member.allocated_units || 0}/{member.capacity_units}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--color-warning, #f59e0b)" }}>
                    Unassigned
                  </div>
                )}
              </div>

              {/* Assignment UI for unassigned slots */}
              {!isAssigned && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    value={selectedAgent || ""}
                    onChange={(e) => handleSelect(member.member_id, e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      background: "var(--color-bg-card, #242424)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "var(--color-text)",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Select agent...</option>
                    {roleAgents.map(agent => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.name} (T{agent.tier}, cap:{agent.available_capacity ?? agent.capacity_units})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign(member.member_id)}
                    disabled={!selectedAgent}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: selectedAgent ? "var(--color-accent, var(--color-primary))" : "rgba(255,255,255,0.05)",
                      border: "none",
                      color: selectedAgent ? "#fff" : "rgba(255,255,255,0.3)",
                      cursor: selectedAgent ? "pointer" : "default",
                    }}
                  >
                    Assign
                  </button>
                </div>
              )}

              {/* Status badge */}
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                textTransform: "uppercase",
                color: isAssigned ? "#22c55e" : "#f59e0b",
                background: isAssigned ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
              }}>
                {isAssigned ? "active" : "unassigned"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
