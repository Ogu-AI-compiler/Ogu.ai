/**
 * Marketplace.tsx — Slice 378
 * Page showing the agent marketplace grid with filters.
 */

import { useState, useEffect } from "react";
import { AgentCard, MarketplaceAgent } from "@/components/marketplace/AgentCard";
import { useStore } from "@/lib/store";

const ROLES      = ["PM","Architect","Engineer","QA","DevOps","Security","Doc"];
const TIERS      = [1, 2, 3, 4];

export function Marketplace() {
  const [agents, setAgents]           = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [roleFilter, setRoleFilter]   = useState<string>("");
  const [tierFilter, setTierFilter]   = useState<number | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [populating, setPopulating]   = useState(false);

  const projectSlug = useStore((s) => s.activeProjectSlug);

  async function fetchAgents() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (roleFilter)   params.set("role", roleFilter);
      if (tierFilter)   params.set("tier", String(tierFilter));
      if (availableOnly) params.set("available", "true");

      const res = await fetch(`/api/marketplace/agents?${params}`);
      if (!res.ok) throw new Error("Failed to fetch agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function populate() {
    setPopulating(true);
    try {
      await fetch("/api/marketplace/agents/populate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 30 }) });
      await fetchAgents();
    } finally {
      setPopulating(false);
    }
  }

  useEffect(() => { fetchAgents(); }, [roleFilter, tierFilter, availableOnly]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Agent Marketplace</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Hire professional AI agents for your projects
            </p>
          </div>
          <button
            onClick={populate}
            disabled={populating}
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {populating ? "Populating..." : "Populate (30)"}
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12 }}
          >
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select
            value={tierFilter ?? ""}
            onChange={e => setTierFilter(e.target.value ? Number(e.target.value) : null)}
            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12 }}
          >
            <option value="">All Tiers</option>
            {TIERS.map(t => <option key={t} value={t}>Tier {t}</option>)}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={e => setAvailableOnly(e.target.checked)}
            />
            Available only
          </label>

          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Agent grid */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {loading && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 40 }}>Loading agents...</div>
        )}
        {error && (
          <div style={{ textAlign: "center", color: "var(--error)", marginTop: 40 }}>{error}</div>
        )}
        {!loading && !error && agents.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: 40 }}>
            No agents found.{" "}
            <button onClick={populate} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
              Populate marketplace
            </button>
          </div>
        )}
        {!loading && !error && agents.length > 0 && (
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap:                 16,
          }}>
            {agents.map(agent => (
              <AgentCard
                key={agent.agent_id}
                agent={agent}
                projectId={projectSlug || undefined}
                onHired={fetchAgents}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
