/**
 * AgentCard.tsx — LinkedIn-style agent profile row
 * Each agent "sells themselves" with a bio, pitch, avatar, and skills.
 */

import { useState, useMemo } from "react";
import Avatar from "react-nice-avatar";
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
  avatar?: Record<string, string>;
}

interface AgentCardProps {
  agent: MarketplaceAgent;
  projectId?: string;
  onHired?: () => void;
}

const TIER_LABELS: Record<number, string> = { 1: "Junior", 2: "Mid-Level", 3: "Senior", 4: "Principal" };
const TIER_COLORS: Record<number, string> = { 1: "#6b7280", 2: "#3b82f6", 3: "#8b5cf6", 4: "#f59e0b" };
const TIER_MODELS: Record<number, string> = { 1: "Haiku", 2: "Sonnet", 3: "Sonnet", 4: "Opus" };

const ROLE_AVATARS: Record<string, { bg: string; emoji: string }> = {
  PM:        { bg: "#dbeafe", emoji: "📋" },
  Architect: { bg: "#ede9fe", emoji: "🏗️" },
  Engineer:  { bg: "#d1fae5", emoji: "⚙️" },
  QA:        { bg: "#fef3c7", emoji: "🔍" },
  DevOps:    { bg: "#fce7f3", emoji: "🚀" },
  Security:  { bg: "#fee2e2", emoji: "🛡️" },
  Doc:       { bg: "#e0e7ff", emoji: "📝" },
};

const PITCHES: Record<string, string[]> = {
  PM: [
    "I turn chaos into roadmaps. Give me ambiguity, I'll give you a sprint plan.",
    "Requirements are my love language. I don't just manage — I align.",
    "I've shipped 0-to-1 products and kept stakeholders happy doing it.",
    "I see the forest AND the trees. Let me own your product vision.",
  ],
  Architect: [
    "I design systems that don't break at 3am. Scalability is not an afterthought.",
    "I've untangled monoliths and designed microservices that actually make sense.",
    "Give me your hardest constraint — I'll find an elegant solution.",
    "I think in systems, communicate in diagrams, and deliver in contracts.",
  ],
  Engineer: [
    "Clean code isn't a buzzword for me — it's how I ship fast AND right.",
    "I write code that my future self will thank me for. Zero tech-debt tolerance.",
    "I don't just implement — I question, optimize, and bulletproof.",
    "Tests first, ship fast, refactor relentlessly. That's my loop.",
  ],
  QA: [
    "I break things so your users don't. Every edge case is my personal challenge.",
    "My test suites catch bugs before they become incidents.",
    "Quality isn't a gate — it's a mindset. I embed it into every sprint.",
    "I've caught production bugs that saved companies millions. Hire me.",
  ],
  DevOps: [
    "CI/CD isn't magic — it's discipline. I make deploys boring (in a good way).",
    "I automate everything. If you're doing it twice, I'll script it.",
    "Zero-downtime deployments, observable systems, automated rollbacks. That's my stack.",
    "Infrastructure as code, always. No snowflake servers on my watch.",
  ],
  Security: [
    "I think like an attacker to build like a defender. Your threats are my speciality.",
    "Compliance is the floor, not the ceiling. I raise your security bar.",
    "I've hardened systems from startup MVPs to enterprise platforms.",
    "Zero-trust isn't paranoia — it's architecture. Let me secure your stack.",
  ],
  Doc: [
    "Great docs are a product feature. I write the kind developers actually read.",
    "I bridge the gap between code and comprehension.",
    "API docs, user guides, architecture diagrams — I make complex things clear.",
    "Documentation debt is real. I eliminate it systematically.",
  ],
};

function generateBio(agent: MarketplaceAgent): string {
  const tierLabel = TIER_LABELS[agent.tier] || "Mid-Level";
  const specialty = agent.specialty.replace(/-/g, " ");
  const strength = agent.dna?.strength_bias || "analytical";
  const workStyle = agent.dna?.work_style?.replace(/-/g, " ") || "async-first";
  const comm = agent.dna?.communication_style || "concise";

  return `${tierLabel} ${agent.role} specializing in ${specialty}. ${capitalize(strength)} problem-solver who thrives in ${workStyle} environments. Known for ${comm} communication and a ${agent.dna?.risk_appetite || "balanced"} approach to risk.`;
}

