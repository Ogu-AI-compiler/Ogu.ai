/**
 * AgentCard.tsx — Slice 378
 * Displays a single marketplace agent card.
 */

import { useState } from "react";
import { api } from "@/lib/api";

export interface MarketplaceAgent {
  agent_id: string;
  name: string;
  role: string;
  specialty: string;
  tier: number;
  skills: string[];
  dna: Record<string, string>;
  capacity_units: number;
  stats: {
    utilization_units: number;
    success_rate: number;
    projects_completed: number;
  };
  price: number;
  status: string;
}

interface AgentCardProps {
  agent: MarketplaceAgent;
  projectId?: string;
  onHired?: () => void;
}

function CapacityBar({ used, cap }: { used: number; cap: number }) {
  const pct = cap > 0 ? Math.round((used / cap) * 100) : 0;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
        <span>Capacity</span>
        <span>{used}/{cap} units</span>
      </div>
      <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct > 80 ? "var(--error)" : "var(--accent)", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

const TIER_COLORS: Record<number, string> = {
  1: "#6b7280",
  2: "#3b82f6",
  3: "#8b5cf6",
  4: "#f59e0b",
};

export function AgentCard({ agent, projectId, onHired }: AgentCardProps) {
  const [hiring, setHiring] = useState(false);
  const [units, setUnits] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierColor = TIER_COLORS[agent.tier] || "#6b7280";
  const topSkills = agent.skills.slice(0, 3);
  const isAvailable = agent.status === "available";
  const utilization = agent.stats?.utilization_units || 0;
  const capacity = agent.capacity_units || 1;

  async function handleHire() {
    if (!projectId) return;
    setHiring(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId:         agent.agent_id,
          projectId,
          allocationUnits: units,
          roleSlot:        agent.role,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Hire failed");
      }
      setShowModal(false);
      onHired?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setHiring(false);
    }
  }

  return (
    <div
      style={{
        background:   "var(--bg-card)",
        border:       "1px solid var(--border)",
        borderRadius: 10,
        padding:      16,
        display:      "flex",
        flexDirection:"column",
        gap:          8,
        position:     "relative",
        opacity:      isAvailable ? 1 : 0.7,
      }}
    >
      {/* Tier badge */}
      <div
        style={{
          position:     "absolute",
          top:          10,
          right:        10,
          background:   tierColor,
          color:        "var(--color-accent-text)",
          fontSize:     11,
          fontWeight:   600,
          padding:      "2px 8px",
          borderRadius: 20,
        }}
      >
        T{agent.tier}
      </div>

      {/* Name + role */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {agent.role} · {agent.specialty}
        </div>
      </div>

      {/* Skills */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {topSkills.map(skill => (
          <span key={skill} style={{
            fontSize: 10,
            padding: "2px 6px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text-muted)",
          }}>
            {skill}
          </span>
        ))}
      </div>

      {/* DNA */}
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {agent.dna?.work_style} · {agent.dna?.communication_style}
      </div>

      {/* Capacity bar */}
      <CapacityBar used={utilization} cap={capacity} />

      {/* Price + Hire button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>
          ${agent.price}/task
        </div>
        {projectId && isAvailable && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              background:   "var(--accent)",
              color:        "#fff",
              border:       "none",
              borderRadius: 6,
              padding:      "5px 12px",
              fontSize:     12,
              fontWeight:   600,
              cursor:       "pointer",
            }}
          >
            Hire
          </button>
        )}
      </div>

      {/* Hire modal */}
      {showModal && (
        <div
          style={{
            position:   "fixed",
            inset:      0,
            background: "rgba(0,0,0,0.5)",
            display:    "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex:     1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:   "var(--bg-card)",
              border:       "1px solid var(--border)",
              borderRadius: 12,
              padding:      24,
              minWidth:     300,
              display:      "flex",
              flexDirection:"column",
              gap:          12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Hire {agent.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {agent.role} · Tier {agent.tier} · ${agent.price}/task
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Allocation Units (1–{capacity - utilization})
              </label>
              <input
                type="number"
                min={1}
                max={capacity - utilization}
                value={units}
                onChange={e => setUnits(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 14,
                }}
              />
            </div>

            {error && <div style={{ color: "var(--error)", fontSize: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleHire}
                disabled={hiring}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--accent)", color: "var(--color-accent-text)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >
                {hiring ? "Hiring..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
