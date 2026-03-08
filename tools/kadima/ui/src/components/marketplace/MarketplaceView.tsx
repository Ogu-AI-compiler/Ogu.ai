/**
 * MarketplaceView.tsx — LinkedIn-style agent hiring board
 * List layout with filters for role, specialty, and tier.
 */

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/store";
import { Icon, icons } from "@/lib/icons";
import { AgentCard, type MarketplaceAgent } from "./AgentCard";

const ALL_ROLES = ["PM", "Architect", "Engineer", "QA", "DevOps", "Security", "Doc"];
const ALL_SPECIALTIES = [
  "frontend", "backend", "mobile", "data", "platform",
  "security-audit", "ai-ml", "product", "docs-api", "distributed",
];
const ALL_TIERS = [1, 2, 3, 4];
const TIER_LABELS: Record<number, string> = { 1: "Junior", 2: "Mid-Level", 3: "Senior", 4: "Principal" };

type SortField = "name" | "price" | "tier" | "success_rate";

export function MarketplaceView() {
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<string>>(new Set());
  const [selectedTiers, setSelectedTiers] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<SortField>("tier");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const activeProjectSlug = useStore((s) => s.activeProjectSlug);

  useEffect(() => {
    loadAgents();
  }, []);

  function loadAgents() {
    setLoading(true);
    api.getMarketplaceAgents()
      .then((data) => setAgents(data.agents || []))
      .catch(() => {
        // Fallback to old endpoint
        api.getAgents()
          .then((data) => setAgents(data.agents || []))
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(() => {
    let result = agents;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.specialty.toLowerCase().includes(q) ||
        a.skills.some(s => s.toLowerCase().includes(q))
      );
    }

    if (selectedRoles.size > 0) {
      result = result.filter(a => selectedRoles.has(a.role));
    }
    if (selectedSpecialties.size > 0) {
      result = result.filter(a => selectedSpecialties.has(a.specialty));
    }
    if (selectedTiers.size > 0) {
      result = result.filter(a => selectedTiers.has(a.tier));
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "price": cmp = a.price - b.price; break;
        case "tier": cmp = a.tier - b.tier; break;
        case "success_rate": cmp = (a.stats?.success_rate || 0) - (b.stats?.success_rate || 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [agents, search, selectedRoles, selectedSpecialties, selectedTiers, sortBy, sortDir]);

  function toggleFilter<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  }

  const availableCount = agents.filter(a => a.status === "available").length;
  const activeFilters = selectedRoles.size + selectedSpecialties.size + selectedTiers.size;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Row 1 — Title */}
        <div style={{
          padding: "24px 28px 20px",
          background: "linear-gradient(180deg, rgba(99,241,157,0.04) 0%, transparent 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "rgba(99,241,157,0.1)", border: "1px solid rgba(99,241,157,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 0 20px rgba(99,241,157,0.08)",
          }}>
            <Icon d={icons.marketplace} size={20} stroke="rgba(99,241,157,0.8)" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.4px" }}>
              Talent Board
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(99,241,157,0.9)", boxShadow: "0 0 6px rgba(99,241,157,0.6)" }} />
                <span style={{ fontSize: 12, color: "rgba(99,241,157,0.8)", fontWeight: 500 }}>{availableCount} available</span>
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>·</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{agents.length} total</span>
            </div>
          </div>
        </div>

        {/* Row 2 — Filters (left) + Search + Sort (right) */}
        <div style={{ padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

          {/* Left: filters + sort */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FilterSelect label="Role" options={ALL_ROLES.map(r => ({ value: r, label: r }))}
              selected={selectedRoles} onToggle={(v) => toggleFilter(selectedRoles, v, setSelectedRoles)}
              onClear={() => setSelectedRoles(new Set())} />
            <FilterSelect label="Level" options={ALL_TIERS.map(t => ({ value: String(t), label: TIER_LABELS[t] }))}
              selected={new Set([...selectedTiers].map(String))} onToggle={(v) => toggleFilter(selectedTiers, Number(v), setSelectedTiers)}
              onClear={() => setSelectedTiers(new Set())} />
            <FilterSelect label="Specialty" options={ALL_SPECIALTIES.map(s => ({ value: s, label: s.replace(/-/g, " ") }))}
              selected={selectedSpecialties} onToggle={(v) => toggleFilter(selectedSpecialties, v, setSelectedSpecialties)}
              onClear={() => setSelectedSpecialties(new Set())} />
            <SortSelect
              value={`${sortBy}-${sortDir}`}
              onChange={(v) => { const [f, d] = v.split("-"); setSortBy(f as SortField); setSortDir(d as "asc" | "desc"); }}
              options={[
                { value: "tier-desc", label: "Tier: High → Low" },
                { value: "tier-asc", label: "Tier: Low → High" },
                { value: "price-asc", label: "Price: Low → High" },
                { value: "price-desc", label: "Price: High → Low" },
                { value: "success_rate-desc", label: "Success Rate" },
                { value: "name-asc", label: "Name: A → Z" },
              ]}
            />
            {activeFilters > 0 && (
              <button onClick={() => { setSelectedRoles(new Set()); setSelectedSpecialties(new Set()); setSelectedTiers(new Set()); }}
                style={{
                  fontSize: 11, padding: "5px 10px", borderRadius: 20,
                  border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
                  color: "rgba(239,68,68,0.7)", cursor: "pointer", whiteSpace: "nowrap",
                }}>Clear</button>
            )}
          </div>

          {/* Right: Search */}
          <div style={{ position: "relative", width: 260 }}>
            <Icon d={icons.search} size={14} stroke="rgba(255,255,255,0.25)"
              style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%", padding: "8px 32px 8px 36px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                color: "var(--color-text)", fontSize: 13, outline: "none", boxSizing: "border-box",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(99,241,157,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,241,157,0.06)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.3)", fontSize: 16, lineHeight: 1, padding: 2,
              }}>×</button>
            )}
          </div>

        </div>

      </div>

      {/* Agent grid */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
            <Icon d={icons.loader} size={20} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {search || activeFilters > 0
                ? "No agents match your filters."
                : "No agents available. Generate some first."}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Showing {filtered.length} of {agents.length} agents
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}>
              {filtered.map(agent => (
                <AgentCard
                  key={agent.agent_id}
                  agent={agent}
                  projectId={activeProjectSlug || undefined}
                  onHired={loadAgents}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 20, cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.55)",
          fontSize: 12, fontWeight: 400,
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}
      >
        {current?.label}
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
            background: "rgba(18,18,18,0.97)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12, padding: "6px 0", minWidth: 160,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
          }}>
            {options.map(opt => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "calc(100% - 12px)", textAlign: "left",
                    margin: "0 6px", padding: "7px 10px", background: "none", border: "none",
                    borderRadius: 7, fontSize: 12, cursor: "pointer",
                    color: active ? "rgba(99,241,157,0.9)" : "rgba(255,255,255,0.65)",
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                    border: active ? "1px solid rgba(99,241,157,0.6)" : "1px solid rgba(255,255,255,0.2)",
                    background: active ? "rgba(99,241,157,0.2)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: "rgba(99,241,157,0.9)",
                  }}>
                    {active ? "✓" : ""}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label, options, selected, onToggle, onClear,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = selected.size;
  const isActive = count > 0;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 20, cursor: "pointer",
          border: isActive ? "1px solid rgba(99,241,157,0.4)" : "1px solid rgba(255,255,255,0.12)",
          background: isActive ? "rgba(99,241,157,0.08)" : "rgba(255,255,255,0.04)",
          color: isActive ? "rgba(99,241,157,0.9)" : "rgba(255,255,255,0.55)",
          fontSize: 12, fontWeight: isActive ? 600 : 400,
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}
      >
        {label}
        {isActive && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: "rgba(99,241,157,0.2)", borderRadius: 10,
            padding: "0px 5px", color: "rgba(99,241,157,0.9)",
          }}>{count}</span>
        )}
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
            background: "rgba(18,18,18,0.97)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12, padding: "6px 0", minWidth: 160,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
          }}>
            {isActive && (
              <button
                onClick={() => { onClear(); setOpen(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "6px 14px", background: "none", border: "none",
                  fontSize: 11, color: "rgba(239,68,68,0.7)", cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4,
                }}
              >
                Clear
              </button>
            )}
            {options.map(opt => {
              const active = selected.has(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => onToggle(opt.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "calc(100% - 12px)", textAlign: "left",
                    margin: "0 6px", padding: "7px 10px", background: "none", border: "none",
                    borderRadius: 7, fontSize: 12, cursor: "pointer", textTransform: "capitalize",
                    color: active ? "rgba(99,241,157,0.9)" : "rgba(255,255,255,0.65)",
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                    border: active ? "1px solid rgba(99,241,157,0.6)" : "1px solid rgba(255,255,255,0.2)",
                    background: active ? "rgba(99,241,157,0.2)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: "rgba(99,241,157,0.9)",
                  }}>
                    {active ? "✓" : ""}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