function generatePitch(agent: MarketplaceAgent): string {
  const rolePitches = PITCHES[agent.role] || PITCHES.Engineer;
  // Deterministic pick based on agent name hash
  const hash = agent.name.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return rolePitches[Math.abs(hash) % rolePitches.length];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getInitials(name: string): string {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

export function AgentCard({ agent, projectId, onHired }: AgentCardProps) {
  const [hiring, setHiring] = useState(false);
  const [units, setUnits] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierColor = TIER_COLORS[agent.tier] || "#6b7280";
  const tierLabel = TIER_LABELS[agent.tier] || "Mid";
  const modelLabel = TIER_MODELS[agent.tier] || "Sonnet";
  const isAvailable = agent.status === "available";
  const utilization = agent.stats?.utilization_units || 0;
  const capacity = agent.capacity_units || 1;
  const available = capacity - utilization;
  const successRate = Math.round((agent.stats?.success_rate || 0) * 100);

  const bio = useMemo(() => generateBio(agent), [agent]);
  const pitch = useMemo(() => generatePitch(agent), [agent]);

  const roleInfo = ROLE_AVATARS[agent.role] || { bg: "#e5e7eb", emoji: "🤖" };

  async function handleHire() {
    if (!projectId) return;
    setHiring(true);
    setError(null);
    try {
      await api.hireMarketplaceAgent(agent.agent_id, projectId, units, agent.role);
      setShowModal(false);
      onHired?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setHiring(false);
    }
  }

  return (
    <>
      {/* LinkedIn-style card: banner → avatar overlap → centered info → hire button */}
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          opacity: isAvailable ? 1 : 0.5,
          background: "linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 2.45%, rgba(255,255,255,0) 126.14%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.12) inset, -1px -2.2px 0.5px -1.8px rgba(255,255,255,0.12) inset",
          transition: "box-shadow 0.15s, transform 0.15s, border-color 0.15s",
          position: "relative",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        {/* Banner */}
        <div style={{
          height: 72,
          background: `linear-gradient(135deg, ${roleInfo.bg}44 0%, ${tierColor}33 100%)`,
          borderBottom: "none",
          position: "relative",
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "8px 10px",
        }}>
          <div style={{ display: "flex", gap: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "2px 9px",
              borderRadius: 20,
              border: `1px solid ${tierColor}66`,
              color: tierColor,
              background: `rgba(10,10,10,0.55)`,
              backdropFilter: "blur(4px)",
              whiteSpace: "nowrap",
            }}>
              {tierLabel}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 500, padding: "2px 9px",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.7)",
              background: "rgba(10,10,10,0.55)",
              backdropFilter: "blur(4px)",
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}>
              ✦ {modelLabel}
            </span>
          </div>
        </div>

        {/* Avatar — overlapping banner */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: -30, position: "relative", zIndex: 1 }}>
          <div style={{ position: "relative" }}>
            {agent.avatar ? (
              <Avatar style={{ width: 60, height: 60, border: "3px solid rgba(30,30,30,0.95)", borderRadius: "50%" }} {...agent.avatar as any} />
            ) : (
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: roleInfo.bg,
                border: "3px solid rgba(30,30,30,0.95)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
              }}>
                {roleInfo.emoji}
              </div>
            )}
            {isAvailable && (
              <div style={{
                position: "absolute", bottom: 3, right: 3,
                width: 12, height: 12, borderRadius: "50%",
                background: "rgba(99,241,157,0.9)", border: "2px solid rgba(18,18,18,0.95)",
                boxShadow: "0 0 6px rgba(99,241,157,0.5)",
              }} />
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "10px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
          {/* Name */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text, #fff)", textAlign: "center" }}>
              {agent.name}
            </span>
          </div>

          {/* Role · Specialty */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
            {agent.role} · {agent.specialty.replace(/-/g, " ")}
          </div>


          {/* Stats row */}
          <div style={{
            marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.35)",
            whiteSpace: "nowrap", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            <span style={{ color: successRate >= 80 ? "rgba(99,241,157,0.8)" : "rgba(255,255,255,0.5)", fontWeight: 600 }}>{successRate}% success</span>
            <span style={{ margin: "0 5px" }}>·</span>
            <span>{agent.stats?.projects_completed || 0} projects</span>
            <span style={{ margin: "0 5px" }}>·</span>
            <span style={{ color: "rgba(99,241,157,0.7)", fontWeight: 600 }}>${agent.price}/task</span>
          </div>

          {/* Skills */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-start", marginTop: 6, width: "100%" }}>
            {agent.skills.slice(0, 3).map(skill => (
              <span key={skill} style={{
                fontSize: 10, padding: "2px 8px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap",
              }}>
                {skill}
              </span>
            ))}
            {agent.skills.length > 3 && (
              <span style={{ fontSize: 10, color: "rgba(99,241,157,0.6)", padding: "2px 4px" }}>
                +{agent.skills.length - 3}
              </span>
            )}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Hire button + availability */}
          <div style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            {/* Availability */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: available > 0 ? "rgba(99,241,157,0.9)" : "rgba(239,68,68,0.8)",
                boxShadow: available > 0 ? "0 0 5px rgba(99,241,157,0.5)" : "none",
              }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                {available}/{capacity}
              </span>
            </div>

            {projectId && isAvailable ? (
              <button
                onClick={() => setShowModal(true)}
                style={{
                  flex: 1, height: 32,
                  borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(70,70,70,0.3)",
                  boxShadow: "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset",
                  color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  transition: "box-shadow 0.15s, background 0.15s, transform 0.15s, border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "rgba(99,241,157,0.7) -8px -6px 4px -8px inset, rgba(255,255,255,0.5) 6px 6px 4px -5px inset, 0 0 14px rgba(99,241,157,0.3) inset, 0 0 16px rgba(99,241,157,0.18)";
                  e.currentTarget.style.background = "rgba(99,241,157,0.24)";
                  e.currentTarget.style.borderColor = "rgba(99,241,157,0.3)";
                  e.currentTarget.style.color = "rgba(99,241,157,0.9)";
                  e.currentTarget.style.transform = "translateY(-1px) scale(1.01)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "rgba(99,241,157,0.22) -8px -6px 4px -8px inset, rgba(255,255,255,0.2) 6px 6px 4px -5px inset";
                  e.currentTarget.style.background = "rgba(70,70,70,0.3)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                }}
              >
                + Hire
              </button>
            ) : !projectId && isAvailable ? (
              <div style={{
                width: "100%", padding: "8px 0", textAlign: "center",
                fontSize: 11, color: "rgba(255,255,255,0.3)",
              }}>
                Select a project to hire
              </div>
            ) : (
              <div style={{
                width: "100%", padding: "8px 0", textAlign: "center",
                borderRadius: 24, border: "1px solid rgba(239,68,68,0.3)",
                fontSize: 12, color: "rgba(239,68,68,0.6)",
              }}>
                Unavailable
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hire modal */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(18,18,18,0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6), 1.1px 2.2px 0.5px -1.8px rgba(255,255,255,0.18) inset",
              borderRadius: 20, padding: 28, minWidth: 360, maxWidth: 420,
              display: "flex", flexDirection: "column", gap: 16,
            }}
          >
            {/* Modal header with avatar */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flexShrink: 0 }}>
                {agent.avatar ? (
                  <Avatar style={{ width: 44, height: 44 }} {...agent.avatar as any} />
                ) : (
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: ROLE_AVATARS[agent.role]?.bg || "#e5e7eb",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                  }}>
                    {ROLE_AVATARS[agent.role]?.emoji || "🤖"}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--color-text, #fff)" }}>Hire {agent.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                  {tierLabel} {agent.role} · ${agent.price}/task
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontStyle: "italic" }}>
              "{pitch}"
            </div>

            <div>
              <label style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 4 }}>
                Allocation Units (1–{available})
              </label>
              <input
                type="number" min={1} max={available} value={units}
                onChange={e => setUnits(Number(e.target.value))}
                style={{
                  width: "100%", padding: "8px 12px",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)", color: "var(--color-text, #fff)", fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {error && <div style={{ color: "#ef4444", fontSize: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "8px 16px", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13,
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
              >
                Cancel
              </button>
              <button
                onClick={handleHire} disabled={hiring}
                style={{
                  padding: "8px 20px", borderRadius: 10,
                  background: "linear-gradient(0deg, rgba(99,241,157,0) 0%, rgba(99,241,157,0.1) 2.45%, rgba(99,241,157,0) 126.14%)",
                  border: "1px solid rgba(99,241,157,0.4)",
                  color: "var(--color-text, #fff)",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                  boxShadow: "1.1px 2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, -1px -2.2px 0.5px -1.8px rgba(99,241,157,0.9) inset, 0 0 12px rgba(99,241,157,0.1)",
                  opacity: hiring ? 0.6 : 1,
                  transition: "opacity 0.15s, border-color 0.15s",
                }}
              >
                {hiring ? "Hiring..." : "Confirm Hire"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: accent ? "rgba(99,241,157,0.9)" : "rgba(255,255,255,0.8)", marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}
